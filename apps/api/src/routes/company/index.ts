import type { FastifyPluginAsync } from 'fastify'
import clientActivityRoute from './clientActivity.js'
import credentialsRoute from './credentials.js'
import listCompaniesRoute from './listCompanies.js'
import clientMembersRoute from './members.js'
import portalCredentialsRoute from './portalCredentials.js'
import companyRequisitesRoute from './requisites.js'
import vaultSharesRoute from './vaultShares.js'

/** Company / client route group (P-3) — client legal requisites for documents (06-Б)
 * + agency-side member management of a client company (28-Б) + credentials vault (17,
 * agency-side + portal self-service 17-А). */
const companyRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(companyRequisitesRoute)
  await fastify.register(clientMembersRoute)
  await fastify.register(clientActivityRoute)
  await fastify.register(credentialsRoute)
  await fastify.register(portalCredentialsRoute)
  await fastify.register(vaultSharesRoute)
  await fastify.register(listCompaniesRoute)
}

export default companyRoutes
