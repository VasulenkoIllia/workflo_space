import { Prisma } from '@workflo/db'
import { ApiErrorCode, AppError, WalletTxnSource } from '@workflo/types'
import { refreshMoneyBalance } from './allocation.js'
import { walletDebit } from './wallet.js'

/**
 * 05-В СТОРНУВАННЯ / ПОВЕРНЕННЯ / СПИСАННЯ (рішення власника 07.07). Три операції,
 * усі owner-only, усі tx-pure (викликаються всередині tenantTransaction; сповіщення
 * шле роут ПІСЛЯ коміту):
 *
 *  - refundPayment — повне/часткове повернення підтвердженого платежу. amountUsd —
 *    пропорційний знімок для moneyBalance. Повне повернення → status='refunded'.
 *    Клавбек: якщо на платіж нараховувався company-реферальний бонус — пропорційно
 *    відкочуємо з wallet референта (clamp до наявного балансу; employee-бонус
 *    рахується наживо при виплаті і скоригується сам).
 *  - writeOffCharge — списання боргу: status='written_off' (вже виключений з боргу,
 *    AR-12) + аудит хто/коли/чому.
 *  - createCreditNote — кредит-нота = ServiceCharge з kind='credit_note' і НЕГАТИВНИМ
 *    totalAmount → зменшує charged у moneyBalance (клієнт винен менше).
 */

interface LockedPayment {
  id: string
  agencyId: string
  companyId: string
  orderId: string | null
  amount: Prisma.Decimal
  amountUsd: Prisma.Decimal | null
  status: string
}

export interface RefundResult {
  refundId: string
  amount: string
  fullyRefunded: boolean
  clawbackAmount: string | null
  companyId: string
  moneyBalance: string | null
}

export async function refundPayment(
  tx: Prisma.TransactionClient,
  args: {
    agencyId: string
    paymentId: string
    amount: number | Prisma.Decimal
    reason?: string | null
    method?: string | null
    actorId: string
  }
): Promise<RefundResult> {
  const amount = new Prisma.Decimal(args.amount)
  if (!amount.greaterThan(0)) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Сума повернення має бути додатною', 400)
  }

  // Lock the payment row — serializes concurrent refunds against the same payment.
  const rows = await tx.$queryRaw<LockedPayment[]>`
    SELECT "id", "agencyId", "companyId", "orderId", "amount", "amountUsd", "status"
    FROM "payments"
    WHERE "id" = ${args.paymentId}
    FOR UPDATE
  `
  const payment = rows[0]
  if (!payment || payment.agencyId !== args.agencyId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Платіж не знайдено', 404)
  }
  if (payment.status !== 'confirmed') {
    throw new AppError(ApiErrorCode.CONFLICT, 'Повернути можна лише підтверджений платіж', 409)
  }

  const paidNative = new Prisma.Decimal(payment.amount)
  const refundedAgg = await tx.paymentRefund.aggregate({
    where: { paymentId: payment.id },
    _sum: { amount: true },
  })
  const alreadyRefunded = refundedAgg._sum.amount ?? new Prisma.Decimal(0)
  const remaining = paidNative.minus(alreadyRefunded)
  if (amount.greaterThan(remaining)) {
    throw new AppError(
      ApiErrorCode.VALIDATION_ERROR,
      `Сума перевищує залишок до повернення (${remaining.toFixed(2)})`,
      400
    )
  }

  // USD-знімок пропорційно до платежу (курс платежу зафіксований у amountUsd/amount).
  const paidUsd = payment.amountUsd ?? paidNative
  const refundUsd = paidNative.greaterThan(0)
    ? amount.mul(paidUsd).div(paidNative).toDecimalPlaces(2)
    : new Prisma.Decimal(0)

  const refund = await tx.paymentRefund.create({
    data: {
      agencyId: args.agencyId,
      paymentId: payment.id,
      amount,
      amountUsd: refundUsd,
      reason: args.reason ?? null,
      method: args.method ?? null,
      refundedById: args.actorId,
    },
    select: { id: true },
  })

  const totalRefunded = alreadyRefunded.plus(amount)
  const fullyRefunded = totalRefunded.greaterThanOrEqualTo(paidNative)
  if (fullyRefunded) {
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } })
  }

  // Клавбек company-реферального бонусу (пропорційно поверненню; clamp до наявного балансу).
  let clawbackAmount: string | null = null
  const bonusRows = await tx.$queryRaw<
    Array<{ id: string; referralId: string; amount: Prisma.Decimal }>
  >`
    SELECT "id", "referralId", "amount"
    FROM "referral_bonuses"
    WHERE "sourceType" = 'payment' AND "sourceId" = ${payment.id}
  `
  const bonus = bonusRows[0]
  if (bonus && paidUsd.greaterThan(0)) {
    const claw = bonus.amount.mul(refundUsd).div(paidUsd).toDecimalPlaces(2)
    if (claw.greaterThan(0)) {
      const referral = await tx.referral.findUnique({
        where: { id: bonus.referralId },
        select: { referrerId: true },
      })
      if (referral) {
        const referrer = await tx.company.findUnique({
          where: { id: referral.referrerId },
          select: { bonusBalance: true },
        })
        // Референт міг уже витратити бонус — забираємо скільки є (решта = бізнес-втрата).
        const available = new Prisma.Decimal(referrer?.bonusBalance ?? 0)
        const toReverse = claw.greaterThan(available) ? available : claw
        if (toReverse.greaterThan(0)) {
          await walletDebit(tx, {
            agencyId: args.agencyId,
            companyId: referral.referrerId,
            source: WalletTxnSource.REFUND,
            amount: toReverse,
            sourceId: refund.id,
          })
          await tx.referral.update({
            where: { id: bonus.referralId },
            data: { totalEarned: { decrement: toReverse } },
          })
          clawbackAmount = toReverse.toFixed(2)
        }
      }
    }
  }

  // Баланс: no-order платіж → moneyBalance (refund-терм); order-платіж → знімаємо paidAt,
  // якщо після повернення замовлення знову недоплачене.
  let moneyBalance: string | null = null
  if (payment.orderId) {
    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      select: { totalAmount: true },
    })
    const paidAgg = await tx.payment.aggregate({
      where: { orderId: payment.orderId, status: 'confirmed' },
      _sum: { amount: true },
    })
    const orderRefundAgg = await tx.$queryRaw<Array<{ refunded: Prisma.Decimal | null }>>`
      SELECT COALESCE(SUM(r."amount"), 0) AS "refunded"
      FROM "payment_refunds" r
      JOIN "payments" p ON p."id" = r."paymentId"
      WHERE p."orderId" = ${payment.orderId} AND p."status" = 'confirmed'
    `
    const total = order?.totalAmount ?? new Prisma.Decimal(0)
    const netPaid = (paidAgg._sum.amount ?? new Prisma.Decimal(0)).minus(
      new Prisma.Decimal(orderRefundAgg[0]?.refunded ?? 0)
    )
    if (total.greaterThan(0) && netPaid.lessThan(total)) {
      await tx.order.update({ where: { id: payment.orderId }, data: { paidAt: null } })
    }
  } else {
    // KNOWN-LIMITATION (LOW-5, аудит 08.07): refund платежу БЕЗ orderId лише перераховує
    // moneyBalance (агрегатний баланс коректний). Якщо цей платіж був FIFO-розподілений на
    // ServiceCharge, статус нарахування (paid) і paymentAllocation НЕ відкочуються тут → окреме
    // нарахування може лишитись 'paid' попри повернення (дунінг його пропустить). Баланс правдивий,
    // стан конкретного charge — застарілий. Точний фікс — реверс alloc + перерахунок charge-стану.
    moneyBalance = (
      await refreshMoneyBalance(tx, { agencyId: args.agencyId, companyId: payment.companyId })
    ).toFixed(2)
  }

  return {
    refundId: refund.id,
    amount: amount.toFixed(2),
    fullyRefunded,
    clawbackAmount,
    companyId: payment.companyId,
    moneyBalance,
  }
}

export interface WriteOffResult {
  chargeId: string
  companyId: string
  amount: string
  moneyBalance: string
}

export async function writeOffCharge(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; chargeId: string; reason: string; actorId: string; now: Date }
): Promise<WriteOffResult> {
  const charge = await tx.serviceCharge.findFirst({
    where: { id: args.chargeId, agencyId: args.agencyId },
    select: { id: true, companyId: true, status: true, amount: true, totalAmount: true },
  })
  if (!charge) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Нарахування не знайдено', 404)
  }
  if (charge.status === 'written_off') {
    throw new AppError(ApiErrorCode.CONFLICT, 'Борг уже списано', 409)
  }
  if (charge.status === 'paid') {
    throw new AppError(ApiErrorCode.CONFLICT, 'Сплачене нарахування не списують', 409)
  }

  await tx.serviceCharge.update({
    where: { id: charge.id },
    data: {
      status: 'written_off',
      writeOffReason: args.reason,
      writtenOffAt: args.now,
      writtenOffById: args.actorId,
    },
  })
  const moneyBalance = await refreshMoneyBalance(tx, {
    agencyId: args.agencyId,
    companyId: charge.companyId,
  })
  return {
    chargeId: charge.id,
    companyId: charge.companyId,
    amount: new Prisma.Decimal(charge.totalAmount ?? charge.amount).toFixed(2),
    moneyBalance: moneyBalance.toFixed(2),
  }
}

export interface CreditNoteResult {
  chargeId: string
  amount: string
  moneyBalance: string
}

export async function createCreditNote(
  tx: Prisma.TransactionClient,
  args: {
    agencyId: string
    companyId: string
    amount: number | Prisma.Decimal
    currency: string
    reason: string
    actorId: string
    now: Date
  }
): Promise<CreditNoteResult> {
  const amount = new Prisma.Decimal(args.amount)
  if (!amount.greaterThan(0)) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Сума кредит-ноти має бути додатною', 400)
  }
  const company = await tx.company.findFirst({
    where: { id: args.companyId, agencyId: args.agencyId },
    select: { id: true },
  })
  if (!company) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Клієнта не знайдено', 404)
  }

  // Негативне нарахування: зменшує charged у moneyBalance (клієнт винен менше). approvalStatus
  // null → рахується одразу; notes = причина. Друкованого документа немає (внутрішнє коригування).
  const neg = amount.negated()
  const charge = await tx.serviceCharge.create({
    data: {
      agencyId: args.agencyId,
      companyId: args.companyId,
      kind: 'credit_note',
      amount: neg,
      totalAmount: neg,
      currency: args.currency,
      month: args.now,
      status: 'paid', // негативний рядок нічого не «винен» — deriveChargeState теж дає paid
      notes: args.reason,
      writeOffReason: args.reason,
      writtenOffById: args.actorId,
      writtenOffAt: args.now,
    },
    select: { id: true },
  })
  const moneyBalance = await refreshMoneyBalance(tx, {
    agencyId: args.agencyId,
    companyId: args.companyId,
  })
  return {
    chargeId: charge.id,
    amount: amount.toFixed(2),
    moneyBalance: moneyBalance.toFixed(2),
  }
}
