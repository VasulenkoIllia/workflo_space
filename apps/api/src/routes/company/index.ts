import type { FastifyPluginAsync } from 'fastify'
import credentialsRoute from './credentials.js'
import listCompaniesRoute from './listCompanies.js'
import clientMembersRoute from './members.js'
import companyRequisitesRoute from './requisites.js'

/** Company / client route group (P-3) — client legal requisites for documents (06-Б)
 * + agency-side member management of a client company (28-Б) + credentials vault (17). */
const companyRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(companyRequisitesRoute)
  await fastify.register(clientMembersRoute)
  await fastify.register(credentialsRoute)
  await fastify.register(listCompaniesRoute)
}

export default companyRoutes
