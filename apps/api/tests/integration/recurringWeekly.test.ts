import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { generateRecurringCharges } from '../../src/services/recurringCharges.js'

/**
 * weekly_day_x cycle (P-2b) against REAL Postgres — hourly_postpaid billed per week
 * (owner's «щопонеділка»). The generator keys off nextCycleAt; the anchor advances
 * +7 days and each charge bills the week that just closed [anchor-7, anchor-1].
 * Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('weekly_day_x recurring charges (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const projectId = randomUUID()
  const orderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function logTime(hours: number, rate: number, date: string) {
    return prisma.timeLog.create({
      data: {
        agencyId,
        orderId,
        executorId: creatorId,
        hours: new Prisma.Decimal(hours),
        date: new Date(date),
        clientRateSnapshot: new Prisma.Decimal(rate),
      },
    })
  }
  function generate(now: Date) {
    return tenantTransaction(prisma, (tx) => generateRecurringCharges(tx, { now, agencyId }))
  }
  function setAnchor(nextCycleAt: Date | null) {
    return prisma.project.update({ where: { id: projectId }, data: { nextCycleAt } })
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `wk-${tag}@test.local`, passwordHash: 'x', name: 'WK Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `wk-${tag}`, slug: `wk-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'WK Co', slug: `wk-${tag}`, loyaltyTier: 'new' },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'WK Project',
        billingModel: 'hourly_postpaid',
        billingCycle: 'weekly_day_x',
        cycleWeekday: 1,
        clientHourlyRate: new Prisma.Decimal(30),
      },
    })
    await prisma.order.create({
      data: { id: orderId, agencyId, projectId, title: 'WK order', createdById: creatorId },
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

  it('bills the week that just closed [anchor-7, anchor-1]; advances +7 days', async () => {
    await logTime(4, 30, '2026-06-17') // inside the closed week → 120
    await logTime(2, 30, '2026-06-24') // next week — must NOT be billed yet
    await setAnchor(new Date('2026-06-22T00:00:00Z')) // close on Mon 22 → bills 15..21

    const res = await generate(new Date('2026-06-22T01:00:00Z'))
    expect(res.created).toBe(1)
    const charge = await prisma.serviceCharge.findFirstOrThrow({ where: { projectId } })
    expect(charge.periodStart?.toISOString().slice(0, 10)).toBe('2026-06-15')
    expect(charge.periodEnd?.toISOString().slice(0, 10)).toBe('2026-06-21')
    expect(charge.baseAmount?.toFixed(2)).toBe('120.00')

    const p = await prisma.project.findUnique({ where: { id: projectId } })
    expect(p?.nextCycleAt?.toISOString()).toBe('2026-06-29T00:00:00.000Z') // +7 days
  })

  it('catches up multiple missed weeks in one run', async () => {
    await logTime(1, 30, '2026-06-03') // week [01..07]
    await logTime(1, 30, '2026-06-10') // week [08..14]
    await setAnchor(new Date('2026-06-08T00:00:00Z')) // closes 08 (wk 01-07) and 15 (wk 08-14)
    const res = await generate(new Date('2026-06-16T00:00:00Z'))
    expect(res.created).toBe(2)
    const periods = await prisma.serviceCharge.findMany({
      where: { projectId },
      orderBy: { periodStart: 'asc' },
      select: { periodStart: true },
    })
    expect(periods.map((c) => c.periodStart?.toISOString().slice(0, 10))).toEqual([
      '2026-06-01',
      '2026-06-08',
    ])
  })
})
