import { randomUUID } from 'node:crypto'
import { Prisma } from '@workflo/db'
import {
  DEFAULT_REFERRAL_TIERS,
  type ReferralTier,
  WalletTxnSource,
  getReferralPercent,
  referralTierSchema,
} from '@workflo/types'
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
}

/**
 * Resolve an agency's referral program config. No settings row → the program is
 * ON with default tiers (out-of-box); a row governs `enabled` + custom tiers.
 *
 * NOTE: read in-tx (no cache) for correctness — a tier edit takes effect on the
 * next payment with no staleness window. A 5-min cache is a future optimization.
 */
export async function resolveReferralConfig(
  tx: Prisma.TransactionClient,
  agencyId: string
): Promise<ReferralConfig> {
  const settings = await tx.referralSettings.findUnique({
    where: { agencyId },
    select: { enabled: true, tiers: true },
  })
  if (!settings) return { enabled: true, tiers: DEFAULT_REFERRAL_TIERS }
  return { enabled: settings.enabled, tiers: parseReferralTiers(settings.tiers) }
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
