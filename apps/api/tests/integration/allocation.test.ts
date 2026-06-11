import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { allocatePayment } from '../../src/services/allocation.js'

/**
 * Money-account invariants against REAL Postgres (S5-07 — what a mock cannot prove):
 * `SELECT … FOR UPDATE` on the payment row serializes concurrent allocations so the
 * cumulative allocated never exceeds `payment.amount`; charge state is derived from
 * Σ(allocations); and `Company.moneyBalance == Σ(no-order confirmed payments).amountUsd
 * − Σ(charge.totalAmount)` after any interleaving. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('S5-07 money-account — allocation + moneyBalance (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const serviceId = randomUUID()
  const companyServiceId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  // ── seed helpers ────────────────────────────────────────────────────────────
  let chargeMonth = 0
  async function createCharge(opts: {
    total: number
    dueDate?: Date | null
    currency?: string
    status?: 'pending' | 'written_off'
  }) {
    chargeMonth += 1
    const month = new Date(Date.UTC(2026, chargeMonth, 1)) // distinct month → @@unique([companyServiceId, month])
    return prisma.serviceCharge.create({
      data: {
        agencyId,
        companyId,
        companyServiceId,
        amount: new Prisma.Decimal(opts.total),
        totalAmount: new Prisma.Decimal(opts.total),
        currency: opts.currency ?? 'USD',
        month,
        dueDate: opts.dueDate ?? null,
        status: opts.status ?? 'pending',
      },
      select: { id: true },
    })
  }

  async function createPayment(opts: {
    amount: number
    amountUsd?: number
    orderId?: string
    currency?: string
  }) {
    return prisma.payment.create({
      data: {
        agencyId,
        companyId,
        orderId: opts.orderId ?? null,
        amount: new Prisma.Decimal(opts.amount),
        currency: opts.currency ?? 'USD',
        amountUsd: new Prisma.Decimal(opts.amountUsd ?? opts.amount),
        rateUsed: new Prisma.Decimal(1),
        type: 'final',
        status: 'confirmed',
        provider: 'manual',
        confirmedBy: creatorId,
      },
      select: { id: true },
    })
  }

  function allocate(paymentId: string, allocations?: { chargeId: string; amount: number }[]) {
    return tenantTransaction(prisma, (tx) =>
      allocatePayment(tx, { agencyId, paymentId, allocations })
    )
  }

  async function moneyBalance(): Promise<string> {
    const c = await prisma.company.findUnique({
      where: { id: companyId },
      select: { moneyBalance: true },
    })
    return new Prisma.Decimal(c?.moneyBalance ?? 0).toFixed(2)
  }

  async function chargeStatus(id: string) {
    const c = await prisma.serviceCharge.findUnique({
      where: { id },
      select: { status: true, paidAt: true },
    })
    return c
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `al-${tag}@test.local`, passwordHash: 'x', name: 'AL Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `al-${tag}`, slug: `al-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'AL Co', slug: `al-${tag}` },
    })
    await prisma.service.create({ data: { id: serviceId, agencyId, name: 'AL Service' } })
    await prisma.companyService.create({
      data: { id: companyServiceId, companyId, serviceId, customPrice: new Prisma.Decimal(100) },
    })
  })

  afterAll(async () => {
    await prisma.paymentAllocation.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.companyService.deleteMany({ where: { companyId } })
    await prisma.service.deleteMany({ where: { id: serviceId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.paymentAllocation.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.company.update({ where: { id: companyId }, data: { moneyBalance: 0 } })
    chargeMonth = 0
  })

  it('full allocation → charge paid (paidAt set), moneyBalance = payments − charges', async () => {
    const charge = await createCharge({ total: 100 })
    const payment = await createPayment({ amount: 100 })

    const res = await allocate(payment.id, [{ chargeId: charge.id, amount: 100 }])

    expect(res.charges[0].state).toBe('paid')
    expect(res.charges[0].outstanding).toBe('0.00')
    expect(res.paymentRemaining).toBe('0.00')
    const c = await chargeStatus(charge.id)
    expect(c?.status).toBe('paid')
    expect(c?.paidAt).not.toBeNull()
    expect(await moneyBalance()).toBe('0.00') // 100 paid − 100 charged
  })

  it('partial allocation → charge partial, outstanding remains', async () => {
    const charge = await createCharge({ total: 100 })
    const payment = await createPayment({ amount: 40 })

    const res = await allocate(payment.id, [{ chargeId: charge.id, amount: 40 }])

    expect(res.charges[0].state).toBe('partial')
    expect(res.charges[0].outstanding).toBe('60.00')
    expect((await chargeStatus(charge.id))?.status).toBe('partial')
    expect(await moneyBalance()).toBe('-60.00') // 40 paid − 100 charged
  })

  it('over-allocation (Σ > payment amount) → 409', async () => {
    const charge = await createCharge({ total: 200 })
    const payment = await createPayment({ amount: 100 })

    await expect(
      allocate(payment.id, [{ chargeId: charge.id, amount: 150 }])
    ).rejects.toMatchObject({ statusCode: 409 })
    // nothing persisted on the failed allocation
    expect(await prisma.paymentAllocation.count({ where: { paymentId: payment.id } })).toBe(0)
  })

  it('overpayment → charge overpaid, moneyBalance > 0 (prepaid remainder)', async () => {
    const charge = await createCharge({ total: 100 })
    const payment = await createPayment({ amount: 150 })

    const res = await allocate(payment.id, [{ chargeId: charge.id, amount: 150 }])

    expect(res.charges[0].state).toBe('overpaid')
    expect(res.moneyBalance).toBe('50.00') // 150 paid − 100 charged
    expect((await chargeStatus(charge.id))?.status).toBe('paid') // nearest stored status
  })

  it('FIFO (no explicit list) allocates the remainder oldest-due-first', async () => {
    // Both due in the future so the partial remainder derives `partial`, not `overdue`.
    const older = await createCharge({
      total: 100,
      dueDate: new Date('2027-02-01T00:00:00.000Z'),
    })
    const newer = await createCharge({
      total: 100,
      dueDate: new Date('2027-05-01T00:00:00.000Z'),
    })
    const payment = await createPayment({ amount: 120 })

    const res = await allocate(payment.id) // FIFO

    // 100 to the older charge (fully paid), 20 to the newer (partial).
    expect((await chargeStatus(older.id))?.status).toBe('paid')
    expect((await chargeStatus(newer.id))?.status).toBe('partial')
    expect(res.paymentRemaining).toBe('0.00')
    expect(res.allocated).toBe('120.00')
  })

  it('re-allocating the same (payment, charge) pair → 409 (unique guard)', async () => {
    const charge = await createCharge({ total: 100 })
    const payment = await createPayment({ amount: 100 })

    await allocate(payment.id, [{ chargeId: charge.id, amount: 40 }])
    await expect(allocate(payment.id, [{ chargeId: charge.id, amount: 30 }])).rejects.toMatchObject(
      { statusCode: 409 }
    )
  })

  it('CONCURRENCY: parallel allocations of one payment never exceed its amount (FOR UPDATE)', async () => {
    const payment = await createPayment({ amount: 100 })
    // 10 distinct charges, each gets a 20 allocation → Σ would be 200 > 100.
    const charges = await Promise.all(
      Array.from({ length: 10 }, () => createCharge({ total: 100 }))
    )

    const results = await Promise.allSettled(
      charges.map((ch) => allocate(payment.id, [{ chargeId: ch.id, amount: 20 }]))
    )
    const ok = results.filter((r) => r.status === 'fulfilled')
    const conflicts = results.filter(
      (r) => r.status === 'rejected' && (r.reason as { statusCode?: number }).statusCode === 409
    )

    expect(ok).toHaveLength(5) // exactly 5 × 20 = 100 affordable
    expect(conflicts).toHaveLength(5)

    const agg = await prisma.paymentAllocation.aggregate({
      where: { paymentId: payment.id },
      _sum: { amount: true },
    })
    expect((agg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2)).toBe('100.00') // never overshoots
  })

  it('CONCURRENCY (audit fix): two payments FIFO-allocating the SAME charge never over-cover it', async () => {
    // Regression for the audit finding: without the company-row lock in allocatePayment,
    // two concurrent FIFO allocations of different payments both grabbed the charge's full
    // outstanding. The company lock now serializes them → Σ(allocations) ≤ charge total.
    const charge = await createCharge({ total: 100 })
    const p1 = await createPayment({ amount: 100 })
    const p2 = await createPayment({ amount: 100 })

    await Promise.allSettled([allocate(p1.id), allocate(p2.id)]) // FIFO (no explicit list)

    const agg = await prisma.paymentAllocation.aggregate({
      where: { chargeId: charge.id },
      _sum: { amount: true },
    })
    expect((agg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2)).toBe('100.00') // not 200
    expect((await chargeStatus(charge.id))?.status).toBe('paid')
  })

  it('order-payments are EXCLUDED from moneyBalance (two-track split)', async () => {
    const order = await prisma.order.create({
      data: { agencyId, companyId, title: 'AL Order', createdById: creatorId },
      select: { id: true },
    })
    await createPayment({ amount: 500, orderId: order.id }) // settles the order, NOT the money-account
    const charge = await createCharge({ total: 100 })
    const advance = await createPayment({ amount: 100 }) // no order → funds the money-account

    await allocate(advance.id, [{ chargeId: charge.id, amount: 100 }])

    // moneyBalance = 100 (no-order payment) − 100 (charge) = 0; the 500 order payment is not counted.
    expect(await moneyBalance()).toBe('0.00')
  })

  it('moneyBalance == Σ(no-order payments).amountUsd − Σ(charge.totalAmount) after mixed ops', async () => {
    await createCharge({ total: 100 })
    const c2 = await createCharge({ total: 250 })
    await createPayment({ amount: 80 }) // no-order, unallocated advance
    const p2 = await createPayment({ amount: 200 })

    await allocate(p2.id, [{ chargeId: c2.id, amount: 200 }]) // triggers a full recompute

    // Σ payments (80 + 200) − Σ charges (100 + 250) = 280 − 350 = −70.
    const [payAgg, chargeAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { agencyId, companyId, status: 'confirmed', orderId: null },
        _sum: { amountUsd: true },
      }),
      prisma.serviceCharge.aggregate({
        where: { agencyId, companyId },
        _sum: { totalAmount: true },
      }),
    ])
    const expected = (payAgg._sum.amountUsd ?? new Prisma.Decimal(0))
      .minus(chargeAgg._sum.totalAmount ?? new Prisma.Decimal(0))
      .toFixed(2)
    expect(expected).toBe('-70.00')
    expect(await moneyBalance()).toBe(expected)
  })

  // ── AR-10 (audit 2026-06-11): currency guard — native amounts never net cross-currency ──

  it('AR-10: explicit allocation rejects a currency mismatch (UAH payment vs USD charge) → 409', async () => {
    const charge = await createCharge({ total: 100 }) // USD
    const payment = await createPayment({ amount: 4150, amountUsd: 100, currency: 'UAH' })

    await expect(allocate(payment.id, [{ chargeId: charge.id, amount: 100 }])).rejects.toThrow(
      /Валюта платежу/
    )
    // Nothing settled, no allocation row.
    expect(await prisma.paymentAllocation.count({ where: { paymentId: payment.id } })).toBe(0)
  })

  it('AR-10: FIFO only targets same-currency charges', async () => {
    const uahCharge = await createCharge({
      total: 4150,
      currency: 'UAH',
      dueDate: new Date('2026-01-01'),
    })
    const usdCharge = await createCharge({ total: 100, dueDate: new Date('2026-02-01') })
    const payment = await createPayment({ amount: 100 }) // USD

    const res = await allocate(payment.id) // FIFO — would hit the UAH charge first if unfiltered

    expect(res.charges).toHaveLength(1)
    expect(res.charges[0]?.chargeId).toBe(usdCharge.id)
    expect((await chargeStatus(usdCharge.id))?.status).toBe('paid')
    expect((await chargeStatus(uahCharge.id))?.status).toBe('pending')
  })

  // ── AR-12: written_off charges are forgiven debt, not owed ──

  it('AR-12: written_off charge is excluded from moneyBalance', async () => {
    await createCharge({ total: 100, status: 'written_off' })
    const live = await createCharge({ total: 40 })
    const payment = await createPayment({ amount: 50 })

    await allocate(payment.id, [{ chargeId: live.id, amount: 40 }])

    // 50 (payment) − 40 (live charge) = 10; the written-off 100 is NOT debt.
    expect(await moneyBalance()).toBe('10.00')
  })

  // ── AR-11: moneyBalance refreshes on its OTHER writers (confirm / charge generation) ──

  it('AR-11: confirming a no-order payment refreshes moneyBalance without an allocation step', async () => {
    const { confirmManualPayment } = await import('../../src/services/payments.js')
    await createCharge({ total: 30 })

    await tenantTransaction(prisma, (tx) =>
      confirmManualPayment(tx, {
        agencyId,
        companyId,
        amount: 130,
        currency: 'USD',
        type: 'final',
        confirmedBy: creatorId,
        idempotencyKey: `ar11-${randomUUID()}`,
      })
    )

    // 130 (confirmed no-order payment) − 30 (charge) = 100 — visible immediately,
    // previously stale until the first allocatePayment call.
    expect(await moneyBalance()).toBe('100.00')
  })

  it('AR-11: recurring charge generation refreshes moneyBalance for the affected company', async () => {
    const { generateRecurringCharges } = await import('../../src/services/recurringCharges.js')
    await prisma.service.update({ where: { id: serviceId }, data: { isRecurring: true } })
    await prisma.companyService.update({
      where: { id: companyServiceId },
      data: { active: true, frequency: 'monthly', nextChargeAt: new Date('2026-06-01T00:00:00Z') },
    })

    const res = await tenantTransaction(prisma, (tx) =>
      generateRecurringCharges(tx, { now: new Date('2026-06-15T00:00:00Z'), agencyId })
    )

    expect(res.created).toBeGreaterThan(0)
    // No payments yet → balance = −Σ(generated charge totals), already refreshed.
    const agg = await prisma.serviceCharge.aggregate({
      where: { agencyId, companyId },
      _sum: { totalAmount: true },
    })
    const expected = new Prisma.Decimal(0)
      .minus(agg._sum.totalAmount ?? new Prisma.Decimal(0))
      .toFixed(2)
    expect(await moneyBalance()).toBe(expected)

    // Reset the subscription so other tests are unaffected.
    await prisma.companyService.update({
      where: { id: companyServiceId },
      data: { nextChargeAt: null },
    })
    await prisma.service.update({ where: { id: serviceId }, data: { isRecurring: false } })
  })
})
