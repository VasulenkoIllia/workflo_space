import type { FastifyPluginAsync } from 'fastify'
import payoutsRoute from './payouts.js'
import ratesRoute from './rates.js'
import teamRoute from './team.js'

/**
 * Team route group (S5-04) — agency roster, append-only executor rates, and the
 * payout lifecycle. Workspace-only; each sub-route is tenant-scoped.
 */
const teamRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(teamRoute)
  await fastify.register(ratesRoute)
  await fastify.register(payoutsRoute)
}

export default teamRoutes
