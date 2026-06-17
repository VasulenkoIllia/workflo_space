import { Prisma } from '@workflo/db'
import { LOYALTY_DISCOUNT_PCT, type LoyaltyTier } from '@workflo/types'
import { refreshMoneyBalance } from './allocation.js'

/**
 * Recurring project-charge generation (05-ПРОЕКТИ, S5.6 P-1 3b). One charge per
 * `(projectId, periodStart)` — the `@@unique` constraint makes generation
 * idempotent, so the monthly cron, a manual replay, and a double-run all converge
 * to the same rows. The loyalty discount is applied here at creation time from the
 * project company's effective tier (the discount math lives in this single place).
 *
 * Scope (P-2a) on a `monthly_day_n` cycle: `fixed_monthly_advance` — abonAmount
 * billed up-front for the upcoming month; `hourly_postpaid` — Σ(hours ×
 * clientRateSnapshot) for the month that just ended (no work → no charge). The
 * `hourly_prepaid` reconcile, hybrid overage, and weekly/manual cycle modes are
 * the remaining P-2 work (PROJECTS_SPEC §3).
 *
 * Runs inside the caller's transaction: the cron wraps all tenants (worker /
 * RLS-bypass); the manual `generate` endpoint scopes to one agency.
 */

const MAX_CATCHUP_PERIODS = 24 // backstop so a stale nextCycleAt can't spin forever

/** First instant (UTC) of the month containing `d`. The canonical period anchor. */
export function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

/** First instant (UTC) of the month after `d` — advances a monthly anchor by one cycle. */
function addMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
}

/** Shift `d` by `n` calendar days (UTC) — advances/rewinds a weekly anchor/period. */
function addDaysUtc(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n))
}

/** Last calendar day (UTC) of the month containing `d` — the cycle's periodEnd. */
function endOfMonthDateUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

/** First instant (UTC) of the month BEFORE `d` — the period a postpaid close bills. */
function firstOfPrevMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
}

/**
 * Σ(billable revenue) for a project's time in [periodStart, periodEnd] — the
 * snapshotted client rate per hour (P-5) times hours. zeroBilled tasks carry a
 * `clientRateSnapshot` of 0, so they contribute nothing (cost-only) automatically.
 */
async function sumBillableRevenue(
  tx: Prisma.TransactionClient,
  projectId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Prisma.Decimal> {
  const rows = await tx.$queryRaw<Array<{ revenue: Prisma.Decimal | string | null }>>`
    SELECT COALESCE(SUM(t."hours" * t."clientRateSnapshot"), 0) AS revenue
    FROM "time_logs" t
    JOIN "orders" o ON o."id" = t."orderId"
    WHERE o."projectId" = ${projectId}
      AND t."date" >= ${periodStart}
      AND t."date" <= ${periodEnd}
  `
  return new Prisma.Decimal(rows[0]?.revenue ?? 0)
}

export interface ChargeAmounts {
  baseAmount: Prisma.Decimal
  discountPct: Prisma.Decimal
  discountAmount: Prisma.Decimal
  totalAmount: Prisma.Decimal
}

/** Apply the tier's auto-discount to a base price. Pure Decimal — no `Number` rounding drift. */
export function computeChargeAmounts(base: Prisma.Decimal, tier: LoyaltyTier): ChargeAmounts {
  const pct = LOYALTY_DISCOUNT_PCT[tier] ?? 0
  const discountAmount = base.times(pct).div(100).toDecimalPlaces(2)
  return {
    baseAmount: base,
    discountPct: new Prisma.Decimal(pct),
    discountAmount,
    totalAmount: base.minus(discountAmount),
  }
}

export interface GenerateOptions {
  /** Charge every project whose `nextCycleAt` is at or before this instant. */
  now: Date
  /** Scope to one tenant (the manual endpoint); omit for the cross-tenant cron. */
  agencyId?: string
}

export interface GenerateResult {
  /** Newly-inserted charge rows (existing ones are skipped by the unique constraint). */
  created: number
  /** Projects found due this run. */
  due: number
}

/**
 * Generate the charges owed up to `opts.now` and advance each project's
 * `nextCycleAt`. Idempotent: re-running creates no duplicates (skipDuplicates →
 * `ON CONFLICT DO NOTHING`), and a project already advanced past `now` is not
 * re-billed.
 */
export async function generateRecurringCharges(
  tx: Prisma.TransactionClient,
  opts: GenerateOptions
): Promise<GenerateResult> {
  const due = await tx.project.findMany({
    where: {
      active: true,
      billingModel: { in: ['fixed_monthly_advance', 'hourly_postpaid'] },
      billingCycle: { in: ['monthly_day_n', 'weekly_day_x'] }, // manual → nextCycleAt null, not due
      nextCycleAt: { lte: opts.now },
      ...(opts.agencyId ? { agencyId: opts.agencyId } : {}),
    },
    select: {
      id: true,
      agencyId: true,
      companyId: true,
      currency: true,
      billingModel: true,
      billingCycle: true,
      abonAmount: true,
      nextCycleAt: true,
      company: { select: { loyaltyTier: true, tierOverride: true } },
    },
  })

  const rows: Prisma.ServiceChargeCreateManyInput[] = []
  const advances: Array<{ id: string; nextCycleAt: Date }> = []

  for (const p of due) {
    if (!p.nextCycleAt) continue
    const tier = (p.company.tierOverride ?? p.company.loyaltyTier) as LoyaltyTier
    const weekly = p.billingCycle === 'weekly_day_x'
    const advance = weekly ? (d: Date) => addDaysUtc(d, 7) : addMonthUtc
    let cursor = p.nextCycleAt
    let guard = 0
    while (cursor <= opts.now && guard < MAX_CATCHUP_PERIODS) {
      // Period + base differ by model: fixed bills the UPCOMING month in advance;
      // hourly_postpaid bills the cycle that just ENDED, by actual hours. weekly_day_x
      // applies to hourly billing (owner's «щопонеділка»); fixed stays monthly (P-2).
      let periodStart: Date
      let periodEnd: Date
      let dueDate: Date
      let base: Prisma.Decimal | null
      if (p.billingModel === 'fixed_monthly_advance') {
        periodStart = startOfMonthUtc(cursor)
        periodEnd = endOfMonthDateUtc(periodStart)
        dueDate = addMonthUtc(periodStart)
        base = p.abonAmount ?? null
      } else {
        if (weekly) {
          periodStart = addDaysUtc(cursor, -7) // the week that just closed
          periodEnd = addDaysUtc(cursor, -1)
          dueDate = addDaysUtc(cursor, 7)
        } else {
          periodStart = firstOfPrevMonthUtc(cursor)
          periodEnd = endOfMonthDateUtc(periodStart)
          dueDate = addMonthUtc(periodStart)
        }
        const revenue = await sumBillableRevenue(tx, p.id, periodStart, periodEnd)
        base = revenue.isZero() ? null : revenue // no billable work → no charge
      }
      if (base) {
        const amounts = computeChargeAmounts(base, tier)
        rows.push({
          agencyId: p.agencyId,
          companyId: p.companyId,
          projectId: p.id,
          amount: amounts.totalAmount,
          baseAmount: amounts.baseAmount,
          discountPct: amounts.discountPct,
          discountAmount: amounts.discountAmount,
          totalAmount: amounts.totalAmount,
          currency: p.currency,
          month: periodStart,
          periodStart,
          periodEnd,
          status: 'pending',
          dueDate,
        })
      }
      cursor = advance(cursor)
      guard++
    }
    advances.push({ id: p.id, nextCycleAt: cursor })
  }

  let created = 0
  if (rows.length > 0) {
    const res = await tx.serviceCharge.createMany({ data: rows, skipDuplicates: true })
    created = res.count
  }
  for (const a of advances) {
    await tx.project.update({ where: { id: a.id }, data: { nextCycleAt: a.nextCycleAt } })
  }

  // AR-11: new charges change Σ(charge.totalAmount) — refresh each affected company's
  // cached moneyBalance in the same tx (sorted for a deterministic lock order; the
  // recompute is a full re-read, so refreshing a skipDuplicates no-op is harmless).
  if (rows.length > 0) {
    const companies = new Map<string, string>()
    for (const r of rows) companies.set(r.companyId, r.agencyId)
    for (const companyId of [...companies.keys()].sort()) {
      const agencyId = companies.get(companyId)
      if (!agencyId) continue
      await refreshMoneyBalance(tx, { agencyId, companyId })
    }
  }

  return { created, due: due.length }
}

/** Parse a `YYYY-MM` to the last instant of that month (UTC) — the `now` a manual generate uses. */
export function endOfMonthUtc(month: string): Date {
  const parts = month.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1]) // 1-based; as a 0-based monthIndex this is the NEXT month
  // First instant of the next month minus 1ms.
  return new Date(Date.UTC(y, m, 1) - 1)
}
