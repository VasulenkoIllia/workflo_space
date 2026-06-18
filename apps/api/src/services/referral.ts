import { randomUUID } from 'node:crypto'
import { Prisma } from '@workflo/db'
import {
  DEFAULT_REFERRAL_TIERS,
  type ReferralTier,
  WalletTxnSource,
  getReferralPercent,
  referralTierSchema,
} from '@workflo/types'
import { computeClientNetIncomeUsd } from './margin.js'
import { walletCredit } from './wallet.js'

/**
 * Referral accrual (S5-06, module 09). When a referred company's payment is
 * confirmed, depth-1 referrer earns a percent of it as a bonus-wallet credit.
 * Invoked from `confirmManualPayment` INSIDE the same tenant transaction, so the
 * bonus and the triggering payment commit together.
 *
 * Idempotency is the `ReferralBonus @@unique([sourceType, sourceId])` constraint:
 * a given payment accrues at most ONE bonus, no matter how often the hook runs
 * (retry, replay, double-process). The accrued `percent` is snapshotted on the
 * row, so later tier edits never rewrite a historical bonus.
 */

export interface ReferralPaymentRef {
  id: string
  agencyId: string
  companyId: string
  amountUsd: Prisma.Decimal | number | null
}

export interface ReferralAccrual {
  bonusId: string
  referrerId: string
  amount: string
  percent: number
}

/** Validate the per-agency tier JSON; fall back to defaults if absent/empty/malformed. */
export function parseReferralTiers(raw: unknown): ReferralTier[] {
  const parsed = referralTierSchema.array().safeParse(raw)
  if (parsed.success && parsed.data.length > 0) return parsed.data
  return DEFAULT_REFERRAL_TIERS
}

export interface ReferralConfig {
  enabled: boolean
  tiers: ReferralTier[]
  /** Employee-referral % of a referred client's net income (P-9b, §4.2). Opt-in: default 0. */
  employeeReferralPercent: number
}

/**
 * Resolve an agency's referral program config. No settings row → company-referral is
 * ON with default tiers (out-of-box) and employee-referral is OFF (0%); a row governs
 * `enabled`, custom tiers, and the employee-referral percent.
 *
 * NOTE: read in-tx (no cache) for correctness — an edit takes effect on the next
 * payment/payout with no staleness window. A 5-min cache is a future optimization.
 */
export async function resolveReferralConfig(
  tx: Prisma.TransactionClient,
  agencyId: string
): Promise<ReferralConfig> {
  const settings = await tx.referralSettings.findUnique({
    where: { agencyId },
    select: { enabled: true, tiers: true, employeeReferralPercent: true },
  })
  if (!settings) return { enabled: true, tiers: DEFAULT_REFERRAL_TIERS, employeeReferralPercent: 0 }
  return {
    enabled: settings.enabled,
    tiers: parseReferralTiers(settings.tiers),
    employeeReferralPercent: Number(settings.employeeReferralPercent),
  }
}

/**
 * Employee-referral bonus (P-9b, PROJECTS_SPEC §4.2). The employee who brought a client
 * (`Company.referredByEmployeeId`) earns a flat percent of the NET income (Σ project
 * margin) those clients produced in `[from, to]`. П4: one % per client, aggregated over
 * the whole client. Recomputed as part of the payout draft (no separate ledger), so it
 * tracks margin/rate/setting edits until the payout is approved. A client running at a
 * loss contributes nothing (clamped per-client — never a negative bonus).
 */
export async function computeEmployeeReferralBonus(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; executorId: string; from: Date; to: Date }
): Promise<Prisma.Decimal> {
  const settings = await tx.referralSettings.findUnique({
    where: { agencyId: args.agencyId },
    select: { employeeReferralPercent: true },
  })
  const percent = new Prisma.Decimal(settings?.employeeReferralPercent ?? 0)
  if (!percent.greaterThan(0)) return new Prisma.Decimal(0)

  const clients = await tx.company.findMany({
    where: { agencyId: args.agencyId, referredByEmployeeId: args.executorId },
    select: { id: true },
  })
  if (clients.length === 0) return new Prisma.Decimal(0)

  let netTotal = new Prisma.Decimal(0)
  for (const c of clients) {
    const net = await computeClientNetIncomeUsd(tx, {
      agencyId: args.agencyId,
      companyId: c.id,
      from: args.from,
      to: args.to,
    })
    if (net.greaterThan(0)) netTotal = netTotal.plus(net) // a loss-making client adds nothing
  }
  return netTotal.times(percent).div(100).toDecimalPlaces(2)
}

/**
 * Accrue (at most once) the referral bonus for a confirmed payment. Returns the
 * accrual, or `null` for every no-op case (no referrer, program disabled, 0%,
 * already accrued) — it never throws on those, so a normal payment is unaffected.
 */
export async function processReferralBonus(
  tx: Prisma.TransactionClient,
  payment: ReferralPaymentRef
): Promise<ReferralAccrual | null> {
  const paidUsd = new Prisma.Decimal(payment.amountUsd ?? 0)
  if (!paidUsd.greaterThan(0)) return null

  const company = await tx.company.findUnique({
    where: { id: payment.companyId },
    select: { referredById: true },
  })
  const referrerId = company?.referredById
  if (!referrerId || referrerId === payment.companyId) return null

  // Referrals are intra-agency only. A cross-agency `referredById` (data error) must
  // NOT accrue: the aggregate below would read another tenant's revenue, and the
  // walletCredit would 404 on the referrer's agency mismatch and roll back the payment.
  const referrer = await tx.company.findUnique({
    where: { id: referrerId },
    select: { agencyId: true },
  })
  if (!referrer || referrer.agencyId !== payment.agencyId) return null

  const config = await resolveReferralConfig(tx, payment.agencyId)
  if (!config.enabled) return null

  // Referrer's standing = their own lifetime confirmed revenue (USD snapshot), scoped to the tenant.
  const lifetimeAgg = await tx.payment.aggregate({
    where: { agencyId: payment.agencyId, companyId: referrerId, status: 'confirmed' },
    _sum: { amountUsd: true },
  })
  // Clamp to 2dp before crossing into the number-typed tier comparator (avoids FP noise at thresholds).
  const lifetime = Number((lifetimeAgg._sum.amountUsd ?? new Prisma.Decimal(0)).toDecimalPlaces(2))
  const percent = getReferralPercent(config.tiers, lifetime)
  if (percent <= 0) return null

  const bonusAmount = paidUsd.times(percent).div(100).toDecimalPlaces(2)
  if (!bonusAmount.greaterThan(0)) return null

  // The relationship row carries totalEarned; create it lazily if onboarding didn't.
  // AR-21: the row is tenant-stamped — both companies are same-agency (guarded above).
  const referral = await tx.referral.upsert({
    where: { referrerId_referredId: { referrerId, referredId: payment.companyId } },
    create: { agencyId: payment.agencyId, referrerId, referredId: payment.companyId },
    update: {},
    select: { id: true },
  })

  // Idempotent accrual: one bonus per (sourceType, sourceId). Conflict → already done.
  const bonusId = randomUUID()
  const inserted = await tx.$executeRaw`
    INSERT INTO "referral_bonuses" ("id", "referralId", "amount", "percent", "sourceType", "sourceId", "createdAt")
    VALUES (${bonusId}, ${referral.id}, ${bonusAmount}, ${percent}, 'payment', ${payment.id}, now())
    ON CONFLICT ("sourceType", "sourceId") DO NOTHING
  `
  if (inserted === 0) return null

  await walletCredit(tx, {
    agencyId: payment.agencyId,
    companyId: referrerId,
    source: WalletTxnSource.REFERRAL_BONUS,
    amount: bonusAmount,
    sourceId: bonusId,
  })
  await tx.referral.update({
    where: { id: referral.id },
    data: { totalEarned: { increment: bonusAmount } },
  })

  return { bonusId, referrerId, amount: bonusAmount.toFixed(2), percent }
}
