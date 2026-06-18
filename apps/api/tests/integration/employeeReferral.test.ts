import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { generatePayout } from '../../src/services/payout.js'

/**
 * Employee-referral bonus (S5.6 P-9b, §4.2) against REAL Postgres. An employee who
 * brought a client earns a flat % of that client's net income (Σ project margin),
 * accrued as a separate line on their payout. Proves: bonus = net × %, it lands in
 * `total`; 0% / no-referred-client / loss-making-client → 0; idempotent recompute.
 * Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('employee referral bonus (real PG)', () => {
  const agencyId = randomUUID()
  const execRef = randomUUID() // the employee who brought the client
  const execWorker = randomUUID() // does the work (referred nobody)
  const companyId = randomUUID()
  const projectId = randomUUID()
  const orderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function setPercent(percent: number) {
    return prisma.referralSettings.upsert({
      where: { agencyId },
      create: { agencyId, employeeReferralPercent: new Prisma.Decimal(percent) },
      update: { employeeReferralPercent: new Prisma.Decimal(percent) },
    })
  }
  function seedCharge(totalAmount: number) {
    return prisma.serviceCharge.create({
      data: {
        agencyId,
        companyId,
        projectId,
        amount: new Prisma.Decimal(totalAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
        currency: 'USD',
        month: new Date('2026-06-01'),
        periodStart: new Date('2026-06-01'),
        kind: 'hourly',
        status: 'pending',
      },
    })
  }
  function logCost(hours: number, costRateUsd: number) {
    return prisma.timeLog.create({
      data: {
        agencyId,
        orderId,
        executorId: execWorker,
        hours: new Prisma.Decimal(hours),
        date: new Date('2026-06-10'),
        costRateUsd: new Prisma.Decimal(costRateUsd),
      },
    })
  }
  function generate(executorId: string) {
    return tenantTransaction(prisma, (tx) =>
      generatePayout(tx, { agencyId, executorId, period: '2026-06' })
    )
  }

  beforeAll(async () => {
    await prisma.profile.createMany({
      data: [
        { id: execRef, email: `er-ref-${tag}@test.local`, passwordHash: 'x', name: 'Referrer' },
        { id: execWorker, email: `er-w-${tag}@test.local`, passwordHash: 'x', name: 'Worker' },
      ],
    })
    await prisma.agency.create({ data: { id: agencyId, name: `er-${tag}`, slug: `er-${tag}` } })
    await prisma.company.create({
      data: {
        id: companyId,
        agencyId,
        name: 'ER Co',
        slug: `er-${tag}`,
        referredByEmployeeId: execRef, // execRef brought this client
      },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'ER Project',
        billingModel: 'hourly_postpaid',
        currency: 'USD',
        clientHourlyRate: new Prisma.Decimal(60),
      },
    })
    await prisma.order.create({
      data: { id: orderId, agencyId, projectId, title: 'ER order', createdById: execWorker },
    })
  })

  afterAll(async () => {
    await prisma.executorPayout.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.referralSettings.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: { in: [execRef, execWorker] } } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.executorPayout.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.referralSettings.deleteMany({ where: { agencyId } })
  })

  it('bonus = net income × % and is included in total', async () => {
    await setPercent(10)
    await seedCharge(300) // revenue 300
    await logCost(5, 20) // cost 100 → net income 200
    const p = await generate(execRef)
    expect(p.referralBonusAmount).toBe('20.00') // 200 × 10%
    expect(p.total).toBe('20.00') // no salary/commission → just the bonus
  })

  it('0% → no bonus', async () => {
    await setPercent(0)
    await seedCharge(300)
    await logCost(5, 20)
    const p = await generate(execRef)
    expect(p.referralBonusAmount).toBe('0.00')
  })

  it('an executor who referred nobody earns no bonus', async () => {
    await setPercent(10)
    await seedCharge(300)
    await logCost(5, 20)
    const p = await generate(execWorker) // did the work, but referred no client
    expect(p.referralBonusAmount).toBe('0.00')
  })

  it('a loss-making client contributes nothing (clamped, never negative)', async () => {
    await setPercent(10)
    await seedCharge(50) // revenue 50
    await logCost(10, 20) // cost 200 → net −150
    const p = await generate(execRef)
    expect(p.referralBonusAmount).toBe('0.00')
  })

  it('recompute is idempotent (draft refreshes with the latest %, one row)', async () => {
    await setPercent(10)
    await seedCharge(300)
    await logCost(5, 20) // net 200 → bonus 20 @ 10%
    const first = await generate(execRef)
    expect(first.referralBonusAmount).toBe('20.00')

    await setPercent(5) // owner lowers the rate → next draft must reflect it
    const second = await generate(execRef)
    expect(second.id).toBe(first.id) // same row
    expect(second.referralBonusAmount).toBe('10.00') // 200 × 5%
    const count = await prisma.executorPayout.count({ where: { agencyId, period: '2026-06' } })
    expect(count).toBe(1)
  })
})
