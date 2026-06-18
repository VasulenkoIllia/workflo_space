import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { closeProjectCycle, generateRecurringCharges } from '../../src/services/recurringCharges.js'

/**
 * П3 contract-gate (S5.6 P-7) against REAL Postgres. A project that requires a contract
 * with none attached is HELD: charge generation is blocked and nextCycleAt is NOT advanced
 * (so it catches up once the signed contract is linked); manual close 409s. Gated on
 * RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('contract-gate П3 (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const projectId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function generate(now: Date) {
    return tenantTransaction(prisma, (tx) => generateRecurringCharges(tx, { now, agencyId }))
  }
  function setContract(id: string | null) {
    return prisma.project.update({ where: { id: projectId }, data: { contractDocumentId: id } })
  }
  function setAnchor(nextCycleAt: Date | null) {
    return prisma.project.update({ where: { id: projectId }, data: { nextCycleAt } })
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `cg-${tag}@test.local`, passwordHash: 'x', name: 'CG Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `cg-${tag}`, slug: `cg-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'CG Co', slug: `cg-${tag}`, loyaltyTier: 'new' },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'CG Project',
        billingModel: 'fixed_monthly_advance',
        billingCycle: 'monthly_day_n',
        abonAmount: new Prisma.Decimal(500),
        contractRequired: true, // requires a signed contract before generation
        contractDocumentId: null,
      },
    })
  })

  afterEach(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await setContract(null)
    await setAnchor(null)
  })

  afterAll(async () => {
    await prisma.serviceCharge.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  it('held: no charge generated, nextCycleAt NOT advanced, gated counted', async () => {
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    const res = await generate(new Date('2026-07-15T00:00:00Z'))
    expect(res.created).toBe(0)
    expect(res.gated).toBe(1)
    expect(await prisma.serviceCharge.count({ where: { projectId } })).toBe(0)
    const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(p.nextCycleAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z') // unchanged → catches up later
  })

  it('attaching the signed contract unblocks generation (catch-up)', async () => {
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    await generate(new Date('2026-07-15T00:00:00Z')) // held, nothing created
    await setContract(randomUUID()) // sign + link the contract
    const res = await generate(new Date('2026-07-15T00:00:00Z'))
    expect(res.created).toBe(1)
    expect(res.gated).toBe(0)
    expect(await prisma.serviceCharge.count({ where: { projectId } })).toBe(1)
  })

  it('manual close 409s while the contract gate is closed', async () => {
    await expect(
      tenantTransaction(prisma, (tx) =>
        closeProjectCycle(tx, {
          agencyId,
          projectId,
          periodStart: new Date('2026-06-01'),
          periodEnd: new Date('2026-06-30'),
        })
      )
    ).rejects.toThrow(/договір/)
  })

  it('a project that does NOT require a contract generates normally', async () => {
    await prisma.project.update({ where: { id: projectId }, data: { contractRequired: false } })
    await setAnchor(new Date('2026-07-01T00:00:00Z'))
    const res = await generate(new Date('2026-07-15T00:00:00Z'))
    expect(res.created).toBe(1)
    expect(res.gated).toBe(0)
    await prisma.project.update({ where: { id: projectId }, data: { contractRequired: true } })
  })
})
