import { prisma, runWithSystemContext, tenantTransaction } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'
import { autoStopStaleTimers } from '../services/timer.js'

/**
 * Cron C15 (02-orders T2): auto-stop timers left running > 8h. Hourly cross-tenant sweep
 * (worker context → RLS-permissive). Idempotent (a stopped timer has endedAt set → not
 * re-selected), so a duplicate run across replicas is harmless. Lifecycle owned by the
 * worker bootstrap; never started in tests.
 */
const HOUR_MS = 60 * 60 * 1000

let bootTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let running = false

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

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return
  running = true
  try {
    await runTimerAutoStopOnce(logger)
  } catch (err) {
    logger.error({ err }, 'timerAutoStop: run failed')
    captureException(err, { scope: 'cron.timerAutoStop' })
  } finally {
    running = false
  }
}

export function startTimerAutoStopCron(logger: FastifyBaseLogger): void {
  if (bootTimer || intervalTimer) return
  // First sweep ~1 min after boot, then hourly.
  bootTimer = setTimeout(() => {
    void runOnce(logger)
    intervalTimer = setInterval(() => void runOnce(logger), HOUR_MS)
    intervalTimer.unref()
  }, 60_000)
  bootTimer.unref()
}

export function stopTimerAutoStopCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}
