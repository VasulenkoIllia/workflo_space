import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const db = {
  timeLog: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  order: { findUnique: vi.fn() },
  $executeRaw: vi.fn().mockResolvedValue(1),
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))
vi.mock('../src/services/rateResolution.js', () => ({
  resolveTimeLogRates: vi
    .fn()
    .mockResolvedValue({ clientRate: null, costRate: null, costCurrency: null, costRateUsd: null }),
}))

const { buildApp } = await import('../src/app.js')
const { elapsedHours, autoStopStaleTimers } = await import('../src/services/timer.js')

const AGENCY = 'agency-1'
const ORDER = 'order-1'

const OWNER = {
  sub: 'exec-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const orderRow = {
  id: ORDER,
  agencyId: AGENCY,
  deletedAt: null,
  projectId: null,
  zeroBilled: false,
  hourlyRate: null,
}
const runningRow = {
  id: 'tl-1',
  orderId: ORDER,
  hours: 0,
  startedAt: new Date('2026-06-29T10:00:00Z'),
  endedAt: null,
  date: new Date('2026-06-29'),
  comment: null,
  executorId: 'exec-1',
  order: { id: ORDER, title: 'Site' },
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('elapsedHours', () => {
  it('rounds to 2dp, clamps negatives to 0, caps at 999.99', () => {
    const t0 = new Date('2026-06-29T10:00:00Z')
    expect(elapsedHours(t0, new Date('2026-06-29T11:00:00Z'))).toBe(1)
    expect(elapsedHours(t0, new Date('2026-06-29T10:30:00Z'))).toBe(0.5)
    expect(elapsedHours(t0, new Date('2026-06-29T10:00:30Z'))).toBe(0.01) // 30s → 0.0083 → 0.01
    expect(elapsedHours(t0, new Date('2026-06-29T09:00:00Z'))).toBe(0) // negative → 0
    expect(elapsedHours(new Date('2000-01-01T00:00:00Z'), new Date('2030-01-01T00:00:00Z'))).toBe(
      999.99
    )
  })
})

describe('GET /workspace/timer', () => {
  it('returns the running timer for a team member', async () => {
    db.timeLog.findFirst.mockResolvedValue(runningRow)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/timer',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.timer).toMatchObject({ id: 'tl-1', orderId: ORDER, hours: 0 })
    expect(res.json().data.timer.endedAt).toBeNull()
    await app.close()
  })

  it('returns null when nothing is running', async () => {
    db.timeLog.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/timer',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.timer).toBeNull()
    await app.close()
  })

  it('a client is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/timer',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await app.inject({ method: 'GET', url: '/workspace/timer' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('POST /workspace/timer/start', () => {
  it('starts a timer when none is running (201)', async () => {
    db.order.findUnique.mockResolvedValue(orderRow)
    db.timeLog.findFirst.mockResolvedValue(null) // no active timer
    db.timeLog.create.mockResolvedValue(runningRow)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/timer/start',
      headers: { authorization: `Bearer ${token}` },
      payload: { orderId: ORDER },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.timer).toMatchObject({ id: 'tl-1', orderId: ORDER })
    expect(db.timeLog.create).toHaveBeenCalled()
    expect(db.timeLog.update).not.toHaveBeenCalled() // nothing to auto-stop
    await app.close()
  })

  it('auto-stops the previous running timer before starting a new one', async () => {
    db.order.findUnique.mockResolvedValue(orderRow)
    db.timeLog.findFirst.mockResolvedValue({
      id: 'old',
      startedAt: new Date('2026-06-29T08:00:00Z'),
    })
    db.timeLog.update.mockResolvedValue({ ...runningRow, id: 'old', endedAt: new Date() })
    db.timeLog.create.mockResolvedValue(runningRow)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/timer/start',
      headers: { authorization: `Bearer ${token}` },
      payload: { orderId: ORDER },
    })
    expect(res.statusCode).toBe(201)
    // the old timer is finalized (endedAt + hours) before the new one is created
    expect(db.timeLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'old' },
        data: expect.objectContaining({ endedAt: expect.any(Date) }),
      })
    )
    expect(db.timeLog.create).toHaveBeenCalled()
    await app.close()
  })

  it('a client cannot start (403, requireTeamOrder)', async () => {
    db.order.findUnique.mockResolvedValue(orderRow)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/timer/start',
      headers: { authorization: `Bearer ${token}` },
      payload: { orderId: ORDER },
    })
    expect(res.statusCode).toBe(403)
    expect(db.timeLog.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects a missing orderId (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/timer/start',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('POST /workspace/timer/stop', () => {
  it('stops the running timer and computes hours', async () => {
    db.timeLog.findFirst.mockResolvedValue({
      id: 'tl-1',
      startedAt: new Date('2026-06-29T10:00:00Z'),
    })
    db.timeLog.update.mockResolvedValue({
      ...runningRow,
      endedAt: new Date('2026-06-29T12:00:00Z'),
      hours: 2,
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/timer/stop',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.timer).toMatchObject({ id: 'tl-1', hours: 2 })
    expect(db.timeLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tl-1' } })
    )
    await app.close()
  })

  it('is a no-op (timer null) when nothing is running', async () => {
    db.timeLog.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/timer/stop',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.timer).toBeNull()
    expect(db.timeLog.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('a client is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/timer/stop',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('autoStopStaleTimers', () => {
  it('caps each stale timer at exactly maxHours and reports the count', async () => {
    const started = new Date('2026-06-29T00:00:00Z')
    db.timeLog.findMany.mockResolvedValue([{ id: 'stale-1', startedAt: started }])
    db.timeLog.update.mockResolvedValue({})
    const now = new Date('2026-06-29T20:00:00Z') // 20h later
    const count = await autoStopStaleTimers(db as never, { now, maxHours: 8 })
    expect(count).toBe(1)
    // endedAt is startedAt + 8h (not "now") → hours booked = 8, never the full 20h
    const arg = db.timeLog.update.mock.calls[0]![0] as { data: { endedAt: Date; hours: number } }
    expect(arg.data.endedAt.toISOString()).toBe('2026-06-29T08:00:00.000Z')
    expect(arg.data.hours).toBe(8)
    await Promise.resolve()
  })
})
