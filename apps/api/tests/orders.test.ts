import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const orderCreate = vi.fn()
const orderCount = vi.fn()
const orderFindMany = vi.fn()
const auditLogCreate = vi.fn()
const transaction = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    order: { create: orderCreate, count: orderCount, findMany: orderFindMany },
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
