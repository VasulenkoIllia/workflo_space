import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  computeClientMargin,
  computeClientNetIncomeUsd,
  computeProjectMargin,
} from '../../src/services/margin.js'

/**
 * Margin engine v1 (S5.6 P-9, §4.1) against REAL Postgres. Proves revenue (Σ charge
 * totalAmount) − cost (Σ hours × costRateUsd) = margin, the per-executor cost split,
 * the «оплачено N%» cash overlay, null cost-rate → 0 cost, client roll-up, and the
 * USD normalization of a non-USD project. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('margin engine (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const execA = randomUUID()
  const execB = randomUUID()
  const projectId = randomUUID()
  const project2Id = randomUUID()
  const orderId = randomUUID()
  const order2Id = randomUUID()
  const tag = randomUUID().slice(0, 8)

  const win = { from: new Date('2026-06-01T00:00:00Z'), to: new Date('2026-06-30T23:59:59Z') }

  function logHours(opts: {
    order?: string
    executorId?: string
    hours: number
    costRateUsd: number | null
    date?: string
  }) {
    return prisma.timeLog.create({
      data: {
        agencyId,
        orderId: opts.order ?? orderId,
        executorId: opts.executorId ?? execA,
        hours: new Prisma.Decimal(opts.hours),
        date: new Date(opts.date ?? '2026-06-10'),
        costRateUsd: opts.costRateUsd === null ? null : new Prisma.Decimal(opts.costRateUsd),
      },
    })
  }

  function seedCharge(opts: {
    project?: string
    totalAmount: number
    currency?: string
    month?: string
    kind?: string
  }) {
    return prisma.serviceCharge.create({
      data: {
        agencyId,
        companyId,
        projectId: opts.project ?? projectId,
        amount: new Prisma.Decimal(opts.totalAmount),
        totalAmount: new Prisma.Decimal(opts.totalAmount),
        currency: opts.currency ?? 'USD',
        month: new Date(opts.month ?? '2026-06-01'),
        periodStart: new Date(opts.month ?? '2026-06-01'),
        kind: opts.kind ?? 'subscription',
        status: 'pending',
      },
    })
  }

  async function allocate(chargeId: string, amount: number) {
    const payment = await prisma.payment.create({
      data: {
        agencyId,
        companyId,
        amount: new Prisma.Decimal(amount),
        currency: 'USD',
        amountUsd: new Prisma.Decimal(amount),
        rateUsed: new Prisma.Decimal(1),
        type: 'partial',
        status: 'confirmed',
        provider: 'manual',
        confirmedBy: execA,
        confirmedAt: new Date('2026-06-15T00:00:00Z'),
      },
    })
    await prisma.paymentAllocation.create({
      data: { agencyId, paymentId: payment.id, chargeId, amount: new Prisma.Decimal(amount) },
    })
  }

  function projectMargin(pid = projectId) {
    return tenantTransaction(prisma, (tx) =>
      computeProjectMargin(tx, { agencyId, projectId: pid, from: win.from, to: win.to })
    )
  }
  async function clientMargin() {
    const c = await tenantTransaction(prisma, (tx) =>
      computeClientMargin(tx, { agencyId, companyId, from: win.from, to: win.to })
    )
    if (!c) throw new Error('expected non-null client margin')
    return c
  }

  beforeAll(async () => {
    await prisma.profile.createMany({
      data: [
        { id: execA, email: `mg-a-${tag}@test.local`, passwordHash: 'x', name: 'Exec A' },
        { id: execB, email: `mg-b-${tag}@test.local`, passwordHash: 'x', name: 'Exec B' },
      ],
    })
    await prisma.agency.create({ data: { id: agencyId, name: `mg-${tag}`, slug: `mg-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'MG Co', slug: `mg-${tag}`, loyaltyTier: 'new' },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'MG Project',
        billingModel: 'hourly_postpaid',
        currency: 'USD',
        clientHourlyRate: new Prisma.Decimal(30),
      },
    })
    await prisma.project.create({
      data: {
        id: project2Id,
        agencyId,
        companyId,
        name: 'MG Project 2',
        billingModel: 'fixed_monthly_advance',
        currency: 'USD',
        abonAmount: new Prisma.Decimal(100),
      },
    })
    await prisma.order.create({
      data: { id: orderId, agencyId, projectId, title: 'MG order', createdById: execA },
    })
    await prisma.order.create({
      data: {
        id: order2Id,
        agencyId,
        projectId: project2Id,
        title: 'MG order 2',
        createdById: execA,
      },
    })
  })

  afterEach(async () => {
    await prisma.paymentAllocation.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.timeLog.deleteMany({ where: { agencyId } })
    await prisma.exchangeRate.deleteMany({ where: { agencyId } })
  })

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: { in: [execA, execB] } } })
    await prisma.$disconnect()
  })

  it('hourly: revenue $30 − cost $10 = margin $20 (owner example)', async () => {
    await seedCharge({ totalAmount: 30 })
    await logHours({ hours: 1, costRateUsd: 10 })
    const m = await projectMargin()
    expect(m?.revenueUsd).toBe('30.00')
    expect(m?.costUsd).toBe('10.00')
    expect(m?.marginUsd).toBe('20.00')
    expect(m?.marginPct).toBe('66.67')
  })

  it('subscription: $100 abon − 6h × $12 zero-billed cost = $28 margin', async () => {
    await seedCharge({ project: project2Id, totalAmount: 100 })
    await logHours({ order: order2Id, hours: 6, costRateUsd: 12 })
    const m = await projectMargin(project2Id)
    expect(m?.revenueUsd).toBe('100.00')
    expect(m?.costUsd).toBe('72.00')
    expect(m?.marginUsd).toBe('28.00')
  })

  it('per-executor breakdown splits cost by executorId', async () => {
    await seedCharge({ totalAmount: 100 })
    await logHours({ executorId: execA, hours: 2, costRateUsd: 10 }) // $20
    await logHours({ executorId: execB, hours: 3, costRateUsd: 15 }) // $45
    const m = await projectMargin()
    expect(m?.costUsd).toBe('65.00')
    expect(m?.byExecutor).toHaveLength(2)
    const a = m?.byExecutor.find((e) => e.executorId === execA)
    const b = m?.byExecutor.find((e) => e.executorId === execB)
    expect(a?.costUsd).toBe('20.00')
    expect(b?.costUsd).toBe('45.00')
  })

  it('«оплачено N%»: accrual revenue stays, paid overlays collected cash', async () => {
    const charge = await seedCharge({ totalAmount: 100 })
    await logHours({ hours: 1, costRateUsd: 10 })
    await allocate(charge.id, 40)
    const m = await projectMargin()
    expect(m?.revenueUsd).toBe('100.00') // accrual unchanged
    expect(m?.paidUsd).toBe('40.00')
    expect(m?.paidPct).toBe('40.00')
  })

  it('null costRateUsd (no resolved rate, cascade tier 5) → 0 cost', async () => {
    await seedCharge({ totalAmount: 50 })
    await logHours({ hours: 4, costRateUsd: null })
    const m = await projectMargin()
    expect(m?.costUsd).toBe('0.00')
    expect(m?.marginUsd).toBe('50.00')
  })

  it('client roll-up sums every project; net income = Σ margin', async () => {
    await seedCharge({ totalAmount: 30 }) // project 1
    await logHours({ hours: 1, costRateUsd: 10 }) // cost 10 → margin 20
    await seedCharge({ project: project2Id, totalAmount: 100 }) // project 2
    await logHours({ order: order2Id, hours: 6, costRateUsd: 12 }) // cost 72 → margin 28
    const c = await clientMargin()
    expect(c.revenueUsd).toBe('130.00')
    expect(c.costUsd).toBe('82.00')
    expect(c.marginUsd).toBe('48.00') // 20 + 28
    expect(c.projects).toHaveLength(2)
    const net = await tenantTransaction(prisma, (tx) =>
      computeClientNetIncomeUsd(tx, { agencyId, companyId, from: win.from, to: win.to })
    )
    expect(net.toFixed(2)).toBe('48.00')
  })

  it('an unknown / cross-tenant companyId returns null (route → 404, no zero-margin oracle)', async () => {
    const got = await tenantTransaction(prisma, (tx) =>
      computeClientMargin(tx, { agencyId, companyId: randomUUID(), from: win.from, to: win.to })
    )
    expect(got).toBeNull()
  })

  it('non-USD project revenue is normalized to USD via the stored FX', async () => {
    await prisma.exchangeRate.create({ data: { agencyId, usdToUah: new Prisma.Decimal(40) } })
    await seedCharge({ totalAmount: 1200, currency: 'UAH' }) // 1200 UAH / 40 = $30
    await logHours({ hours: 1, costRateUsd: 10 }) // cost already USD
    // project currency is USD in seed; override to UAH for this case
    await prisma.project.update({ where: { id: projectId }, data: { currency: 'UAH' } })
    const m = await projectMargin()
    expect(m?.revenueUsd).toBe('30.00')
    expect(m?.costUsd).toBe('10.00')
    expect(m?.marginUsd).toBe('20.00')
    await prisma.project.update({ where: { id: projectId }, data: { currency: 'USD' } })
  })
})
