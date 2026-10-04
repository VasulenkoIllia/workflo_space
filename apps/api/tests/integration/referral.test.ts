import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { confirmManualPayment } from '../../src/services/payments.js'
import { processReferralBonus } from '../../src/services/referral.js'

/**
 * Referral accrual against REAL Postgres (S5-06). Proves the money-correctness a
 * mock can't: a confirmed payment by a referred company credits the referrer's
 * bonus wallet exactly ONCE (ReferralBonus @@unique([sourceType, sourceId])),
 * the accrued percent is immutable across later tier edits, and confirmManualPayment
 * wires it end-to-end. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('S5-06 referral accrual (real PG)', () => {
  const agencyId = randomUUID()
  const referrerId = randomUUID() // company A (the referrer)
  const referredId = randomUUID() // company B (referred by A)
  const loneId = randomUUID() // company C (no referrer)
  const creatorId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function accrue(paymentId: string, companyId: string, amountUsd: number) {
    return tenantTransaction(prisma, (tx) =>
      processReferralBonus(tx, { id: paymentId, agencyId, companyId, amountUsd })
    )
  }

  async function bonusBalance(companyId: string): Promise<string> {
    const c = await prisma.company.findUnique({
      where: { id: companyId },
      select: { bonusBalance: true },
    })
    return c?.bonusBalance.toFixed(2) ?? 'n/a'
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `rf-${tag}@test.local`, passwordHash: 'x', name: 'RF Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `rf-${tag}`, slug: `rf-${tag}` } })
    await prisma.company.create({
      data: { id: referrerId, agencyId, name: 'Referrer A', slug: `rf-a-${tag}` },
    })
    await prisma.company.create({
      data: {
        id: referredId,
        agencyId,
        name: 'Referred B',
        slug: `rf-b-${tag}`,
        referredById: referrerId,
      },
    })
    await prisma.company.create({
      data: { id: loneId, agencyId, name: 'Lone C', slug: `rf-c-${tag}` },
    })
  })

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({ where: { agencyId } })
    await prisma.referralBonus.deleteMany({ where: { referral: { referrerId } } })
    await prisma.referral.deleteMany({ where: { referrerId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.referralSettings.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { agencyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.walletTransaction.deleteMany({ where: { agencyId } })
    await prisma.referralBonus.deleteMany({ where: { referral: { referrerId } } })
    await prisma.referral.deleteMany({ where: { referrerId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.referralSettings.deleteMany({ where: { agencyId } })
    await prisma.company.update({ where: { id: referrerId }, data: { bonusBalance: 0 } })
  })

  it('credits the referrer the default 5% and bumps totalEarned', async () => {
    const payId = randomUUID()
    const accrual = await accrue(payId, referredId, 100)
    expect(accrual).toMatchObject({ referrerId, percent: 5, amount: '5.00' })

    expect(await bonusBalance(referrerId)).toBe('5.00')
    const bonus = await prisma.referralBonus.findUnique({
      where: { sourceType_sourceId: { sourceType: 'payment', sourceId: payId } },
    })
    expect(bonus?.percent.toFixed(2)).toBe('5.00')
    const wt = await prisma.walletTransaction.findFirst({ where: { companyId: referrerId } })
    expect(wt?.source).toBe('referral_bonus')
    expect(wt?.amount.toFixed(2)).toBe('5.00')
    const referral = await prisma.referral.findUnique({
      where: { referrerId_referredId: { referrerId, referredId } },
    })
    expect(referral?.totalEarned.toFixed(2)).toBe('5.00')
  })

  it('is idempotent: re-processing the same payment accrues exactly once', async () => {
    const payId = randomUUID()
    const first = await accrue(payId, referredId, 100)
    const second = await accrue(payId, referredId, 100)
    expect(first).not.toBeNull()
    expect(second).toBeNull() // already accrued

    const count = await prisma.referralBonus.count({
      where: { sourceType: 'payment', sourceId: payId },
    })
    expect(count).toBe(1)
    expect(await bonusBalance(referrerId)).toBe('5.00')
  })

  it('no referrer → no accrual', async () => {
    const accrual = await accrue(randomUUID(), loneId, 100)
    expect(accrual).toBeNull()
    expect(await bonusBalance(referrerId)).toBe('0.00')
  })

  it('disabled program → no accrual', async () => {
    await prisma.referralSettings.create({ data: { agencyId, enabled: false, tiers: [] } })
    const accrual = await accrue(randomUUID(), referredId, 100)
    expect(accrual).toBeNull()
    expect(await bonusBalance(referrerId)).toBe('0.00')
  })

  it('a later tier change does NOT rewrite an already-accrued bonus percent', async () => {
    const payId1 = randomUUID()
    await accrue(payId1, referredId, 100) // default 5%

    // Raise the rate for everyone going forward.
    await prisma.referralSettings.create({
      data: { agencyId, enabled: true, tiers: [{ minPaidUsd: 0, percent: 9 }] },
    })
    const payId2 = randomUUID()
    const second = await accrue(payId2, referredId, 100)
    expect(second?.percent).toBe(9)

    const old = await prisma.referralBonus.findUnique({
      where: { sourceType_sourceId: { sourceType: 'payment', sourceId: payId1 } },
    })
    expect(old?.percent.toFixed(2)).toBe('5.00') // historical percent unchanged
  })

  it('confirmManualPayment wires the accrual end-to-end', async () => {
    const result = await tenantTransaction(prisma, (tx) =>
      confirmManualPayment(tx, {
        agencyId,
        companyId: referredId,
        amount: 200,
        currency: 'USD',
        type: 'final',
        confirmedBy: creatorId,
        idempotencyKey: randomUUID(),
      })
    )
    expect(result.payment.amountUsd).toBe('200.00')
    // 5% of 200 → 10.00 credited to the referrer.
    expect(await bonusBalance(referrerId)).toBe('10.00')
  })
})
