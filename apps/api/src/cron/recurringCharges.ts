import { prisma, runWithSystemContext, tenantTransaction } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'
import { generateRecurringCharges } from '../services/recurringCharges.js'

/**
 * Recurring-charge cron (S5-03b → S5.6 P-1 3b). Fires on the 1st of each month and
 * generates the project subscription charges due across ALL tenants (worker context
 * → RLS-permissive, sees every agency). Idempotent: the `(projectId, periodStart)`
 * unique constraint means a duplicate run on another replica creates no extra rows.
 * Lifecycle owned by `startWorkers()`; never started in tests.
 *
 * Month lengths vary, so this self-reschedules after each fire rather than using a
 * fixed interval (mirrors the exchangeRate cron's lifecycle).
 */
let timer: ReturnType<typeof setTimeout> | null = null
let running = false

/** ms from `now` until the next 1st-of-month at `hour:minute` UTC. */
export function msUntilNextMonthStart(hour: number, minute: number, now: Date): number {
  let candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, hour, minute, 0, 0))
  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, hour, minute, 0, 0)
    )
  }
  return candidate.getTime() - now.getTime()
}

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return // never overlap a slow run with the next tick
  running = true
  try {
    // Explicit RLS-bypass: this cron bills EVERY tenant, so it must not be scoped to
    // one agency once RLS is enforced (don't rely on the connection happening to bypass).
    const res = await runWithSystemContext(() =>
      tenantTransaction(prisma, (tx) => generateRecurringCharges(tx, { now: new Date() }))
    )
    logger.info(res, 'recurringCharges: generated')
  } catch (err) {
    logger.error({ err }, 'recurringCharges: run failed')
    captureException(err, { scope: 'cron.recurringCharges' })
  } finally {
    running = false
  }
}

function schedule(logger: FastifyBaseLogger): void {
  const delay = msUntilNextMonthStart(0, 5, new Date())
  timer = setTimeout(() => {
    timer = null
    void runOnce(logger).finally(() => schedule(logger))
  }, delay)
  timer.unref()
}

export function startRecurringChargesCron(logger: FastifyBaseLogger): void {
  if (timer) return
  schedule(logger)
  logger.info('recurringCharges cron scheduled (1st of month, 00:05 UTC)')
}

export function stopRecurringChargesCron(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
