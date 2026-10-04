import { LOYALTY_TIER_THRESHOLDS_USD, LoyaltyTier } from '@workflo/types'

/**
 * S11-07 RETENTION: аналітика клієнтської бази (life-time, без вікна дат).
 *  - тір-розподіл компаній (NEW/REGULAR/PARTNER/VIP);
 *  - repeat rate = % компаній з 2+ замовленнями серед тих, хто має хоч одне;
 *  - медіана днів між 1-м і 2-м замовленням (компанії з 2+);
 *  - конверсія NEW→REGULAR: серед «зрілих» компаній (90+ днів у системі) — %
 *    що досягли REGULAR-порога lifetime-оплат ($1000, канон LOYALTY_TIER_THRESHOLDS_USD);
 *  - активність: остання подія (замовлення АБО confirmed-платіж; нема жодної →
 *    createdAt компанії): <60 дн = active, 60–120 = at_risk, >120 = churned;
 *  - топ at-risk/churned клієнтів для проактивної роботи.
 */

const DAY_MS = 86_400_000
const MATURE_DAYS = 90
const AT_RISK_DAYS = 60
const CHURNED_DAYS = 120

export interface AtRiskClient {
  id: string
  name: string
  lastActivityAt: string
  daysSince: number
  lifetimeUsd: string
  tier: string
}

export interface RetentionReport {
  totalCompanies: number
  tierCounts: { tier: string; count: number }[]
  /** % компаній з 2+ замовленнями серед компаній з ≥1 замовленням. */
  repeatRatePct: string
  companiesWithOrders: number
  companiesWithRepeat: number
  /** Медіана днів між 1-м і 2-м замовленням (null — нема компаній з 2+). */
  medianDaysToSecondOrder: number | null
  /** Конверсія NEW→REGULAR серед зрілих (90+ днів) компаній. */
  newToRegularPct: string
  matureCompanies: number
  convertedCompanies: number
  activity: { active: number; atRisk: number; churned: number }
  /** at_risk + churned, відсортовані за давністю (спершу найсвіжіші втрати). */
  atRiskClients: AtRiskClient[]
}

interface Db {
  company: {
    findMany: (args: {
      where: { agencyId: string }
      select: {
        id: true
        name: true
        loyaltyTier: true
        totalSpent: true
        createdAt: true
      }
      take: number
    }) => Promise<
      Array<{
        id: string
        name: string
        loyaltyTier: string
        totalSpent: unknown
        createdAt: Date
      }>
    >
  }
  order: {
    // Перші 2 замовлення per company (ASC) — для медіани time-to-2nd.
    findMany: (args: {
      where: { agencyId: string; deletedAt: null; companyId: { not: null } }
      select: { companyId: true; createdAt: true }
      orderBy: { createdAt: 'asc' }
      take: number
    }) => Promise<Array<{ companyId: string | null; createdAt: Date }>>
    // audit-M4: остання активність — max(createdAt) per company (без take-зрізу,
    // інакше при >10k замовлень активні клієнти хибно ставали churned).
    groupBy: (args: {
      by: ['companyId']
      where: { agencyId: string; deletedAt: null; companyId: { not: null } }
      _max: { createdAt: true }
    }) => Promise<Array<{ companyId: string | null; _max: { createdAt: Date | null } }>>
  }
  payment: {
    groupBy: (args: {
      by: ['companyId']
      where: { agencyId: string; status: 'confirmed' }
      _max: { confirmedAt: true }
    }) => Promise<Array<{ companyId: string; _max: { confirmedAt: Date | null } }>>
  }
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? null)
    : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
}

export async function computeRetentionReport(
  db: Db,
  opts: { agencyId: string; now?: Date }
): Promise<RetentionReport> {
  const now = opts.now ?? new Date()
  const [companies, orders, orderActivity, paymentActivity] = await Promise.all([
    db.company.findMany({
      where: { agencyId: opts.agencyId },
      select: { id: true, name: true, loyaltyTier: true, totalSpent: true, createdAt: true },
      take: 2000,
    }),
    // Перші замовлення (ASC) — беремо найдавніші, тож перші-2 per company коректні.
    db.order.findMany({
      where: { agencyId: opts.agencyId, deletedAt: null, companyId: { not: null } },
      select: { companyId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 10_000,
    }),
    // Остання активність — агрегат max, без take-зрізу (audit-M4).
    db.order.groupBy({
      by: ['companyId'],
      where: { agencyId: opts.agencyId, deletedAt: null, companyId: { not: null } },
      _max: { createdAt: true },
    }),
    db.payment.groupBy({
      by: ['companyId'],
      where: { agencyId: opts.agencyId, status: 'confirmed' },
      _max: { confirmedAt: true },
    }),
  ])

  // Перші два замовлення per company (для медіани time-to-2nd)
  const firstTwo = new Map<string, Date[]>()
  for (const o of orders) {
    if (!o.companyId) continue
    const arr = firstTwo.get(o.companyId) ?? []
    if (arr.length < 2) {
      arr.push(o.createdAt)
      firstTwo.set(o.companyId, arr)
    }
  }

  // Остання активність per company: max(замовлення) ∪ max(confirmed-платіж)
  const lastActivity = new Map<string, Date>()
  for (const o of orderActivity) {
    if (o.companyId && o._max.createdAt) lastActivity.set(o.companyId, o._max.createdAt)
  }
  for (const p of paymentActivity) {
    const d = p._max.confirmedAt
    if (!d) continue
    const prev = lastActivity.get(p.companyId)
    if (!prev || d > prev) lastActivity.set(p.companyId, d)
  }

  // Тір-розподіл (стабільний порядок за каноном)
  const tierOrder = [LoyaltyTier.NEW, LoyaltyTier.REGULAR, LoyaltyTier.PARTNER, LoyaltyTier.VIP]
  const tierCounts = tierOrder.map((tier) => ({
    tier,
    count: companies.filter((c) => c.loyaltyTier === String(tier)).length,
  }))

  // Repeat rate + медіана до 2-го замовлення
  const withOrders = [...firstTwo.values()]
  const companiesWithOrders = withOrders.length
  const gaps = withOrders
    .filter((arr): arr is [Date, Date] => arr.length >= 2)
    .map((arr) => Math.round((arr[1].getTime() - arr[0].getTime()) / DAY_MS))
    .sort((a, b) => a - b)
  const companiesWithRepeat = gaps.length
  const repeatRatePct =
    companiesWithOrders > 0 ? ((companiesWithRepeat / companiesWithOrders) * 100).toFixed(1) : '0.0'

  // Конверсія NEW→REGULAR серед зрілих компаній
  const matureCutoff = new Date(now.getTime() - MATURE_DAYS * DAY_MS)
  const regularThreshold = LOYALTY_TIER_THRESHOLDS_USD[LoyaltyTier.REGULAR]
  const mature = companies.filter((c) => c.createdAt <= matureCutoff)
  const converted = mature.filter((c) => Number(c.totalSpent ?? 0) >= regularThreshold)
  const newToRegularPct =
    mature.length > 0 ? ((converted.length / mature.length) * 100).toFixed(1) : '0.0'

  // Активність (нема подій → createdAt: новий клієнт без замовлень = ще не «churned»)
  const activity = { active: 0, atRisk: 0, churned: 0 }
  const risky: AtRiskClient[] = []
  for (const c of companies) {
    const last = lastActivity.get(c.id) ?? c.createdAt
    const daysSince = Math.floor((now.getTime() - last.getTime()) / DAY_MS)
    if (daysSince < AT_RISK_DAYS) activity.active += 1
    else {
      if (daysSince <= CHURNED_DAYS) activity.atRisk += 1
      else activity.churned += 1
      risky.push({
        id: c.id,
        name: c.name,
        lastActivityAt: last.toISOString(),
        daysSince,
        lifetimeUsd: Number(c.totalSpent ?? 0).toFixed(2),
        tier: c.loyaltyTier,
      })
    }
  }
  risky.sort((a, b) => a.daysSince - b.daysSince)

  return {
    totalCompanies: companies.length,
    tierCounts,
    repeatRatePct,
    companiesWithOrders,
    companiesWithRepeat,
    medianDaysToSecondOrder: median(gaps),
    newToRegularPct,
    matureCompanies: mature.length,
    convertedCompanies: converted.length,
    activity,
    atRiskClients: risky.slice(0, 20),
  }
}
