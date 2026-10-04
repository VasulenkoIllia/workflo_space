import type { FastifyPluginAsync } from 'fastify'
import calendarEventsRoute from './events.js'
import calendarViewRoute from './view.js'

/** 24 Calendar MVP — зустрічі (CRUD+respond) + агрегований view (події+дедлайни). */
const calendarRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(calendarEventsRoute)
  await fastify.register(calendarViewRoute)
}

export default calendarRoutes
