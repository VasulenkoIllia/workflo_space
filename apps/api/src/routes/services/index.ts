import type { FastifyPluginAsync } from 'fastify'
import assignmentsRoute from './assignments.js'
import catalogRoute from './catalog.js'
import generateChargesRoute from './generateCharges.js'

/**
 * Services route group (S5-03b) — catalog CRUD, per-company subscriptions, and the
 * manual recurring-charge generation fallback. Workspace-only; each sub-route is
 * tenant-scoped and declares its full path.
 */
const serviceRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(catalogRoute)
  await fastify.register(assignmentsRoute)
  await fastify.register(generateChargesRoute)
}

export default serviceRoutes
