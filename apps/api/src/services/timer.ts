import { type Prisma } from '@workflo/db'
import { resolveTimeLogRates } from './rateResolution.js'

/**
 * Time-tracking timer (02-orders T2, фінд.#7). A running timer is a TimeLog row with
 * `startedAt` set and `endedAt` null; stopping it stamps `endedAt` and computes `hours`
 * from the elapsed span. Manual logs (both null) are untouched (back-compat).
 *
 * "One active timer per executor" is enforced here, not by a DB constraint: a per-executor
 * advisory xact-lock serializes start/stop so two concurrent starts can't both create a
 * running row (a partial-unique index would break the prisma migrate-diff drift gate).
 * Scope is the active tenant (RLS) — i.e. one running timer per executor per agency.
 */

export const TIMER_SELECT = {
  id: true,
  orderId: true,
  hours: true,
  startedAt: true,
  endedAt: true,
  date: true,
  comment: true,
  executorId: true,
  order: { select: { id: true, title: true } },
} as const

const MAX_DECIMAL_HOURS = 999.99 // TimeLog.hours is Decimal(5,2)

/** Elapsed hours, rounded to 2 dp, clamped to the column's range. */
export function elapsedHours(startedAt: Date, endedAt: Date): number {
  const ms = endedAt.getTime() - startedAt.getTime()
  const h = Math.round((ms / 3_600_000) * 100) / 100
  return Math.max(0, Math.min(MAX_DECIMAL_HOURS, h))
}

const dateOnly = (d: Date): Date => new Date(d.toISOString().slice(0, 10))

/** Serialize start/stop for one executor so concurrent calls can't double-run. */
async function lockExecutor(tx: Prisma.TransactionClient, executorId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`timer:${executorId}`}))`
}

async function findActive(tx: Prisma.TransactionClient, agencyId: string, executorId: string) {
  return tx.timeLog.findFirst({
    where: { agencyId, executorId, startedAt: { not: null }, endedAt: null },
    select: { id: true, startedAt: true },
  })
}

async function finalize(
  tx: Prisma.TransactionClient,
  id: string,
  startedAt: Date,
  endedAt: Date,
  comment: string | null
) {
  return tx.timeLog.update({
    where: { id },
    data: {
      endedAt,
      hours: elapsedHours(startedAt, endedAt),
      ...(comment ? { comment } : {}),
    },
    select: TIMER_SELECT,
  })
}

/** The executor's currently-running timer in this tenant, or null. */
export function getActiveTimer(tx: Prisma.TransactionClient, agencyId: string, executorId: string) {
  return tx.timeLog.findFirst({
    where: { agencyId, executorId, startedAt: { not: null }, endedAt: null },
    select: TIMER_SELECT,
  })
}

/**
 * Start a timer on an order. Any timer already running for this executor is auto-stopped
 * first (its hours computed) — there is only ever one running timer. Rates are snapshotted
 * at start (П5/П7), like a manual log.
 */
export async function startTimer(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; executorId: string; orderId: string; now: Date }
) {
  const { agencyId, executorId, orderId, now } = args
  await lockExecutor(tx, executorId)

  const active = await findActive(tx, agencyId, executorId)
  if (active?.startedAt) {
    await finalize(tx, active.id, active.startedAt, now, 'авто-стоп: запущено новий таймер')
  }

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { projectId: true, zeroBilled: true, hourlyRate: true },
  })
  const rates = order
    ? await resolveTimeLogRates(tx, { agencyId, order, executorId, date: now })
    : { clientRate: null, costRate: null, costCurrency: null, costRateUsd: null }

  return tx.timeLog.create({
    data: {
      agency: { connect: { id: agencyId } },
      order: { connect: { id: orderId } },
      executor: { connect: { id: executorId } },
      hours: 0,
      date: dateOnly(now),
      startedAt: now,
      endedAt: null,
      clientRateSnapshot: rates.clientRate,
      costRateSnapshot: rates.costRate,
      costCurrency: rates.costCurrency,
      costRateUsd: rates.costRateUsd,
    },
    select: TIMER_SELECT,
  })
}

/** Stop the executor's running timer (if any) → stamps endedAt + computes hours. */
export async function stopTimer(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; executorId: string; now: Date }
) {
  const { agencyId, executorId, now } = args
  await lockExecutor(tx, executorId)
  const active = await findActive(tx, agencyId, executorId)
  if (!active?.startedAt) return null
  return finalize(tx, active.id, active.startedAt, now, null)
}

/**
 * Cron C15: auto-stop timers left running longer than `maxHours` (default 8). Cross-tenant
 * sweep; each is capped to exactly `maxHours` (endedAt = startedAt + maxHours) so a forgotten
 * timer never books an absurd span. Returns the count stopped.
 */
export async function autoStopStaleTimers(
  tx: Prisma.TransactionClient,
  args: { now: Date; maxHours?: number }
): Promise<number> {
  const maxHours = args.maxHours ?? 8
  const cutoff = new Date(args.now.getTime() - maxHours * 3_600_000)
  const stale = await tx.timeLog.findMany({
    where: { startedAt: { not: null, lt: cutoff }, endedAt: null },
    select: { id: true, startedAt: true },
  })
  for (const t of stale) {
    if (!t.startedAt) continue
    const endedAt = new Date(t.startedAt.getTime() + maxHours * 3_600_000)
    await finalize(tx, t.id, t.startedAt, endedAt, `авто-стоп: таймер ${maxHours} год`)
  }
  return stale.length
}
