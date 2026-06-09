import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, generatePayoutSchema, payoutQuerySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { PAYOUT_SELECT, generatePayout, payoutDto } from '../../services/payout.js'

/**
 * Executor payouts (S5-04). Generation is idempotent (one row per executor+period);
 * status is monotonic draft → approved → paid, owner-gated, and approving a period
 * locks its time logs (enforced in the time-logs route). Reads = internal team.
 */
const payoutsRoute: FastifyPluginAsync = (fastify) => {
  // ── Generate (one executor or the whole team) ───────────────────────────────
  fastify.post(
    '/workspace/team/payouts/generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = generatePayoutSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції може формувати виплати',
          403
        )
      }

      const payouts = await tenantTransaction(prisma, async (tx) => {
        const executorIds = input.executorId
          ? [input.executorId]
          : (
              await tx.agencyMember.findMany({
                where: { agencyId },
                select: { profileId: true },
              })
            ).map((m) => m.profileId)

        const out = []
        for (const executorId of executorIds) {
          out.push(await generatePayout(tx, { agencyId, executorId, period: input.period }))
        }
        return out
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'payout.generated',
        resourceType: 'executor_payout',
        resourceId: input.period,
        result: 'allowed',
        metadata: { period: input.period, count: payouts.length },
      })

      return reply.send({ success: true, data: { payouts } })
    }
  )

  // ── List ────────────────────────────────────────────────────────────────────
  fastify.get(
    '/workspace/team/payouts',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = payoutQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const rows = await withTenant((tx) =>
        tx.executorPayout.findMany({
          where: { agencyId, ...(query.period ? { period: query.period } : {}) },
          select: PAYOUT_SELECT,
          orderBy: [{ period: 'desc' }, { executorId: 'asc' }],
        })
      )
      return reply.send({ success: true, data: { payouts: rows.map(payoutDto) } })
    }
  )

  // ── Approve (draft → approved) ──────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/team/payouts/:id/approve',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції може затверджувати виплати',
          403
        )
      }

      const payout = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.executorPayout.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, status: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Виплату не знайдено', 404)
        }
        if (existing.status !== 'draft') {
          throw new AppError(ApiErrorCode.CONFLICT, 'Виплату вже затверджено або оплачено', 409)
        }
        return tx.executorPayout.update({
          where: { id: existing.id },
          data: { status: 'approved', approvedBy: user.sub },
          select: PAYOUT_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'payout.approved',
        resourceType: 'executor_payout',
        resourceId: payout.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { payout: payoutDto(payout) } })
    }
  )

  // ── Mark paid (approved → paid) ─────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/team/payouts/:id/mark-paid',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції може позначати виплати',
          403
        )
      }

      const payout = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.executorPayout.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, status: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Виплату не знайдено', 404)
        }
        if (existing.status !== 'approved') {
          throw new AppError(ApiErrorCode.CONFLICT, 'Спершу затвердіть виплату', 409)
        }
        return tx.executorPayout.update({
          where: { id: existing.id },
          data: { status: 'paid', paidAt: new Date() },
          select: PAYOUT_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'payout.paid',
        resourceType: 'executor_payout',
        resourceId: payout.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { payout: payoutDto(payout) } })
    }
  )

  return Promise.resolve()
}

export default payoutsRoute
