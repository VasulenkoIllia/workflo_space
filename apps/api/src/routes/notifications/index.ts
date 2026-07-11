import type { FastifyPluginAsync } from 'fastify'
import announcementsRoute from './announcements.js'
import notificationsRoute from './notifications.js'
import pushRoute from './push.js'

/** In-app notification feed (read + mark-read) + 07-В оголошення + S12-03 web push. */
const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(notificationsRoute)
  await fastify.register(announcementsRoute)
  await fastify.register(pushRoute)
}

export default notificationRoutes
