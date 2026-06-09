import { LOYALTY_DISCOUNT_PCT, LOYALTY_TIER_THRESHOLDS_USD, LoyaltyTier } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'

const TIER_ORDER = [LoyaltyTier.NEW, LoyaltyTier.REGULAR, LoyaltyTier.PARTNER, LoyaltyTier.VIP]

/**
 * GET /loyalty/tiers (S5-09) — the public loyalty tier table (thresholds + auto
 * discount). Static constant data only (no tenant data), so it needs no auth — the
 * landing/pricing pages render it directly.
 */
const publicTiersRoute: FastifyPluginAsync = (fastify) => {
  fastify.get('/loyalty/tiers', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        tiers: TIER_ORDER.map((tier) => ({
          tier,
          thresholdUsd: LOYALTY_TIER_THRESHOLDS_USD[tier],
          discountPercent: LOYALTY_DISCOUNT_PCT[tier],
        })),
      },
    })
  })

  return Promise.resolve()
}

export default publicTiersRoute
