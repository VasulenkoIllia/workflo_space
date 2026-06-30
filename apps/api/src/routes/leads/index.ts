import type { FastifyPluginAsync } from 'fastify'
import leadsRoute from './leads.js'

/** Leads / CRM (module 26). All require authentication; internal-team gated inside. */
const leadRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(leadsRoute)
}

export default leadRoutes
