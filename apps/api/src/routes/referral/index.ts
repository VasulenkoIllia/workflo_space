import type { FastifyPluginAsync } from 'fastify'
import referralSettingsRoute from './settings.js'

/** Referral route group (S5-06) — per-agency program config. */
const referralRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(referralSettingsRoute)
}

export default referralRoutes
