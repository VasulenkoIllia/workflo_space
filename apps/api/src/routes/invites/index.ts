import type { FastifyPluginAsync } from 'fastify'
import acceptInviteRoute from './acceptInvite.js'
import createExecutorInviteRoute from './createExecutorInvite.js'
import createMemberInviteRoute from './createMemberInvite.js'
import getInviteRoute from './getInvite.js'

/** Invite flow: create (executor/member), public preview, accept. */
const inviteRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(createExecutorInviteRoute)
  await fastify.register(createMemberInviteRoute)
  await fastify.register(getInviteRoute)
  await fastify.register(acceptInviteRoute)
}

export default inviteRoutes
