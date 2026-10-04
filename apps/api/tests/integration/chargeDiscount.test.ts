import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { applyChargeDiscount } from '../../src/services/chargeDiscount.js'

/**
 * One-time manual discount on a charge (S5.6 P-10, 05-З) against REAL Postgres. Proves
 * the recompute off the post-loyalty net, that moneyBalance refreshes with the new total,
 * the clamp to 0, the 409 on a charge with payments, and 404 cross-tenant. Gated on
 * RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('manual charge discount (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  // base 100 with a 5 loyalty discount → post-loyalty net = 95.
  function seedCharge(month: string) {
    return prisma.serviceCharge.create({
      data: {
        agencyId,
        companyId,
        amount: new Prisma.Decimal(95),
        baseAmount: new Prisma.Decimal(100),
        discountPct: new Prisma.Decimal(5),
        discountAmount: new Prisma.Decimal(5),
        totalAmount: new Prisma.Decimal(95),
        currency: 'USD',
        month: new Date(month),
        status: 'pending',
      },
      select: { id: true },
    })
  }
  function discount(
    chargeId: string,
    pct: number | null,
    amount: number | null,
    agency = agencyId
  ) {
    return tenantTransaction(prisma, (tx) =>
      applyChargeDiscount(tx, {
        agencyId: agency,
        chargeId,
        pct: pct != null ? new Prisma.Decimal(pct) : null,
        amount: amount != null ? new Prisma.Decimal(amount) : null,
      })
    )
  }
  function moneyBalance() {
    return prisma.company
      .findUniqueOrThrow({ where: { id: companyId }, select: { moneyBalance: true } })
      .then((c) => c.moneyBalance.toFixed(2))
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `cd-${tag}@test.local`, passwordHash: 'x', name: 'CD Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `cd-${tag}`, slug: `cd-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'CD Co', slug: `cd-${tag}` },
    })
  })

  afterEach(async () => {
    await prisma.paymentAllocation.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.company.update({ where: { id: companyId }, data: { moneyBalance: 0 } })
  })

  afterAll(async () => {
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  it('percent discount recomputes total off the post-loyalty net + refreshes moneyBalance', async () => {
    const c = await seedCharge('2026-06-01')
    const updated = await discount(c.id, 20, null) // 20% of 95 = 19 → total 76
    expect(updated.manualDiscountAmount?.toFixed(2)).toBe('19.00')
    expect(updated.totalAmount?.toFixed(2)).toBe('76.00')
    expect(await moneyBalance()).toBe('-76.00') // no payments → owes the discounted total
  })

  it('re-applying is stable (computed off net, not the prior discounted total)', async () => {
    const c = await seedCharge('2026-06-01')
    await discount(c.id, 50, null) // → 47.50
    const second = await discount(c.id, 10, null) // 10% of 95 (net), NOT of 47.50
    expect(second.totalAmount?.toFixed(2)).toBe('85.50') // 95 − 9.5
  })

  it('clearing (0 reduction) nulls the markers and restores the net total', async () => {
    const c = await seedCharge('2026-06-01')
    await discount(c.id, 20, null) // 76, markers set
    const cleared = await discount(c.id, 0, 0)
    expect(cleared.manualDiscountPct).toBeNull()
    expect(cleared.manualDiscountAmount).toBeNull()
    expect(cleared.totalAmount?.toFixed(2)).toBe('95.00') // back to post-loyalty net
  })

  it('flat amount clamps to the net (charge floors at 0)', async () => {
    const c = await seedCharge('2026-06-01')
    const updated = await discount(c.id, null, 500) // way over net 95
    expect(updated.manualDiscountAmount?.toFixed(2)).toBe('95.00')
    expect(updated.totalAmount?.toFixed(2)).toBe('0.00')
  })

  it('409 on a charge that already has payments allocated', async () => {
    const c = await seedCharge('2026-06-01')
    const payment = await prisma.payment.create({
      data: {
        agencyId,
        companyId,
        amount: new Prisma.Decimal(50),
        currency: 'USD',
        amountUsd: new Prisma.Decimal(50),
        rateUsed: new Prisma.Decimal(1),
        type: 'partial',
        status: 'confirmed',
        provider: 'manual',
        confirmedBy: creatorId,
        confirmedAt: new Date('2026-06-15T00:00:00Z'),
      },
    })
    await prisma.paymentAllocation.create({
      data: { agencyId, paymentId: payment.id, chargeId: c.id, amount: new Prisma.Decimal(50) },
    })
    await expect(discount(c.id, 10, null)).rejects.toThrow(/платеж/)
  })

  it('404 for a charge in another tenant', async () => {
    const c = await seedCharge('2026-06-01')
    await expect(discount(c.id, 10, null, randomUUID())).rejects.toThrow(/не знайдено/)
  })
})
