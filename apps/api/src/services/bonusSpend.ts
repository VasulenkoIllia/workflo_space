import { Prisma } from '@workflo/db'
import { ApiErrorCode, AppError, WalletTxnSource } from '@workflo/types'
import { type AllocatedChargeResult, allocatePayment } from './allocation.js'
import { walletDebit } from './wallet.js'

/**
 * Pay a service charge with bonus balance (S5-08, module 25). Composes the S5-05
 * bonus ledger with the S5-07 money-account WITHOUT corrupting either:
 *
 *  - a bonus is NOT revenue and NOT real money, so the backing `Payment` is stamped
 *    `provider='bonus'` with **`amountUsd = 0`** — every USD aggregation
 *    (moneyBalance, P&L revenue, loyalty lifetime, overview) sums `amountUsd`, so a
 *    bonus payment contributes nothing to them. Its `amount` (the bonus spent) is
 *    only the allocation cap;
 *  - the `PaymentAllocation` it creates flows through the SAME charge-state machinery
 *    as a money payment, so a charge covered by bonus shows `partial`/`paid`
 *    consistently, and a later money payment to the same charge sees the bonus
 *    allocation in `Σ(allocations)`.
 *
 * Runs inside the caller's tenant tx; the company row lock (taken here and re-taken
 * by walletDebit/recompute) serializes concurrent spends so a charge can't be
 * over-paid and the bonus can't be overdrawn.
 */

const BONUS_PROVIDER = 'bonus'

export interface SpendBonusArgs {
  agencyId: string
  companyId: string
  chargeId: string
  /** Cap; omit to spend the full min(outstanding, balance). */
  requestedAmount?: number | null
  confirmedBy: string
  now?: Date
}

export interface SpendBonusResult {
  spent: string
  bonusBalance: string
  charge: AllocatedChargeResult
}

interface LockedCompany {
  id: string
  agencyId: string
  bonusBalance: Prisma.Decimal | string
}

export async function spendBonusOnCharge(
  tx: Prisma.TransactionClient,
  args: SpendBonusArgs
): Promise<SpendBonusResult> {
  // 1. Lock the company — serializes concurrent bonus-spends so neither the bonus
  //    balance nor the charge can be raced into an inconsistent state.
  const crows = await tx.$queryRaw<LockedCompany[]>`
    SELECT "id", "agencyId", "bonusBalance"
    FROM "companies"
    WHERE "id" = ${args.companyId}
    FOR UPDATE
  `
  const company = crows[0]
  if (!company || company.agencyId !== args.agencyId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
  }
  const bonusBalance = new Prisma.Decimal(company.bonusBalance)

  // 2. Load the charge + its current coverage (under the company lock).
  const charge = await tx.serviceCharge.findUnique({
    where: { id: args.chargeId },
    select: {
      id: true,
      agencyId: true,
      companyId: true,
      totalAmount: true,
      amount: true,
      currency: true,
      approvalStatus: true,
    },
  })
  if (!charge || charge.agencyId !== args.agencyId || charge.companyId !== args.companyId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Нарахування не знайдено', 404)
  }
  // P-11: a draft (pending/rejected on_actuals) charge isn't billable yet — block bonus spend.
  if (charge.approvalStatus === 'pending' || charge.approvalStatus === 'rejected') {
    throw new AppError(
      ApiErrorCode.CONFLICT,
      'Не можна оплатити бонусами нарахування, що очікує погодження',
      409
    )
  }
  // The bonus wallet is USD; settling a non-USD charge would need an FX leg (out of scope).
  if (charge.currency !== 'USD') {
    throw new AppError(
      ApiErrorCode.VALIDATION_ERROR,
      'Бонусами можна оплатити лише нарахування в USD',
      400
    )
  }

  const allocAgg = await tx.paymentAllocation.aggregate({
    where: { chargeId: charge.id },
    _sum: { amount: true },
  })
  const allocated = allocAgg._sum.amount ?? new Prisma.Decimal(0)
  const total = new Prisma.Decimal(charge.totalAmount ?? charge.amount)
  const outstanding = total.minus(allocated)
  if (outstanding.lessThanOrEqualTo(0)) {
    throw new AppError(ApiErrorCode.CONFLICT, 'Нарахування вже погашене', 409)
  }

  // 3. Spend = min(requested ?? outstanding, outstanding, bonusBalance).
  const want = args.requestedAmount != null ? new Prisma.Decimal(args.requestedAmount) : outstanding
  const spend = Prisma.Decimal.min(want, outstanding, bonusBalance)
  if (spend.lessThanOrEqualTo(0)) {
    throw new AppError(ApiErrorCode.CONFLICT, 'Недостатньо бонусів', 409)
  }

  // 4. Debit the bonus wallet (re-locks the company; guards overdraw).
  const debit = await walletDebit(tx, {
    agencyId: args.agencyId,
    companyId: args.companyId,
    source: WalletTxnSource.INVOICE_PAYMENT,
    amount: spend,
    sourceId: charge.id,
    createdById: args.confirmedBy,
  })

  // 5. Bonus-backed payment: amountUsd=0 keeps it out of every revenue/money sum.
  const payment = await tx.payment.create({
    data: {
      agencyId: args.agencyId,
      companyId: args.companyId,
      amount: spend,
      currency: 'USD',
      amountUsd: new Prisma.Decimal(0),
      rateUsed: new Prisma.Decimal(1),
      type: 'partial',
      status: 'confirmed',
      provider: BONUS_PROVIDER,
      paymentMethod: BONUS_PROVIDER,
      note: 'Оплата бонусами',
      confirmedBy: args.confirmedBy,
    },
    select: { id: true },
  })

  // 6. Allocate it to the charge (updates charge state + recomputes moneyBalance).
  const allocation = await allocatePayment(tx, {
    agencyId: args.agencyId,
    paymentId: payment.id,
    allocations: [{ chargeId: charge.id, amount: spend }],
    now: args.now,
  })

  const charge0 = allocation.charges[0]
  if (!charge0) {
    // Unreachable: exactly one allocation was requested above.
    throw new AppError(ApiErrorCode.INTERNAL_ERROR, 'Не вдалося застосувати бонус', 500)
  }
  return {
    spent: spend.toFixed(2),
    // Authoritative post-debit balance from the ledger op (not recomputed here).
    bonusBalance: debit.balanceAfter,
    charge: charge0,
  }
}
