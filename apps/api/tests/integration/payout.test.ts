import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  generatePayout,
  getActiveRate,
  isPeriodLocked,
  periodBounds,
} from '../../src/services/payout.js'

/**
 * Executor payout against REAL Postgres (S5-04). Proves the calc from real time logs +
 * commission revenue, idempotent generation that never clobbers an approved payout,
 * window-correct rate selection, and the period lock. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('S5-04 payout (real PG)', () => {
  const agencyId = randomUUID()
  const executorId = randomUUID()
  const companyId = randomUUID()
  const orderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function generate(period: string) {
    return tenantTransaction(prisma, (tx) => generatePayout(tx, { agencyId, executorId, period }))
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: executorId, email: `po-${tag}@test.local`, passwordHash: 'x', name: 'Exec' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `po-${tag}`, slug: `po-${tag}` } })
    await prisma.agencyMember.create({
      data: { agencyId, profileId: executorId, role: 'executor' },
    })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'PO Co', slug: `po-${tag}` },
    })
    await prisma.order.create({
      data: {
        id: orderId,
        agencyId,
        companyId,
        title: 'Job',
        createdById: executorId,
        assigneeId: executorId,
      },
    })
  })

  afterAll(async () => {
    await prisma.executorPayout.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.executorRate.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agencyMember.deleteMany({ where: { agencyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: executorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.executorPayout.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.executorRate.deleteMany({ where: { agencyId } })
  })

  async function seedRate(monthlySalary: number, commissionPercent: number, from = '2026-05-01') {
    await prisma.executorRate.create({
      data: {
        agencyId,
        executorId,
        monthlySalary,
        commissionPercent,
        effectiveFrom: new Date(`${from}T00:00:00Z`),
      },
    })
  }
  async function seedHours(hours: number, date = '2026-06-10') {
    await prisma.timeLog.create({
      data: { agencyId, orderId, executorId, hours, date: new Date(`${date}T00:00:00Z`) },
    })
  }
  async function seedPayment(amountUsd: number, when = '2026-06-15') {
    await prisma.payment.create({
      data: {
        agencyId,
        companyId,
        orderId,
        amount: amountUsd,
        currency: 'USD',
        amountUsd,
        rateUsed: 1,
        type: 'final',
        status: 'confirmed',
        provider: 'manual',
        confirmedBy: executorId,
        confirmedAt: new Date(`${when}T00:00:00Z`),
      },
    })
  }

  it('total = salary + commission%×assigned-order revenue; billableHours summed', async () => {
    await seedRate(1000, 10)
    await seedHours(12)
    await seedHours(8)
    await seedPayment(5000)

    const p = await generate('2026-06')
    expect(p.baseSalary).toBe('1000.00')
    expect(p.billableHours).toBe('20.00')
    expect(p.commissionAmount).toBe('500.00') // 10% of 5000
    expect(p.total).toBe('1500.00')
    expect(p.status).toBe('draft')
  })

  it('generation is idempotent (re-run refreshes the draft, one row per executor+period)', async () => {
    await seedRate(1000, 0)
    const first = await generate('2026-06')
    await seedHours(5)
    const second = await generate('2026-06')
    expect(second.id).toBe(first.id)
    expect(second.billableHours).toBe('5.00') // refreshed
    const count = await prisma.executorPayout.count({ where: { agencyId, period: '2026-06' } })
    expect(count).toBe(1)
  })

  it('never clobbers an approved payout', async () => {
    await seedRate(1000, 0)
    const p = await generate('2026-06')
    await prisma.executorPayout.update({
      where: { id: p.id },
      data: { status: 'approved', approvedBy: executorId },
    })
    await seedHours(99) // would change billableHours if recomputed
    const again = await generate('2026-06')
    expect(again.status).toBe('approved')
    expect(again.billableHours).toBe('0.00') // unchanged — not recomputed
  })

  it('getActiveRate picks the window-correct rate', async () => {
    await seedRate(500, 0, '2026-01-01') // older window
    // close it + open a newer one starting mid-period
    await prisma.executorRate.updateMany({
      where: { agencyId, executorId, effectiveUntil: null },
      data: { effectiveUntil: new Date('2026-05-31T00:00:00Z') },
    })
    await seedRate(1500, 0, '2026-06-01')
    const rate = await tenantTransaction(prisma, (tx) =>
      getActiveRate(tx, executorId, periodBounds('2026-06'))
    )
    expect(rate?.monthlySalary?.toFixed(2)).toBe('1500.00')
  })

  it('period lock: draft → unlocked, approved → locked', async () => {
    await seedRate(1000, 0)
    const p = await generate('2026-06')
    expect(
      await tenantTransaction(prisma, (tx) => isPeriodLocked(tx, agencyId, executorId, '2026-06'))
    ).toBe(false)
    await prisma.executorPayout.update({ where: { id: p.id }, data: { status: 'approved' } })
    expect(
      await tenantTransaction(prisma, (tx) => isPeriodLocked(tx, agencyId, executorId, '2026-06'))
    ).toBe(true)
    // AR-20: the SAME period in ANOTHER agency must not be locked by this payout.
    expect(
      await tenantTransaction(prisma, (tx) =>
        isPeriodLocked(tx, 'another-agency-id', executorId, '2026-06')
      )
    ).toBe(false)
  })
})
