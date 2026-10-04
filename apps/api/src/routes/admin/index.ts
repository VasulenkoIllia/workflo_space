import type { FastifyPluginAsync } from 'fastify'
import legalEntitiesRoute from './legalEntities.js'

/**
 * Admin route group (module 20) — Workspace-only agency administration.
 * Currently: legal entities (20-Д). Future: roles/manager, change journal, view-as.
 * Each sub-route is tenant-scoped and declares its full path.
 */
const adminRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(legalEntitiesRoute)
}

export default adminRoutes
