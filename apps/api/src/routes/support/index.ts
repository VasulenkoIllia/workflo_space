import type { FastifyPluginAsync } from 'fastify'
import ticketStreamRoute from './stream.js'
import supportRoute from './tickets.js'

/** 29 Support MVP — тікети підтримки (portal + workspace) + SSE live-тред. */
const supportRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(supportRoute)
  await fastify.register(ticketStreamRoute)
}

export default supportRoutes
