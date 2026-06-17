import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterEach, afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateRecurringCharges } from '../../src/services/recurringCharges.js'

/**
 * Hybrid project overage (P-2d) against REAL Postgres. A fixed_monthly_advance
 * project with includedHoursCap bills the abon in advance AND the hours over the
 * cap for the just-closed month at clientHourlyRate — a separate kind='overage'
 * charge that coexists with the subscription advance. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('hybrid project overage (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const projectId = randomUUID()
  const orderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function logHours(hours: number, date: string) {
    return prisma.timeLog.create({
      data: {
        agencyId,
        orderId,
        executorId: creatorId,
        hours: new Prisma.Decimal(hours),
        date: new Date(date),
        clientRateSnapshot: new Prisma.Decimal(0), // zeroBilled within the subscription
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
      data: { id: creatorId, email: `hy-${tag}@test.local`, passwordHash: 'x', name: 'HY Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `hy-${tag}`, slug: `hy-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'HY Co', slug: `hy-${tag}`, loyaltyTier: 'new' },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'HY Project',
        billingModel: 'fixed_monthly_advance',
        billingCycle: 'monthly_day_n',
        abonAmount: new Prisma.Decimal(500),
        includedHoursCap: new Prisma.Decimal(20),
        clientHourlyRate: new Prisma.Decimal(30), // overage rate
      },
    })
    await prisma.order.create({
      data: { id: orderId, agencyId, projectId, title: 'HY order', createdById: creatorId },
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

  it('over the cap: advance (subscription) + overage charge coexist', async () => {
    await logHours(15, '2026-06-10')
    await logHours(10, '2026-06-20') // June total 25h, cap 20 → 5h over
    await setAnchor(new Date('2026-07-01T00:00:00Z'))

    const res = await generate(new Date('2026-07-15T00:00:00Z'))
    expect(res.created).toBe(2)

    const sub = await prisma.serviceCharge.findFirstOrThrow({
      where: { projectId, kind: 'subscription' },
    })
    expect(sub.baseAmount?.toFixed(2)).toBe('500.00')
    expect(sub.periodStart?.toISOString().slice(0, 10)).toBe('2026-07-01') // advance for July

    const over = await prisma.serviceCharge.findFirstOrThrow({
      where: { projectId, kind: 'overage' },
    })
    expect(over.periodStart?.toISOString().slice(0, 10)).toBe('2026-06-01') // the closed month
    expect(over.baseAmount?.toFixed(2)).toBe('150.00') // (25 − 20) × 30
  })

  it('under the cap: only the subscription advance, no overage', async () => {
    await logHours(12, '2026-06-10') // under cap 20
    await setAnchor(new Date('2026-07-01T00:00:00Z'))

    const res = await generate(new Date('2026-07-15T00:00:00Z'))
    expect(res.created).toBe(1)
    expect(await prisma.serviceCharge.count({ where: { projectId, kind: 'overage' } })).toBe(0)
  })
})
