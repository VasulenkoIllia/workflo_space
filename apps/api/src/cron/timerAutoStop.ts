import { prisma, runWithSystemContext, tenantTransaction } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { autoStopStaleTimers } from '../services/timer.js'
import { makeCron } from './makeCron.js'

/**
 * Cron C15 (02-orders T2): auto-stop timers left running > 8h. Hourly cross-tenant sweep
 * (worker context → RLS-permissive). Idempotent (a stopped timer has endedAt set → not
 * re-selected), so a duplicate run across replicas is harmless. Lifecycle owned by the
 * worker bootstrap; never started in tests.
 */
const HOUR_MS = 60 * 60 * 1000

export async function runTimerAutoStopOnce(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<number> {
  const stopped = await runWithSystemContext(() =>
    tenantTransaction(prisma, (tx) => autoStopStaleTimers(tx, { now }))
  )
  if (stopped > 0) logger.info({ stopped }, 'timerAutoStop: stopped stale timers (>8h)')
  return stopped
}

const cron = makeCron({
  name: 'timerAutoStop',
  bootDelayMs: 60_000,
  intervalMs: HOUR_MS,
  run: (logger) => runTimerAutoStopOnce(logger),
})
export const startTimerAutoStopCron = cron.start
export const stopTimerAutoStopCron = cron.stop
