import type { FastifyPluginAsync } from 'fastify'
import loginRoute from './login.js'
import registerRoute from './register.js'

/**
 * Auth route group. Endpoints are registered at root (`/auth/*`) since each
 * sub-route declares its own full path — keeps rate-limit configs co-located.
 */
const authRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(registerRoute)
  await fastify.register(loginRoute)
}

export default authRoutes
