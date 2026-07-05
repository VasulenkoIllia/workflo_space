import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { type AccessClaims, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { requireTeamOrder } from './access.js'

/**
 * S10-01: теги замовлень (спека 02-orders §B). Каталог — per-agency, CRUD owner-only;
 * призначення на замовлення — вся команда (replace-set, join несе agencyId для RLS).
 */
const createTagSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Колір — hex #RRGGBB')
      .nullish(),
  })
  .strict()

const setTagsSchema = z.object({ tagIds: z.array(z.string().min(1)).max(20) }).strict()

function assertTeam(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isInternalTeam(user)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
  }
  return agencyId
}

function assertOwner(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Каталог тегів редагує лише власник', 403)
  }
  return agencyId
}

const orderTagsRoute: FastifyPluginAsync = (fastify) => {
  // ── Каталог ────────────────────────────────────────────────────────────────────
  fastify.get(
    '/workspace/order-tags',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const tags = await withTenant((tx) =>
        tx.orderTag.findMany({
          where: { agencyId },
          select: { id: true, name: true, color: true },
          orderBy: { name: 'asc' },
        })
      )
      return reply.send({ success: true, data: { tags } })
    }
  )

  fastify.post(
    '/workspace/order-tags',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const input = createTagSchema.parse(request.body)
      const dup = await withTenant((tx) =>
        tx.orderTag.findFirst({
          where: { agencyId, name: input.name },
          select: { id: true },
        })
      )
      if (dup) throw new AppError(ApiErrorCode.CONFLICT, 'Тег із такою назвою вже є', 409)
      const tag = await withTenant((tx) =>
        tx.orderTag.create({
          data: { agencyId, name: input.name, color: input.color ?? null },
          select: { id: true, name: true, color: true },
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'orders.tag_created',
        resourceType: 'order_tag',
        resourceId: tag.id,
        result: 'allowed',
        metadata: { name: tag.name },
      })
      return reply.status(201).send({ success: true, data: { tag } })
    }
  )

  fastify.delete<{ Params: { id: string } }>(
    '/workspace/order-tags/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const res = await withTenant((tx) =>
        tx.orderTag.deleteMany({ where: { id: request.params.id, agencyId } })
      )
      if (res.count === 0) throw new AppError(ApiErrorCode.NOT_FOUND, 'Тег не знайдено', 404)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'orders.tag_deleted',
        resourceType: 'order_tag',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  // ── Призначення на замовлення (replace-set, команда) ───────────────────────────
  fastify.put<{ Params: { id: string } }>(
    '/orders/:id/tags',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orderId, agencyId } = await requireTeamOrder(request, request.params.id)
      const { tagIds } = setTagsSchema.parse(request.body)

      const tags = await withTenant(async (tx) => {
        // Кожен тег мусить існувати в каталозі ЦІЄЇ агенції (cross-tenant tagId → 400).
        const found = await tx.orderTag.findMany({
          where: { id: { in: tagIds }, agencyId },
          select: { id: true },
        })
        if (found.length !== new Set(tagIds).size) {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Невідомий тег у списку', 400)
        }
        await tx.orderTagAssignment.deleteMany({ where: { orderId } })
        if (tagIds.length > 0) {
          await tx.orderTagAssignment.createMany({
            data: tagIds.map((tagId) => ({ orderId, tagId, agencyId })),
          })
        }
        return tx.orderTagAssignment.findMany({
          where: { orderId },
          select: { tag: { select: { id: true, name: true, color: true } } },
        })
      })

      return reply.send({ success: true, data: { tags: tags.map((t) => t.tag) } })
    }
  )

  return Promise.resolve()
}

export default orderTagsRoute
