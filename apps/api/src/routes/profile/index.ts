import type { FastifyPluginAsync } from 'fastify'
import changePasswordRoute from './changePassword.js'
import updateNotificationsRoute from './updateNotifications.js'
import updateProfileRoute from './updateProfile.js'

/** Profile self-service routes (all require authentication). */
const profileRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(updateProfileRoute)
  await fastify.register(changePasswordRoute)
  await fastify.register(updateNotificationsRoute)
}

export default profileRoutes
