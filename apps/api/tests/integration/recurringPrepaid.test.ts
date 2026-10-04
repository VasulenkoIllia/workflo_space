import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { generateRecurringCharges } from '../../src/services/recurringCharges.js'

/**
 * hourly_prepaid cycle-engine (S5.6 P-7, 02-В) against REAL Postgres. Advance at cycle
 * start = Σ(estimate hours) × clientHourlyRate × advanceGatePct%; reconciliation at the
 * next cycle = actual − advance → a positive top-up (kind='prepaid_reconciliation') or a
 * NEGATIVE credit (kind='prepaid_credit') that lifts moneyBalance. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('hourly_prepaid cycle (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const projectId = randomUUID()
  const orderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function generate(now: Date) {
    return tenantTransaction(prisma, (tx) => generateRecurringCharges(tx, { now, agencyId }))
  }
  function setAnchor(nextCycleAt: Date) {
    return prisma.project.update({ where: { id: projectId }, data: { nextCycleAt } })
  }
  function logHours(hours: number, date: string) {
    return prisma.timeLog.create({
      data: {
        agencyId,
        orderId,
        executorId: creatorId,
        hours: new Prisma.Decimal(hours),
        date: new Date(date),
        clientRateSnapshot: new Prisma.Decimal(30), // billable client rate
      },
    })
  }
  function chargeOf(kind: string) {
    return prisma.serviceCharge.findFirst({ where: { projectId, kind } })
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `pp-${tag}@test.local`, passwordHash: 'x', name: 'PP Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `pp-${tag}`, slug: `pp-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'PP Co', slug: `pp-${tag}`, loyaltyTier: 'new' },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'PP Project',
        billingModel: 'hourly_prepaid',
        billingCycle: 'monthly_day_n',
        clientHourlyRate: new Prisma.Decimal(30),
        advanceGatePct: new Prisma.Decimal(50), // advance = 50% of the estimate
      },
    })
    await prisma.order.create({
      data: { id: orderId, agencyId, projectId, title: 'PP order', createdById: creatorId },
    })
    // Estimate budget: 10 hours → advance = 10 × 30 × 50% = 150.
    await prisma.estimateLine.create({
      data: { agencyId, projectId, name: 'Бюджет', hours: new Prisma.Decimal(10) },
    })
  })

  afterEach(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.company.update({ where: { id: companyId }, data: { moneyBalance: 0 } })
  })

  afterAll(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.estimateLine.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  it('charges the advance at cycle start = Σ(estimate) × rate × gate%', async () => {
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    const adv = await chargeOf('prepaid_advance')
    expect(adv?.totalAmount?.toFixed(2)).toBe('150.00') // 10 × 30 × 50%
    expect(adv?.periodStart?.toISOString().slice(0, 10)).toBe('2026-07-01')
  })

  it('reconciles under-payment (actual > advance) → positive top-up', async () => {
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z')) // advance(July) = 150, anchor → Aug
    await logHours(8, '2026-07-10') // actual July = 8 × 30 = 240 > 150
    await generate(new Date('2026-08-15T00:00:00Z')) // reconcile July + advance(Aug)
    const recon = await chargeOf('prepaid_reconciliation')
    expect(recon?.totalAmount?.toFixed(2)).toBe('90.00') // 240 − 150
    expect(recon?.periodStart?.toISOString().slice(0, 10)).toBe('2026-07-01')
  })

  it('reconciles over-payment (actual < advance) → negative credit + lifts moneyBalance', async () => {
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z')) // advance(July) = 150
    await logHours(4, '2026-07-10') // actual July = 4 × 30 = 120 < 150
    await generate(new Date('2026-08-15T00:00:00Z')) // reconcile July
    const credit = await chargeOf('prepaid_credit')
    expect(credit?.totalAmount?.toFixed(2)).toBe('-30.00') // 120 − 150
    // moneyBalance = Σpayments − Σcharges; a negative charge raises it (a credit).
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { moneyBalance: true },
    })
    // charges: advance July 150 + advance Aug 150 + credit −30 = 270 owed → balance −270.
    expect(company.moneyBalance.toFixed(2)).toBe('-270.00')
  })

  it('multi-period catch-up reconciles each period against its OWN advance (not a phantom full charge)', async () => {
    // Project is 3 cycles behind: a SINGLE run must charge advance(Jul/Aug/Sep) and
    // reconcile Jul & Aug. The Jul/Aug advances are created earlier in THIS very run and
    // are not in the DB yet — reconciliation must read them from the in-run buffer, else
    // advancePaid falls back to 0 and the client is double-billed the whole period.
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    await logHours(8, '2026-07-10') // actual July = 8 × 30 = 240 → recon = 240 − 150 = 90
    await logHours(8, '2026-08-10') // actual Aug  = 8 × 30 = 240 → recon = 240 − 150 = 90
    await generate(new Date('2026-09-15T00:00:00Z')) // one run, catch-up Jul→Sep

    const advCount = await prisma.serviceCharge.count({
      where: { projectId, kind: 'prepaid_advance' },
    })
    expect(advCount).toBe(3) // Jul, Aug, Sep advances each = 150

    const reconJul = await prisma.serviceCharge.findFirst({
      where: {
        projectId,
        kind: 'prepaid_reconciliation',
        periodStart: new Date('2026-07-01T00:00:00Z'),
      },
    })
    expect(reconJul?.totalAmount?.toFixed(2)).toBe('90.00') // NOT 240 (phantom)
    const reconAug = await prisma.serviceCharge.findFirst({
      where: {
        projectId,
        kind: 'prepaid_reconciliation',
        periodStart: new Date('2026-08-01T00:00:00Z'),
      },
    })
    expect(reconAug?.totalAmount?.toFixed(2)).toBe('90.00') // NOT 240 (phantom)
  })

  it('generation is idempotent (re-run creates no duplicate prepaid charges)', async () => {
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z'))
    await prisma.project.update({
      where: { id: projectId },
      data: { nextCycleAt: new Date('2026-07-01T00:00:00Z') },
    }) // rewind anchor → replay same cycle
    await generate(new Date('2026-07-15T00:00:00Z'))
    expect(
      await prisma.serviceCharge.count({ where: { projectId, kind: 'prepaid_advance' } })
    ).toBe(1)
  })
})
