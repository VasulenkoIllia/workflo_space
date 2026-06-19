import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import { LIVE_CHARGE_APPROVAL } from './allocation.js'

/**
 * Unified financial statement (S5-08, module 25): a read-only, date-sorted merge of
 * the two ledgers — service charges, payments, and bonus-wallet movements — plus the
 * current bonus + money balances. Pure aggregation; never writes.
 */

export interface StatementEvent {
  kind: 'charge' | 'payment' | 'bonus'
  date: Date
  amount: string
  /** Extra per-kind detail (status / provider / source / direction). */
  detail: Record<string, unknown>
}

export interface Statement {
  bonus: { balance: string }
  money: { balance: string; status: 'prepaid' | 'owing' | 'settled' }
  timeline: StatementEvent[]
}

export interface BuildStatementArgs {
  agencyId: string
  companyId: string
  from?: string
  to?: string
  /** Admin view traces the originating record id of each bonus movement. */
  includeSourceId?: boolean
}

/** `[from 00:00, to 23:59:59.999]` UTC window for a field; either bound optional. */
function dateRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {}
  if (from) range.gte = new Date(`${from}T00:00:00.000Z`)
  if (to) range.lte = new Date(`${to}T23:59:59.999Z`)
  return range.gte || range.lte ? range : undefined
}

export async function buildStatement(args: BuildStatementArgs): Promise<Statement> {
  const window = dateRange(args.from, args.to)

  const data = await withTenant(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: args.companyId },
      select: { id: true, agencyId: true, bonusBalance: true, moneyBalance: true },
    })
    if (!company || company.agencyId !== args.agencyId) {
      throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
    }

    const base = { agencyId: args.agencyId, companyId: args.companyId }
    const [charges, payments, bonuses] = await Promise.all([
      tx.serviceCharge.findMany({
        // P-11: the statement is the financial ledger — exclude draft (pending/rejected)
        // on_actuals charges, consistent with the balance which already omits them.
        where: { ...base, ...LIVE_CHARGE_APPROVAL, ...(window ? { createdAt: window } : {}) },
        select: {
          id: true,
          totalAmount: true,
          amount: true,
          currency: true,
          status: true,
          month: true,
          createdAt: true,
        },
      }),
      tx.payment.findMany({
        where: { ...base, ...(window ? { confirmedAt: window } : {}) },
        select: {
          id: true,
          amount: true,
          amountUsd: true,
          currency: true,
          type: true,
          provider: true,
          confirmedAt: true,
        },
      }),
      tx.walletTransaction.findMany({
        where: { ...base, ...(window ? { createdAt: window } : {}) },
        select: {
          id: true,
          type: true,
          source: true,
          amount: true,
          balanceAfter: true,
          sourceId: true,
          createdAt: true,
        },
      }),
    ])
    return { company, charges, payments, bonuses }
  })

  const events: StatementEvent[] = []
  for (const c of data.charges) {
    events.push({
      kind: 'charge',
      date: c.createdAt,
      amount: (c.totalAmount ?? c.amount).toFixed(2),
      detail: { chargeId: c.id, currency: c.currency, status: c.status, month: c.month },
    })
  }
  for (const p of data.payments) {
    events.push({
      kind: 'payment',
      date: p.confirmedAt,
      amount: p.amount.toFixed(2),
      detail: {
        paymentId: p.id,
        currency: p.currency,
        amountUsd: p.amountUsd ? p.amountUsd.toFixed(2) : null,
        type: p.type,
        provider: p.provider,
      },
    })
  }
  for (const w of data.bonuses) {
    events.push({
      kind: 'bonus',
      date: w.createdAt,
      amount: w.amount.toFixed(2),
      detail: {
        txnId: w.id,
        direction: w.type,
        source: w.source,
        balanceAfter: w.balanceAfter.toFixed(2),
        ...(args.includeSourceId ? { sourceId: w.sourceId } : {}),
      },
    })
  }
  // Oldest → newest (a statement reads chronologically).
  events.sort((a, b) => a.date.getTime() - b.date.getTime())

  const moneyBalance = data.company.moneyBalance
  const status: Statement['money']['status'] = moneyBalance.greaterThan(0)
    ? 'prepaid'
    : moneyBalance.lessThan(0)
      ? 'owing'
      : 'settled'

  return {
    bonus: { balance: data.company.bonusBalance.toFixed(2) },
    money: { balance: moneyBalance.toFixed(2), status },
    timeline: events,
  }
}
