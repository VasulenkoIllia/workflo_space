import type { FastifyPluginAsync } from 'fastify'
import adminWalletRoute from './adminWallet.js'
import payWithBonusRoute from './payWithBonus.js'
import portalWalletRoute from './portalWallet.js'
import statementRoute from './statement.js'

/**
 * Wallet route group (S5-05 / S5-08) — bonus-account balance + ledger reads (portal)
 * and agency-side management + manual adjustment (admin), plus the unified statement
 * and bonus-spend. Each sub-route is tenant-scoped and declares its full path.
 */
const walletRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(portalWalletRoute)
  await fastify.register(adminWalletRoute)
  await fastify.register(statementRoute)
  await fastify.register(payWithBonusRoute)
}

export default walletRoutes
