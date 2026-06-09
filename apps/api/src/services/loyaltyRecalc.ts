import { Prisma } from '@workflo/db'
import { LoyaltyTier, calculateLoyaltyTier } from '@workflo/types'

/**
 * Loyalty tier recalculation (S5-09, module 10). Run by the nightly cron across all
 * tenants. Per company:
 *  - `lifetimePaidUsd = Σ Payment.amountUsd WHERE status=confirmed` — refunds
 *    (status=refunded) and bonus payments (amountUsd=0) are excluded by construction;
 *  - `totalSpent` is refreshed every run — the cron is the ONLY writer of this cache;
 *  - the earned `loyaltyTier` moves **upgrade-only** (never auto-downgrades, e.g. after
 *    a refund) and only for companies WITHOUT a manual `tierOverride` (which the cron
 *    never clobbers);
 *  - each upgrade appends a `LoyaltyTierHistory` row (append-only audit).
 *
 * Idempotent: re-running recomputes `totalSpent` identically and, since upgrades are
 * rank-gated, produces no further tier change or history once a tier is reached.
 */

const TIER_RANK: Record<string, number> = {
  [LoyaltyTier.NEW]: 0,
  [LoyaltyTier.REGULAR]: 1,
  [LoyaltyTier.PARTNER]: 2,
  [LoyaltyTier.VIP]: 3,
}

export interface RecalcResult {
  scanned: number
  upgraded: number
}

export async function recalcLoyaltyTiers(
  tx: Prisma.TransactionClient,
  opts: { agencyId?: string } = {}
): Promise<RecalcResult> {
  const companies = await tx.company.findMany({
    where: opts.agencyId ? { agencyId: opts.agencyId } : {},
    select: { id: true, agencyId: true, loyaltyTier: true, tierOverride: true },
  })

  let upgraded = 0
  for (const c of companies) {
    const agg = await tx.payment.aggregate({
      where: { companyId: c.id, status: 'confirmed' },
      _sum: { amountUsd: true },
    })
    const lifetime = agg._sum.amountUsd ?? new Prisma.Decimal(0)

    const data: Prisma.CompanyUpdateInput = { totalSpent: lifetime }
    let upgradedTo: LoyaltyTier | null = null

    // A manual override pins the effective tier — the cron never auto-moves it.
    if (!c.tierOverride) {
      const earned = calculateLoyaltyTier(Number(lifetime))
      if ((TIER_RANK[earned] ?? 0) > (TIER_RANK[c.loyaltyTier] ?? 0)) {
        data.loyaltyTier = earned
        upgradedTo = earned
      }
    }

    await tx.company.update({ where: { id: c.id }, data })

    if (upgradedTo) {
      await tx.loyaltyTierHistory.create({
        data: {
          agencyId: c.agencyId,
          companyId: c.id,
          fromTier: c.loyaltyTier as LoyaltyTier,
          toTier: upgradedTo,
          reason: 'auto_recalc',
        },
      })
      upgraded += 1
      // S6: dispatch `loyalty.tier_upgraded` (email + telegram + in_app) — deferred to
      // the notification sprint; the LoyaltyTierHistory row is the durable record.
    }
  }

  return { scanned: companies.length, upgraded }
}
