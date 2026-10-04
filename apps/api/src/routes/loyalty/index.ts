import type { FastifyPluginAsync } from 'fastify'
import companyLoyaltyRoute from './companyLoyalty.js'
import publicTiersRoute from './publicTiers.js'

/**
 * Loyalty route group (S5-09) — the public tier table + the workspace company tier
 * panel and owner-only override. (The auto-discount itself is applied at charge
 * creation in S5-03b; the nightly recalc cron is wired in `startCronJobs`.)
 */
const loyaltyRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(publicTiersRoute)
  await fastify.register(companyLoyaltyRoute)
}

export default loyaltyRoutes
