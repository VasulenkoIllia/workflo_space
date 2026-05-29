import type { FastifyPluginAsync } from 'fastify'
import loginRoute from './login.js'
import logoutRoute from './logout.js'
import meRoute from './me.js'
import refreshRoute from './refresh.js'
import registerRoute from './register.js'

/**
 * Auth route group. Endpoints are registered at root (`/auth/*`) since each
 * sub-route declares its own full path — keeps rate-limit configs co-located.
 */
const authRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(registerRoute)
  await fastify.register(loginRoute)
  await fastify.register(logoutRoute)
  await fastify.register(refreshRoute)
  await fastify.register(meRoute)
}

export default authRoutes
