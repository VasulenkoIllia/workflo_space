import { prisma } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { makeCron, msUntilUtc, DAY_MS } from './makeCron.js'

/**
 * S6 follow-up: idempotency_keys are written on every idempotent mutation and never deleted,
 * so the table grows unboundedly. Daily sweep drops rows past their `expiresAt` (the dedup
 * window has closed — a replay after expiry is treated as a fresh request anyway). Deletes are
 * idempotent → a duplicate run across replicas is harmless. Mirrors refreshTokenSweep.
 */

export interface SweepResult {
  deleted: number
}

export async function sweepIdempotencyKeys(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<SweepResult> {
  const res = await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } })
  if (res.count > 0) {
    logger.info({ deleted: res.count }, 'idempotencyKeySweep: pruned expired keys')
  }
  return { deleted: res.count }
}

// ── Scheduler (daily 03:50 UTC) — same plain-timer pattern as refreshTokenSweep ──

const cron = makeCron({
  name: 'idempotencyKeySweep',
  bootDelayMs: () => msUntilUtc(3, 50),
  intervalMs: DAY_MS,
  run: (logger) => sweepIdempotencyKeys(logger),
})
export const startIdempotencyKeySweepCron = cron.start
export const stopIdempotencyKeySweepCron = cron.stop
