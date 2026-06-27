import type { FastifyPluginAsync } from 'fastify'
import contactRoute from './contact.js'

const contentRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(contactRoute)
}

export default contentRoutes
