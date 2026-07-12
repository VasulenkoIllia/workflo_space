import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency, requireOwnerAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * 02-Б НОМЕНКЛАТУРА (рішення власника 07.07): довідник офіційних позицій «згідно КВЕД».
 * Обирається на замовленні/проекті — її назва друкується в рахунках і актах (специфікація
 * лишається довільною). vatRate закладено на майбутнє (05-Ж) — поки що довідкове поле,
 * ПДВ не рахується. Читає вся команда (селект в оцінці), мутації — owner.
 */
const upsertSchema = z
  .object({
    name: z.string().trim().min(3).max(255),
    code: z.string().trim().max(20).nullable().optional(),
    vatRate: z.number().min(0).max(50).nullable().optional(),
  })
  .strict()
const patchSchema = upsertSchema.partial().extend({ isActive: z.boolean().optional() })

const SELECT = {
  id: true,
  name: true,
  code: true,
  vatRate: true,
  isActive: true,
  updatedAt: true,
} as const

function assertOwner(user: AccessClaims): string {
  return requireOwnerAgency(user, 'Номенклатуру змінює лише власник')
}

const nomenclatureRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/nomenclature',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      requireActiveAgency(request.user)
      const items = await withTenant((tx) =>
        tx.nomenclature.findMany({ orderBy: { name: 'asc' }, select: SELECT })
      )
      return reply.send({ success: true, data: { items } })
    }
  )

  fastify.post(
    '/workspace/nomenclature',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const body = upsertSchema.parse(request.body)
      const item = await withTenant((tx) =>
        tx.nomenclature.create({
          data: {
            agencyId,
            name: body.name,
            code: body.code ?? null,
            vatRate: body.vatRate ?? null,
          },
          select: SELECT,
        })
      ).catch(() => {
        throw new AppError(ApiErrorCode.CONFLICT, 'Така позиція вже існує', 409)
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'nomenclature.created',
        resourceType: 'nomenclature',
        resourceId: item.id,
        result: 'allowed',
        metadata: { name: body.name },
      })
      return reply.status(201).send({ success: true, data: { item } })
    }
  )

  fastify.patch<{ Params: { id: string } }>(
    '/workspace/nomenclature/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const body = patchSchema.parse(request.body)
      const updated = await withTenant((tx) =>
        tx.nomenclature.updateMany({
          where: { id: request.params.id, agencyId },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.code !== undefined ? { code: body.code } : {}),
            ...(body.vatRate !== undefined ? { vatRate: body.vatRate } : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          },
        })
      )
      if (updated.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Позицію не знайдено', 404)
      }
      const item = await withTenant((tx) =>
        tx.nomenclature.findUnique({ where: { id: request.params.id }, select: SELECT })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'nomenclature.updated',
        resourceType: 'nomenclature',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: {},
      })
      return reply.send({ success: true, data: { item } })
    }
  )

  fastify.delete<{ Params: { id: string } }>(
    '/workspace/nomenclature/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      // На позицію можуть посилатись замовлення/проекти (їх рахунки вже друкували цю
      // назву) — тоді лише деактивуємо; вільну від посилань видаляємо повністю.
      const result = await withTenant(async (tx) => {
        const nom = await tx.nomenclature.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true, _count: { select: { orders: true, projects: true } } },
        })
        if (!nom) return null
        if (nom._count.orders > 0 || nom._count.projects > 0) {
          await tx.nomenclature.update({
            where: { id: nom.id },
            data: { isActive: false },
          })
          return 'deactivated' as const
        }
        await tx.nomenclature.delete({ where: { id: nom.id } })
        return 'deleted' as const
      })
      if (!result) throw new AppError(ApiErrorCode.NOT_FOUND, 'Позицію не знайдено', 404)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'nomenclature.deleted',
        resourceType: 'nomenclature',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: { outcome: result },
      })
      return reply.send({ success: true, data: { outcome: result } })
    }
  )

  return Promise.resolve()
}

export default nomenclatureRoute
