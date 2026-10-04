import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { WalletTxnSource } from '@workflo/types'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { walletCredit, walletDebit } from '../../src/services/wallet.js'

/**
 * Bonus-wallet invariants against REAL Postgres (S5-05 — what a mock cannot prove):
 * `SELECT … FOR UPDATE` on the company row serializes concurrent mutations, so
 * parallel credits never lose an update, parallel debits never overdraw, and
 * `bonusBalance == Σ credit − Σ debit` holds after any interleaving. Gated on
 * RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('S5-05 wallet ledger — concurrency invariants (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function credit(amount: number) {
    return tenantTransaction(prisma, (tx) =>
      walletCredit(tx, {
        agencyId,
        companyId,
        source: WalletTxnSource.MANUAL_ADJUSTMENT,
        amount,
        note: 'test',
        createdById: creatorId,
      })
    )
  }
  function debit(amount: number) {
    return tenantTransaction(prisma, (tx) =>
      walletDebit(tx, {
        agencyId,
        companyId,
        source: WalletTxnSource.MANUAL_ADJUSTMENT,
        amount,
        note: 'test',
        createdById: creatorId,
      })
    )
  }

  async function balance(): Promise<Prisma.Decimal> {
    const c = await prisma.company.findUnique({
      where: { id: companyId },
      select: { bonusBalance: true },
    })
    return new Prisma.Decimal(c?.bonusBalance ?? 0)
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `wl-${tag}@test.local`, passwordHash: 'x', name: 'WL Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `wl-${tag}`, slug: `wl-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'WL Co', slug: `wl-${tag}` },
    })
  })

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.walletTransaction.deleteMany({ where: { agencyId } })
    await prisma.company.update({ where: { id: companyId }, data: { bonusBalance: 0 } })
  })

  it('N parallel credits → balance is exactly N×amount, ledger has N rows (no lost update)', async () => {
    await Promise.all(Array.from({ length: 20 }, () => credit(10)))
    expect((await balance()).toFixed(2)).toBe('200.00')
    const count = await prisma.walletTransaction.count({ where: { companyId } })
    expect(count).toBe(20)
  })

  it('parallel debits that would overdraw → only the affordable succeed, balance never negative', async () => {
    await credit(50) // balance 50 → exactly 5 debits of 10 are affordable
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => debit(10)))
    const ok = results.filter((r) => r.status === 'fulfilled')
    const conflicts = results.filter(
      (r) => r.status === 'rejected' && (r.reason as { statusCode?: number }).statusCode === 409
    )
    expect(ok).toHaveLength(5)
    expect(conflicts).toHaveLength(5)
    const b = await balance()
    expect(b.toFixed(2)).toBe('0.00')
    expect(b.greaterThanOrEqualTo(0)).toBe(true)
  })

  it('balanceAfter on each row matches the running total under concurrency', async () => {
    await Promise.all(Array.from({ length: 15 }, () => credit(4)))
    const txns = await prisma.walletTransaction.findMany({
      where: { companyId },
      orderBy: { balanceAfter: 'asc' },
      select: { balanceAfter: true },
    })
    // FOR UPDATE serializes them, so the 15 balanceAfter snapshots are 4,8,…,60 with no gaps/dupes.
    expect(txns.map((t) => t.balanceAfter.toFixed(2))).toEqual(
      Array.from({ length: 15 }, (_, i) => ((i + 1) * 4).toFixed(2))
    )
  })

  it('invariant holds after a mixed interleaving: bonusBalance == Σcredit − Σdebit', async () => {
    const ops = [
      credit(30),
      debit(10),
      credit(5),
      debit(50), // may 409 depending on interleaving — allowed to fail
      credit(100),
      debit(20),
      credit(7),
      debit(3),
    ]
    await Promise.allSettled(ops)

    const txns = await prisma.walletTransaction.findMany({
      where: { companyId },
      select: { type: true, amount: true },
    })
    const ledgerSum = txns.reduce(
      (acc, t) => (t.type === 'credit' ? acc.plus(t.amount) : acc.minus(t.amount)),
      new Prisma.Decimal(0)
    )
    const b = await balance()
    expect(b.equals(ledgerSum)).toBe(true)
    expect(b.greaterThanOrEqualTo(0)).toBe(true)
  })
})
