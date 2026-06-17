import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterEach, afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeProjectCycle } from '../../src/services/recurringCharges.js'

/**
 * Manual cycle close (P-2c) against REAL Postgres. The owner picks the period and
 * closeProjectCycle bills it with the same logic as the cron: fixed → abonAmount,
 * hourly_postpaid → Σ(billable hours). Idempotent per (projectId, periodStart).
 * Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('manual cycle close (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const fixedId = randomUUID()
  const hourlyId = randomUUID()
  const orderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function close(projectId: string, periodStart: string, periodEnd: string) {
    return tenantTransaction(prisma, (tx) =>
      closeProjectCycle(tx, {
        agencyId,
        projectId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      })
    )
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `mc-${tag}@test.local`, passwordHash: 'x', name: 'MC Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `mc-${tag}`, slug: `mc-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'MC Co', slug: `mc-${tag}`, loyaltyTier: 'new' },
    })
    await prisma.project.create({
      data: {
        id: fixedId,
        agencyId,
        companyId,
        name: 'MC Fixed',
        billingModel: 'fixed_monthly_advance',
        billingCycle: 'manual',
        abonAmount: new Prisma.Decimal(200),
      },
    })
    await prisma.project.create({
      data: {
        id: hourlyId,
        agencyId,
        companyId,
        name: 'MC Hourly',
        billingModel: 'hourly_postpaid',
        billingCycle: 'manual',
        clientHourlyRate: new Prisma.Decimal(30),
      },
    })
    await prisma.order.create({
      data: {
        id: orderId,
        agencyId,
        projectId: hourlyId,
        title: 'MC order',
        createdById: creatorId,
      },
    })
  })

  afterEach(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
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

  it('fixed manual: bills abonAmount for the owner-specified period', async () => {
    const res = await close(fixedId, '2026-06-01', '2026-06-30')
    expect(res.created).toBe(1)
    const charge = await prisma.serviceCharge.findFirstOrThrow({ where: { projectId: fixedId } })
    expect(charge.baseAmount?.toFixed(2)).toBe('200.00')
    expect(charge.periodStart?.toISOString().slice(0, 10)).toBe('2026-06-01')
    expect(charge.periodEnd?.toISOString().slice(0, 10)).toBe('2026-06-30')
  })

  it('hourly manual: bills Σ(hours × clientRateSnapshot) within the period', async () => {
    await prisma.timeLog.create({
      data: {
        agencyId,
        orderId,
        executorId: creatorId,
        hours: new Prisma.Decimal(5),
        date: new Date('2026-06-10'),
        clientRateSnapshot: new Prisma.Decimal(30),
      },
    })
    const res = await close(hourlyId, '2026-06-01', '2026-06-30')
    expect(res.created).toBe(1)
    const charge = await prisma.serviceCharge.findFirstOrThrow({ where: { projectId: hourlyId } })
    expect(charge.baseAmount?.toFixed(2)).toBe('150.00')
  })

  it('idempotent: re-closing the same period creates no duplicate', async () => {
    await close(fixedId, '2026-06-01', '2026-06-30')
    const again = await close(fixedId, '2026-06-01', '2026-06-30')
    expect(again.created).toBe(0)
    expect(await prisma.serviceCharge.count({ where: { projectId: fixedId } })).toBe(1)
  })

  it('cross-tenant: a mismatched agencyId yields no charge', async () => {
    const res = await tenantTransaction(prisma, (tx) =>
      closeProjectCycle(tx, {
        agencyId: randomUUID(),
        projectId: fixedId,
        periodStart: new Date('2026-06-01'),
        periodEnd: new Date('2026-06-30'),
      })
    )
    expect(res.created).toBe(0)
    expect(await prisma.serviceCharge.count({ where: { projectId: fixedId } })).toBe(0)
  })
})
