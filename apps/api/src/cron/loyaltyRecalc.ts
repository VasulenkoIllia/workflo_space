import { prisma, runWithSystemContext, tenantTransaction } from '@workflo/db'
import { recalcLoyaltyTiers } from '../services/loyaltyRecalc.js'
import { makeCron, msUntilUtc, DAY_MS } from './makeCron.js'

/**
 * Loyalty tier-recalc cron (S5-09). Runs nightly at 02:30 UTC across all tenants
 * (worker context → RLS-permissive). Idempotent (upgrade-only + full totalSpent
 * recompute), so a duplicate run on another replica is harmless. Lifecycle owned by
 * `startWorkers()`; never started in tests.
 */

const cron = makeCron({
  name: 'loyaltyRecalc',
  bootDelayMs: () => msUntilUtc(2, 30),
  intervalMs: DAY_MS,
  run: async (logger) => {
    // Explicit RLS-bypass: recalcs every tenant's companies (see recurringCharges note).
    const res = await runWithSystemContext(() =>
      tenantTransaction(prisma, (tx) => recalcLoyaltyTiers(tx))
    )
    logger.info(res, 'loyaltyRecalc: done')
  },
})
export const startLoyaltyRecalcCron = cron.start
export const stopLoyaltyRecalcCron = cron.stop
