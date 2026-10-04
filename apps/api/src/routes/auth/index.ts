import type { FastifyPluginAsync } from 'fastify'
import forgotPasswordRoute from './forgotPassword.js'
import loginRoute from './login.js'
import magicLinkRoute from './magicLink.js'
import changeEmailRoute from './changeEmail.js'
import logoutRoute from './logout.js'
import meRoute from './me.js'
import refreshRoute from './refresh.js'
import registerRoute from './register.js'
import resetPasswordRoute from './resetPassword.js'
import oauthRoute from './oauth.js'
import sessionsRoute from './sessions.js'
import switchAgencyRoute from './switchAgency.js'
import twoFactorRoute from './twoFactor.js'
import verifyEmailRoute from './verifyEmail.js'

/**
 * Auth route group. Endpoints are registered at root (`/auth/*`) since each
 * sub-route declares its own full path — keeps rate-limit configs co-located.
 */
const authRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(registerRoute)
  await fastify.register(loginRoute)
  await fastify.register(magicLinkRoute)
  await fastify.register(changeEmailRoute)
  await fastify.register(logoutRoute)
  await fastify.register(refreshRoute)
  await fastify.register(switchAgencyRoute)
  await fastify.register(meRoute)
  await fastify.register(forgotPasswordRoute)
  await fastify.register(resetPasswordRoute)
  await fastify.register(twoFactorRoute)
  await fastify.register(sessionsRoute)
  await fastify.register(verifyEmailRoute)
  await fastify.register(oauthRoute)
}

export default authRoutes
