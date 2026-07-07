import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// МУЛЬТИВИКОНАВЦІ: PUT співвиконавців замовлення/задачі (додатково до головного assignee).
const db = {
  order: { findUnique: vi.fn() },
  internalTask: { findFirst: vi.fn() },
  agencyMember: { findMany: vi.fn().mockResolvedValue([]) },
  orderAssignee: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  internalTaskAssignee: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
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
const { dispatchNotification } = await import('../src/services/notifications.js')

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
const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: 'co-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: 'co-1', role: 'member' as const }],
}

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const PRIMARY = '33333333-3333-4333-8333-333333333333'

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

const notifyEvents = () =>
  (dispatchNotification as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
    (c) => c[1] as { event: string; profileId: string }
  )

beforeEach(() => {
  vi.clearAllMocks()
  db.agencyMember.findMany.mockResolvedValue([])
  db.orderAssignee.findMany.mockResolvedValue([])
  db.internalTaskAssignee.findMany.mockResolvedValue([])
  db.twoFactorAuth.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.clearAllMocks())

describe('PUT /orders/:id/assignees — order co-executors', () => {
  it('replaces co-executors, drops primary from the set, notifies newly-added', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      agencyId: AGENCY,
      title: 'Лендінг',
      assigneeId: PRIMARY,
      deletedAt: null,
    })
    db.agencyMember.findMany.mockResolvedValue([{ profileId: P1 }, { profileId: P2 }])
    db.orderAssignee.findMany.mockResolvedValue([{ profileId: P1 }]) // P1 already there → only P2 is new
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/assignees',
      headers: { authorization: `Bearer ${token}` },
      payload: { profileIds: [P1, P2, PRIMARY] }, // PRIMARY must be filtered out
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.coAssigneeIds.sort()).toEqual([P1, P2].sort())
    // createMany only for the newly-added (P2)
    expect(db.orderAssignee.createMany).toHaveBeenCalledTimes(1)
    expect(db.orderAssignee.createMany.mock.calls[0][0].data).toEqual([
      { agencyId: AGENCY, orderId: 'order-1', profileId: P2 },
    ])
    // notify only P2
    const assigned = notifyEvents().filter((v) => v.event === 'orders.assigned')
    expect(assigned).toHaveLength(1)
    expect(assigned[0].profileId).toBe(P2)
    await app.close()
  })

  it('400 when a profile is not an agency member', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      agencyId: AGENCY,
      title: 'Лендінг',
      assigneeId: PRIMARY,
      deletedAt: null,
    })
    db.agencyMember.findMany.mockResolvedValue([{ profileId: P1 }]) // P2 missing
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/assignees',
      headers: { authorization: `Bearer ${token}` },
      payload: { profileIds: [P1, P2] },
    })
    expect(res.statusCode).toBe(400)
    expect(db.orderAssignee.createMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('empty list clears all co-executors (deleteMany, no createMany, no notify)', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      agencyId: AGENCY,
      title: 'Лендінг',
      assigneeId: PRIMARY,
      deletedAt: null,
    })
    db.orderAssignee.findMany.mockResolvedValue([{ profileId: P1 }])
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/assignees',
      headers: { authorization: `Bearer ${token}` },
      payload: { profileIds: [] },
    })
    expect(res.statusCode).toBe(200)
    expect(db.orderAssignee.deleteMany).toHaveBeenCalledTimes(1)
    expect(db.orderAssignee.createMany).not.toHaveBeenCalled()
    expect(notifyEvents()).toHaveLength(0)
    await app.close()
  })

  it('client is forbidden (403)', async () => {
    const { app } = await authed(CLIENT)
    const token = app.jwt.sign(CLIENT)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/assignees',
      headers: { authorization: `Bearer ${token}` },
      payload: { profileIds: [P1] },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('404 for unknown / soft-deleted order', async () => {
    db.order.findUnique.mockResolvedValue(null)
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-x/assignees',
      headers: { authorization: `Bearer ${token}` },
      payload: { profileIds: [P1] },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('PUT /orders/:orderId/tasks/:taskId/assignees — task co-executors', () => {
  it('replaces task co-executors + notifies newly-added', async () => {
    // requireTeamOrder → order.findUnique
    db.order.findUnique.mockResolvedValue({ id: 'order-1', agencyId: AGENCY, deletedAt: null })
    db.internalTask.findFirst.mockResolvedValue({ id: 't1', title: 'Верстка', assigneeId: PRIMARY })
    db.agencyMember.findMany.mockResolvedValue([{ profileId: P1 }])
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/tasks/t1/assignees',
      headers: { authorization: `Bearer ${token}` },
      payload: { profileIds: [P1] },
    })
    expect(res.statusCode).toBe(200)
    expect(db.internalTaskAssignee.createMany.mock.calls[0][0].data).toEqual([
      { agencyId: AGENCY, taskId: 't1', profileId: P1 },
    ])
    const assigned = notifyEvents().filter((v) => v.event === 'orders.assigned')
    expect(assigned).toHaveLength(1)
    expect(assigned[0].profileId).toBe(P1)
    await app.close()
  })

  it('404 when the task is not part of the order (IDOR)', async () => {
    db.order.findUnique.mockResolvedValue({ id: 'order-1', agencyId: AGENCY, deletedAt: null })
    db.internalTask.findFirst.mockResolvedValue(null)
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/order-1/tasks/t-other/assignees',
      headers: { authorization: `Bearer ${token}` },
      payload: { profileIds: [P1] },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
