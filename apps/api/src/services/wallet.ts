import { Prisma } from '@workflo/db'
import { ApiErrorCode, AppError, WalletTxnSource } from '@workflo/types'

/**
 * Bonus-wallet ledger primitives (S5-05, module 25). The append-only
 * `WalletTransaction` table is the source of truth; `Company.bonusBalance` is a
 * derived cache kept in lock-step. Both primitives take an ALREADY-OPEN `tx` so
 * callers compose them inside their own tenant transaction (referral accrual →
 * credit, invoice spend → debit, manual adjust → either).
 *
 * Non-negotiable invariants (enforced here, proven by the integration suite):
 *  - `bonusBalance == Σ credit.amount − Σ debit.amount` after every op;
 *  - `bonusBalance ≥ 0` always (the debit guard refuses an overdraw → 409);
 *  - `amount > 0` always; direction is carried by `type`, never a signed amount;
 *  - `balanceAfter` is computed UNDER the company row lock (`SELECT … FOR UPDATE`),
 *    so concurrent mutations serialize and no update is lost;
 *  - `manual_adjustment` must carry a non-empty note.
 */

export interface WalletMutationArgs {
  agencyId: string
  companyId: string
  source: WalletTxnSource
  /** Positive decimal amount (caller validates 2dp via Zod). */
  amount: number | Prisma.Decimal
  /** Link to the originating record (e.g. a ReferralBonus or ServiceCharge id). */
  sourceId?: string | null
  note?: string | null
  createdById?: string | null
}

export interface WalletTxnResult {
  id: string
  type: 'credit' | 'debit'
  amount: string
  balanceAfter: string
  source: string
  createdAt: Date
}

interface LockedCompany {
  id: string
  agencyId: string
  bonusBalance: Prisma.Decimal | string
}

async function mutate(
  tx: Prisma.TransactionClient,
  args: WalletMutationArgs,
  direction: 'credit' | 'debit'
): Promise<WalletTxnResult> {
  const amount = new Prisma.Decimal(args.amount)
  if (!amount.greaterThan(0)) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Сума має бути додатною', 400)
  }
  if (args.source === WalletTxnSource.MANUAL_ADJUSTMENT && !args.note?.trim()) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Ручне коригування потребує причини', 400)
  }

  // Lock the company row — this is what serializes concurrent credits/debits.
  const rows = await tx.$queryRaw<LockedCompany[]>`
    SELECT "id", "agencyId", "bonusBalance"
    FROM "companies"
    WHERE "id" = ${args.companyId}
    FOR UPDATE
  `
  const company = rows[0]
  if (!company || company.agencyId !== args.agencyId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
  }

  const current = new Prisma.Decimal(company.bonusBalance)
  let newBalance: Prisma.Decimal
  if (direction === 'credit') {
    newBalance = current.plus(amount)
  } else {
    if (amount.greaterThan(current)) {
      throw new AppError(ApiErrorCode.CONFLICT, 'Недостатньо бонусів', 409)
    }
    newBalance = current.minus(amount)
  }

  const txn = await tx.walletTransaction.create({
    data: {
      agencyId: args.agencyId,
      companyId: args.companyId,
      type: direction,
      source: args.source,
      amount,
      balanceAfter: newBalance,
      sourceId: args.sourceId ?? null,
      note: args.note ?? null,
      createdById: args.createdById ?? null,
    },
    select: { id: true, createdAt: true },
  })
  await tx.company.update({ where: { id: args.companyId }, data: { bonusBalance: newBalance } })

  // S6: enqueueOutbox(tx, { type: `wallet.${direction === 'credit' ? 'credited' : 'debited'}`,
  //   payload: { companyId, txnId: txn.id, amount, balanceAfter }, agencyId }) — deferred to
  //   avoid a DLQ'd event with no handler; the WalletTransaction row is already durable.

  return {
    id: txn.id,
    type: direction,
    amount: amount.toFixed(2),
    balanceAfter: newBalance.toFixed(2),
    source: args.source,
    createdAt: txn.createdAt,
  }
}

/** Credit the company's bonus balance (referral bonus, refund, manual top-up). */
export function walletCredit(
  tx: Prisma.TransactionClient,
  args: WalletMutationArgs
): Promise<WalletTxnResult> {
  return mutate(tx, args, 'credit')
}

/** Debit the company's bonus balance (invoice spend, manual deduction). Guards overdraw. */
export function walletDebit(
  tx: Prisma.TransactionClient,
  args: WalletMutationArgs
): Promise<WalletTxnResult> {
  return mutate(tx, args, 'debit')
}
