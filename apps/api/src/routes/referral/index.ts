import type { FastifyPluginAsync } from 'fastify'
import portalReferralRoute from './portalReferral.js'
import referralSettingsRoute from './settings.js'

/** Referral route group — per-agency program config (S5-06) + client overview (S5-11). */
const referralRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(referralSettingsRoute)
  await fastify.register(portalReferralRoute)
}

export default referralRoutes
