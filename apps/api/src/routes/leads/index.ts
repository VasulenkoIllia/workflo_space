import type { FastifyPluginAsync } from 'fastify'
import leadStagesRoute from './leadStages.js'
import leadsRoute from './leads.js'

/** Leads / CRM (module 26). All require authentication; internal-team gated inside. */
const leadRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(leadsRoute)
  await fastify.register(leadStagesRoute)
}

export default leadRoutes
