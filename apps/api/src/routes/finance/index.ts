import type { FastifyPluginAsync } from 'fastify'
import expensesRoute from './expenses.js'
import marginRoute from './margin.js'
import reportsRoute from './reports.js'
import opsReportsRoute from './opsReports.js'

/**
 * Finance route group (S5-10, +S5.6 P-9 margin) — operating-expense CRUD, the P&L
 * report, and project/client margin. Workspace-only, owner-gated, tenant-scoped.
 */
const financeRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(expensesRoute)
  await fastify.register(reportsRoute)
  await fastify.register(opsReportsRoute)
  await fastify.register(marginRoute)
}

export default financeRoutes
