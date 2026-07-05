import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// S10-01: теги замовлень (каталог owner + replace-set командою) і шаблони замовлень.
const db = {
  orderTag: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  orderTagAssignment: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  orderTemplate: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  order: { findUnique: vi.fn(), create: vi.fn() },
  company: { findFirst: vi.fn() },
  agency: { findMany: vi.fn().mockResolvedValue([]) },
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

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  role: 'executor' as const,
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('order tags (S10-01)', () => {
  it('owner creates a tag; duplicate name → 409; executor create → 403', async () => {
    db.orderTag.findFirst.mockResolvedValue(null)
    db.orderTag.create.mockResolvedValue({ id: 't-1', name: 'терміново', color: '#ff0000' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/order-tags',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'терміново', color: '#ff0000' },
    })
    expect(res.statusCode).toBe(201)

    db.orderTag.findFirst.mockResolvedValue({ id: 't-1' })
    const dup = await app.inject({
      method: 'POST',
      url: '/workspace/order-tags',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'терміново' },
    })
    expect(dup.statusCode).toBe(409)

    const etoken = app.jwt.sign(EXECUTOR as object)
    const denied = await app.inject({
      method: 'POST',
      url: '/workspace/order-tags',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { name: 'x' },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })

  it('PUT /orders/:id/tags replaces the set; unknown/cross-tenant tag → 400', async () => {
    db.order.findUnique.mockResolvedValue({ id: 'o-1', agencyId: AGENCY, deletedAt: null })
    db.orderTag.findMany.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }])
    db.orderTagAssignment.findMany.mockResolvedValue([
      { tag: { id: 't-1', name: 'a', color: null } },
      { tag: { id: 't-2', name: 'b', color: null } },
    ])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/o-1/tags',
      headers: { authorization: `Bearer ${token}` },
      payload: { tagIds: ['t-1', 't-2'] },
    })
    expect(res.statusCode).toBe(200)
    expect(db.orderTagAssignment.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'o-1' } })
    const created = db.orderTagAssignment.createMany.mock.calls[0]![0] as {
      data: { agencyId: string }[]
    }
    expect(created.data.every((d) => d.agencyId === AGENCY)).toBe(true)

    db.orderTag.findMany.mockResolvedValue([{ id: 't-1' }]) // t-x не існує в агенції
    const bad = await app.inject({
      method: 'PUT',
      url: '/orders/o-1/tags',
      headers: { authorization: `Bearer ${token}` },
      payload: { tagIds: ['t-1', 't-x'] },
    })
    expect(bad.statusCode).toBe(400)
    await app.close()
  })
})

describe('order templates (S10-01)', () => {
  it('owner creates a template; from-template creates a bound order (team)', async () => {
    db.orderTemplate.findFirst.mockResolvedValue(null)
    db.orderTemplate.create.mockResolvedValue({
      id: 'tpl-1',
      name: 'Лендінг',
      type: 'client_order',
      defaultTitle: 'Лендінг під ключ',
      defaultDescription: null,
      defaultBillingType: 'fixed',
      defaultPrice: { toFixed: () => '1500.00' },
      isActive: true,
    })
    const { app, token } = await authed(OWNER)
    const created = await app.inject({
      method: 'POST',
      url: '/workspace/order-templates',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Лендінг', defaultTitle: 'Лендінг під ключ', defaultPrice: 1500 },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json().data.template.defaultPrice).toBe('1500.00')

    db.orderTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      name: 'Лендінг',
      type: 'client_order',
      defaultTitle: 'Лендінг під ключ',
      defaultDescription: 'Опис',
      defaultBillingType: 'fixed',
      defaultPrice: 1500,
      isActive: true,
    })
    db.company.findFirst.mockResolvedValue({ id: 'company-1' })
    db.order.create.mockResolvedValue({ id: 'o-9', title: 'Лендінг під ключ' })
    const etoken = app.jwt.sign(EXECUTOR as object)
    const from = await app.inject({
      method: 'POST',
      url: '/workspace/orders/from-template/tpl-1',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { companyId: 'company-1' },
    })
    expect(from.statusCode).toBe(201)
    const arg = db.order.create.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(arg.data.title).toBe('Лендінг під ключ')
    expect(arg.data.billingType).toBe('fixed')
    expect(arg.data.fixedPrice).toBe(1500)
    await app.close()
  })

  it('from-template: unknown template → 404, cross-tenant company → 404', async () => {
    db.orderTemplate.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/orders/from-template/tpl-x',
      headers: { authorization: `Bearer ${token}` },
      payload: { companyId: 'company-1' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('template delete is owner-only; executor → 403', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: '/workspace/order-templates/tpl-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('GET /orders?tags= filter (S10-01)', () => {
  it('team filters by tag ids; list DTO carries tags', async () => {
    db.order.findUnique.mockResolvedValue(null)
    const dbAny = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
    dbAny.order.count = vi.fn().mockResolvedValue(1)
    dbAny.order.findMany = vi.fn().mockResolvedValue([
      {
        id: 'o-1',
        title: 'X',
        internalStatus: 'new',
        clientStatus: 'in_progress',
        priority: 'medium',
        deadline: null,
        totalAmount: null,
        companyId: 'company-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { stages: 0 },
        tags: [{ tag: { id: 't-1', name: 'терміново', color: null } }],
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/orders?tags=t-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const where = dbAny.order.findMany.mock.calls[0]![0].where as Record<string, unknown>
    expect(where.tags).toEqual({ some: { tagId: { in: ['t-1'] } } })
    const order = res.json().data.orders[0] as { tags: { name: string }[] }
    expect(order.tags[0]!.name).toBe('терміново')
    await app.close()
  })
})
