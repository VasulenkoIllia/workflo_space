import type { FastifyPluginAsync } from 'fastify'
import listCompaniesRoute from './listCompanies.js'
import clientMembersRoute from './members.js'
import companyRequisitesRoute from './requisites.js'

/** Company / client route group (P-3) — client legal requisites for documents (06-Б)
 * + agency-side member management of a client company (28-Б). */
const companyRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(companyRequisitesRoute)
  await fastify.register(clientMembersRoute)
  await fastify.register(listCompaniesRoute)
}

export default companyRoutes
