import { Prisma } from '@workflo/db'
import { ApiErrorCode, AppError, type PaymentType } from '@workflo/types'
import { ManualProvider, type PaymentProvider } from '@workflo/payments'
import { refreshMoneyBalance } from './allocation.js'
import { processReferralBonus } from './referral.js'

/**
 * The money-correctness heart of S5-02. `confirmManualPayment` records ONE
 * confirmed payment and settles the target order under a row lock, with an
 * immutable USD snapshot. It MUST run inside a tenant transaction (the caller
 * wraps it in `withIdempotency` + `tenantTransaction`) — every guarantee here
 * (serialization, single settlement, no double-pay) rests on that lock + tx.
 *
 * Invariants:
 *  - all balance math is `Prisma.Decimal`, never JS `Number` arithmetic;
 *  - the target order is `SELECT … FOR UPDATE`-locked, so concurrent confirms
 *    serialize and only ONE can mark it paid (the rest see `paidAt` → 409);
 *  - `amountUsd`/`rateUsed` are snapshotted at confirm-time and never recomputed
 *    (a later FX change must not move historical revenue/loyalty figures);
 *  - manual rows leave `providerPaymentId`/`sourceType`/`sourceId` NULL so an
 *    order can take multiple payments (advance + final) — dedup is the
 *    Idempotency-Key, not the source-unique constraint.
 */

/** Shared singleton — the MVP provider has no per-request state. */
export const manualProvider: PaymentProvider = new ManualProvider()

const ZERO = '0'

export interface ConfirmManualPaymentArgs {
  agencyId: string
  companyId: string
  orderId?: string | null
  amount: number
  currency: 'USD' | 'UAH'
  type: PaymentType
  paymentMethod?: string | null
  paymentReference?: string | null
  note?: string | null
  /** Actor profile id stamped onto `Payment.confirmedBy`. */
  confirmedBy: string
  /** Idempotency anchor handed to the provider (the request's Idempotency-Key). */
  idempotencyKey: string
  provider?: PaymentProvider
  now?: Date
}

export interface ConfirmManualPaymentResult {
  payment: {
    id: string
    companyId: string
    orderId: string | null
    amount: string
    currency: string
    amountUsd: string
    rateUsed: string
    type: PaymentType
    confirmedAt: string
  }
  /** Remaining balance on the settled order (clamped ≥ 0); '0' when no order. */
  newDebt: string
  /** ISO timestamp the order was marked fully paid, or null. Stored verbatim for idempotent replay. */
  orderPaidAt: string | null
}

interface LockedOrder {
  id: string
  agencyId: string
  totalAmount: Prisma.Decimal | null
  currency: string
  paidAt: Date | null
  companyId: string | null
}

/**
 * Snapshot the native amount to USD (the reporting base). USD-native is identity
 * (`rateUsed = 1`); UAH divides by the agency's stored UAH-per-USD rate. A missing
 * rate for a non-USD payment is a hard stop (422) rather than a silent NULL that
 * would drop the payment from loyalty lifetime + P&L revenue.
 */
async function snapshotUsd(
  tx: Prisma.TransactionClient,
  agencyId: string,
  amount: Prisma.Decimal,
  currency: 'USD' | 'UAH'
): Promise<{ amountUsd: Prisma.Decimal; rateUsed: Prisma.Decimal }> {
  if (currency === 'USD') {
    return { amountUsd: amount, rateUsed: new Prisma.Decimal(1) }
  }
  const rate = await tx.exchangeRate.findUnique({
    where: { agencyId },
    select: { usdToUah: true },
  })
  if (!rate || rate.usdToUah.lessThanOrEqualTo(0)) {
    throw new AppError(
      ApiErrorCode.VALIDATION_ERROR,
      'Курс валют недоступний — синхронізуйте курс перед записом платежу в гривні',
      422
    )
  }
  // rateUsed = UAH-per-USD divisor (matches "1 for USD-native"); amountUsd = amount / rateUsed.
  const amountUsd = amount.div(rate.usdToUah).toDecimalPlaces(2)
  return { amountUsd, rateUsed: rate.usdToUah }
}

export async function confirmManualPayment(
  tx: Prisma.TransactionClient,
  args: ConfirmManualPaymentArgs
): Promise<ConfirmManualPaymentResult> {
  const now = args.now ?? new Date()
  const provider = args.provider ?? manualProvider
  const amount = new Prisma.Decimal(args.amount)

  // 1. Lock the target order (if any) so concurrent confirms serialize on it.
  let order: LockedOrder | null = null
  if (args.orderId) {
    const rows = await tx.$queryRaw<LockedOrder[]>`
      SELECT "id", "agencyId", "totalAmount", "currency", "paidAt", "companyId"
      FROM "orders"
      WHERE "id" = ${args.orderId} AND "deletedAt" IS NULL
      FOR UPDATE
    `
    order = rows[0] ?? null
    if (!order || order.agencyId !== args.agencyId) {
      // Cross-tenant orderId (e.g. an unscoped internal order) is treated as not-found.
      throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
    }
    if (order.companyId && order.companyId !== args.companyId) {
      throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Замовлення належить іншій компанії', 400)
    }
    // Settlement subtracts native amounts (total − Σ payments), so the currencies
    // must match — never net a UAH payment against a USD order total.
    if (order.currency !== args.currency) {
      throw new AppError(
        ApiErrorCode.VALIDATION_ERROR,
        `Валюта платежу (${args.currency}) не збігається з валютою замовлення (${order.currency})`,
        400
      )
    }
    // Re-pay guard: a fully-paid order cannot take another payment (the loser of a race lands here).
    if (order.paidAt) {
      throw new AppError(ApiErrorCode.CONFLICT, 'Замовлення вже оплачено', 409)
    }
  }

  // 2. FX snapshot (immutable from here on).
  const { amountUsd, rateUsed } = await snapshotUsd(tx, args.agencyId, amount, args.currency)

  // 3. Provider confirm — pure (no money mutation); ManualProvider returns providerPaymentId=null.
  const confirmation = await provider.confirmPayment({
    amount: args.amount,
    currency: args.currency,
    idempotencyKey: args.idempotencyKey,
    note: args.note ?? undefined,
  })
  if (!confirmation.ok) {
    throw new AppError(ApiErrorCode.CONFLICT, 'Провайдер відхилив платіж', 409)
  }

  // 4. Persist the confirmed payment. Manual → provider/source NULL (advance+final allowed).
  const created = await tx.payment.create({
    data: {
      agencyId: args.agencyId,
      companyId: args.companyId,
      orderId: args.orderId ?? null,
      amount,
      currency: args.currency,
      amountUsd,
      rateUsed,
      type: args.type,
      status: 'confirmed',
      provider: provider.name,
      providerPaymentId: confirmation.providerPaymentId,
      paymentMethod: args.paymentMethod ?? null,
      paymentReference: args.paymentReference ?? null,
      note: args.note ?? null,
      confirmedBy: args.confirmedBy,
    },
    select: { id: true, amount: true, currency: true, type: true, confirmedAt: true },
  })

  // 5. Settle the order: new balance = total − (already-confirmed + this payment).
  let newDebt = ZERO
  let orderPaidAt: string | null = null
  if (order) {
    const agg = await tx.payment.aggregate({
      where: { orderId: order.id, status: 'confirmed' },
      _sum: { amount: true },
    })
    const totalPaid = agg._sum.amount ?? new Prisma.Decimal(0)
    const total = order.totalAmount ?? new Prisma.Decimal(0)
    const remaining = total.minus(totalPaid)
    newDebt = (remaining.lessThan(0) ? new Prisma.Decimal(0) : remaining).toFixed(2)
    // Mark paid only for a priced order whose balance is now cleared (over-payment → still paid, debt 0).
    if (total.greaterThan(0) && remaining.lessThanOrEqualTo(0)) {
      await tx.order.update({ where: { id: order.id }, data: { paidAt: now } })
      orderPaidAt = now.toISOString()
    }
  }

  // 6. Referral accrual (S5-06) — in-tx, idempotent, no-op when there is no referrer.
  //    A confirmed payment credits the referrer's bonus wallet at most once.
  await processReferralBonus(tx, {
    id: created.id,
    agencyId: args.agencyId,
    companyId: args.companyId,
    amountUsd,
  })

  // 7. AR-11: a confirmed NO-ORDER payment is a moneyBalance input (Σ no-order
  //    confirmed payments), so the cached balance must refresh in the same tx —
  //    previously it only refreshed on allocation, leaving portal/admin reads stale.
  if (!args.orderId) {
    await refreshMoneyBalance(tx, { agencyId: args.agencyId, companyId: args.companyId })
  }

  return {
    payment: {
      id: created.id,
      companyId: args.companyId,
      orderId: args.orderId ?? null,
      amount: created.amount.toFixed(2),
      currency: created.currency,
      amountUsd: amountUsd.toFixed(2),
      rateUsed: rateUsed.toString(),
      type: created.type as PaymentType,
      confirmedAt: created.confirmedAt.toISOString(),
    },
    newDebt,
    orderPaidAt,
  }
}
