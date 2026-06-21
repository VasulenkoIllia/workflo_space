import { Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { resolveReferralConfig } from '../../services/referral.js'

/**
 * Client-facing referral overview (module 09, S5-11). The caller's active company sees its
 * shareable referral code, whether the program is enabled, and each company it referred with the
 * bonus earned from it. Read-only; pinned to the active company and gated by `billing.view`.
 */
const portalReferralRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/portal/referral',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      if (!can(user, 'billing.view', { agencyId, companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до рефералів', 403)
      }

      const data = await withTenant(async (tx) => {
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: { id: true, agencyId: true, referralCode: true },
        })
        if (!company || company.agencyId !== agencyId) return null
        const config = await resolveReferralConfig(tx, agencyId)
        const referrals = await tx.referral.findMany({
          where: { referrerId: companyId, agencyId },
          select: {
            id: true,
            totalEarned: true,
            createdAt: true,
            referred: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
        return { company, config, referrals }
      })
      if (!data) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
      }

      const total = data.referrals.reduce((s, r) => s.plus(r.totalEarned), new Prisma.Decimal(0))
      return reply.send({
        success: true,
        data: {
          referralCode: data.company.referralCode,
          enabled: data.config.enabled,
          totalEarned: total.toFixed(2),
          referrals: data.referrals.map((r) => ({
            id: r.id,
            name: r.referred.name,
            totalEarned: r.totalEarned.toFixed(2),
            since: r.createdAt.toISOString(),
          })),
        },
      })
    }
  )
  return Promise.resolve()
}

export default portalReferralRoute
