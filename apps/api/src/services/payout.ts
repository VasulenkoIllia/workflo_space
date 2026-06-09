import { Prisma } from '@workflo/db'

/**
 * Executor payout calculation + lifecycle (S5-04, module 12). One `ExecutorPayout`
 * per `(executor, period)` — the `@@unique` makes generation idempotent; a re-run
 * refreshes a DRAFT but never clobbers an `approved`/`paid` row. Status is monotonic
 * draft → approved → paid, and an approved/paid period locks its time logs.
 *
 * `total = baseSalary + hourlyEarned + commissionAmount`.
 *  - baseSalary = the ExecutorRate active in the period (`monthlySalary`);
 *  - billableHours = Σ TimeLog.hours in the period (recorded);
 *  - hourlyEarned = 0 — ExecutorRate carries no hourly rate yet (a flagged future
 *    column); billableHours is tracked so it can light up without a recalc;
 *  - commissionAmount = commissionPercent × Σ confirmed revenue (amountUsd) on orders
 *    assigned to the executor in the period.
 */

export interface PeriodBounds {
  start: Date
  end: Date
}

/** `YYYY-MM` → `[first instant, last instant]` of that month (UTC). */
export function periodBounds(period: string): PeriodBounds {
  const parts = period.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1) - 1)
  return { start, end }
}

/** Calendar period (`YYYY-MM`) a date falls in (UTC). */
export function periodOf(date: Date): string {
  return date.toISOString().slice(0, 7)
}

/** The ExecutorRate whose validity window covers the period (latest start wins). */
export async function getActiveRate(
  tx: Prisma.TransactionClient,
  executorId: string,
  bounds: PeriodBounds
) {
  return tx.executorRate.findFirst({
    where: {
      executorId,
      effectiveFrom: { lte: bounds.end },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: bounds.start } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { monthlySalary: true, commissionPercent: true, currency: true },
  })
}

/** True if the executor's period has an approved/paid payout — its time logs are locked. */
export async function isPeriodLocked(
  tx: Prisma.TransactionClient,
  executorId: string,
  period: string
): Promise<boolean> {
  const payout = await tx.executorPayout.findUnique({
    where: { executorId_period: { executorId, period } },
    select: { status: true },
  })
  return payout != null && payout.status !== 'draft'
}

export interface PayoutDto {
  id: string
  executorId: string
  period: string
  baseSalary: string
  billableHours: string
  hourlyEarned: string
  commissionAmount: string
  total: string
  currency: string
  status: string
  approvedBy: string | null
  paidAt: Date | null
}

interface PayoutRow {
  id: string
  executorId: string
  period: string
  baseSalary: Prisma.Decimal
  billableHours: Prisma.Decimal
  hourlyEarned: Prisma.Decimal
  commissionAmount: Prisma.Decimal
  total: Prisma.Decimal
  currency: string
  status: string
  approvedBy: string | null
  paidAt: Date | null
}

export const PAYOUT_SELECT = {
  id: true,
  executorId: true,
  period: true,
  baseSalary: true,
  billableHours: true,
  hourlyEarned: true,
  commissionAmount: true,
  total: true,
  currency: true,
  status: true,
  approvedBy: true,
  paidAt: true,
} satisfies Prisma.ExecutorPayoutSelect

export function payoutDto(p: PayoutRow): PayoutDto {
  return {
    id: p.id,
    executorId: p.executorId,
    period: p.period,
    baseSalary: p.baseSalary.toFixed(2),
    billableHours: p.billableHours.toFixed(2),
    hourlyEarned: p.hourlyEarned.toFixed(2),
    commissionAmount: p.commissionAmount.toFixed(2),
    total: p.total.toFixed(2),
    currency: p.currency,
    status: p.status,
    approvedBy: p.approvedBy,
    paidAt: p.paidAt,
  }
}

/**
 * Generate (or refresh a draft of) one executor's payout for a period. Idempotent;
 * an already approved/paid payout is returned untouched.
 */
export async function generatePayout(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; executorId: string; period: string }
): Promise<PayoutDto> {
  const bounds = periodBounds(args.period)

  // Never recompute over an approved/paid payout.
  const existing = await tx.executorPayout.findUnique({
    where: { executorId_period: { executorId: args.executorId, period: args.period } },
    select: PAYOUT_SELECT,
  })
  if (existing && existing.status !== 'draft') {
    return payoutDto(existing)
  }

  const rate = await getActiveRate(tx, args.executorId, bounds)
  const baseSalary = new Prisma.Decimal(rate?.monthlySalary ?? 0)
  const currency = rate?.currency ?? 'USD'
  const commissionPct = new Prisma.Decimal(rate?.commissionPercent ?? 0)

  const [hoursAgg, commAgg] = await Promise.all([
    tx.timeLog.aggregate({
      where: {
        agencyId: args.agencyId,
        executorId: args.executorId,
        date: { gte: bounds.start, lte: bounds.end },
      },
      _sum: { hours: true },
    }),
    tx.payment.aggregate({
      where: {
        agencyId: args.agencyId,
        status: 'confirmed',
        confirmedAt: { gte: bounds.start, lte: bounds.end },
        order: { is: { assigneeId: args.executorId } },
      },
      _sum: { amountUsd: true },
    }),
  ])
  const billableHours = hoursAgg._sum.hours ?? new Prisma.Decimal(0)
  const hourlyEarned = new Prisma.Decimal(0)
  const commissionBase = commAgg._sum.amountUsd ?? new Prisma.Decimal(0)
  const commissionAmount = commissionBase.times(commissionPct).div(100).toDecimalPlaces(2)
  const total = baseSalary.plus(hourlyEarned).plus(commissionAmount)

  const payout = await tx.executorPayout.upsert({
    where: { executorId_period: { executorId: args.executorId, period: args.period } },
    create: {
      agencyId: args.agencyId,
      executorId: args.executorId,
      period: args.period,
      baseSalary,
      billableHours,
      hourlyEarned,
      commissionAmount,
      total,
      currency,
      status: 'draft',
    },
    update: { baseSalary, billableHours, hourlyEarned, commissionAmount, total, currency },
    select: PAYOUT_SELECT,
  })
  return payoutDto(payout)
}
