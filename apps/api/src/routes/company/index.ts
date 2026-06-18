import type { FastifyPluginAsync } from 'fastify'
import companyRequisitesRoute from './requisites.js'

/** Company / client route group (P-3) — client legal requisites for documents (06-Б). */
const companyRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(companyRequisitesRoute)
}

export default companyRoutes
