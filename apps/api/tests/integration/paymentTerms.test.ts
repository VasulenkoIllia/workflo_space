import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { closeProjectCycle, generateRecurringCharges } from '../../src/services/recurringCharges.js'

/**
 * Payment terms → charge dueDate (S5.6 P-4, 05-Г / В10) against REAL Postgres. Proves
 * the cascade project → company → agency (PaymentSettings), the issue-anchor rule
 * (advance = periodStart, postpaid = periodEnd) + net terms, the legacy fallback when
 * every tier is null, and the manual-close path. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('payment terms → dueDate (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const fixedId = randomUUID()
  const hourlyId = randomUUID()
  const hourlyOrderId = randomUUID()
  const weeklyId = randomUUID()
  const weeklyOrderId = randomUUID()
  const hybridId = randomUUID()
  const hybridOrderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function generate(now: Date) {
    return tenantTransaction(prisma, (tx) => generateRecurringCharges(tx, { now, agencyId }))
  }
  function setAnchor(id: string, nextCycleAt: Date | null) {
    return prisma.project.update({ where: { id }, data: { nextCycleAt } })
  }
  function setProjectTerms(id: string, days: number | null) {
    return prisma.project.update({ where: { id }, data: { paymentTermsDays: days } })
  }
  function setCompanyTerms(days: number | null) {
    return prisma.company.update({ where: { id: companyId }, data: { paymentTermsDays: days } })
  }
  function setAgencyTerms(days: number | null) {
    return prisma.paymentSettings.upsert({
      where: { agencyId },
      create: { agencyId, paymentTermsDays: days },
      update: { paymentTermsDays: days },
    })
  }
  function dueOf(projectId: string) {
    return prisma.serviceCharge
      .findFirstOrThrow({ where: { projectId } })
      .then((c) => c.dueDate?.toISOString().slice(0, 10))
  }
  function dueOfKind(projectId: string, kind: string) {
    return prisma.serviceCharge
      .findFirstOrThrow({ where: { projectId, kind } })
      .then((c) => c.dueDate?.toISOString().slice(0, 10))
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `pt-${tag}@test.local`, passwordHash: 'x', name: 'PT Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `pt-${tag}`, slug: `pt-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'PT Co', slug: `pt-${tag}`, loyaltyTier: 'new' },
    })
    await prisma.project.create({
      data: {
        id: fixedId,
        agencyId,
        companyId,
        name: 'PT Fixed',
        billingModel: 'fixed_monthly_advance',
        billingCycle: 'monthly_day_n',
        abonAmount: new Prisma.Decimal(500),
      },
    })
    await prisma.project.create({
      data: {
        id: hourlyId,
        agencyId,
        companyId,
        name: 'PT Hourly',
        billingModel: 'hourly_postpaid',
        billingCycle: 'monthly_day_n',
        clientHourlyRate: new Prisma.Decimal(40),
      },
    })
    await prisma.order.create({
      data: {
        id: hourlyOrderId,
        agencyId,
        projectId: hourlyId,
        title: 'PT order',
        createdById: creatorId,
      },
    })
    await prisma.project.create({
      data: {
        id: weeklyId,
        agencyId,
        companyId,
        name: 'PT Weekly',
        billingModel: 'hourly_postpaid',
        billingCycle: 'weekly_day_x',
        clientHourlyRate: new Prisma.Decimal(40),
      },
    })
    await prisma.order.create({
      data: {
        id: weeklyOrderId,
        agencyId,
        projectId: weeklyId,
        title: 'PT weekly order',
        createdById: creatorId,
      },
    })
    await prisma.project.create({
      data: {
        id: hybridId,
        agencyId,
        companyId,
        name: 'PT Hybrid',
        billingModel: 'fixed_monthly_advance',
        billingCycle: 'monthly_day_n',
        abonAmount: new Prisma.Decimal(500),
        includedHoursCap: new Prisma.Decimal(20),
        clientHourlyRate: new Prisma.Decimal(30),
      },
    })
    await prisma.order.create({
      data: {
        id: hybridOrderId,
        agencyId,
        projectId: hybridId,
        title: 'PT hybrid order',
        createdById: creatorId,
      },
    })
  })

  afterEach(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.paymentSettings.deleteMany({ where: { agencyId } })
    await setAnchor(fixedId, null)
    await setAnchor(hourlyId, null)
    await setAnchor(weeklyId, null)
    await setAnchor(hybridId, null)
    await setProjectTerms(fixedId, null)
    await setProjectTerms(hourlyId, null)
    await setProjectTerms(weeklyId, null)
    await setProjectTerms(hybridId, null)
    await setCompanyTerms(null)
  })

  afterAll(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.paymentSettings.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  // ── fixed_monthly_advance: anchor = periodStart (2026-07-01) ──────────────────
  it('project-level terms: dueDate = periodStart + days (advance anchor)', async () => {
    await setProjectTerms(fixedId, 14)
    await setAnchor(fixedId, new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    expect(await dueOf(fixedId)).toBe('2026-07-15') // 2026-07-01 + 14d
  })

  it('cascade tier 2: project null → company default', async () => {
    await setCompanyTerms(20)
    await setAnchor(fixedId, new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    expect(await dueOf(fixedId)).toBe('2026-07-21') // 2026-07-01 + 20d
  })

  it('cascade tier 3: project + company null → agency PaymentSettings default', async () => {
    await setAgencyTerms(5)
    await setAnchor(fixedId, new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    expect(await dueOf(fixedId)).toBe('2026-07-06') // 2026-07-01 + 5d
  })

  it('cascade precedence: project wins over company and agency', async () => {
    await setProjectTerms(fixedId, 3)
    await setCompanyTerms(20)
    await setAgencyTerms(60)
    await setAnchor(fixedId, new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    expect(await dueOf(fixedId)).toBe('2026-07-04') // project 3d wins
  })

  it('all tiers null → legacy per-model dueDate (no regression)', async () => {
    await setAnchor(fixedId, new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    expect(await dueOf(fixedId)).toBe('2026-08-01') // legacy addMonth(periodStart)
  })

  it('zero-day terms are honored (?? keeps 0): dueDate = anchor + 0 = periodStart', async () => {
    await setProjectTerms(fixedId, 0)
    await setCompanyTerms(30) // must NOT be used — project 0 wins over company 30
    await setAnchor(fixedId, new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    expect(await dueOf(fixedId)).toBe('2026-07-01') // due immediately at the issue anchor
  })

  // ── weekly_day_x: anchor = periodEnd (cursor − 1) ─────────────────────────────
  it('weekly cycle with terms: dueDate = periodEnd + days', async () => {
    await setProjectTerms(weeklyId, 5)
    await prisma.timeLog.create({
      data: {
        agencyId,
        orderId: weeklyOrderId,
        executorId: creatorId,
        hours: new Prisma.Decimal(3),
        date: new Date('2026-07-03'), // inside the closed week [07-01, 07-07]
        clientRateSnapshot: new Prisma.Decimal(40),
      },
    })
    await setAnchor(weeklyId, new Date('2026-07-08T00:00:00Z'))
    await generate(new Date('2026-07-10T00:00:00Z'))
    // week = [2026-07-01, 2026-07-07]; anchor = periodEnd 2026-07-07 + 5d
    expect(await dueOf(weeklyId)).toBe('2026-07-12')
  })

  // ── overage (postpaid component of a hybrid fixed project): anchor = ovEnd ─────
  it('hybrid overage charge: dueDate = ovEnd + terms (postpaid anchor)', async () => {
    await setProjectTerms(hybridId, 10)
    await prisma.timeLog.create({
      data: {
        agencyId,
        orderId: hybridOrderId,
        executorId: creatorId,
        hours: new Prisma.Decimal(25), // cap 20 → 5h over
        date: new Date('2026-06-10'),
        clientRateSnapshot: new Prisma.Decimal(0), // zeroBilled within the subscription
      },
    })
    await setAnchor(hybridId, new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    // overage period = June; anchor = ovEnd 2026-06-30 + 10d
    expect(await dueOfKind(hybridId, 'overage')).toBe('2026-07-10')
    // the coexisting subscription advance anchors on periodStart 2026-07-01 + 10d
    expect(await dueOfKind(hybridId, 'subscription')).toBe('2026-07-11')
  })

  // ── hourly_postpaid: anchor = periodEnd (2026-06-30) ──────────────────────────
  it('postpaid anchors on periodEnd, not periodStart', async () => {
    await setProjectTerms(hourlyId, 10)
    await prisma.timeLog.create({
      data: {
        agencyId,
        orderId: hourlyOrderId,
        executorId: creatorId,
        hours: new Prisma.Decimal(4),
        date: new Date('2026-06-10'),
        clientRateSnapshot: new Prisma.Decimal(40), // billable → produces a charge
      },
    })
    await setAnchor(hourlyId, new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    // period = June (2026-06-01..2026-06-30); anchor = periodEnd 2026-06-30 + 10d
    expect(await dueOf(hourlyId)).toBe('2026-07-10')
  })

  // ── manual close ──────────────────────────────────────────────────────────────
  it('manual close: dueDate = periodEnd + terms', async () => {
    await setProjectTerms(fixedId, 7)
    await tenantTransaction(prisma, (tx) =>
      closeProjectCycle(tx, {
        agencyId,
        projectId: fixedId,
        periodStart: new Date('2026-06-01'),
        periodEnd: new Date('2026-06-30'),
      })
    )
    expect(await dueOf(fixedId)).toBe('2026-07-07') // 2026-06-30 + 7d
  })

  it('manual close with no terms → periodEnd (legacy)', async () => {
    await tenantTransaction(prisma, (tx) =>
      closeProjectCycle(tx, {
        agencyId,
        projectId: fixedId,
        periodStart: new Date('2026-06-01'),
        periodEnd: new Date('2026-06-30'),
      })
    )
    expect(await dueOf(fixedId)).toBe('2026-06-30')
  })
})
