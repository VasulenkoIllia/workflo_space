import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { generateRecurringCharges } from '../../src/services/recurringCharges.js'

/**
 * Recurring-charge generation against REAL Postgres (S5-03b). The guarantee a mock
 * cannot prove: `(companyServiceId, month)` uniqueness makes generation idempotent —
 * the cron, a manual replay, and a double-run all converge to the SAME rows, and a
 * stale `nextChargeAt` is caught up one period at a time. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('S5-03b recurring charges — idempotent generation (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const serviceId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  async function seedSubscription(opts: {
    nextChargeAt: Date
    frequency?: 'monthly' | 'quarterly' | 'annual'
    customPrice?: number
  }): Promise<string> {
    const cs = await prisma.companyService.create({
      data: {
        companyId,
        serviceId,
        customPrice: opts.customPrice ?? 100,
        active: true,
        frequency: opts.frequency ?? 'monthly',
        nextChargeAt: opts.nextChargeAt,
      },
      select: { id: true },
    })
    return cs.id
  }

  function generate(now: Date) {
    return tenantTransaction(prisma, (tx) => generateRecurringCharges(tx, { now, agencyId }))
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `rc-${tag}@test.local`, passwordHash: 'x', name: 'RC Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `rc-${tag}`, slug: `rc-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'RC Co', slug: `rc-${tag}`, loyaltyTier: 'regular' },
    })
    await prisma.service.create({
      data: { id: serviceId, agencyId, name: 'Retainer', isActive: true, isRecurring: true },
    })
  })

  afterAll(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.companyService.deleteMany({ where: { serviceId } })
    await prisma.service.deleteMany({ where: { id: serviceId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.companyService.deleteMany({ where: { serviceId } })
  })

  it('generates one charge and advances nextChargeAt; re-run is a no-op (idempotent)', async () => {
    const csId = await seedSubscription({ nextChargeAt: new Date('2026-06-01T00:00:00Z') })
    const now = new Date('2026-06-15T00:00:00Z')

    const first = await generate(now)
    expect(first.created).toBe(1)

    const second = await generate(now)
    expect(second.created).toBe(0) // already advanced past `now` → nothing due

    const charges = await prisma.serviceCharge.findMany({ where: { companyServiceId: csId } })
    expect(charges).toHaveLength(1)
    // REGULAR tier = 3% off 100 → 97.00 owed.
    expect(charges[0].totalAmount?.toFixed(2)).toBe('97.00')
    expect(charges[0].amount.toFixed(2)).toBe('97.00')
    expect(charges[0].month.toISOString().slice(0, 10)).toBe('2026-06-01')

    const cs = await prisma.companyService.findUnique({ where: { id: csId } })
    expect(cs?.nextChargeAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('idempotent under a duplicated month even if nextChargeAt is reset (ON CONFLICT)', async () => {
    const csId = await seedSubscription({ nextChargeAt: new Date('2026-06-01T00:00:00Z') })
    await generate(new Date('2026-06-15T00:00:00Z'))

    // Force the anchor back as if a retry re-ran the same month — the unique constraint guards it.
    await prisma.companyService.update({
      where: { id: csId },
      data: { nextChargeAt: new Date('2026-06-01T00:00:00Z') },
    })
    const again = await generate(new Date('2026-06-15T00:00:00Z'))
    expect(again.created).toBe(0) // skipDuplicates → no second June row

    const count = await prisma.serviceCharge.count({ where: { companyServiceId: csId } })
    expect(count).toBe(1)
  })

  it('catches up multiple missed monthly periods in one run', async () => {
    const csId = await seedSubscription({ nextChargeAt: new Date('2026-04-01T00:00:00Z') })
    const res = await generate(new Date('2026-06-15T00:00:00Z'))
    expect(res.created).toBe(3) // Apr, May, Jun

    const charges = await prisma.serviceCharge.findMany({
      where: { companyServiceId: csId },
      orderBy: { month: 'asc' },
      select: { month: true },
    })
    expect(charges.map((c) => c.month.toISOString().slice(0, 7))).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ])
    const cs = await prisma.companyService.findUnique({ where: { id: csId } })
    expect(cs?.nextChargeAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('quarterly subscription bills once per quarter', async () => {
    const csId = await seedSubscription({
      nextChargeAt: new Date('2026-01-01T00:00:00Z'),
      frequency: 'quarterly',
    })
    const res = await generate(new Date('2026-06-15T00:00:00Z'))
    expect(res.created).toBe(2) // Jan + Apr (Jul is in the future)

    const cs = await prisma.companyService.findUnique({ where: { id: csId } })
    expect(cs?.nextChargeAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('skips inactive subscriptions and inactive services', async () => {
    const csId = await seedSubscription({ nextChargeAt: new Date('2026-06-01T00:00:00Z') })
    await prisma.companyService.update({ where: { id: csId }, data: { active: false } })
    const res = await generate(new Date('2026-06-15T00:00:00Z'))
    expect(res.created).toBe(0)
    expect(res.due).toBe(0)
  })
})
