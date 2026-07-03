import type { FastifyPluginAsync } from 'fastify'
import forgotPasswordRoute from './forgotPassword.js'
import loginRoute from './login.js'
import logoutRoute from './logout.js'
import meRoute from './me.js'
import refreshRoute from './refresh.js'
import registerRoute from './register.js'
import resetPasswordRoute from './resetPassword.js'
import switchAgencyRoute from './switchAgency.js'
import twoFactorRoute from './twoFactor.js'

/**
 * Auth route group. Endpoints are registered at root (`/auth/*`) since each
 * sub-route declares its own full path — keeps rate-limit configs co-located.
 */
const authRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(registerRoute)
  await fastify.register(loginRoute)
  await fastify.register(logoutRoute)
  await fastify.register(refreshRoute)
  await fastify.register(switchAgencyRoute)
  await fastify.register(meRoute)
  await fastify.register(forgotPasswordRoute)
  await fastify.register(resetPasswordRoute)
  await fastify.register(twoFactorRoute)
}

export default authRoutes
