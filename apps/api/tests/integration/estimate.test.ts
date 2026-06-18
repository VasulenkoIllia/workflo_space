import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  createEstimateLine,
  deleteEstimateLine,
  getEstimate,
  updateEstimateLine,
} from '../../src/services/estimate.js'

/**
 * Estimate lines (S5.6 P-6, 02-Б) against REAL Postgres. Proves a line auto-spawns a
 * zeroBilled kanban task, the includedHoursCap reconciliation (soft), the update→task
 * sync, that deleting a line LEAVES the task, and cross-tenant 404. Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('estimate lines (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const projectId = randomUUID()
  const creatorId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  function create(name: string, hours: number) {
    return tenantTransaction(prisma, (tx) =>
      createEstimateLine(tx, {
        agencyId,
        projectId,
        actorId: creatorId,
        input: { name, hours },
      })
    )
  }
  function summary() {
    return tenantTransaction(prisma, (tx) => getEstimate(tx, { agencyId, projectId }))
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: creatorId, email: `es-${tag}@test.local`, passwordHash: 'x', name: 'ES Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `es-${tag}`, slug: `es-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'ES Co', slug: `es-${tag}` },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        agencyId,
        companyId,
        name: 'ES Project',
        billingModel: 'fixed_monthly_advance',
        abonAmount: '500',
        includedHoursCap: '20', // budget: 20 hours
      },
    })
  })

  afterEach(async () => {
    await prisma.estimateLine.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
  })

  afterAll(async () => {
    await prisma.estimateLine.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.project.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  it('creating a line auto-spawns a linked zeroBilled kanban task', async () => {
    const line = await create('Оновлення', 5)
    expect(line.orderId).not.toBeNull()
    const order = await prisma.order.findUniqueOrThrow({ where: { id: line.orderId! } })
    expect(order.zeroBilled).toBe(true)
    expect(order.projectId).toBe(projectId)
    expect(order.companyId).toBe(companyId)
    expect(order.title).toBe('Оновлення')
    expect(order.estimatedHours?.toFixed(2)).toBe('5.00')
  })

  it('reconciles Σ hours against includedHoursCap (within budget)', async () => {
    await create('Оновлення', 1)
    await create('Підтримка', 1)
    await create('Інше', 3) // total 5 ≤ cap 20
    const s = await summary()
    expect(s.totalHours).toBe('5.00')
    expect(s.includedHoursCap).toBe('20.00')
    expect(s.withinCap).toBe(true)
    expect(s.remainingHours).toBe('15.00')
    expect(s.lines).toHaveLength(3)
  })

  it('flags over-budget (Σ hours > cap) — soft, P-2 bills the overage', async () => {
    await create('Велике', 25) // 25 > cap 20
    const s = await summary()
    expect(s.withinCap).toBe(false)
    expect(s.remainingHours).toBe('-5.00')
  })

  it('updating a line syncs the spawned task (title + estimated hours)', async () => {
    const line = await create('Оновлення', 5)
    await tenantTransaction(prisma, (tx) =>
      updateEstimateLine(tx, {
        agencyId,
        projectId,
        lineId: line.id,
        input: { name: 'Оновлення+', hours: 8 },
      })
    )
    const order = await prisma.order.findUniqueOrThrow({ where: { id: line.orderId! } })
    expect(order.title).toBe('Оновлення+')
    expect(order.estimatedHours?.toFixed(2)).toBe('8.00')
  })

  it('deleting a line LEAVES its zeroBilled task (real logged work)', async () => {
    const line = await create('Оновлення', 5)
    const orderId = line.orderId!
    await tenantTransaction(prisma, (tx) =>
      deleteEstimateLine(tx, { agencyId, projectId, lineId: line.id })
    )
    expect(await prisma.estimateLine.count({ where: { id: line.id } })).toBe(0)
    expect(await prisma.order.count({ where: { id: orderId } })).toBe(1) // task survives
  })

  it('404 for a project in another tenant', async () => {
    await expect(
      tenantTransaction(prisma, (tx) =>
        createEstimateLine(tx, {
          agencyId: randomUUID(),
          projectId,
          actorId: creatorId,
          input: { name: 'X', hours: 1 },
        })
      )
    ).rejects.toThrow(/не знайдено/)
  })
})
