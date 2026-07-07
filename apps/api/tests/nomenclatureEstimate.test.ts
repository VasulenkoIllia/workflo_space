import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 02-Б: довідник номенклатури (owner CRUD) + кошторис замовлення (Σ → fixedPrice).
const db = {
  nomenclature: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  order: { findUnique: vi.fn(), update: vi.fn() },
  orderEstimateLine: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  service: { count: vi.fn() },
  agency: { findMany: vi.fn().mockResolvedValue([]) },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@workflo/db')>()
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  }
})
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { Prisma } = await import('@workflo/db')
const { buildApp } = await import('../src/app.js')

const dec = (n: number) => new Prisma.Decimal(n)

const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner',
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' }],
  memberships: [],
}
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' }],
}

async function authed(claims: object = OWNER) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.nomenclature.findMany.mockResolvedValue([])
  db.agency.findMany.mockResolvedValue([])
  db.twoFactorAuth.findUnique.mockResolvedValue(null)
  db.order.findUnique.mockResolvedValue({
    id: 'ord-1',
    agencyId: 'agency-1',
    deletedAt: null,
    approvalStatus: null,
  })
  db.orderEstimateLine.deleteMany.mockResolvedValue({ count: 0 })
  db.orderEstimateLine.createMany.mockResolvedValue({ count: 0 })
  db.orderEstimateLine.findMany.mockResolvedValue([])
  db.order.update.mockResolvedValue({})
  db.service.count.mockResolvedValue(0)
})
afterEach(() => vi.clearAllMocks())

describe('nomenclature CRUD (02-Б)', () => {
  it('POST creates (owner); duplicate → 409; executor → 403; GET lists for whole team', async () => {
    db.nomenclature.create.mockResolvedValue({
      id: 'n-1',
      name: 'Консультації з питань інформатизації',
      code: '62.02',
      vatRate: null,
      isActive: true,
      updatedAt: new Date(),
    })
    const { app, token } = await authed()
    const created = await app.inject({
      method: 'POST',
      url: '/workspace/nomenclature',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Консультації з питань інформатизації', code: '62.02' },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json().data.item.name).toContain('Консультації')

    db.nomenclature.create.mockRejectedValue(new Error('unique'))
    const dup = await app.inject({
      method: 'POST',
      url: '/workspace/nomenclature',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Консультації з питань інформатизації' },
    })
    expect(dup.statusCode).toBe(409)

    const etoken = app.jwt.sign(EXECUTOR)
    const denied = await app.inject({
      method: 'POST',
      url: '/workspace/nomenclature',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { name: 'Розробка ПЗ' },
    })
    expect(denied.statusCode).toBe(403)

    // читає і виконавець — селект в оцінці замовлення
    const list = await app.inject({
      method: 'GET',
      url: '/workspace/nomenclature',
      headers: { authorization: `Bearer ${etoken}` },
    })
    expect(list.statusCode).toBe(200)
    await app.close()
  })

  it('DELETE deactivates a referenced item, hard-deletes an unreferenced one', async () => {
    const { app, token } = await authed()
    db.nomenclature.findFirst.mockResolvedValue({
      id: 'n-1',
      _count: { orders: 2, projects: 0 },
    })
    db.nomenclature.update.mockResolvedValue({})
    const soft = await app.inject({
      method: 'DELETE',
      url: '/workspace/nomenclature/n-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(soft.json().data.outcome).toBe('deactivated')
    expect(db.nomenclature.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { isActive: false },
    })

    db.nomenclature.findFirst.mockResolvedValue({
      id: 'n-2',
      _count: { orders: 0, projects: 0 },
    })
    db.nomenclature.delete.mockResolvedValue({})
    const hard = await app.inject({
      method: 'DELETE',
      url: '/workspace/nomenclature/n-2',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(hard.json().data.outcome).toBe('deleted')
    await app.close()
  })
})

describe('order estimate (02-Б)', () => {
  it('PUT bulk-replaces lines and stamps Σ → fixedPrice/totalAmount (billingType fixed)', async () => {
    db.service.count.mockResolvedValue(1)
    db.orderEstimateLine.findMany.mockResolvedValue([
      {
        id: 'l1',
        serviceId: '22222222-2222-4222-8222-222222222222',
        name: 'Лендінг',
        qty: dec(1),
        unitPrice: dec(300),
        position: 0,
      },
      { id: 'l2', serviceId: null, name: 'Правки', qty: dec(2), unitPrice: dec(50), position: 1 },
    ])
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'PUT',
      url: '/orders/ord-1/estimate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        lines: [
          {
            serviceId: '22222222-2222-4222-8222-222222222222',
            name: 'Лендінг',
            qty: 1,
            unitPrice: 300,
          },
          { name: 'Правки', qty: 2, unitPrice: 50 },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.total).toBe('400.00')
    expect(db.orderEstimateLine.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'ord-1' } })
    const upd = db.order.update.mock.calls[0][0]
    expect(upd.data.billingType).toBe('fixed')
    expect(String(upd.data.fixedPrice)).toBe('400')
    await app.close()
  })

  it('PUT 409 while approval pending; unknown serviceId → 400; empty lines keep fixedPrice', async () => {
    const { app, token } = await authed()
    db.order.findUnique.mockResolvedValue({
      id: 'ord-1',
      agencyId: 'agency-1',
      deletedAt: null,
      approvalStatus: 'pending',
    })
    const locked = await app.inject({
      method: 'PUT',
      url: '/orders/ord-1/estimate',
      headers: { authorization: `Bearer ${token}` },
      payload: { lines: [{ name: 'X', qty: 1, unitPrice: 10 }] },
    })
    expect(locked.statusCode).toBe(409)

    db.order.findUnique.mockResolvedValue({
      id: 'ord-1',
      agencyId: 'agency-1',
      deletedAt: null,
      approvalStatus: null,
    })
    db.service.count.mockResolvedValue(0)
    const badSvc = await app.inject({
      method: 'PUT',
      url: '/orders/ord-1/estimate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        lines: [
          { serviceId: '11111111-1111-4111-8111-111111111111', name: 'X', qty: 1, unitPrice: 10 },
        ],
      },
    })
    expect(badSvc.statusCode).toBe(400)

    const empty = await app.inject({
      method: 'PUT',
      url: '/orders/ord-1/estimate',
      headers: { authorization: `Bearer ${token}` },
      payload: { lines: [] },
    })
    expect(empty.statusCode).toBe(200)
    expect(db.order.update).not.toHaveBeenCalled()
    await app.close()
  })
})
