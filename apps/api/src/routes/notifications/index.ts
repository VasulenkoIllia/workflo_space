import type { FastifyPluginAsync } from 'fastify'
import notificationsRoute from './notifications.js'
import announcementsRoute from './announcements.js'

/** In-app notification feed (read + mark-read). All require authentication. */
const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(notificationsRoute)
  await fastify.register(announcementsRoute)
}

export default notificationRoutes
