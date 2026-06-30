import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { autoStopStaleTimers, startTimer, stopTimer } from '../../src/services/timer.js'

/**
 * Time-tracking timer against REAL Postgres (T2 — what a mock cannot prove): the per-executor
 * `pg_advisory_xact_lock` serializes concurrent starts, so N parallel starts converge to exactly
 * ONE running timer (the rest auto-stopped). Also covers stop→hours and the 8h auto-stop cap.
 * Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('T2 timer — concurrency + auto-stop (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const executorId = randomUUID()
  const orderId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  const start = () =>
    tenantTransaction(prisma, (tx) =>
      startTimer(tx, { agencyId, executorId, orderId, now: new Date() })
    )
  const stop = () =>
    tenantTransaction(prisma, (tx) => stopTimer(tx, { agencyId, executorId, now: new Date() }))
  const runningCount = () =>
    prisma.timeLog.count({ where: { executorId, startedAt: { not: null }, endedAt: null } })

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: executorId, email: `tm-${tag}@test.local`, passwordHash: 'x', name: 'TM Seed' },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `tm-${tag}`, slug: `tm-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'TM Co', slug: `tm-${tag}` },
    })
    await prisma.order.create({
      data: { id: orderId, agencyId, companyId, title: 'Timer order', createdById: executorId },
    })
  })

  afterEach(async () => {
    await prisma.timeLog.deleteMany({ where: { executorId } })
  })

  afterAll(async () => {
    await prisma.timeLog.deleteMany({ where: { executorId } })
    await prisma.order.deleteMany({ where: { id: orderId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: executorId } })
    await prisma.$disconnect()
  })

  it('20 concurrent starts converge to exactly ONE running timer (advisory lock)', async () => {
    await Promise.all(Array.from({ length: 20 }, () => start()))
    expect(await runningCount()).toBe(1)
    // each start created a row; all but the last were auto-stopped (endedAt stamped)
    const total = await prisma.timeLog.count({ where: { executorId } })
    expect(total).toBe(20)
    const stopped = await prisma.timeLog.count({ where: { executorId, endedAt: { not: null } } })
    expect(stopped).toBe(19)
  })

  it('stop finalizes the running timer with computed hours', async () => {
    await start()
    expect(await runningCount()).toBe(1)
    const stoppedTimer = await stop()
    expect(stoppedTimer).not.toBeNull()
    expect(stoppedTimer?.endedAt).not.toBeNull()
    expect(await runningCount()).toBe(0)
    // a second stop with nothing running is a no-op
    expect(await stop()).toBeNull()
  })

  it('auto-stop caps a >8h timer at exactly 8h and clears it from running', async () => {
    const startedAt = new Date(Date.now() - 20 * 3_600_000) // 20h ago
    await prisma.timeLog.create({
      data: { agencyId, orderId, executorId, hours: 0, date: startedAt, startedAt, endedAt: null },
    })
    const count = await tenantTransaction(prisma, (tx) =>
      autoStopStaleTimers(tx, { now: new Date(), maxHours: 8 })
    )
    expect(count).toBe(1)
    expect(await runningCount()).toBe(0)
    const row = await prisma.timeLog.findFirstOrThrow({ where: { executorId } })
    expect(Number(row.hours)).toBe(8) // capped at maxHours, not the full 20h
    expect(row.endedAt?.getTime()).toBe(startedAt.getTime() + 8 * 3_600_000)
  })
})
