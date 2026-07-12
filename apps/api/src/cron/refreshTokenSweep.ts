import { prisma } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { makeCron, msUntilUtc, DAY_MS } from './makeCron.js'

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

const cron = makeCron({
  name: 'refreshTokenSweep',
  bootDelayMs: () => msUntilUtc(3, 40),
  intervalMs: DAY_MS,
  run: (logger) => sweepRefreshTokens(logger),
})
export const startRefreshTokenSweepCron = cron.start
export const stopRefreshTokenSweepCron = cron.stop
