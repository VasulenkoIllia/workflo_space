import type { FastifyPluginAsync } from 'fastify'
import allocatePaymentRoute from './allocatePayment.js'
import chargesRoute from './charges.js'
import createPaymentRoute from './createPayment.js'
import listPaymentsRoute from './listPayments.js'
import overviewRoute from './overview.js'
import paymentSettingsRoute from './paymentSettings.js'
import portalSummaryRoute from './portalSummary.js'
import projectsRoute from './projects.js'

/**
 * Billing route group (S5-02). Each sub-route declares its full `/workspace/*` or
 * `/portal/*` path. The write path (`createPayment`) is idempotent + tenant-scoped;
 * the rest are read-only money views. Projects (05-ПРОЕКТИ, S5.6) — CRUD over the
 * per-client financial container.
 */
const billingRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(createPaymentRoute)
  await fastify.register(allocatePaymentRoute)
  await fastify.register(listPaymentsRoute)
  await fastify.register(overviewRoute)
  await fastify.register(chargesRoute)
  await fastify.register(portalSummaryRoute)
  await fastify.register(paymentSettingsRoute)
  await fastify.register(projectsRoute)
}

export default billingRoutes
