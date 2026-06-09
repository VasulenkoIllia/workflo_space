import { Prisma, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  LOYALTY_DISCOUNT_PCT,
  LOYALTY_TIER_THRESHOLDS_USD,
  LoyaltyTier,
  loyaltyOverrideSchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

const TIER_ORDER = [LoyaltyTier.NEW, LoyaltyTier.REGULAR, LoyaltyTier.PARTNER, LoyaltyTier.VIP]

/** The next tier above `earned`, or null at the top (VIP). */
function nextTier(earned: LoyaltyTier): LoyaltyTier | null {
  const i = TIER_ORDER.indexOf(earned)
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1]! : null
}

/**
 * Company loyalty (S5-09): the workspace tier panel (current/effective tier, lifetime
 * progress, history) and the owner-only manual override.
 */
const companyLoyaltyRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/workspace/companies/:id/loyalty',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const data = await withTenant(async (tx) => {
        const company = await tx.company.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, loyaltyTier: true, tierOverride: true },
        })
        if (!company || company.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        }
        const [paidAgg, history] = await Promise.all([
          tx.payment.aggregate({
            where: { companyId: company.id, status: 'confirmed' },
            _sum: { amountUsd: true },
          }),
          tx.loyaltyTierHistory.findMany({
            where: { companyId: company.id },
            select: { fromTier: true, toTier: true, reason: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
          }),
        ])
        return { company, paidAgg, history }
      })

      const lifetime = data.paidAgg._sum.amountUsd ?? new Prisma.Decimal(0)
      const earned = data.company.loyaltyTier as LoyaltyTier
      const effective = (data.company.tierOverride ?? earned) as LoyaltyTier
      const next = nextTier(earned)
      const nextThreshold = next ? LOYALTY_TIER_THRESHOLDS_USD[next] : null
      const remaining =
        nextThreshold != null ? Math.max(0, nextThreshold - Number(lifetime)).toFixed(2) : null

      return reply.send({
        success: true,
        data: {
          earnedTier: earned,
          tierOverride: data.company.tierOverride,
          effectiveTier: effective,
          discountPercent: LOYALTY_DISCOUNT_PCT[effective],
          lifetimePaidUsd: lifetime.toFixed(2),
          progress: { nextTier: next, nextThresholdUsd: nextThreshold, remainingUsd: remaining },
          history: data.history,
        },
      })
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/workspace/companies/:id/loyalty/override-discount',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = loyaltyOverrideSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Лише власник агенції може змінювати тір', 403)
      }

      const updated = await withTenant(async (tx) => {
        const company = await tx.company.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, tierOverride: true },
        })
        if (!company || company.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        }
        return tx.company.update({
          where: { id: company.id },
          data: { tierOverride: input.tier },
          select: { id: true, loyaltyTier: true, tierOverride: true },
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'loyalty.override_set',
        resourceType: 'company',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: { tierOverride: input.tier },
      })

      const effective = (updated.tierOverride ?? updated.loyaltyTier) as LoyaltyTier
      return reply.send({
        success: true,
        data: {
          tierOverride: updated.tierOverride,
          effectiveTier: effective,
          discountPercent: LOYALTY_DISCOUNT_PCT[effective],
        },
      })
    }
  )

  return Promise.resolve()
}

export default companyLoyaltyRoute
