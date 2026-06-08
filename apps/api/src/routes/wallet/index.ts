import type { FastifyPluginAsync } from 'fastify'
import adminWalletRoute from './adminWallet.js'
import portalWalletRoute from './portalWallet.js'

/**
 * Wallet route group (S5-05) — bonus-account balance + ledger reads (portal) and
 * agency-side management + manual adjustment (admin). Each sub-route is
 * tenant-scoped and declares its full path.
 */
const walletRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(portalWalletRoute)
  await fastify.register(adminWalletRoute)
}

export default walletRoutes
