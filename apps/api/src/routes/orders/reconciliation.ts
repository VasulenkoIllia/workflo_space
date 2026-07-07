import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, reconcileOrderSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { assertSameTenant } from '../../auth/tenant.js'
import { agencyRole } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * ПРИЙМАННЯ РОБОТИ — звірка годин (рішення власника 07.07). Owner/manager коригує:
 *  • billableHours — год ДО ВИСТАВЛЕННЯ клієнту (погодинне; null = факт Σ TimeLog);
 *  • per-executor payableHours — год ДО ОПЛАТИ виконавцю.
 * Факт (Σ TimeLog) не редагується. Доступно поки замовлення в роботі або на прийманні
 * (in_progress/review) — після приймання (done) звірка заморожена.
 */
const RECONCILABLE = new Set(['in_progress', 'review'])

const reconciliationRoute: FastifyPluginAsync = (fastify) => {
  fastify.put<{ Params: { id: string } }>(
    '/orders/:id/reconciliation',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const order = await withTenant((tx) =>
        tx.order.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, internalStatus: true, deletedAt: true },
        })
      )
      if (!order || order.deletedAt) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
      }
      assertSameTenant(user, order.agencyId)
      // Приймати/коригувати години може лише owner або manager (тімлід).
      const role = agencyRole(user, order.agencyId)
      if (role !== 'owner' && role !== 'manager') {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Звірку годин робить owner або тімлід', 403)
      }
      if (!RECONCILABLE.has(order.internalStatus)) {
        throw new AppError(
          ApiErrorCode.CONFLICT,
          'Звірка доступна лише поки замовлення в роботі або на прийманні',
          409
        )
      }
      const body = reconcileOrderSchema.parse(request.body)

      // Валідація співвиконавців: усі — члени агенції.
      const wantedIds = [...new Set((body.settlements ?? []).map((s) => s.profileId))]
      if (wantedIds.length > 0) {
        const members = await withTenant((tx) =>
          tx.agencyMember.findMany({
            where: { agencyId: order.agencyId, profileId: { in: wantedIds } },
            select: { profileId: true },
          })
        )
        const valid = new Set(members.map((m) => m.profileId))
        if (wantedIds.some((id) => !valid.has(id))) {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Виконавець не є членом агенції', 400)
        }
      }

      // Знімок факту (Σ TimeLog) на момент звірки — по кожному виконавцю.
      const grouped = await withTenant((tx) =>
        tx.timeLog.groupBy({
          by: ['executorId'],
          where: { orderId: order.id },
          _sum: { hours: true },
        })
      )
      const trackedByExec = new Map(grouped.map((g) => [g.executorId, g._sum.hours ?? null]))

      await tenantTransaction(prisma, async (tx) => {
        if (body.billableHours !== undefined) {
          await tx.order.update({
            where: { id: order.id },
            data: { billableHours: body.billableHours },
          })
        }
        for (const s of body.settlements ?? []) {
          const tracked = trackedByExec.get(s.profileId) ?? 0
          await tx.orderExecutorSettlement.upsert({
            where: { orderId_profileId: { orderId: order.id, profileId: s.profileId } },
            create: {
              agencyId: order.agencyId,
              orderId: order.id,
              profileId: s.profileId,
              trackedHours: tracked as Prisma.Decimal | number,
              payableHours: s.payableHours,
            },
            update: {
              trackedHours: tracked as Prisma.Decimal | number,
              payableHours: s.payableHours,
            },
          })
        }
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId: order.agencyId,
        action: 'order.reconciled',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: {
          billableHours: body.billableHours ?? null,
          settlements: (body.settlements ?? []).length,
        },
      })

      return reply.send({ success: true, data: { id: order.id } })
    }
  )

  return Promise.resolve()
}

export default reconciliationRoute
