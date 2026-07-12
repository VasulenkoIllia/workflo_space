import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, OrderType, BillingType } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency, requireOwnerAgency } from '../../auth/tenant.js'
import { type AccessClaims, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { slaDueDates } from '../../services/sla.js'

/**
 * S10-01: шаблони замовлень (спека 02-orders §E). Каталог owner-only (CRUD),
 * створення з шаблону — команда: POST /workspace/orders/from-template/:templateId.
 * defaultStages/nomenclatureCode лежать у моделі spec-compat — стадії/номенклатура
 * підключаться окремими зрізами.
 */
const TEMPLATE_SELECT = {
  id: true,
  name: true,
  type: true,
  defaultTitle: true,
  defaultDescription: true,
  defaultBillingType: true,
  defaultPrice: true,
  isActive: true,
} as const

const createTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.nativeEnum(OrderType).optional(),
    defaultTitle: z.string().trim().min(1).max(200),
    defaultDescription: z.string().trim().max(5000).nullish(),
    defaultBillingType: z.nativeEnum(BillingType).optional(),
    defaultPrice: z.number().nonnegative().max(1_000_000_000).nullish(),
  })
  .strict()

const fromTemplateSchema = z
  .object({
    companyId: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

function assertTeam(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isInternalTeam(user)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
  }
  return agencyId
}

function assertOwner(user: AccessClaims): string {
  return requireOwnerAgency(user, 'Шаблони редагує лише власник')
}

const orderTemplatesRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/order-templates',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const templates = await withTenant((tx) =>
        tx.orderTemplate.findMany({
          where: { agencyId, isActive: true },
          select: TEMPLATE_SELECT,
          orderBy: { name: 'asc' },
        })
      )
      return reply.send({
        success: true,
        data: {
          templates: templates.map((t) => ({
            ...t,
            defaultPrice: t.defaultPrice ? t.defaultPrice.toFixed(2) : null,
          })),
        },
      })
    }
  )

  fastify.post(
    '/workspace/order-templates',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const input = createTemplateSchema.parse(request.body)
      const dup = await withTenant((tx) =>
        tx.orderTemplate.findFirst({
          where: { agencyId, name: input.name },
          select: { id: true },
        })
      )
      if (dup) throw new AppError(ApiErrorCode.CONFLICT, 'Шаблон із такою назвою вже є', 409)
      const template = await withTenant((tx) =>
        tx.orderTemplate.create({
          data: {
            agencyId,
            name: input.name,
            type: input.type ?? OrderType.CLIENT_ORDER,
            defaultTitle: input.defaultTitle,
            defaultDescription: input.defaultDescription ?? null,
            defaultBillingType: input.defaultBillingType ?? BillingType.FIXED,
            defaultPrice: input.defaultPrice ?? null,
          },
          select: TEMPLATE_SELECT,
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'orders.template_created',
        resourceType: 'order_template',
        resourceId: template.id,
        result: 'allowed',
        metadata: { name: template.name },
      })
      return reply.status(201).send({
        success: true,
        data: {
          template: {
            ...template,
            defaultPrice: template.defaultPrice ? template.defaultPrice.toFixed(2) : null,
          },
        },
      })
    }
  )

  fastify.delete<{ Params: { id: string } }>(
    '/workspace/order-templates/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const res = await withTenant((tx) =>
        tx.orderTemplate.deleteMany({ where: { id: request.params.id, agencyId } })
      )
      if (res.count === 0) throw new AppError(ApiErrorCode.NOT_FOUND, 'Шаблон не знайдено', 404)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'orders.template_deleted',
        resourceType: 'order_template',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  // ── Створення замовлення з шаблону (команда) ───────────────────────────────────
  fastify.post<{ Params: { templateId: string } }>(
    '/workspace/orders/from-template/:templateId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const input = fromTemplateSchema.parse(request.body)

      const order = await withTenant(async (tx) => {
        const template = await tx.orderTemplate.findFirst({
          where: { id: request.params.templateId, agencyId, isActive: true },
          select: TEMPLATE_SELECT,
        })
        if (!template) throw new AppError(ApiErrorCode.NOT_FOUND, 'Шаблон не знайдено', 404)
        const company = await tx.company.findFirst({
          where: { id: input.companyId, agencyId },
          select: { id: true },
        })
        if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)

        // S10-02: пріоритет шаблонного замовлення — medium (дефолт Order)
        const sla = await slaDueDates(tx, agencyId, 'medium')
        return tx.order.create({
          data: {
            agency: { connect: { id: agencyId } },
            ...sla,
            company: { connect: { id: company.id } },
            createdBy: { connect: { id: request.user.sub } },
            title: input.title ?? template.defaultTitle,
            description: template.defaultDescription,
            type: template.type,
            billingType: template.defaultBillingType,
            // Prisma-enum vs TS-enum — однакові рядкові значення, порівнюємо як рядки
            fixedPrice:
              (template.defaultBillingType as string) === (BillingType.FIXED as string)
                ? template.defaultPrice
                : null,
            hourlyRate:
              (template.defaultBillingType as string) === (BillingType.HOURLY as string)
                ? template.defaultPrice
                : null,
          },
          select: { id: true, title: true },
        })
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'order.created_from_template',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { templateId: request.params.templateId, companyId: input.companyId },
      })
      return reply.status(201).send({ success: true, data: { order } })
    }
  )

  return Promise.resolve()
}

export default orderTemplatesRoute
