import { prisma, runWithSystemContext, tenantTransaction } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'
import { recalcLoyaltyTiers } from '../services/loyaltyRecalc.js'
import { msUntilUtc } from './exchangeRate.js'

/**
 * Loyalty tier-recalc cron (S5-09). Runs nightly at 02:30 UTC across all tenants
 * (worker context → RLS-permissive). Idempotent (upgrade-only + full totalSpent
 * recompute), so a duplicate run on another replica is harmless. Lifecycle owned by
 * `startWorkers()`; never started in tests.
 */
const DAY_MS = 24 * 60 * 60 * 1000

let bootTimer: ReturnType<typeof setTimeout> | null = null
let dailyTimer: ReturnType<typeof setInterval> | null = null
let running = false

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return
  running = true
  try {
    // Explicit RLS-bypass: recalcs every tenant's companies (see recurringCharges note).
    const res = await runWithSystemContext(() =>
      tenantTransaction(prisma, (tx) => recalcLoyaltyTiers(tx))
    )
    logger.info(res, 'loyaltyRecalc: done')
  } catch (err) {
    logger.error({ err }, 'loyaltyRecalc: run failed')
    captureException(err, { scope: 'cron.loyaltyRecalc' })
  } finally {
    running = false
  }
}

export function startLoyaltyRecalcCron(logger: FastifyBaseLogger): void {
  if (bootTimer || dailyTimer) return
  const delay = msUntilUtc(2, 30, new Date())
  bootTimer = setTimeout(() => {
    bootTimer = null
    void runOnce(logger)
    dailyTimer = setInterval(() => void runOnce(logger), DAY_MS)
    dailyTimer.unref()
  }, delay)
  bootTimer.unref()
  logger.info({ delayMs: delay }, 'loyaltyRecalc cron scheduled (02:30 UTC)')
}

export function stopLoyaltyRecalcCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (dailyTimer) {
    clearInterval(dailyTimer)
    dailyTimer = null
  }
}
