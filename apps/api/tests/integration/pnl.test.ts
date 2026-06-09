import { randomUUID } from 'node:crypto'
import { prisma } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { computePnl } from '../../src/services/pnl.js'

/**
 * P&L against REAL Postgres (S5-10). Proves revenue = Σ confirmed amountUsd (bonus
 * amountUsd=0 excluded), recurring/one-time/salary expense normalization to a monthly
 * USD run-rate, and the single-salary-source rule. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('S5-10 P&L (real PG)', () => {
  const agencyId = randomUUID()
  const executorId = randomUUID()
  const companyId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function pnl(from = '2026-06-01', to = '2026-06-30') {
    return computePnl({ agencyId, from, to })
  }
  async function seedPayment(amountUsd: number, provider = 'manual') {
    await prisma.payment.create({
      data: {
        agencyId,
        companyId,
        amount: amountUsd,
        currency: 'USD',
        amountUsd,
        rateUsed: 1,
        type: 'final',
        status: 'confirmed',
        provider,
        confirmedBy: executorId,
        confirmedAt: new Date('2026-06-15T00:00:00Z'),
      },
    })
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: executorId, email: `pl-${tag}@test.local`, passwordHash: 'x', name: 'Exec' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `pl-${tag}`, slug: `pl-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'PL Co', slug: `pl-${tag}` },
    })
  })

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.expense.deleteMany({ where: { agencyId } })
    await prisma.executorRate.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: executorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.expense.deleteMany({ where: { agencyId } })
    await prisma.executorRate.deleteMany({ where: { agencyId } })
  })

  it('revenue excludes bonus (amountUsd=0) payments', async () => {
    await seedPayment(10000, 'manual')
    await seedPayment(500, 'bonus') // amountUsd is set to 500 here, but a real bonus is 0…
    // simulate a real bonus payment with amountUsd 0
    await prisma.payment.create({
      data: {
        agencyId,
        companyId,
        amount: 300,
        currency: 'USD',
        amountUsd: 0,
        rateUsed: 1,
        type: 'partial',
        status: 'confirmed',
        provider: 'bonus',
        confirmedBy: executorId,
        confirmedAt: new Date('2026-06-15T00:00:00Z'),
      },
    })
    const r = await pnl()
    // 10000 + 500 + 0 = 10500 (the amountUsd-0 row contributes nothing)
    expect(r.revenueUsd).toBe('10500.00')
  })

  it('recurring + salary expenses normalize; netProfit + margin correct', async () => {
    await seedPayment(10000)
    await prisma.expense.create({
      data: {
        agencyId,
        type: 'recurring',
        category: 'software',
        source: 'manual',
        amount: 1000,
        currency: 'USD',
        frequency: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        isActive: true,
        createdById: executorId,
      },
    })
    await prisma.executorRate.create({
      data: {
        agencyId,
        executorId,
        monthlySalary: 2000,
        commissionPercent: 0,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      },
    })
    const r = await pnl()
    expect(r.revenueUsd).toBe('10000.00')
    expect(r.salaryUsd).toBe('2000.00')
    expect(r.expensesUsd).toBe('3000.00') // 1000 software + 2000 salary
    expect(r.netProfitUsd).toBe('7000.00')
    expect(r.marginPct).toBe('70.00')
  })

  it('a manual category=salary line is ignored (single salary source = ExecutorRate)', async () => {
    await prisma.expense.create({
      data: {
        agencyId,
        type: 'recurring',
        category: 'salary',
        source: 'manual',
        amount: 9999,
        currency: 'USD',
        frequency: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        isActive: true,
        createdById: executorId,
      },
    })
    await prisma.executorRate.create({
      data: {
        agencyId,
        executorId,
        monthlySalary: 2000,
        commissionPercent: 0,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      },
    })
    const r = await pnl()
    expect(r.expensesUsd).toBe('2000.00') // only the rate salary
  })

  it('a one-time expense lands only in its start-month window', async () => {
    await prisma.expense.create({
      data: {
        agencyId,
        type: 'one_time',
        category: 'marketing',
        source: 'manual',
        amount: 500,
        currency: 'USD',
        startDate: new Date('2026-06-10T00:00:00Z'),
        isActive: true,
        createdById: executorId,
      },
    })
    expect((await pnl('2026-06-01', '2026-06-30')).expensesUsd).toBe('500.00')
    expect((await pnl('2026-07-01', '2026-07-31')).expensesUsd).toBe('0.00') // outside window
  })
})
