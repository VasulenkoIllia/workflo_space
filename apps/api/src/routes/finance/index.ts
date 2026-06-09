import type { FastifyPluginAsync } from 'fastify'
import expensesRoute from './expenses.js'
import reportsRoute from './reports.js'

/**
 * Finance route group (S5-10) — operating-expense CRUD and the P&L report.
 * Workspace-only, owner-gated, tenant-scoped.
 */
const financeRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(expensesRoute)
  await fastify.register(reportsRoute)
}

export default financeRoutes
