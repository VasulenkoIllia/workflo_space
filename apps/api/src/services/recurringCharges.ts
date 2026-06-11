import { Prisma } from '@workflo/db'
import { LOYALTY_DISCOUNT_PCT, type LoyaltyTier } from '@workflo/types'
import { refreshMoneyBalance } from './allocation.js'

/**
 * Recurring service-charge generation (S5-03b). One charge per
 * `(companyServiceId, month)` — the `@@unique` constraint makes generation
 * idempotent, so the monthly cron, a manual replay, and a double-run all converge
 * to the same rows. The loyalty discount is applied here at creation time from the
 * company's effective tier (S5-09 later adds the tier-recalc cron + per-invoice
 * override; the discount math is this single place).
 *
 * Runs inside the caller's transaction: the cron wraps all tenants (worker /
 * RLS-bypass); the manual `generate` endpoint scopes to one agency.
 */

const MAX_CATCHUP_PERIODS = 24 // backstop so a stale nextChargeAt can't spin forever

/** First instant (UTC) of the month containing `d`. The canonical `ServiceCharge.month` value. */
export function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

/** Advance a first-of-month anchor by one billing period. */
export function addFrequency(d: Date, frequency: string): Date {
  const months = frequency === 'annual' ? 12 : frequency === 'quarterly' ? 3 : 1
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
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
  /** Charge every subscription whose `nextChargeAt` is at or before this instant. */
  now: Date
  /** Scope to one tenant (the manual endpoint); omit for the cross-tenant cron. */
  agencyId?: string
}

export interface GenerateResult {
  /** Newly-inserted charge rows (existing ones are skipped by the unique constraint). */
  created: number
  /** Subscriptions found due this run. */
  due: number
}

/**
 * Generate the charges owed up to `opts.now` and advance each subscription's
 * `nextChargeAt`. Idempotent: re-running creates no duplicates (skipDuplicates →
 * `ON CONFLICT DO NOTHING`), and a subscription already advanced past `now` is not
 * re-billed.
 */
export async function generateRecurringCharges(
  tx: Prisma.TransactionClient,
  opts: GenerateOptions
): Promise<GenerateResult> {
  const due = await tx.companyService.findMany({
    where: {
      active: true,
      nextChargeAt: { lte: opts.now },
      service: { is: { isActive: true, isRecurring: true } },
      ...(opts.agencyId ? { company: { is: { agencyId: opts.agencyId } } } : {}),
    },
    select: {
      id: true,
      customPrice: true,
      frequency: true,
      nextChargeAt: true,
      companyId: true,
      company: {
        select: { agencyId: true, currency: true, loyaltyTier: true, tierOverride: true },
      },
    },
  })

  const rows: Prisma.ServiceChargeCreateManyInput[] = []
  const advances: Array<{ id: string; nextChargeAt: Date }> = []

  for (const cs of due) {
    if (!cs.nextChargeAt) continue
    const tier = (cs.company.tierOverride ?? cs.company.loyaltyTier) as LoyaltyTier
    let cursor = cs.nextChargeAt
    let guard = 0
    while (cursor <= opts.now && guard < MAX_CATCHUP_PERIODS) {
      const month = startOfMonthUtc(cursor)
      const amounts = computeChargeAmounts(cs.customPrice, tier)
      rows.push({
        agencyId: cs.company.agencyId,
        companyId: cs.companyId,
        companyServiceId: cs.id,
        amount: amounts.totalAmount,
        baseAmount: amounts.baseAmount,
        discountPct: amounts.discountPct,
        discountAmount: amounts.discountAmount,
        totalAmount: amounts.totalAmount,
        currency: cs.company.currency,
        month,
        status: 'pending',
        dueDate: addFrequency(month, 'monthly'), // due by the end of the charge month
      })
      cursor = addFrequency(cursor, cs.frequency)
      guard++
    }
    advances.push({ id: cs.id, nextChargeAt: cursor })
  }

  let created = 0
  if (rows.length > 0) {
    const res = await tx.serviceCharge.createMany({ data: rows, skipDuplicates: true })
    created = res.count
  }
  for (const a of advances) {
    await tx.companyService.update({ where: { id: a.id }, data: { nextChargeAt: a.nextChargeAt } })
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
