import { Prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import { refreshMoneyBalance } from './allocation.js'

/**
 * One-time manual discount on a charge (S5.6 P-10, 05-З). Applied ON TOP of the auto
 * loyalty discount: the reduction is computed off the POST-LOYALTY net (`baseAmount −
 * loyaltyDiscount`), so re-applying with a new value is stable (never compounds on an
 * already-discounted total). A percent and/or a flat amount may be given; the combined
 * reduction is clamped to the net (a charge can drop to 0, never negative). Pure Decimal.
 */
export interface ManualDiscountInput {
  pct?: Prisma.Decimal | null
  amount?: Prisma.Decimal | null
}

export interface ManualDiscountResult {
  /** Resolved absolute reduction folded into the new total (stored as manualDiscountAmount). */
  manualDiscountAmount: Prisma.Decimal
  /** New post-loyalty-and-manual amount owed. */
  totalAmount: Prisma.Decimal
}

export function computeManualDiscount(
  postLoyaltyNet: Prisma.Decimal,
  input: ManualDiscountInput
): ManualDiscountResult {
  let discount = new Prisma.Decimal(0)
  if (input.pct && input.pct.greaterThan(0)) {
    discount = discount.plus(postLoyaltyNet.times(input.pct).div(100))
  }
  if (input.amount && input.amount.greaterThan(0)) {
    discount = discount.plus(input.amount)
  }
  // Clamp to the net — a discount can zero a charge but never make it negative.
  discount = Prisma.Decimal.min(discount, postLoyaltyNet).toDecimalPlaces(2)
  return {
    manualDiscountAmount: discount,
    totalAmount: postLoyaltyNet.minus(discount).toDecimalPlaces(2),
  }
}

/** Post-loyalty net of a charge = baseAmount − loyalty discountAmount (stable base for manual). */
export function postLoyaltyNet(charge: {
  baseAmount: Prisma.Decimal | null
  amount: Prisma.Decimal
  discountAmount: Prisma.Decimal | null
}): Prisma.Decimal {
  const base = charge.baseAmount ?? charge.amount
  return base.minus(charge.discountAmount ?? new Prisma.Decimal(0))
}

/** Fields a discounted charge is returned with (shared by the route DTO + tests). */
export const DISCOUNT_CHARGE_SELECT = {
  id: true,
  companyId: true,
  amount: true,
  baseAmount: true,
  discountPct: true,
  discountAmount: true,
  manualDiscountPct: true,
  manualDiscountAmount: true,
  totalAmount: true,
  currency: true,
  month: true,
  status: true,
  dueDate: true,
  paidAt: true,
} satisfies Prisma.ServiceChargeSelect

/**
 * Apply (or update) a charge's one-time manual discount inside a tenant tx: load &
 * tenant-check the charge, block if it already has allocations (settled — changing the
 * discount would desync the allocation/overpaid math), recompute total off the stable
 * post-loyalty net, persist, and refresh the cached moneyBalance. Caller (owner-gated
 * route) audits. Throws 404 (not in tenant) / 409 (already has payments).
 */
export async function applyChargeDiscount(
  tx: Prisma.TransactionClient,
  args: {
    agencyId: string
    chargeId: string
    pct: Prisma.Decimal | null
    amount: Prisma.Decimal | null
  }
): Promise<Prisma.ServiceChargeGetPayload<{ select: typeof DISCOUNT_CHARGE_SELECT }>> {
  const existing = await tx.serviceCharge.findUnique({
    where: { id: args.chargeId },
    select: {
      id: true,
      agencyId: true,
      companyId: true,
      status: true,
      baseAmount: true,
      amount: true,
      discountAmount: true,
      _count: { select: { allocations: true } },
    },
  })
  if (!existing || existing.agencyId !== args.agencyId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Нарахування не знайдено', 404)
  }
  // A charge with payments (any allocation) or a written-off charge is settled — changing
  // its total would desync allocation/overpaid math or revive a forgiven debt.
  if (existing._count.allocations > 0 || existing.status === 'written_off') {
    throw new AppError(
      ApiErrorCode.CONFLICT,
      'Не можна змінювати знижку на нарахування з платежами або списане',
      409
    )
  }
  const { manualDiscountAmount, totalAmount } = computeManualDiscount(postLoyaltyNet(existing), {
    pct: args.pct,
    amount: args.amount,
  })
  // Clearing (resolved reduction = 0) nulls the markers, so "cleared" reads the same as
  // "never discounted" — matching how the loyalty discountPct is stored.
  const cleared = manualDiscountAmount.isZero()
  const updated = await tx.serviceCharge.update({
    where: { id: existing.id },
    data: {
      manualDiscountPct: cleared ? null : args.pct,
      manualDiscountAmount: cleared ? null : manualDiscountAmount,
      totalAmount,
      amount: totalAmount,
    },
    select: DISCOUNT_CHARGE_SELECT,
  })
  // AR-11: a changed total moves Σ(charges) → refresh the cached moneyBalance in-tx.
  await refreshMoneyBalance(tx, { agencyId: args.agencyId, companyId: existing.companyId })
  return updated
}
