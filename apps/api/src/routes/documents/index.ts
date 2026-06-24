import type { FastifyPluginAsync } from 'fastify'
import documentsRoute from './documents.js'

/** Document generation + listing (06). All require authentication. */
const documentRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(documentsRoute)
}

export default documentRoutes
