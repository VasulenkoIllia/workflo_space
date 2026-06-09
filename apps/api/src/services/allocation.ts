import { Prisma } from '@workflo/db'
import { ApiErrorCode, AppError, ChargeStatus, type ChargeDerivedState } from '@workflo/types'

/**
 * Money-account allocation primitives (S5-07, module 25). A confirmed payment is
 * allocated to one or more `ServiceCharge`s; each charge's display state is derived
 * from Σ(allocations) vs `totalAmount`; `Company.moneyBalance` is a single-writer
 * derived cache recomputed under the company row lock. Both primitives take an
 * ALREADY-OPEN `tx` so callers compose them inside their own tenant transaction.
 *
 * Two settlement tracks are kept separate: ORDER-payments (carry `orderId`) settle
 * one-off orders and live in the order-debt track; charge/advance-payments (no
 * `orderId`) fund the recurring money-account. `moneyBalance` therefore sums only
 * no-order payments — never double-counting an order payment as prepaid credit.
 *
 * Non-negotiable invariants (proven by the integration suite):
 *  - `Σ allocation.amount per payment ≤ payment.amount` (enforced UNDER the payment
 *    row lock → else 409; this is the over-allocation guard);
 *  - `@@unique([paymentId, chargeId])` forbids double-allocating the same pair;
 *  - `moneyBalance == Σ(confirmed no-order payments).amountUsd − Σ(charge.totalAmount)`
 *    after every op, recomputed atomically under the company lock;
 *  - all money math is `Prisma.Decimal`, never JS `Number`.
 */

/**
 * Derived charge state — a pure function of the allocated total vs the amount owed.
 * `awaiting`/`overpaid` have no stored `ChargeStatus`; this is the read-DTO label.
 * Precedence: fully-covered (paid/overpaid) → past-due (overdue) → partial → awaiting.
 */
export function deriveChargeState(
  allocated: Prisma.Decimal,
  total: Prisma.Decimal,
  dueDate: Date | null,
  now: Date
): ChargeDerivedState {
  if (total.greaterThan(0) && allocated.greaterThanOrEqualTo(total)) {
    return allocated.greaterThan(total) ? 'overpaid' : 'paid'
  }
  const pastDue = dueDate != null && dueDate.getTime() < now.getTime()
  if (pastDue) return 'overdue'
  if (allocated.greaterThan(0)) return 'partial'
  return 'awaiting'
}

/** Persist the nearest stored `ChargeStatus` for a derived state (enum has no overpaid/awaiting). */
function toStoredStatus(state: ChargeDerivedState): ChargeStatus {
  switch (state) {
    case 'paid':
    case 'overpaid':
      return ChargeStatus.PAID
    case 'overdue':
      return ChargeStatus.OVERDUE
    case 'partial':
      return ChargeStatus.PARTIAL
    case 'awaiting':
      return ChargeStatus.PENDING
  }
}

interface LockedCompany {
  id: string
  agencyId: string
}

/**
 * Single-writer recompute of `Company.moneyBalance` under the company row lock.
 * `moneyBalance = Σ(confirmed no-order payments).amountUsd − Σ(charge.totalAmount)
 *                 + Σ(bonus applied to invoices)`.
 *
 * The bonus term (S5-08) is what keeps the money-account honest once charges can be
 * settled with bonus: a bonus-backed payment carries `amountUsd = 0` (so it never
 * inflates revenue), so without adding back the `invoice_payment` wallet debits a
 * bonus-settled charge would wrongly read as money still owed. Backward-compatible —
 * with no bonus spends the term is 0.
 *
 * A full re-read (not an increment) → idempotent regardless of what triggered it, so
 * concurrent recomputes serialize on the lock and the last one writes the truth.
 */
export async function recomputeMoneyBalance(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; companyId: string }
): Promise<Prisma.Decimal> {
  const rows = await tx.$queryRaw<LockedCompany[]>`
    SELECT "id", "agencyId"
    FROM "companies"
    WHERE "id" = ${args.companyId}
    FOR UPDATE
  `
  const company = rows[0]
  if (!company || company.agencyId !== args.agencyId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
  }

  const [paidAgg, chargeAgg, bonusAgg] = await Promise.all([
    tx.payment.aggregate({
      where: {
        agencyId: args.agencyId,
        companyId: args.companyId,
        status: 'confirmed',
        orderId: null,
      },
      _sum: { amountUsd: true },
    }),
    // COALESCE(totalAmount, amount): a charge with a null post-discount total (legacy /
    // hand-made) still counts its `amount`, so `_sum.totalAmount` can't silently drop it.
    tx.$queryRaw<Array<{ charged: Prisma.Decimal | null }>>`
      SELECT COALESCE(SUM(COALESCE("totalAmount", "amount")), 0) AS "charged"
      FROM "service_charges"
      WHERE "agencyId" = ${args.agencyId} AND "companyId" = ${args.companyId}
    `,
    tx.walletTransaction.aggregate({
      where: {
        agencyId: args.agencyId,
        companyId: args.companyId,
        type: 'debit',
        source: 'invoice_payment',
      },
      _sum: { amount: true },
    }),
  ])
  const paid = paidAgg._sum.amountUsd ?? new Prisma.Decimal(0)
  const charged = new Prisma.Decimal(chargeAgg[0]?.charged ?? 0)
  const bonusApplied = bonusAgg._sum.amount ?? new Prisma.Decimal(0)
  const balance = paid.minus(charged).plus(bonusApplied)

  await tx.company.update({ where: { id: args.companyId }, data: { moneyBalance: balance } })
  return balance
}

interface LockedPayment {
  id: string
  agencyId: string
  companyId: string
  amount: Prisma.Decimal
  status: string
}

export interface AllocationInput {
  chargeId: string
  amount: number | Prisma.Decimal
}

export interface AllocatePaymentArgs {
  agencyId: string
  paymentId: string
  /** Explicit pairs; omit (or empty) to FIFO-allocate the remainder by `dueDate`. */
  allocations?: AllocationInput[]
  now?: Date
}

export interface AllocatedChargeResult {
  chargeId: string
  allocated: string
  outstanding: string
  state: ChargeDerivedState
}

export interface AllocatePaymentResult {
  paymentId: string
  /** Σ of THIS call's new allocations. */
  allocated: string
  /** `payment.amount − Σ(all allocations)` — the unallocated prepaid remainder. */
  paymentRemaining: string
  moneyBalance: string
  charges: AllocatedChargeResult[]
}

/** Auto-allocate `remaining` across the company's not-fully-paid charges, oldest `dueDate` first. */
async function fifoTargets(
  tx: Prisma.TransactionClient,
  agencyId: string,
  companyId: string,
  remaining: Prisma.Decimal,
  excludeChargeIds: Set<string>
): Promise<{ chargeId: string; amount: Prisma.Decimal }[]> {
  if (remaining.lessThanOrEqualTo(0)) return []
  const charges = await tx.serviceCharge.findMany({
    where: {
      agencyId,
      companyId,
      status: { notIn: [ChargeStatus.PAID, ChargeStatus.WRITTEN_OFF] },
    },
    select: { id: true, totalAmount: true, amount: true },
    orderBy: [{ dueDate: 'asc' }, { month: 'asc' }, { id: 'asc' }],
  })

  const targets: { chargeId: string; amount: Prisma.Decimal }[] = []
  let left = remaining
  for (const c of charges) {
    if (left.lessThanOrEqualTo(0)) break
    if (excludeChargeIds.has(c.id)) continue // this payment already allocated to it (unique pair)
    const already = await tx.paymentAllocation.aggregate({
      where: { chargeId: c.id },
      _sum: { amount: true },
    })
    const allocated = already._sum.amount ?? new Prisma.Decimal(0)
    const total = new Prisma.Decimal(c.totalAmount ?? c.amount)
    const outstanding = total.minus(allocated)
    if (outstanding.lessThanOrEqualTo(0)) continue
    const take = Prisma.Decimal.min(outstanding, left)
    targets.push({ chargeId: c.id, amount: take })
    left = left.minus(take)
  }
  return targets
}

/**
 * Allocate a confirmed payment to charges (explicit pairs or FIFO), updating each
 * charge's derived state and the company money-account. Serializes on the payment
 * row lock so concurrent allocations of the same payment can never over-allocate.
 */
export async function allocatePayment(
  tx: Prisma.TransactionClient,
  args: AllocatePaymentArgs
): Promise<AllocatePaymentResult> {
  const now = args.now ?? new Date()

  // 1. Lock the payment row — serializes concurrent allocations of THIS payment.
  const prows = await tx.$queryRaw<LockedPayment[]>`
    SELECT "id", "agencyId", "companyId", "amount", "status"
    FROM "payments"
    WHERE "id" = ${args.paymentId}
    FOR UPDATE
  `
  const payment = prows[0]
  if (!payment || payment.agencyId !== args.agencyId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Платіж не знайдено', 404)
  }
  if (payment.status !== 'confirmed') {
    throw new AppError(ApiErrorCode.CONFLICT, 'Платіж не підтверджено', 409)
  }

  // 1b. Lock the COMPANY too (order: payment → company, consistent with bonusSpend's
  //     company→… re-entrant path). This serializes ALL allocations for the company, so
  //     two concurrent FIFO allocations of different payments can't each grab the same
  //     charge's outstanding and over-cover it. recomputeMoneyBalance re-takes this lock.
  await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id" = ${payment.companyId} FOR UPDATE`

  // 2. Already-allocated Σ + pairs (under the lock) → the unallocated remainder.
  const existing = await tx.paymentAllocation.findMany({
    where: { paymentId: payment.id },
    select: { chargeId: true, amount: true },
  })
  const alreadyAllocated = existing.reduce((acc, e) => acc.plus(e.amount), new Prisma.Decimal(0))
  const existingChargeIds = new Set(existing.map((e) => e.chargeId))
  const paymentAmount = new Prisma.Decimal(payment.amount)
  const remaining = paymentAmount.minus(alreadyAllocated)

  // 3. Resolve targets: explicit pairs or FIFO over the remainder.
  let targets: { chargeId: string; amount: Prisma.Decimal }[]
  if (args.allocations && args.allocations.length > 0) {
    targets = args.allocations.map((a) => ({
      chargeId: a.chargeId,
      amount: new Prisma.Decimal(a.amount),
    }))
    for (const t of targets) {
      if (!t.amount.greaterThan(0)) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Сума розподілу має бути додатною', 400)
      }
    }
  } else {
    targets = await fifoTargets(
      tx,
      payment.agencyId,
      payment.companyId,
      remaining,
      existingChargeIds
    )
  }

  // 4. Over-allocation guard: Σ(new) ≤ remaining (else 409). Enforced under the lock.
  const sumNew = targets.reduce((acc, t) => acc.plus(t.amount), new Prisma.Decimal(0))
  if (sumNew.greaterThan(remaining)) {
    throw new AppError(
      ApiErrorCode.CONFLICT,
      'Сума розподілу перевищує невикористаний залишок платежу',
      409
    )
  }

  // 5. Insert allocations + re-derive each affected charge's state.
  const charges: AllocatedChargeResult[] = []
  for (const t of targets) {
    const charge = await tx.serviceCharge.findUnique({
      where: { id: t.chargeId },
      select: {
        id: true,
        agencyId: true,
        companyId: true,
        totalAmount: true,
        amount: true,
        dueDate: true,
        paidAt: true,
      },
    })
    if (!charge || charge.agencyId !== payment.agencyId || charge.companyId !== payment.companyId) {
      throw new AppError(ApiErrorCode.NOT_FOUND, 'Нарахування не знайдено', 404)
    }

    try {
      await tx.paymentAllocation.create({
        data: {
          agencyId: payment.agencyId,
          paymentId: payment.id,
          chargeId: charge.id,
          amount: t.amount,
        },
      })
    } catch (e) {
      // @@unique([paymentId, chargeId]) → the same pair twice is a conflict, not a silent merge.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(ApiErrorCode.CONFLICT, 'Платіж уже розподілено на це нарахування', 409)
      }
      throw e
    }

    const chargeAgg = await tx.paymentAllocation.aggregate({
      where: { chargeId: charge.id },
      _sum: { amount: true },
    })
    const allocated = chargeAgg._sum.amount ?? new Prisma.Decimal(0)
    const total = new Prisma.Decimal(charge.totalAmount ?? charge.amount)
    const state = deriveChargeState(allocated, total, charge.dueDate, now)
    await tx.serviceCharge.update({
      where: { id: charge.id },
      data: {
        status: toStoredStatus(state),
        // Preserve the original settlement timestamp if the charge was already paid.
        paidAt: state === 'paid' || state === 'overpaid' ? (charge.paidAt ?? now) : null,
      },
    })
    const outstanding = total.minus(allocated)
    charges.push({
      chargeId: charge.id,
      allocated: allocated.toFixed(2),
      outstanding: (outstanding.lessThan(0) ? new Prisma.Decimal(0) : outstanding).toFixed(2),
      state,
    })
  }

  // 6. Recompute the money-account under the company lock (single writer).
  const moneyBalance = await recomputeMoneyBalance(tx, {
    agencyId: payment.agencyId,
    companyId: payment.companyId,
  })

  const totalAllocated = alreadyAllocated.plus(sumNew)
  return {
    paymentId: payment.id,
    allocated: sumNew.toFixed(2),
    paymentRemaining: paymentAmount.minus(totalAllocated).toFixed(2),
    moneyBalance: moneyBalance.toFixed(2),
    charges,
  }
}
