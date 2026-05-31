import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const orderCreate = vi.fn()
const orderCount = vi.fn()
const orderFindMany = vi.fn()
const orderFindUnique = vi.fn()
const orderUpdate = vi.fn()
const auditLogCreate = vi.fn()
const transaction = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    order: {
      create: orderCreate,
      count: orderCount,
      findMany: orderFindMany,
      findUnique: orderFindUnique,
      update: orderUpdate,
    },
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
