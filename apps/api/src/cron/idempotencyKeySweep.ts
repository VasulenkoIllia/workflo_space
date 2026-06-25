import { prisma } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'

/**
 * S6 follow-up: idempotency_keys are written on every idempotent mutation and never deleted,
 * so the table grows unboundedly. Daily sweep drops rows past their `expiresAt` (the dedup
 * window has closed — a replay after expiry is treated as a fresh request anyway). Deletes are
 * idempotent → a duplicate run across replicas is harmless. Mirrors refreshTokenSweep.
 */
const DAY_MS = 24 * 60 * 60 * 1000

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
    await sweepIdempotencyKeys(logger)
  } catch (err) {
    logger.error({ err }, 'idempotencyKeySweep: run failed')
    captureException(err, { scope: 'cron.idempotencyKeySweep' })
  } finally {
    running = false
  }
}

export function startIdempotencyKeySweepCron(logger: FastifyBaseLogger): void {
  if (bootTimer || dailyTimer) return
  bootTimer = setTimeout(
    () => {
      void runOnce(logger)
      dailyTimer = setInterval(() => void runOnce(logger), DAY_MS)
      dailyTimer.unref()
    },
    msUntilUtc(3, 50, new Date())
  )
  bootTimer.unref()
}

export function stopIdempotencyKeySweepCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (dailyTimer) {
    clearInterval(dailyTimer)
    dailyTimer = null
  }
}
