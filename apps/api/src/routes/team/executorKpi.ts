import { Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency } from '../../auth/tenant.js'
import { agencyRole } from '../../auth/tokens.js'

/**
 * 12-В KPI-картка виконавця: GET /workspace/executors/:profileId/kpi?from&to.
 * Owner/manager (адмін-поверхня; ставки й так owner-only в ростері). Вікно — довільне,
 * дефолт = поточний місяць. Метрики:
 *  - hoursLogged    — Σ TimeLog (лише фіналізовані записи, як у дошці/звітах);
 *  - hoursAccepted  — Σ payableHours settlements на замовленнях, ПРИЙНЯТИХ у вікні;
 *  - revenueUsd     — НЕТТО confirmed-виручка замовлень виконавця у вікні (мінус refund-и
 *                     confirmed-платежів — та сама семантика, що P&L/HIGH-2);
 *  - activeOrders   — відкриті замовлення на виконавці (не done/cancelled) на ЗАРАЗ;
 *  - tasksDone      — задачі done з апдейтом у вікні;
 *  - onTimePct      — % замовлень, прийнятих у вікні ДО дедлайну (лише ті, що мали дедлайн).
 */
const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

function monthBounds(now: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1)
  return { from, to }
}

const executorKpiRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { profileId: string } }>(
    '/workspace/executors/:profileId/kpi',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const role = agencyRole(user, agencyId)
      if (role !== 'owner' && role !== 'manager') {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'KPI-картка — для власника/тімліда', 403)
      }
      const q = querySchema.parse(request.query)
      const def = monthBounds(new Date())
      const from = q.from ? new Date(q.from) : def.from
      const to = q.to ? new Date(q.to) : def.to
      const profileId = request.params.profileId

      const kpi = await withTenant(async (tx) => {
        const member = await tx.agencyMember.findFirst({
          where: { agencyId, profileId },
          select: { profileId: true },
        })
        if (!member) throw new AppError(ApiErrorCode.NOT_FOUND, 'Члена агенції не знайдено', 404)

        const [hoursAgg, acceptedAgg, revAgg, refundAgg, activeOrders, tasksDone, acceptedOrders] =
          await Promise.all([
            tx.timeLog.aggregate({
              where: {
                agencyId,
                executorId: profileId,
                date: { gte: from, lte: to },
                OR: [{ startedAt: null }, { endedAt: { not: null } }],
              },
              _sum: { hours: true },
            }),
            tx.orderExecutorSettlement.aggregate({
              where: {
                agencyId,
                profileId,
                order: { is: { acceptedAt: { gte: from, lte: to }, deletedAt: null } },
              },
              _sum: { payableHours: true },
            }),
            tx.payment.aggregate({
              where: {
                agencyId,
                status: 'confirmed',
                confirmedAt: { gte: from, lte: to },
                order: { is: { assigneeId: profileId } },
              },
              _sum: { amountUsd: true },
            }),
            tx.paymentRefund.aggregate({
              where: {
                agencyId,
                createdAt: { gte: from, lte: to },
                payment: {
                  is: { status: 'confirmed', order: { is: { assigneeId: profileId } } },
                },
              },
              _sum: { amountUsd: true },
            }),
            tx.order.count({
              where: {
                agencyId,
                assigneeId: profileId,
                deletedAt: null,
                internalStatus: { notIn: ['done', 'cancelled'] },
              },
            }),
            tx.internalTask.count({
              where: {
                agencyId,
                assigneeId: profileId,
                status: 'done',
                updatedAt: { gte: from, lte: to },
              },
            }),
            tx.order.findMany({
              where: {
                agencyId,
                assigneeId: profileId,
                deletedAt: null,
                acceptedAt: { gte: from, lte: to },
                deadline: { not: null },
              },
              select: { acceptedAt: true, deadline: true },
            }),
          ])

        const onTimeBase = acceptedOrders.length
        const onTime = acceptedOrders.filter(
          (o) => o.acceptedAt && o.deadline && o.acceptedAt.getTime() <= o.deadline.getTime()
        ).length
        const revenue = (revAgg._sum.amountUsd ?? new Prisma.Decimal(0)).minus(
          refundAgg._sum.amountUsd ?? new Prisma.Decimal(0)
        )

        return {
          from: from.toISOString(),
          to: to.toISOString(),
          hoursLogged: Number(hoursAgg._sum.hours ?? 0),
          hoursAccepted: Number(acceptedAgg._sum.payableHours ?? 0),
          revenueUsd: revenue.toFixed(2),
          activeOrders,
          tasksDone,
          onTimePct: onTimeBase > 0 ? Math.round((onTime / onTimeBase) * 100) : null,
          onTimeBase,
        }
      })

      return reply.send({ success: true, data: { kpi } })
    }
  )

  return Promise.resolve()
}

export default executorKpiRoute
