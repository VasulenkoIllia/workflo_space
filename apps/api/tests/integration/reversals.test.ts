import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { allocatePayment } from '../../src/services/allocation.js'
import { confirmManualPayment } from '../../src/services/payments.js'
import { createCreditNote, refundPayment, writeOffCharge } from '../../src/services/reversals.js'

/**
 * 05-В reversals against REAL Postgres (mocks are blind to the FOR UPDATE locks, the
 * refund JOIN in recomputeMoneyBalance, and the NULL-distinct credit-note unique):
 * a partial refund lowers the money-account; a full refund flips status→refunded and
 * zeroes its contribution; a write-off forgives debt; a credit-note reduces owed; and
 * a refund claws back the proportional company-referral bonus from the referrer wallet.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('05-В reversals (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const referrerId = randomUUID()
  const creatorId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  const balance = async (id: string) =>
    (
      await prisma.company.findUniqueOrThrow({ where: { id }, select: { moneyBalance: true } })
    ).moneyBalance.toFixed(2)
  const bonus = async (id: string) =>
    (
      await prisma.company.findUniqueOrThrow({ where: { id }, select: { bonusBalance: true } })
    ).bonusBalance.toFixed(2)

  async function pay(amount: number, opts: { orderId?: string } = {}) {
    return tenantTransaction(prisma, (tx) =>
      confirmManualPayment(tx, {
        agencyId,
        companyId,
        orderId: opts.orderId ?? null,
        amount,
        currency: 'USD',
        type: 'final',
        confirmedBy: creatorId,
        idempotencyKey: randomUUID(),
      }).then((r) => r.payment)
    )
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `rv-${tag}@test.local`, passwordHash: 'x', name: 'RV Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `rv-${tag}`, slug: `rv-${tag}` } })
    await prisma.company.create({
      data: { id: referrerId, agencyId, name: 'Referrer', slug: `rv-ref-${tag}` },
    })
    await prisma.company.create({
      data: {
        id: companyId,
        agencyId,
        name: 'RV Co',
        slug: `rv-co-${tag}`,
        referredById: referrerId,
      },
    })
  })

  afterAll(async () => {
    await prisma.paymentAllocation.deleteMany({ where: { agencyId } })
    await prisma.paymentRefund.deleteMany({ where: { agencyId } })
    await prisma.walletTransaction.deleteMany({ where: { agencyId } })
    await prisma.referralBonus.deleteMany({ where: { referral: { referrerId } } })
    await prisma.referral.deleteMany({ where: { referrerId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.referralSettings.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { agencyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.paymentAllocation.deleteMany({ where: { agencyId } })
    await prisma.paymentRefund.deleteMany({ where: { agencyId } })
    await prisma.walletTransaction.deleteMany({ where: { agencyId } })
    await prisma.referralBonus.deleteMany({ where: { referral: { referrerId } } })
    await prisma.referral.deleteMany({ where: { referrerId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.referralSettings.deleteMany({ where: { agencyId } })
    await prisma.company.update({
      where: { id: companyId },
      data: { moneyBalance: 0, bonusBalance: 0 },
    })
    await prisma.company.update({ where: { id: referrerId }, data: { bonusBalance: 0 } })
  })

  it('partial refund lowers money-account; full refund flips status; over-refund 400', async () => {
    const p = await pay(100)
    expect(await balance(companyId)).toBe('100.00') // prepaid credit

    await tenantTransaction(prisma, (tx) =>
      refundPayment(tx, { agencyId, paymentId: p.id, amount: 30, actorId: creatorId })
    )
    expect(await balance(companyId)).toBe('70.00')
    const afterPartial = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
    expect(afterPartial.status).toBe('confirmed') // still partly live

    // over-refund of the remaining 70 → 400
    await expect(
      tenantTransaction(prisma, (tx) =>
        refundPayment(tx, { agencyId, paymentId: p.id, amount: 90, actorId: creatorId })
      )
    ).rejects.toThrow(/залишок/)

    // refund the rest → fully refunded, status flips, balance back to 0
    await tenantTransaction(prisma, (tx) =>
      refundPayment(tx, { agencyId, paymentId: p.id, amount: 70, actorId: creatorId })
    )
    expect(await balance(companyId)).toBe('0.00')
    const full = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
    expect(full.status).toBe('refunded')
  })

  // LOW-5 (закрито 10.07): refund платежу, розподіленого на нарахування, відкочує алокації
  // LIFO і воскрешає борг charge (paid → partial → pending) — дунінг знову його бачить.
  it('LOW-5: refund відкочує алокації і воскрешає борг нарахування', async () => {
    await prisma.serviceCharge.create({
      data: {
        agencyId,
        companyId,
        kind: 'subscription',
        amount: 100,
        totalAmount: 100,
        currency: 'USD',
        month: new Date('2026-07-01'),
        status: 'pending',
      },
    })
    const charge = await prisma.serviceCharge.findFirstOrThrow({ where: { companyId } })
    const p = await pay(100)
    await tenantTransaction(prisma, (tx) =>
      allocatePayment(tx, {
        agencyId,
        paymentId: p.id,
        allocations: [{ chargeId: charge.id, amount: 100 }],
      })
    )
    const paid = await prisma.serviceCharge.findUniqueOrThrow({ where: { id: charge.id } })
    expect(paid.status).toBe('paid')

    // частковий refund 60 → алокація зменшена до 40, charge → partial, paidAt знято
    await tenantTransaction(prisma, (tx) =>
      refundPayment(tx, { agencyId, paymentId: p.id, amount: 60, actorId: creatorId })
    )
    const partial = await prisma.serviceCharge.findUniqueOrThrow({ where: { id: charge.id } })
    expect(partial.status).toBe('partial')
    expect(partial.paidAt).toBeNull()
    const alloc = await prisma.paymentAllocation.findFirstOrThrow({ where: { paymentId: p.id } })
    expect(alloc.amount.toFixed(2)).toBe('40.00')

    // добиваємо refund 40 → алокацію видалено, charge знову pending (борг видимий дунінгу)
    await tenantTransaction(prisma, (tx) =>
      refundPayment(tx, { agencyId, paymentId: p.id, amount: 40, actorId: creatorId })
    )
    const reopened = await prisma.serviceCharge.findUniqueOrThrow({ where: { id: charge.id } })
    expect(reopened.status).toBe('pending')
    expect(await prisma.paymentAllocation.count({ where: { paymentId: p.id } })).toBe(0)
  })

  it('write-off forgives an open charge; second write-off 409', async () => {
    await prisma.serviceCharge.create({
      data: {
        agencyId,
        companyId,
        kind: 'subscription',
        amount: 200,
        totalAmount: 200,
        currency: 'USD',
        month: new Date('2026-07-01'),
        status: 'overdue',
      },
    })
    const charge = await prisma.serviceCharge.findFirstOrThrow({ where: { companyId } })
    expect(await balance(companyId)).toBe('0.00') // charge not yet reflected until recompute
    const res = await tenantTransaction(prisma, (tx) =>
      writeOffCharge(tx, {
        agencyId,
        chargeId: charge.id,
        reason: 'клієнт не заплатить',
        actorId: creatorId,
        now: new Date(),
      })
    )
    expect(res.amount).toBe('200.00')
    expect(res.moneyBalance).toBe('0.00') // written-off debt excluded → no negative balance
    const off = await prisma.serviceCharge.findUniqueOrThrow({ where: { id: charge.id } })
    expect(off.status).toBe('written_off')
    expect(off.writeOffReason).toBe('клієнт не заплатить')

    await expect(
      tenantTransaction(prisma, (tx) =>
        writeOffCharge(tx, {
          agencyId,
          chargeId: charge.id,
          reason: 'ще раз',
          actorId: creatorId,
          now: new Date(),
        })
      )
    ).rejects.toThrow(/списано/)
  })

  it('credit-note reduces the client debt (negative charge)', async () => {
    // seed a real debt: a 150 charge drives balance to −150
    await prisma.serviceCharge.create({
      data: {
        agencyId,
        companyId,
        kind: 'subscription',
        amount: 150,
        totalAmount: 150,
        currency: 'USD',
        month: new Date('2026-07-01'),
        status: 'pending',
      },
    })
    // force a recompute via a 0-effect refund-less path: use write-off of a throwaway? simpler —
    // create the credit note which recomputes and nets against the 150 debt.
    const res = await tenantTransaction(prisma, (tx) =>
      createCreditNote(tx, {
        agencyId,
        companyId,
        amount: 50,
        currency: 'USD',
        reason: 'коригування',
        actorId: creatorId,
        now: new Date(),
      })
    )
    // debt = −(150 − 50) = −100
    expect(res.moneyBalance).toBe('-100.00')
    expect(await balance(companyId)).toBe('-100.00')
  })

  it('refund claws back the proportional company-referral bonus', async () => {
    await prisma.referralSettings.create({
      data: { agencyId, enabled: true, tiers: [{ minPaidUsd: 0, percent: 10 }] },
    })
    const p = await pay(100) // referred company → referrer earns 10% = 10.00
    expect(await bonus(referrerId)).toBe('10.00')

    // full refund → clawback 10.00 from referrer wallet, totalEarned back to 0
    await tenantTransaction(prisma, (tx) =>
      refundPayment(tx, { agencyId, paymentId: p.id, amount: 100, actorId: creatorId })
    )
    expect(await bonus(referrerId)).toBe('0.00')
    const ref = await prisma.referral.findFirstOrThrow({ where: { referrerId } })
    expect(ref.totalEarned.toFixed(2)).toBe('0.00')
  })
})
