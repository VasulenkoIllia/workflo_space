import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { allocatePayment, refreshMoneyBalance } from '../../src/services/allocation.js'
import { spendBonusOnCharge } from '../../src/services/bonusSpend.js'
import { computeProjectMargin } from '../../src/services/margin.js'
import { generateRecurringCharges } from '../../src/services/recurringCharges.js'

/**
 * P-11 on_actuals invoice-approval gate (PROJECTS_SPEC §8) against REAL Postgres. A project
 * whose effective approvalMode is on_actuals issues its charge as a DRAFT (approvalStatus=
 * pending) that is EXCLUDED from moneyBalance and accrual revenue until released. Releasing it
 * (approvalStatus → approved) folds it back into both. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('on_actuals charge gate (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const projectId = randomUUID()
  const orderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `oa-${tag}@test.local`, passwordHash: 'x', name: 'OA Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `oa-${tag}`, slug: `oa-${tag}` } })
    // Company opts into on_actuals — every charge under it needs sign-off before it's real.
    await prisma.company.create({
      data: {
        id: companyId,
        agencyId,
        name: 'OA Co',
        slug: `oa-${tag}`,
        loyaltyTier: 'new',
        approvalMode: 'on_actuals',
      },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'OA Project',
        billingModel: 'hourly_postpaid',
        billingCycle: 'monthly_day_n',
        currency: 'USD',
        clientHourlyRate: new Prisma.Decimal(30),
        nextCycleAt: new Date('2026-08-01T00:00:00Z'),
      },
    })
    await prisma.order.create({
      data: { id: orderId, agencyId, projectId, title: 'OA order', createdById: creatorId },
    })
    // 5 billable hours in July → postpaid charge at the Aug close = 5 × 30 = 150.
    await prisma.timeLog.create({
      data: {
        agencyId,
        orderId,
        executorId: creatorId,
        hours: new Prisma.Decimal(5),
        date: new Date('2026-07-10'),
        clientRateSnapshot: new Prisma.Decimal(30),
      },
    })
    await tenantTransaction(prisma, (tx) =>
      generateRecurringCharges(tx, { now: new Date('2026-08-15T00:00:00Z'), agencyId })
    )
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

  const marginScope = {
    agencyId,
    projectId,
    from: new Date('2026-07-01T00:00:00Z'),
    to: new Date('2026-07-31T00:00:00Z'),
  }

  it('issues the postpaid charge as a pending draft', async () => {
    const charge = await prisma.serviceCharge.findFirst({ where: { projectId, kind: 'hourly' } })
    expect(charge?.totalAmount?.toFixed(2)).toBe('150.00')
    expect(charge?.approvalStatus).toBe('pending') // on_actuals → draft
  })

  it('draft is EXCLUDED from moneyBalance and accrual revenue', async () => {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { moneyBalance: true },
    })
    expect(company.moneyBalance.toFixed(2)).toBe('0.00') // 150 draft owes nothing yet

    const margin = await tenantTransaction(prisma, (tx) => computeProjectMargin(tx, marginScope))
    expect(margin?.revenueUsd).toBe('0.00') // not accrued while pending
  })

  it('a draft cannot be settled by an explicit allocation or by bonus (HIGH guards)', async () => {
    const charge = await prisma.serviceCharge.findFirstOrThrow({
      where: { projectId, kind: 'hourly' },
    })
    const payment = await prisma.payment.create({
      data: {
        agencyId,
        companyId,
        amount: new Prisma.Decimal(150),
        currency: 'USD',
        status: 'confirmed',
        type: 'final',
        confirmedBy: creatorId,
      },
    })
    // Explicit allocation to a draft → 409.
    await expect(
      tenantTransaction(prisma, (tx) =>
        allocatePayment(tx, {
          agencyId,
          paymentId: payment.id,
          allocations: [{ chargeId: charge.id, amount: 150 }],
        })
      )
    ).rejects.toMatchObject({ statusCode: 409 })
    // Bonus spend on a draft → 409.
    await prisma.company.update({
      where: { id: companyId },
      data: { bonusBalance: new Prisma.Decimal(200) },
    })
    await expect(
      tenantTransaction(prisma, (tx) =>
        spendBonusOnCharge(tx, { agencyId, companyId, chargeId: charge.id, confirmedBy: creatorId })
      )
    ).rejects.toMatchObject({ statusCode: 409 })
    await prisma.payment.deleteMany({ where: { id: payment.id } })
    await prisma.company.update({ where: { id: companyId }, data: { bonusBalance: 0 } })
  })

  it('releasing the draft (→ approved) folds it back into balance + revenue', async () => {
    await prisma.serviceCharge.updateMany({
      where: { projectId, kind: 'hourly' },
      data: {
        approvalStatus: 'approved',
        approvalDecidedAt: new Date(),
        approvalDecidedById: creatorId,
      },
    })
    await tenantTransaction(prisma, (tx) => refreshMoneyBalance(tx, { agencyId, companyId }))

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { moneyBalance: true },
    })
    expect(company.moneyBalance.toFixed(2)).toBe('-150.00') // now owed

    const margin = await tenantTransaction(prisma, (tx) => computeProjectMargin(tx, marginScope))
    expect(margin?.revenueUsd).toBe('150.00') // now accrued
  })
})
