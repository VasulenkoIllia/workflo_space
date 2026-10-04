import type { FastifyPluginAsync } from 'fastify'
import catalogRoute from './catalog.js'
import generateChargesRoute from './generateCharges.js'

/**
 * Services route group (S5-03b → S5.6) — Service catalog CRUD + the manual
 * recurring-charge generation fallback (now project-based, P-1 3b). Per-company
 * subscriptions (CompanyService) were removed in P-1 3b-2 — projects (05-ПРОЕКТИ)
 * replace them. Workspace-only; each sub-route is tenant-scoped.
 */
const serviceRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(catalogRoute)
  await fastify.register(generateChargesRoute)
}

export default serviceRoutes
