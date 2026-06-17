import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { generateRecurringCharges } from '../../src/services/recurringCharges.js'

/**
 * Recurring project-charge generation against REAL Postgres (S5.6 P-1 3b). The
 * guarantee a mock cannot prove: `(projectId, periodStart)` uniqueness makes
 * generation idempotent — the cron, a manual replay, and a double-run all converge
 * to the SAME rows, and a stale `nextCycleAt` is caught up one period at a time.
 * Scope: fixed_monthly_advance / monthly_day_n. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('recurring project charges — idempotent generation (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  async function seedProject(opts: { nextCycleAt: Date; abonAmount?: number }): Promise<string> {
    const p = await prisma.project.create({
      data: {
        agencyId,
        companyId,
        name: `Retainer-${randomUUID().slice(0, 8)}`,
        billingModel: 'fixed_monthly_advance',
        billingCycle: 'monthly_day_n',
        cycleDay: 1,
        abonAmount: opts.abonAmount ?? 100,
        active: true,
        nextCycleAt: opts.nextCycleAt,
      },
      select: { id: true },
    })
    return p.id
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
  })

  afterAll(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
  })

  it('generates one charge and advances nextCycleAt; re-run is a no-op (idempotent)', async () => {
    const projectId = await seedProject({ nextCycleAt: new Date('2026-06-01T00:00:00Z') })
    const now = new Date('2026-06-15T00:00:00Z')

    const first = await generate(now)
    expect(first.created).toBe(1)

    const second = await generate(now)
    expect(second.created).toBe(0) // already advanced past `now` → nothing due

    const charges = await prisma.serviceCharge.findMany({ where: { projectId } })
    expect(charges).toHaveLength(1)
    // REGULAR tier = 3% off 100 → 97.00 owed.
    expect(charges[0].totalAmount?.toFixed(2)).toBe('97.00')
    expect(charges[0].amount.toFixed(2)).toBe('97.00')
    expect(charges[0].month.toISOString().slice(0, 10)).toBe('2026-06-01')
    expect(charges[0].periodStart?.toISOString().slice(0, 10)).toBe('2026-06-01')

    const p = await prisma.project.findUnique({ where: { id: projectId } })
    expect(p?.nextCycleAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('idempotent under a duplicated period even if nextCycleAt is reset (ON CONFLICT)', async () => {
    const projectId = await seedProject({ nextCycleAt: new Date('2026-06-01T00:00:00Z') })
    await generate(new Date('2026-06-15T00:00:00Z'))

    // Force the anchor back as if a retry re-ran the same period — the unique constraint guards it.
    await prisma.project.update({
      where: { id: projectId },
      data: { nextCycleAt: new Date('2026-06-01T00:00:00Z') },
    })
    const again = await generate(new Date('2026-06-15T00:00:00Z'))
    expect(again.created).toBe(0) // skipDuplicates → no second June row

    const count = await prisma.serviceCharge.count({ where: { projectId } })
    expect(count).toBe(1)
  })

  it('catches up multiple missed monthly periods in one run', async () => {
    const projectId = await seedProject({ nextCycleAt: new Date('2026-04-01T00:00:00Z') })
    const res = await generate(new Date('2026-06-15T00:00:00Z'))
    expect(res.created).toBe(3) // Apr, May, Jun

    const charges = await prisma.serviceCharge.findMany({
      where: { projectId },
      orderBy: { periodStart: 'asc' },
      select: { periodStart: true },
    })
    expect(charges.map((c) => c.periodStart?.toISOString().slice(0, 7))).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ])
    const p = await prisma.project.findUnique({ where: { id: projectId } })
    expect(p?.nextCycleAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('skips inactive projects', async () => {
    const projectId = await seedProject({ nextCycleAt: new Date('2026-06-01T00:00:00Z') })
    await prisma.project.update({ where: { id: projectId }, data: { active: false } })
    const res = await generate(new Date('2026-06-15T00:00:00Z'))
    expect(res.created).toBe(0)
    expect(res.due).toBe(0)
  })
})
