import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const orderCreate = vi.fn()
const orderCount = vi.fn()
const orderFindMany = vi.fn()
const orderFindUnique = vi.fn()
const orderUpdate = vi.fn()
const agencyMemberFindUnique = vi.fn()
const auditLogCreate = vi.fn()
const transaction = vi.fn()
const taskFindMany = vi.fn()
const taskCreate = vi.fn()
const taskFindUnique = vi.fn()
const taskUpdate = vi.fn()
const taskDelete = vi.fn()
const commentFindMany = vi.fn()
const commentCount = vi.fn()
const commentCreate = vi.fn()
const chatReadFindUnique = vi.fn()
const chatReadUpsert = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    order: {
      create: orderCreate,
      count: orderCount,
      findMany: orderFindMany,
      findUnique: orderFindUnique,
      update: orderUpdate,
    },
    internalTask: {
      findMany: taskFindMany,
      create: taskCreate,
      findUnique: taskFindUnique,
      update: taskUpdate,
      delete: taskDelete,
    },
    orderComment: {
      findMany: commentFindMany,
      count: commentCount,
      create: commentCreate,
    },
    orderChatRead: {
      findUnique: chatReadFindUnique,
      upsert: chatReadUpsert,
    },
    agencyMember: { findUnique: agencyMemberFindUnique },
    auditLog: { create: auditLogCreate },
    $transaction: transaction,
  },
  Prisma: {},
}))

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const CLIENT = {
  sub: 'profile-1',
  email: 'u@e.com',
  role: 'client' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}
const EXECUTOR = {
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}

function authed(claims: unknown) {
  const app = buildApp()
  return app.ready().then(() => ({ app, token: app.jwt.sign(claims as object) }))
}

describe('POST /orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
  })
  afterEach(() => vi.clearAllMocks())

  it('creates an order for the active company → 201, tenant-stamped', async () => {
    orderCreate.mockResolvedValue({
      id: 'order-1',
      title: 'Land migration',
      description: 'do the thing',
      clientStatus: 'in_progress',
      priority: 'medium',
      deadline: null,
      createdAt: new Date('2026-05-31T00:00:00Z'),
      updatedAt: new Date('2026-05-31T00:00:00Z'),
    })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Land migration', description: 'do the thing' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.order.id).toBe('order-1')
    // tenant + author are derived from the session, never the body
    const arg = orderCreate.mock.calls[0][0]
    expect(arg.data.agency).toEqual({ connect: { id: 'agency-1' } })
    expect(arg.data.company).toEqual({ connect: { id: 'company-1' } })
    expect(arg.data.internalStatus).toBe('new')
    await app.close()
  })

  it('rejects with 400 when the session has no active company', async () => {
    const { app, token } = await authed({ ...CLIENT, activeCompanyId: null })
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'No company', description: 'should fail' },
    })
    expect(res.statusCode).toBe(400)
    expect(orderCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('401 without a token', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: { title: 'x', description: 'y' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('rejects a too-short title (400 validation)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'ab' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('GET /orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transaction.mockImplementation((promises: Promise<unknown>[]) => Promise.all(promises))
  })
  afterEach(() => vi.clearAllMocks())

  const row = {
    id: 'order-1',
    title: 'Land migration',
    internalStatus: 'in_progress',
    clientStatus: 'in_progress',
    priority: 'high',
    deadline: null,
    totalAmount: null,
    companyId: 'company-1',
    createdAt: new Date('2026-05-31T00:00:00Z'),
    updatedAt: new Date('2026-05-31T00:00:00Z'),
    _count: { stages: 2 },
  }

  it('client list is scoped to their companies + hides internalStatus', async () => {
    orderCount.mockResolvedValue(1)
    orderFindMany.mockResolvedValue([row])
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json().data
    expect(body.orders[0].stageCount).toBe(2)
    expect(body.orders[0].internalStatus).toBeUndefined() // client view
    expect(body.pagination.total).toBe(1)
    // where must carry the agency + the client's company restriction
    const whereArg = orderFindMany.mock.calls[0][0].where
    expect(whereArg.agencyId).toBe('agency-1')
    expect(whereArg.companyId).toEqual({ in: ['company-1'] })
    await app.close()
  })

  it('executor list spans the agency (no company restriction) + shows internalStatus', async () => {
    orderCount.mockResolvedValue(1)
    orderFindMany.mockResolvedValue([row])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/orders?status=in_progress&page=1&limit=10',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.orders[0].internalStatus).toBe('in_progress')
    const whereArg = orderFindMany.mock.calls[0][0].where
    expect(whereArg.agencyId).toBe('agency-1')
    expect(whereArg.companyId).toBeUndefined()
    expect(whereArg.internalStatus).toEqual({ in: ['in_progress'] })
    await app.close()
  })
})

describe('GET /orders/:id', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  const fullOrder = {
    id: 'order-1',
    agencyId: 'agency-1',
    companyId: 'company-1',
    title: 'Land',
    description: 'desc',
    type: 'client_order',
    priority: 'high',
    internalStatus: 'in_progress',
    clientStatus: 'in_progress',
    billingType: 'fixed',
    fixedPrice: null,
    hourlyRate: null,
    estimatedHours: null,
    totalAmount: null,
    currency: 'USD',
    deadline: null,
    paidAt: null,
    deletedAt: null,
    onHoldReason: null,
    cancelledReason: null,
    createdAt: new Date('2026-05-31T00:00:00Z'),
    updatedAt: new Date('2026-05-31T00:00:00Z'),
    company: { id: 'company-1', name: 'Acme' },
    assignee: { id: 'exec-1', name: 'Olena' },
    stages: [{ id: 's1', title: 'Brief', description: null, status: 'done', position: 1 }],
  }

  it('client sees own order without internal fields', async () => {
    orderFindUnique.mockResolvedValue(fullOrder)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const o = res.json().data.order
    expect(o.id).toBe('order-1')
    expect(o.internalStatus).toBeUndefined()
    expect(o.assignee).toBeUndefined()
    expect(o.stages).toHaveLength(1)
    await app.close()
  })

  it('executor sees the full internal view', async () => {
    orderFindUnique.mockResolvedValue(fullOrder)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const o = res.json().data.order
    expect(o.internalStatus).toBe('in_progress')
    expect(o.assignee).toEqual({ id: 'exec-1', name: 'Olena' })
    await app.close()
  })

  it('404 for unknown / soft-deleted order', async () => {
    orderFindUnique.mockResolvedValue(null)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/nope',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('403 on cross-tenant access (different agency)', async () => {
    orderFindUnique.mockResolvedValue({ ...fullOrder, agencyId: 'agency-OTHER' })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('404 when a client requests another company order in the same tenant', async () => {
    orderFindUnique.mockResolvedValue({ ...fullOrder, companyId: 'company-OTHER' })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('PATCH /orders/:id/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
  })
  afterEach(() => vi.clearAllMocks())

  const base = {
    id: 'order-1',
    agencyId: 'agency-1',
    companyId: 'company-1',
    internalStatus: 'in_progress',
    deletedAt: null,
  }

  it('executor runs a valid transition + mirrors clientStatus', async () => {
    orderFindUnique.mockResolvedValue(base)
    orderUpdate.mockResolvedValue({
      id: 'order-1',
      internalStatus: 'review',
      clientStatus: 'pending_approval',
      onHoldReason: null,
      cancelledReason: null,
      updatedAt: new Date(),
    })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'review' },
    })
    expect(res.statusCode).toBe(200)
    expect(orderUpdate.mock.calls[0][0].data.clientStatus).toBe('pending_approval')
    await app.close()
  })

  it('409 on an invalid transition (in_progress → done)', async () => {
    orderFindUnique.mockResolvedValue(base)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'done' },
    })
    expect(res.statusCode).toBe(409)
    expect(orderUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('403 for a client who is not reopening as owner', async () => {
    orderFindUnique.mockResolvedValue(base)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'review' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('allows a company owner to reopen done → revision', async () => {
    orderFindUnique.mockResolvedValue({ ...base, internalStatus: 'done' })
    orderUpdate.mockResolvedValue({
      id: 'order-1',
      internalStatus: 'revision',
      clientStatus: 'in_progress',
      onHoldReason: null,
      cancelledReason: null,
      updatedAt: new Date(),
    })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'revision' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

describe('PATCH /orders/:id (edit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
  })
  afterEach(() => vi.clearAllMocks())

  const newOrder = {
    id: 'order-1',
    agencyId: 'agency-1',
    companyId: 'company-1',
    internalStatus: 'new',
    deletedAt: null,
  }

  it('executor edits title + billing field', async () => {
    orderFindUnique.mockResolvedValue({ ...newOrder, internalStatus: 'in_progress' })
    orderUpdate.mockResolvedValue({ id: 'order-1' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Renamed', fixedPrice: 500 },
    })
    expect(res.statusCode).toBe(200)
    expect(orderUpdate.mock.calls[0][0].data.fixedPrice).toBe(500)
    await app.close()
  })

  it('client edits title on a new order', async () => {
    orderFindUnique.mockResolvedValue(newOrder)
    orderUpdate.mockResolvedValue({ id: 'order-1' })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Client rename' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('client cannot edit once the order left `new` (403)', async () => {
    orderFindUnique.mockResolvedValue({ ...newOrder, internalStatus: 'in_progress' })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'too late' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('client cannot edit billing fields (403)', async () => {
    orderFindUnique.mockResolvedValue(newOrder)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { fixedPrice: 1 },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('DELETE /orders/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
  })
  afterEach(() => vi.clearAllMocks())

  const base = { id: 'order-1', agencyId: 'agency-1', deletedAt: null }

  it('executor soft-deletes the order', async () => {
    orderFindUnique.mockResolvedValue(base)
    orderUpdate.mockResolvedValue({ id: 'order-1' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(orderUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
    await app.close()
  })

  it('client cannot delete (403)', async () => {
    orderFindUnique.mockResolvedValue(base)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'DELETE',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('PATCH /orders/:id/assign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
  })
  afterEach(() => vi.clearAllMocks())

  const base = { id: 'order-1', agencyId: 'agency-1', deletedAt: null }

  it('executor assigns a valid agency member', async () => {
    orderFindUnique.mockResolvedValue(base)
    agencyMemberFindUnique.mockResolvedValue({ profileId: 'exec-2' })
    orderUpdate.mockResolvedValue({ id: 'order-1', assigneeId: 'exec-2', updatedAt: new Date() })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/assign',
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: '11111111-1111-4111-8111-111111111111' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('400 when the assignee is not an agency member', async () => {
    orderFindUnique.mockResolvedValue(base)
    agencyMemberFindUnique.mockResolvedValue(null)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/assign',
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: '11111111-1111-4111-8111-111111111111' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('executor can unassign (assigneeId = null)', async () => {
    orderFindUnique.mockResolvedValue(base)
    orderUpdate.mockResolvedValue({ id: 'order-1', assigneeId: null, updatedAt: new Date() })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/assign',
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: null },
    })
    expect(res.statusCode).toBe(200)
    expect(agencyMemberFindUnique).not.toHaveBeenCalled()
    await app.close()
  })

  it('client cannot assign (403)', async () => {
    orderFindUnique.mockResolvedValue(base)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/assign',
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: null },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('internal tasks (workspace-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
  })
  afterEach(() => vi.clearAllMocks())

  const order = { id: 'order-1', agencyId: 'agency-1', deletedAt: null }
  const ASSIGNEE = '11111111-1111-4111-8111-111111111111'

  describe('GET /orders/:orderId/tasks', () => {
    it('executor lists tasks ordered by position', async () => {
      orderFindUnique.mockResolvedValue(order)
      taskFindMany.mockResolvedValue([
        { id: 't1', title: 'A', status: 'todo', assigneeId: null, position: 0 },
      ])
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/tasks',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.tasks).toHaveLength(1)
      expect(taskFindMany.mock.calls[0][0].where.orderId).toBe('order-1')
      await app.close()
    })

    it('client is forbidden (403) — never sees internal tasks', async () => {
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/tasks',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
      expect(taskFindMany).not.toHaveBeenCalled()
      await app.close()
    })

    it('404 for an unknown order', async () => {
      orderFindUnique.mockResolvedValue(null)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/nope/tasks',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('403 cross-tenant (order in another agency)', async () => {
      orderFindUnique.mockResolvedValue({ ...order, agencyId: 'agency-OTHER' })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/tasks',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })
  })

  describe('POST /orders/:orderId/tasks', () => {
    it('executor creates a task with a valid assignee (201)', async () => {
      orderFindUnique.mockResolvedValue(order)
      agencyMemberFindUnique.mockResolvedValue({ profileId: ASSIGNEE })
      taskCreate.mockResolvedValue({ id: 't1', title: 'Build', status: 'todo', position: 1 })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/tasks',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Build', assigneeId: ASSIGNEE, position: 1 },
      })
      expect(res.statusCode).toBe(201)
      expect(taskCreate.mock.calls[0][0].data.assignee).toEqual({ connect: { id: ASSIGNEE } })
      await app.close()
    })

    it('executor creates an unassigned task (201, position defaults to 0)', async () => {
      orderFindUnique.mockResolvedValue(order)
      taskCreate.mockResolvedValue({ id: 't1', title: 'Build', status: 'todo', position: 0 })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/tasks',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Build' },
      })
      expect(res.statusCode).toBe(201)
      expect(agencyMemberFindUnique).not.toHaveBeenCalled()
      expect(taskCreate.mock.calls[0][0].data.position).toBe(0)
      await app.close()
    })

    it('400 when the assignee is not an agency member', async () => {
      orderFindUnique.mockResolvedValue(order)
      agencyMemberFindUnique.mockResolvedValue(null)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/tasks',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Build', assigneeId: ASSIGNEE },
      })
      expect(res.statusCode).toBe(400)
      expect(taskCreate).not.toHaveBeenCalled()
      await app.close()
    })

    it('client cannot create (403)', async () => {
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/tasks',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Build' },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('400 on an empty title (validation)', async () => {
      orderFindUnique.mockResolvedValue(order)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/tasks',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: '' },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('PATCH /orders/:orderId/tasks/:taskId', () => {
    it('executor updates status (200)', async () => {
      orderFindUnique.mockResolvedValue(order)
      taskFindUnique.mockResolvedValue({ id: 't1', orderId: 'order-1' })
      taskUpdate.mockResolvedValue({ id: 't1', title: 'A', status: 'done', position: 0 })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/order-1/tasks/t1',
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'done' },
      })
      expect(res.statusCode).toBe(200)
      expect(taskUpdate.mock.calls[0][0].data.status).toBe('done')
      await app.close()
    })

    it('unassign via assigneeId:null → disconnect', async () => {
      orderFindUnique.mockResolvedValue(order)
      taskFindUnique.mockResolvedValue({ id: 't1', orderId: 'order-1' })
      taskUpdate.mockResolvedValue({ id: 't1', title: 'A', status: 'todo', position: 0 })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/order-1/tasks/t1',
        headers: { authorization: `Bearer ${token}` },
        payload: { assigneeId: null },
      })
      expect(res.statusCode).toBe(200)
      expect(taskUpdate.mock.calls[0][0].data.assignee).toEqual({ disconnect: true })
      expect(agencyMemberFindUnique).not.toHaveBeenCalled()
      await app.close()
    })

    it('404 when the task belongs to a different order (IDOR guard)', async () => {
      orderFindUnique.mockResolvedValue(order)
      taskFindUnique.mockResolvedValue({ id: 't1', orderId: 'order-OTHER' })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/order-1/tasks/t1',
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'done' },
      })
      expect(res.statusCode).toBe(404)
      expect(taskUpdate).not.toHaveBeenCalled()
      await app.close()
    })

    it('client cannot update (403)', async () => {
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/order-1/tasks/t1',
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'done' },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })
  })

  describe('DELETE /orders/:orderId/tasks/:taskId', () => {
    it('executor deletes a task (200)', async () => {
      orderFindUnique.mockResolvedValue(order)
      taskFindUnique.mockResolvedValue({ id: 't1', orderId: 'order-1' })
      taskDelete.mockResolvedValue({ id: 't1' })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'DELETE',
        url: '/orders/order-1/tasks/t1',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(taskDelete).toHaveBeenCalledWith({ where: { id: 't1' } })
      await app.close()
    })

    it('client cannot delete (403)', async () => {
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'DELETE',
        url: '/orders/order-1/tasks/t1',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })
  })
})

describe('order comments + reads (chat)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
  })
  afterEach(() => vi.clearAllMocks())

  const order = { id: 'order-1', agencyId: 'agency-1', companyId: 'company-1', deletedAt: null }
  const rows = [
    {
      id: 'c2',
      content: 'second',
      isInternal: false,
      createdAt: new Date('2026-05-31T02:00:00Z'),
      editedAt: null,
      author: { id: 'p1', name: 'Ann' },
    },
    {
      id: 'c1',
      content: 'first',
      isInternal: false,
      createdAt: new Date('2026-05-31T01:00:00Z'),
      editedAt: null,
      author: { id: 'p1', name: 'Ann' },
    },
  ]

  describe('GET /orders/:id/comments', () => {
    it('executor sees all comments + unread meta (ascending order)', async () => {
      orderFindUnique.mockResolvedValue(order)
      commentFindMany.mockResolvedValue(rows)
      chatReadFindUnique.mockResolvedValue({ lastReadAt: new Date('2026-05-31T01:30:00Z') })
      commentCount.mockResolvedValue(1)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.comments.map((c: { id: string }) => c.id)).toEqual(['c1', 'c2']) // reversed → asc
      expect(data.meta.unreadCount).toBe(1)
      // executor where carries no isInternal restriction
      expect(commentFindMany.mock.calls[0][0].where.isInternal).toBeUndefined()
      await app.close()
    })

    it('client list is leak-guarded to public comments (where.isInternal=false)', async () => {
      orderFindUnique.mockResolvedValue(order)
      commentFindMany.mockResolvedValue(rows)
      chatReadFindUnique.mockResolvedValue(null)
      commentCount.mockResolvedValue(0)
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(commentFindMany.mock.calls[0][0].where.isInternal).toBe(false)
      expect(commentCount.mock.calls[0][0].where.isInternal).toBe(false)
      await app.close()
    })

    it('hasMore=true when more than `limit` rows exist', async () => {
      orderFindUnique.mockResolvedValue(order)
      // limit=1 → take=2 → returning 2 rows means there is an older page
      commentFindMany.mockResolvedValue(rows)
      chatReadFindUnique.mockResolvedValue(null)
      commentCount.mockResolvedValue(0)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/comments?limit=1',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.meta.hasMore).toBe(true)
      expect(data.comments).toHaveLength(1)
      await app.close()
    })

    it('404 when a client requests another company order', async () => {
      orderFindUnique.mockResolvedValue({ ...order, companyId: 'company-OTHER' })
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('403 cross-tenant', async () => {
      orderFindUnique.mockResolvedValue({ ...order, agencyId: 'agency-OTHER' })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('404 for an unknown order', async () => {
      orderFindUnique.mockResolvedValue(null)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/nope/comments',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('POST /orders/:id/comments', () => {
    it('executor posts an internal note (201, isInternal persisted)', async () => {
      orderFindUnique.mockResolvedValue(order)
      commentCreate.mockResolvedValue({ id: 'c1', content: 'note', isInternal: true })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'note', isInternal: true },
      })
      expect(res.statusCode).toBe(201)
      expect(commentCreate.mock.calls[0][0].data.isInternal).toBe(true)
      expect(commentCreate.mock.calls[0][0].data.agency).toEqual({ connect: { id: 'agency-1' } })
      await app.close()
    })

    it('client cannot author an internal note — flag is forced false', async () => {
      orderFindUnique.mockResolvedValue(order)
      commentCreate.mockResolvedValue({ id: 'c1', content: 'hi', isInternal: false })
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'hi', isInternal: true },
      })
      expect(res.statusCode).toBe(201)
      expect(commentCreate.mock.calls[0][0].data.isInternal).toBe(false)
      await app.close()
    })

    it('400 on empty content', async () => {
      orderFindUnique.mockResolvedValue(order)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '' },
      })
      expect(res.statusCode).toBe(400)
      expect(commentCreate).not.toHaveBeenCalled()
      await app.close()
    })

    it('404 when a client posts to another company order', async () => {
      orderFindUnique.mockResolvedValue({ ...order, companyId: 'company-OTHER' })
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'leak?' },
      })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('POST /orders/:id/comments/read', () => {
    it('marks the thread read (upsert lastReadAt)', async () => {
      orderFindUnique.mockResolvedValue(order)
      chatReadUpsert.mockResolvedValue({})
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments/read',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const arg = chatReadUpsert.mock.calls[0][0]
      expect(arg.where.orderId_profileId).toEqual({ orderId: 'order-1', profileId: 'profile-1' })
      expect(arg.create.lastReadAt).toBeInstanceOf(Date)
      await app.close()
    })

    it('404 for an unknown order', async () => {
      orderFindUnique.mockResolvedValue(null)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/nope/comments/read',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      expect(chatReadUpsert).not.toHaveBeenCalled()
      await app.close()
    })
  })
})
