import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'

/**
 * GET /workspace/team (S5-04) — agency members with their profile and current
 * (open-window) compensation rate. Internal-team read.
 */
const teamRoute: FastifyPluginAsync = (fastify) => {
  fastify.get('/workspace/team', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user
    const agencyId = requireActiveAgency(user)
    if (!isInternalTeam(user)) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
    }

    const { members, rates } = await withTenant(async (tx) => {
      const [members, rates] = await Promise.all([
        tx.agencyMember.findMany({
          where: { agencyId },
          select: {
            profileId: true,
            role: true,
            createdAt: true,
            profile: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        tx.executorRate.findMany({
          where: { agencyId, effectiveUntil: null },
          select: {
            executorId: true,
            monthlySalary: true,
            commissionPercent: true,
            currency: true,
          },
        }),
      ])
      return { members, rates }
    })

    const rateByExec = new Map(rates.map((r) => [r.executorId, r]))

    return reply.send({
      success: true,
      data: {
        members: members.map((m) => {
          const rate = rateByExec.get(m.profileId)
          return {
            profileId: m.profileId,
            role: m.role,
            name: m.profile.name,
            email: m.profile.email,
            joinedAt: m.createdAt,
            rate: rate
              ? {
                  monthlySalary: rate.monthlySalary ? rate.monthlySalary.toFixed(2) : null,
                  commissionPercent: rate.commissionPercent.toString(),
                  currency: rate.currency,
                }
              : null,
          }
        }),
      },
    })
  })

  return Promise.resolve()
}

export default teamRoute
