import { randomUUID } from 'node:crypto'
import { Prisma, prisma } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type OrderForRate, resolveTimeLogRates } from '../../src/services/rateResolution.js'

/**
 * Rate resolution cascade (PROJECTS_SPEC §2.3, P-5) against REAL Postgres. Verifies
 * client (revenue) rate + the 5-tier cost cascade + costRateUsd FX conversion.
 * Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('rate resolution cascade (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const projectId = randomUUID()
  const execBase = randomUUID() // ExecutorRate hourlyRate 10
  const execZero = randomUUID() // ExecutorRate zeroCostDefault true
  const execNone = randomUUID() // no ExecutorRate
  const tag = randomUUID().slice(0, 8)
  const date = new Date('2026-06-15T00:00:00Z')

  const hourlyOrder: OrderForRate = { projectId, zeroBilled: false, hourlyRate: null }

  function resolve(order: OrderForRate, executorId: string) {
    return resolveTimeLogRates(prisma, { agencyId, order, executorId, date })
  }

  beforeAll(async () => {
    await prisma.agency.create({ data: { id: agencyId, name: `rr-${tag}`, slug: `rr-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'RR Co', slug: `rr-${tag}` },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'RR Project',
        billingModel: 'hourly_postpaid',
        clientHourlyRate: new Prisma.Decimal(30),
        currency: 'USD',
      },
    })
    await prisma.exchangeRate.create({ data: { agencyId, usdToUah: new Prisma.Decimal(40) } })
    for (const [id, slug] of [
      [execBase, 'base'],
      [execZero, 'zero'],
      [execNone, 'none'],
    ] as const) {
      await prisma.profile.create({
        data: { id, email: `${slug}-${tag}@test.local`, passwordHash: 'x', name: slug },
      })
    }
    const effectiveFrom = new Date('2026-01-01T00:00:00Z') // before the test `date` (15.06)
    await prisma.executorRate.create({
      data: {
        agencyId,
        executorId: execBase,
        hourlyRate: new Prisma.Decimal(10),
        currency: 'USD',
        effectiveFrom,
      },
    })
    await prisma.executorRate.create({
      data: {
        agencyId,
        executorId: execZero,
        zeroCostDefault: true,
        currency: 'USD',
        effectiveFrom,
      },
    })
  })

  afterEach(async () => {
    await prisma.projectExecutorRate.deleteMany({ where: { agencyId } })
  })

  afterAll(async () => {
    await prisma.projectExecutorRate.deleteMany({ where: { agencyId } })
    await prisma.executorRate.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
    await prisma.exchangeRate.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { agencyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: { in: [execBase, execZero, execNone] } } })
    await prisma.$disconnect()
  })

  it('tier 4: falls back to ExecutorRate.hourlyRate; client rate = project rate', async () => {
    const r = await resolve(hourlyOrder, execBase)
    expect(r.clientRate?.toFixed(2)).toBe('30.00')
    expect(r.costRate?.toFixed(2)).toBe('10.00')
    expect(r.costCurrency).toBe('USD')
    expect(r.costRateUsd?.toFixed(2)).toBe('10.00')
  })

  it('tier 2: per-project costHourlyRate override wins over person base', async () => {
    await prisma.projectExecutorRate.create({
      data: { agencyId, projectId, executorId: execBase, costHourlyRate: new Prisma.Decimal(8) },
    })
    const r = await resolve(hourlyOrder, execBase)
    expect(r.costRate?.toFixed(2)).toBe('8.00')
  })

  it('tier 1: per-project zeroCost → cost 0', async () => {
    await prisma.projectExecutorRate.create({
      data: {
        agencyId,
        projectId,
        executorId: execBase,
        costHourlyRate: new Prisma.Decimal(8),
        zeroCost: true,
      },
    })
    const r = await resolve(hourlyOrder, execBase)
    expect(r.costRate?.toFixed(2)).toBe('0.00')
  })

  it('tier 3: ExecutorRate.zeroCostDefault → cost 0', async () => {
    const r = await resolve(hourlyOrder, execZero)
    expect(r.costRate?.toFixed(2)).toBe('0.00')
  })

  it('tier 5: no rate anywhere → cost null (UI warns)', async () => {
    const r = await resolve(hourlyOrder, execNone)
    expect(r.costRate).toBeNull()
    expect(r.costRateUsd).toBeNull()
  })

  it('client rate: zeroBilled → 0; legacy order (no project) → order.hourlyRate', async () => {
    const zb = await resolve({ projectId, zeroBilled: true, hourlyRate: null }, execBase)
    expect(zb.clientRate?.toFixed(2)).toBe('0.00')
    const legacy = await resolve(
      { projectId: null, zeroBilled: false, hourlyRate: new Prisma.Decimal(25) },
      execBase
    )
    expect(legacy.clientRate?.toFixed(2)).toBe('25.00')
  })

  it('costRateUsd: a UAH cost rate is converted at usdToUah', async () => {
    await prisma.projectExecutorRate.create({
      data: {
        agencyId,
        projectId,
        executorId: execBase,
        costHourlyRate: new Prisma.Decimal(400),
        currency: 'UAH',
      },
    })
    const r = await resolve(hourlyOrder, execBase)
    expect(r.costRate?.toFixed(2)).toBe('400.00')
    expect(r.costCurrency).toBe('UAH')
    expect(r.costRateUsd?.toFixed(2)).toBe('10.00') // 400 / 40
  })
})
