import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { WalletTxnSource } from '@workflo/types'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { allocatePayment } from '../../src/services/allocation.js'
import { spendBonusOnCharge } from '../../src/services/bonusSpend.js'
import { confirmManualPayment } from '../../src/services/payments.js'
import { walletCredit } from '../../src/services/wallet.js'

/**
 * Bonus-spend money-correctness against REAL Postgres (S5-08). The guarantee a mock
 * can't prove: applying bonus to a charge settles it via the SAME allocation
 * machinery WITHOUT inflating revenue (the bonus payment is amountUsd=0), and the
 * money-account reflects the bonus credit. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('S5-08 bonus-spend (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const serviceId = randomUUID()
  const companyServiceId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function credit(amount: number) {
    return tenantTransaction(prisma, (tx) =>
      walletCredit(tx, {
        agencyId,
        companyId,
        source: WalletTxnSource.MANUAL_ADJUSTMENT,
        amount,
        note: 'seed',
        createdById: creatorId,
      })
    )
  }
  function spend(chargeId: string, requestedAmount?: number) {
    return tenantTransaction(prisma, (tx) =>
      spendBonusOnCharge(tx, {
        agencyId,
        companyId,
        chargeId,
        requestedAmount,
        confirmedBy: creatorId,
      })
    )
  }
  async function seedCharge(total: number): Promise<string> {
    const c = await prisma.serviceCharge.create({
      data: {
        agencyId,
        companyId,
        companyServiceId,
        amount: total,
        totalAmount: total,
        baseAmount: total,
        currency: 'USD',
        month: new Date('2026-06-01T00:00:00Z'),
        status: 'pending',
      },
      select: { id: true },
    })
    return c.id
  }
  async function revenueUsd(): Promise<string> {
    const agg = await prisma.payment.aggregate({
      where: { agencyId, status: 'confirmed' },
      _sum: { amountUsd: true },
    })
    return (agg._sum.amountUsd ?? new Prisma.Decimal(0)).toFixed(2)
  }
  async function company() {
    const c = await prisma.company.findUnique({
      where: { id: companyId },
      select: { bonusBalance: true, moneyBalance: true },
    })
    return { bonus: c?.bonusBalance.toFixed(2), money: c?.moneyBalance.toFixed(2) }
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `bs-${tag}@test.local`, passwordHash: 'x', name: 'BS Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `bs-${tag}`, slug: `bs-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'BS Co', slug: `bs-${tag}` },
    })
    await prisma.service.create({
      data: { id: serviceId, agencyId, name: 'Svc', isActive: true, isRecurring: true },
    })
    await prisma.companyService.create({
      data: { id: companyServiceId, companyId, serviceId, customPrice: 100, active: true },
    })
  })

  afterAll(async () => {
    await prisma.paymentAllocation.deleteMany({ where: { agencyId } })
    await prisma.walletTransaction.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.companyService.deleteMany({ where: { id: companyServiceId } })
    await prisma.service.deleteMany({ where: { id: serviceId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.paymentAllocation.deleteMany({ where: { agencyId } })
    await prisma.walletTransaction.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.company.update({
      where: { id: companyId },
      data: { bonusBalance: 0, moneyBalance: 0 },
    })
  })

  it('partial bonus-spend covers part of a charge, draining the bonus; revenue stays 0', async () => {
    await credit(30)
    const chargeId = await seedCharge(100)

    const res = await spend(chargeId)
    expect(res.spent).toBe('30.00')
    expect(res.bonusBalance).toBe('0.00')
    expect(res.charge).toMatchObject({ outstanding: '70.00', state: 'partial' })

    const ch = await prisma.serviceCharge.findUnique({ where: { id: chargeId } })
    expect(ch?.status).toBe('partial')
    // The bonus-backed payment carries amountUsd=0 → never counts as revenue.
    expect(await revenueUsd()).toBe('0.00')
    // moneyBalance = 0 money − 100 charge + 30 bonus-applied = -70.
    expect((await company()).money).toBe('-70.00')
    expect((await company()).bonus).toBe('0.00')
  })

  it('respects an explicit amount cap', async () => {
    await credit(50)
    const chargeId = await seedCharge(100)
    const res = await spend(chargeId, 20)
    expect(res.spent).toBe('20.00')
    expect(res.bonusBalance).toBe('30.00')
    expect(res.charge.outstanding).toBe('80.00')
  })

  it('caps spend at the bonus balance (cannot overdraw)', async () => {
    await credit(40)
    const chargeId = await seedCharge(100)
    const res = await spend(chargeId) // wants 100 outstanding, only 40 bonus
    expect(res.spent).toBe('40.00')
    expect(res.bonusBalance).toBe('0.00')
    expect(res.charge.outstanding).toBe('60.00')
  })

  it('409 when the charge is already fully covered', async () => {
    await credit(200)
    const chargeId = await seedCharge(100)
    await spend(chargeId) // covers 100
    await expect(spend(chargeId)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('bonus + money together settle a charge; moneyBalance nets to 0, revenue = money only', async () => {
    await credit(30)
    const chargeId = await seedCharge(100)
    await spend(chargeId) // 30 bonus → outstanding 70

    // A 70 money payment (no order), allocated to the same charge.
    const pay = await tenantTransaction(prisma, (tx) =>
      confirmManualPayment(tx, {
        agencyId,
        companyId,
        amount: 70,
        currency: 'USD',
        type: 'final',
        confirmedBy: creatorId,
        idempotencyKey: randomUUID(),
      })
    )
    const alloc = await tenantTransaction(prisma, (tx) =>
      allocatePayment(tx, {
        agencyId,
        paymentId: pay.payment.id,
        allocations: [{ chargeId, amount: 70 }],
      })
    )
    expect(alloc.charges[0]?.state).toBe('paid')

    const ch = await prisma.serviceCharge.findUnique({ where: { id: chargeId } })
    expect(ch?.status).toBe('paid')
    expect(ch?.paidAt).not.toBeNull()
    // revenue = the 70 money payment only (bonus payment is amountUsd 0).
    expect(await revenueUsd()).toBe('70.00')
    // moneyBalance = 70 money − 100 charge + 30 bonus-applied = 0.
    expect((await company()).money).toBe('0.00')
  })
})
