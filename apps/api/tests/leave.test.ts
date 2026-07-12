import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// S13-04/05 LEAVE: self-service заявки + owner/manager погодження + accrual-баланс.
const db = {
  leaveRequest: {
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  agencyMember: { findUnique: vi.fn(), findMany: vi.fn() },
  agency: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  // audit-M3: advisory-lock у approve-транзакції серіалізує погодження per-profile
  $executeRaw: vi.fn().mockResolvedValue(1),
}

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  }
})
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')
const { workdaysBetween } = await import('../src/routes/team/leave.js')

const AGENCY = 'agency-1'
const claims = (sub: string, role: 'owner' | 'manager' | 'executor') => ({
  sub,
  email: `${sub}@e.com`,
  role: role === 'owner' ? ('owner' as const) : ('executor' as const),
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
})
const OWNER = claims('owner-1', 'owner')
const MANAGER = claims('manager-1', 'manager')
const EXECUTOR = claims('exec-1', 'executor')
const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const leaveRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'leave-1',
  profileId: 'exec-1',
  profile: { name: 'Виконавець' },
  type: 'vacation',
  startDate: new Date('2026-07-13T00:00:00Z'),
  endDate: new Date('2026-07-17T00:00:00Z'),
  days: 5,
  status: 'pending',
  reason: null,
  rejectReason: null,
  reviewedById: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2026-07-11T00:00:00Z'),
  ...over,
})

async function authed(c: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(c as object) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.auditLog.create.mockResolvedValue({})
  db.agencyMember.findMany.mockResolvedValue([])
  db.leaveRequest.findFirst.mockResolvedValue(null)
  db.leaveRequest.findMany.mockResolvedValue([])
})
afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('workdaysBetween — робочі дні пн–пт', () => {
  it('пн–пт = 5; тиждень з вихідними = 5; сб–нд = 0; один вт = 1', () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`)
    expect(workdaysBetween(d('2026-07-13'), d('2026-07-17'))).toBe(5) // пн–пт
    expect(workdaysBetween(d('2026-07-11'), d('2026-07-19'))).toBe(5) // сб–нд обабіч
    expect(workdaysBetween(d('2026-07-11'), d('2026-07-12'))).toBe(0) // сб–нд
    expect(workdaysBetween(d('2026-07-14'), d('2026-07-14'))).toBe(1)
  })
})

describe('POST /workspace/leave — подача заявки (self)', () => {
  it('клієнт порталу → 403', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leave',
      headers: { authorization: `Bearer ${token}` },
      payload: { startDate: '2026-07-13', endDate: '2026-07-17' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.leaveRequest.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('виконавець подає пн–пт → 201, days=5, нотифікація owner-ам (не собі)', async () => {
    db.leaveRequest.create.mockResolvedValue(leaveRow())
    db.agencyMember.findMany.mockResolvedValue([{ profileId: 'owner-1' }])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leave',
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'vacation', startDate: '2026-07-13', endDate: '2026-07-17' },
    })
    expect(res.statusCode).toBe(201)
    expect(db.leaveRequest.create.mock.calls[0][0].data).toMatchObject({
      profileId: 'exec-1',
      days: 5,
    })
    // рев'юери — owner/manager, крім заявника
    expect(db.agencyMember.findMany.mock.calls[0][0].where).toMatchObject({
      role: { in: ['owner', 'manager'] },
      profileId: { not: 'exec-1' },
    })
    await app.close()
  })

  it('період лише з вихідних → 400; кінець раніше за початок → 400', async () => {
    const { app, token } = await authed(EXECUTOR)
    const weekend = await app.inject({
      method: 'POST',
      url: '/workspace/leave',
      headers: { authorization: `Bearer ${token}` },
      payload: { startDate: '2026-07-11', endDate: '2026-07-12' },
    })
    expect(weekend.statusCode).toBe(400)
    const inverted = await app.inject({
      method: 'POST',
      url: '/workspace/leave',
      headers: { authorization: `Bearer ${token}` },
      payload: { startDate: '2026-07-17', endDate: '2026-07-13' },
    })
    expect(inverted.statusCode).toBe(400)
    expect(db.leaveRequest.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('перетин з живою заявкою → 409', async () => {
    db.leaveRequest.findFirst.mockResolvedValue({ id: 'other' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leave',
      headers: { authorization: `Bearer ${token}` },
      payload: { startDate: '2026-07-13', endDate: '2026-07-17' },
    })
    expect(res.statusCode).toBe(409)
    expect(db.leaveRequest.create).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('GET /workspace/leave — self-vs-others', () => {
  it('виконавець бачить лише своє (примусовий profileId), canReview=false', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leave?profileId=someone-else',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.leaveRequest.findMany.mock.calls[0][0].where.profileId).toBe('exec-1')
    expect(res.json().data.canReview).toBe(false)
    await app.close()
  })

  it('owner бачить всіх, canReview=true', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leave',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(db.leaveRequest.findMany.mock.calls[0][0].where.profileId).toBeUndefined()
    expect(res.json().data.canReview).toBe(true)
    await app.close()
  })
})

describe('GET /workspace/leave/balance — accrual (S13-05)', () => {
  it('стаж >1 року, 24 дн/рік, зараз липень → accrued 12; used віднімається', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-11T12:00:00Z'), toFake: ['Date'] })
    db.agencyMember.findUnique.mockResolvedValue({
      hireDate: new Date('2024-03-01T00:00:00Z'),
      createdAt: new Date('2024-03-01T00:00:00Z'),
    })
    db.agency.findUnique.mockResolvedValue({ vacationDaysPerYear: 24 })
    db.leaveRequest.findMany.mockResolvedValue([
      { days: 5, status: 'approved' },
      { days: 3, status: 'pending' },
    ])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leave/balance',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const b = res.json().data.balance
    expect(b.accruedDays).toBe(12) // 24 × 6 міс / 12
    expect(b.usedDays).toBe(5)
    expect(b.pendingDays).toBe(3)
    expect(b.balanceDays).toBe(7)
    await app.close()
  })

  it('виконавець не бачить чужий баланс → 403; owner — бачить', async () => {
    db.agencyMember.findUnique.mockResolvedValue({
      hireDate: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    db.agency.findUnique.mockResolvedValue({ vacationDaysPerYear: 24 })
    const { app, token } = await authed(EXECUTOR)
    const denied = await app.inject({
      method: 'GET',
      url: '/workspace/leave/balance?profileId=owner-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(denied.statusCode).toBe(403)
    const { app: app2, token: token2 } = await authed(OWNER)
    const ok = await app2.inject({
      method: 'GET',
      url: '/workspace/leave/balance?profileId=exec-1',
      headers: { authorization: `Bearer ${token2}` },
    })
    expect(ok.statusCode).toBe(200)
    await app.close()
    await app2.close()
  })
})

describe('approve/reject/cancel — гейти і клейми', () => {
  it('виконавець не може approve → 403', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leave/leave-1/approve',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('менеджер не погоджує ВЛАСНУ заявку → 403 (owner — може)', async () => {
    db.leaveRequest.findFirst.mockResolvedValue({
      id: 'leave-1',
      profileId: 'manager-1',
      type: 'dayoff',
      days: 1,
      status: 'pending',
    })
    const { app, token } = await authed(MANAGER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leave/leave-1/approve',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.leaveRequest.updateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('vacation понад баланс → 409', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-11T12:00:00Z'), toFake: ['Date'] })
    db.leaveRequest.findFirst.mockResolvedValue({
      id: 'leave-1',
      profileId: 'exec-1',
      type: 'vacation',
      days: 20, // просить 20
      status: 'pending',
    })
    db.agencyMember.findUnique.mockResolvedValue({
      hireDate: new Date('2024-03-01T00:00:00Z'),
      createdAt: new Date('2024-03-01T00:00:00Z'),
    })
    db.agency.findUnique.mockResolvedValue({ vacationDaysPerYear: 24 }) // accrued 12
    db.leaveRequest.findMany.mockResolvedValue([])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leave/leave-1/approve',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    expect(db.leaveRequest.updateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('approve happy: атомарний клейм + нотифікація заявнику; повторний → 409', async () => {
    db.leaveRequest.findFirst.mockResolvedValue({
      id: 'leave-1',
      profileId: 'exec-1',
      type: 'sick', // без балансового guard
      days: 2,
      status: 'pending',
    })
    db.leaveRequest.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    db.leaveRequest.findFirstOrThrow.mockResolvedValue(
      leaveRow({ status: 'approved', type: 'sick' })
    )
    const { app, token } = await authed(MANAGER)
    const ok = await app.inject({
      method: 'POST',
      url: '/workspace/leave/leave-1/approve',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(ok.statusCode).toBe(200)
    expect(db.leaveRequest.updateMany.mock.calls[0][0].where).toMatchObject({ status: 'pending' })
    const again = await app.inject({
      method: 'POST',
      url: '/workspace/leave/leave-1/approve',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(again.statusCode).toBe(409)
    await app.close()
  })

  it('reject вимагає причину (400 без) і пише rejectReason', async () => {
    const { app, token } = await authed(OWNER)
    const noReason = await app.inject({
      method: 'POST',
      url: '/workspace/leave/leave-1/reject',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(noReason.statusCode).toBe(400)
    db.leaveRequest.updateMany.mockResolvedValue({ count: 1 })
    db.leaveRequest.findFirstOrThrow.mockResolvedValue(
      leaveRow({ status: 'rejected', rejectReason: 'Перетин з дедлайном' })
    )
    const ok = await app.inject({
      method: 'POST',
      url: '/workspace/leave/leave-1/reject',
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Перетин з дедлайном' },
    })
    expect(ok.statusCode).toBe(200)
    expect(db.leaveRequest.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'rejected',
      rejectReason: 'Перетин з дедлайном',
    })
    await app.close()
  })

  it('cancel: лише автор і лише pending — чужа/розглянута → 404', async () => {
    db.leaveRequest.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    const { app, token } = await authed(EXECUTOR)
    const ok = await app.inject({
      method: 'POST',
      url: '/workspace/leave/leave-1/cancel',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(ok.statusCode).toBe(200)
    expect(db.leaveRequest.updateMany.mock.calls[0][0].where).toMatchObject({
      profileId: 'exec-1',
      status: 'pending',
    })
    const miss = await app.inject({
      method: 'POST',
      url: '/workspace/leave/leave-2/cancel',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(miss.statusCode).toBe(404)
    await app.close()
  })
})
