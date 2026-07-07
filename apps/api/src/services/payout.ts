import { Prisma } from '@workflo/db'
import { computeEmployeeReferralBonus } from './referral.js'

/**
 * Executor payout calculation + lifecycle (S5-04, module 12). One `ExecutorPayout`
 * per `(executor, period)` — the `@@unique` makes generation idempotent; a re-run
 * refreshes a DRAFT but never clobbers an `approved`/`paid` row. Status is monotonic
 * draft → approved → paid, and an approved/paid period locks its time logs.
 *
 * `total = baseSalary + hourlyEarned + commissionAmount + referralBonusAmount`.
 *  - baseSalary = the ExecutorRate active in the period (`monthlySalary`);
 *  - billableHours = Σ TimeLog.hours in the period (recorded — informational);
 *  - paidHours = Σ ACCEPTED payableHours (OrderExecutorSettlement) on orders accepted
 *    (`acceptedAt`) in the period — the reconciled hours we actually pay for (ПРИЙМАННЯ);
 *  - hourlyEarned = paidHours × ExecutorRate.hourlyRate (погодинники; окладні → hourlyRate
 *    null → 0). Замикає money-loop приймання: платимо за прийняті, а не сирі залоговані години;
 *  - commissionAmount = commissionPercent × Σ confirmed revenue (amountUsd) on orders
 *    assigned to the executor in the period.
 *  - referralBonusAmount = employee-referral % × Σ net income of clients this executor
 *    brought (P-9b, §4.2) — recomputed with the draft, like every other component.
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
    // hourlyRate — ставка оплати погодинника (07.07 S5-D6), поряд із cost-роллю в маржі.
    select: { monthlySalary: true, hourlyRate: true, commissionPercent: true, currency: true },
  })
}

/** True if the executor's period has an approved/paid payout — its time logs are locked. */
export async function isPeriodLocked(
  tx: Prisma.TransactionClient,
  agencyId: string,
  executorId: string,
  period: string
): Promise<boolean> {
  // AR-20: payouts are tenant-scoped — the same staffer's period in ANOTHER agency
  // must not lock this agency's time logs.
  const payout = await tx.executorPayout.findUnique({
    where: { agencyId_executorId_period: { agencyId, executorId, period } },
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
  paidHours: string
  hourlyEarned: string
  commissionAmount: string
  referralBonusAmount: string
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
  paidHours: Prisma.Decimal
  hourlyEarned: Prisma.Decimal
  commissionAmount: Prisma.Decimal
  referralBonusAmount: Prisma.Decimal
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
  paidHours: true,
  hourlyEarned: true,
  commissionAmount: true,
  referralBonusAmount: true,
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
    paidHours: p.paidHours.toFixed(2),
    hourlyEarned: p.hourlyEarned.toFixed(2),
    commissionAmount: p.commissionAmount.toFixed(2),
    referralBonusAmount: p.referralBonusAmount.toFixed(2),
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
    where: {
      agencyId_executorId_period: {
        agencyId: args.agencyId,
        executorId: args.executorId,
        period: args.period,
      },
    },
    select: PAYOUT_SELECT,
  })
  if (existing && existing.status !== 'draft') {
    return payoutDto(existing)
  }

  const rate = await getActiveRate(tx, args.executorId, bounds)
  const baseSalary = new Prisma.Decimal(rate?.monthlySalary ?? 0)
  const currency = rate?.currency ?? 'USD'
  const commissionPct = new Prisma.Decimal(rate?.commissionPercent ?? 0)
  const payHourly = new Prisma.Decimal(rate?.hourlyRate ?? 0)

  const [hoursAgg, paidAgg, commAgg] = await Promise.all([
    tx.timeLog.aggregate({
      where: {
        agencyId: args.agencyId,
        executorId: args.executorId,
        date: { gte: bounds.start, lte: bounds.end },
      },
      _sum: { hours: true },
    }),
    // ПРИЙМАННЯ→PAYROLL: платимо за ПРИЙНЯТІ payableHours на замовленнях, ПРИЙНЯТИХ у періоді
    // (order.acceptedAt), а не за сирі залоговані. Співвиконавці мають власні settlement-рядки.
    tx.orderExecutorSettlement.aggregate({
      where: {
        agencyId: args.agencyId,
        profileId: args.executorId,
        order: { is: { acceptedAt: { gte: bounds.start, lte: bounds.end }, deletedAt: null } },
      },
      _sum: { payableHours: true },
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
  const paidHours = paidAgg._sum.payableHours ?? new Prisma.Decimal(0)
  const hourlyEarned = paidHours.times(payHourly).toDecimalPlaces(2)
  const commissionBase = commAgg._sum.amountUsd ?? new Prisma.Decimal(0)
  const commissionAmount = commissionBase.times(commissionPct).div(100).toDecimalPlaces(2)
  // Employee-referral bonus over the SAME period window (P-9b, §4.2).
  const referralBonusAmount = await computeEmployeeReferralBonus(tx, {
    agencyId: args.agencyId,
    executorId: args.executorId,
    from: bounds.start,
    to: bounds.end,
  })
  const total = baseSalary.plus(hourlyEarned).plus(commissionAmount).plus(referralBonusAmount)

  const payout = await tx.executorPayout.upsert({
    where: {
      agencyId_executorId_period: {
        agencyId: args.agencyId,
        executorId: args.executorId,
        period: args.period,
      },
    },
    create: {
      agencyId: args.agencyId,
      executorId: args.executorId,
      period: args.period,
      baseSalary,
      billableHours,
      paidHours,
      hourlyEarned,
      commissionAmount,
      referralBonusAmount,
      total,
      currency,
      status: 'draft',
    },
    update: {
      baseSalary,
      billableHours,
      paidHours,
      hourlyEarned,
      commissionAmount,
      referralBonusAmount,
      total,
      currency,
    },
    select: PAYOUT_SELECT,
  })
  return payoutDto(payout)
}
