import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// ПРИЙМАННЯ РОБОТИ: PUT /orders/:id/reconciliation — owner/manager коригує білабельні
// (клієнту) + оплатні (виконавцю) години. Факт (Σ TimeLog) не редагується.
const db = {
  order: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  agencyMember: { findMany: vi.fn().mockResolvedValue([]) },
  timeLog: { groupBy: vi.fn().mockResolvedValue([]) },
  orderExecutorSettlement: { upsert: vi.fn().mockResolvedValue({}) },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))
vi.mock('../src/services/notifications.js', () => ({
  buildNotifyDeps: () => ({}),
  dispatchNotification: vi.fn(),
}))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}
const MANAGER = {
  ...OWNER,
  sub: 'mgr-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'manager' as const }],
}
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}

const P1 = '11111111-1111-4111-8111-111111111111'

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.order.update.mockResolvedValue({})
  db.agencyMember.findMany.mockResolvedValue([])
  db.timeLog.groupBy.mockResolvedValue([])
  db.orderExecutorSettlement.upsert.mockResolvedValue({})
  db.twoFactorAuth.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.clearAllMocks())

describe('PUT /orders/:id/reconciliation — звірка годин', () => {
  it('owner sets billableHours + per-exec payable (tracked snapshot from TimeLog)', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      agencyId: AGENCY,
      internalStatus: 'review',
      deletedAt: null,
    })
    db.agencyMember.findMany.mockResolvedValue([{ profileId: P1 }])
    db.timeLog.groupBy.mockResolvedValue([{ executorId: P1, _sum: { hours: 10 } }])
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/reconciliation',
      headers: { authorization: `Bearer ${token}` },
      payload: { billableHours: 5, settlements: [{ profileId: P1, payableHours: 5 }] },
    })
    expect(res.statusCode).toBe(200)
    expect(db.order.update.mock.calls[0][0].data.billableHours).toBe(5)
    const up = db.orderExecutorSettlement.upsert.mock.calls[0][0]
    expect(up.where.orderId_profileId).toEqual({ orderId: 'order-1', profileId: P1 })
    // tracked береться зі снапшоту факту (10), payable — з тіла (5)
    expect(up.create.trackedHours).toBe(10)
    expect(up.create.payableHours).toBe(5)
    await app.close()
  })

  it('manager may reconcile too', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      agencyId: AGENCY,
      internalStatus: 'review',
      deletedAt: null,
    })
    const { app } = await authed(MANAGER)
    const token = app.jwt.sign(MANAGER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/reconciliation',
      headers: { authorization: `Bearer ${token}` },
      payload: { billableHours: 8 },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('executor is forbidden (403)', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      agencyId: AGENCY,
      internalStatus: 'review',
      deletedAt: null,
    })
    const { app } = await authed(EXECUTOR)
    const token = app.jwt.sign(EXECUTOR)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/reconciliation',
      headers: { authorization: `Bearer ${token}` },
      payload: { billableHours: 5 },
    })
    expect(res.statusCode).toBe(403)
    expect(db.order.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('400 when a settlement profile is not an agency member', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      agencyId: AGENCY,
      internalStatus: 'review',
      deletedAt: null,
    })
    db.agencyMember.findMany.mockResolvedValue([]) // P1 not a member
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/reconciliation',
      headers: { authorization: `Bearer ${token}` },
      payload: { settlements: [{ profileId: P1, payableHours: 3 }] },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('409 once accepted (done) — reconciliation frozen', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      agencyId: AGENCY,
      internalStatus: 'done',
      deletedAt: null,
    })
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/reconciliation',
      headers: { authorization: `Bearer ${token}` },
      payload: { billableHours: 5 },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })
})
