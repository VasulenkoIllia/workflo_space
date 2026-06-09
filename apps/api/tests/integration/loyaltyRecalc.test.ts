import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { recalcLoyaltyTiers } from '../../src/services/loyaltyRecalc.js'

/**
 * Loyalty tier-recalc against REAL Postgres (S5-09). Proves the rules a mock can't:
 * tier upgrades at the constant thresholds from real Payment.amountUsd, never
 * auto-downgrades, refunds + bonus (amountUsd=0) payments are excluded from lifetime,
 * a tierOverride is never clobbered, and each upgrade appends history. Gated on
 * RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('S5-09 loyalty recalc (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  async function pay(amountUsd: number, status: 'confirmed' | 'refunded' = 'confirmed') {
    await prisma.payment.create({
      data: {
        agencyId,
        companyId,
        amount: amountUsd,
        currency: 'USD',
        amountUsd,
        rateUsed: 1,
        type: 'final',
        status,
        provider: 'manual',
        confirmedBy: creatorId,
      },
    })
  }
  function recalc() {
    return tenantTransaction(prisma, (tx) => recalcLoyaltyTiers(tx, { agencyId }))
  }
  async function company() {
    const c = await prisma.company.findUnique({
      where: { id: companyId },
      select: { loyaltyTier: true, totalSpent: true, tierOverride: true },
    })
    return c
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `ly-${tag}@test.local`, passwordHash: 'x', name: 'LY Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `ly-${tag}`, slug: `ly-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'LY Co', slug: `ly-${tag}` },
    })
  })

  afterAll(async () => {
    await prisma.loyaltyTierHistory.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.loyaltyTierHistory.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.company.update({
      where: { id: companyId },
      data: { loyaltyTier: 'new', tierOverride: null, totalSpent: 0 },
    })
  })

  it('upgrades at the threshold, writes history + totalSpent', async () => {
    await pay(1500)
    const res = await recalc()
    expect(res.upgraded).toBe(1)
    const c = await company()
    expect(c?.loyaltyTier).toBe('regular')
    expect(c?.totalSpent.toFixed(2)).toBe('1500.00')
    const history = await prisma.loyaltyTierHistory.findMany({ where: { companyId } })
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ fromTier: 'new', toTier: 'regular' })
  })

  it('threshold boundary: 999.99 stays NEW, 1000.00 becomes REGULAR', async () => {
    await pay(999.99)
    await recalc()
    expect((await company())?.loyaltyTier).toBe('new')

    await pay(0.01) // → 1000.00 total
    await recalc()
    expect((await company())?.loyaltyTier).toBe('regular')
  })

  it('is idempotent + never downgrades after a refund', async () => {
    await pay(5000) // → partner
    await recalc()
    expect((await company())?.loyaltyTier).toBe('partner')

    // A refund drops lifetime, but tier never auto-downgrades.
    await pay(4000, 'refunded')
    const res = await recalc()
    expect(res.upgraded).toBe(0) // no change
    expect((await company())?.loyaltyTier).toBe('partner')
    // refunds excluded from lifetime: totalSpent = 5000 (confirmed only)
    expect((await company())?.totalSpent.toFixed(2)).toBe('5000.00')
    // re-run writes no new history
    expect(await prisma.loyaltyTierHistory.count({ where: { companyId } })).toBe(1)
  })

  it('excludes refunded + bonus (amountUsd=0) payments from lifetime', async () => {
    await pay(900)
    await pay(2000, 'refunded') // excluded
    // a bonus-style payment (amountUsd 0) — must not count toward lifetime
    await prisma.payment.create({
      data: {
        agencyId,
        companyId,
        amount: 5000,
        currency: 'USD',
        amountUsd: 0,
        rateUsed: 1,
        type: 'partial',
        status: 'confirmed',
        provider: 'bonus',
        confirmedBy: creatorId,
      },
    })
    await recalc()
    // lifetime = 900 only → still NEW
    expect((await company())?.loyaltyTier).toBe('new')
    expect((await company())?.totalSpent.toFixed(2)).toBe('900.00')
  })

  it('respects a tierOverride: never auto-moves a pinned tier', async () => {
    await prisma.company.update({ where: { id: companyId }, data: { tierOverride: 'partner' } })
    await pay(20000) // would earn VIP
    const res = await recalc()
    expect(res.upgraded).toBe(0)
    const c = await company()
    expect(c?.loyaltyTier).toBe('new') // earned tier untouched
    expect(c?.tierOverride).toBe('partner') // pin preserved
    expect(c?.totalSpent.toFixed(2)).toBe('20000.00') // totalSpent still refreshed
  })
})
