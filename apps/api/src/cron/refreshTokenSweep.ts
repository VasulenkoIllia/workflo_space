import { prisma } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'

/**
 * AR-31 (audit 2026-06-11): refresh_tokens grew unboundedly — every rotation
 * creates a row and nothing ever deleted revoked/expired ones. Daily sweep:
 *  - revoked rows older than {@link REVOKED_RETENTION_DAYS} (kept briefly so a
 *    rotation race / incident has an audit window);
 *  - rows expired more than {@link EXPIRED_RETENTION_DAYS} ago.
 * Deletes are idempotent → a duplicate run across replicas is harmless.
 */
const REVOKED_RETENTION_DAYS = 7
const EXPIRED_RETENTION_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface SweepResult {
  deleted: number
}

export async function sweepRefreshTokens(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<SweepResult> {
  const revokedBefore = new Date(now.getTime() - REVOKED_RETENTION_DAYS * DAY_MS)
  const expiredBefore = new Date(now.getTime() - EXPIRED_RETENTION_DAYS * DAY_MS)

  const res = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ revokedAt: { lt: revokedBefore } }, { expiresAt: { lt: expiredBefore } }],
    },
  })
  if (res.count > 0) {
    logger.info({ deleted: res.count }, 'refreshTokenSweep: pruned stale tokens')
  }
  return { deleted: res.count }
}

// ── Scheduler (daily 03:40 UTC) — same plain-timer pattern as exchangeRate ───
let bootTimer: ReturnType<typeof setTimeout> | null = null
let dailyTimer: ReturnType<typeof setInterval> | null = null
let running = false

function msUntilUtc(hour: number, minute: number, now: Date): number {
  const next = new Date(now)
  next.setUTCHours(hour, minute, 0, 0)
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return
  running = true
  try {
    await sweepRefreshTokens(logger)
  } catch (err) {
    logger.error({ err }, 'refreshTokenSweep: run failed')
    captureException(err, { scope: 'cron.refreshTokenSweep' })
  } finally {
    running = false
  }
}

export function startRefreshTokenSweepCron(logger: FastifyBaseLogger): void {
  if (bootTimer || dailyTimer) return
  bootTimer = setTimeout(
    () => {
      void runOnce(logger)
      dailyTimer = setInterval(() => void runOnce(logger), DAY_MS)
      dailyTimer.unref()
    },
    msUntilUtc(3, 40, new Date())
  )
  bootTimer.unref()
}

export function stopRefreshTokenSweepCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (dailyTimer) {
    clearInterval(dailyTimer)
    dailyTimer = null
  }
}
