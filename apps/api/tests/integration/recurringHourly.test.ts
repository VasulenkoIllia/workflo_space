import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { generateRecurringCharges } from '../../src/services/recurringCharges.js'

/**
 * hourly_postpaid cycle generation (P-2a) against REAL Postgres. Bills the month
 * that just ended by Σ(hours × clientRateSnapshot); zeroBilled work (snapshot 0)
 * is excluded automatically. Company tier = `new` (0% discount) for clean asserts.
 * Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('hourly_postpaid recurring charges (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const projectId = randomUUID()
  const orderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function logTime(hours: number, rate: number | null, date: string) {
    return prisma.timeLog.create({
      data: {
        agencyId,
        orderId,
        executorId: creatorId,
        hours: new Prisma.Decimal(hours),
        date: new Date(date),
        clientRateSnapshot: rate === null ? null : new Prisma.Decimal(rate),
      },
    })
  }

  function generate(now: Date) {
    return tenantTransaction(prisma, (tx) => generateRecurringCharges(tx, { now, agencyId }))
  }

  async function setAnchor(nextCycleAt: Date | null) {
    await prisma.project.update({ where: { id: projectId }, data: { nextCycleAt } })
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `ho-${tag}@test.local`, passwordHash: 'x', name: 'HO Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `ho-${tag}`, slug: `ho-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'HO Co', slug: `ho-${tag}`, loyaltyTier: 'new' },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'HO Project',
        billingModel: 'hourly_postpaid',
        billingCycle: 'monthly_day_n',
        clientHourlyRate: new Prisma.Decimal(30),
      },
    })
    await prisma.order.create({
      data: { id: orderId, agencyId, projectId, title: 'HO order', createdById: creatorId },
    })
  })

  afterEach(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await setAnchor(null)
  })

  afterAll(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  it('bills the prior month by Σ(hours × clientRateSnapshot); advances anchor', async () => {
    await logTime(5, 30, '2026-06-10') // 150
    await logTime(3, 30, '2026-06-20') // 90 → June total 240
    await logTime(4, 30, '2026-07-05') // next period — must NOT be billed yet
    await setAnchor(new Date('2026-07-01T00:00:00Z')) // close = July 1 → bills June

    const res = await generate(new Date('2026-07-15T00:00:00Z'))
    expect(res.created).toBe(1)

    const charge = await prisma.serviceCharge.findFirstOrThrow({ where: { projectId } })
    expect(charge.periodStart?.toISOString().slice(0, 10)).toBe('2026-06-01')
    expect(charge.periodEnd?.toISOString().slice(0, 10)).toBe('2026-06-30')
    expect(charge.baseAmount?.toFixed(2)).toBe('240.00')
    expect(charge.totalAmount?.toFixed(2)).toBe('240.00') // tier new = 0% off

    const p = await prisma.project.findUnique({ where: { id: projectId } })
    expect(p?.nextCycleAt?.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('no billable hours in the period → no charge', async () => {
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    const res = await generate(new Date('2026-07-15T00:00:00Z'))
    expect(res.created).toBe(0)
  })

  it('zeroBilled hours (snapshot 0) are excluded from billable revenue', async () => {
    await logTime(5, 30, '2026-06-10') // 150 billable
    await logTime(2, 0, '2026-06-12') // zeroBilled → 0
    await setAnchor(new Date('2026-07-01T00:00:00Z'))

    await generate(new Date('2026-07-15T00:00:00Z'))
    const charge = await prisma.serviceCharge.findFirstOrThrow({ where: { projectId } })
    expect(charge.baseAmount?.toFixed(2)).toBe('150.00') // 5×30, the 2 zeroBilled hours excluded
  })

  it('idempotent: re-running the same close creates no duplicate', async () => {
    await logTime(5, 30, '2026-06-10')
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    await setAnchor(new Date('2026-07-01T00:00:00Z')) // force re-close of the same period
    const again = await generate(new Date('2026-07-15T00:00:00Z'))
    expect(again.created).toBe(0)
    expect(await prisma.serviceCharge.count({ where: { projectId } })).toBe(1)
  })
})
