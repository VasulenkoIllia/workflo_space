import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// DSN-7: реєстр клієнтів із реальними агрегатами по ВСІХ замовленнях; борг — лише з billing.view.
const db = {
  company: { findMany: vi.fn() },
  order: { groupBy: vi.fn() },
  $queryRaw: vi.fn(),
}
vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as { Prisma: unknown }
  return {
    prisma: db,
    Prisma: actual.Prisma,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  }
})
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const base = {
  email: 'x@e.com',
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  memberships: [],
}
const OWNER = {
  ...base,
  sub: 'owner-1',
  role: 'owner',
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' }],
}
const MANAGER = {
  ...base,
  sub: 'mgr-1',
  role: 'executor',
  agencyMemberships: [{ agencyId: 'agency-1', role: 'manager' }],
}

async function list(claims: object) {
  const app = buildApp()
  await app.ready()
  const res = await app.inject({
    method: 'GET',
    url: '/workspace/companies',
    headers: { authorization: `Bearer ${app.jwt.sign(claims as never)}` },
  })
  await app.close()
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
  db.company.findMany.mockResolvedValue([
    { id: 'c-1', name: 'Акме', slug: 'acme', loyaltyTier: 'regular', currency: 'USD' },
    { id: 'c-2', name: 'Бета', slug: 'beta', loyaltyTier: 'new', currency: 'USD' },
  ])
  const last = new Date('2026-09-01T00:00:00Z')
  db.order.groupBy
    .mockResolvedValueOnce([
      {
        companyId: 'c-1',
        _count: { _all: 150 },
        _sum: { totalAmount: 9000 },
        _max: { updatedAt: last },
      },
    ])
    .mockResolvedValueOnce([{ companyId: 'c-1', _count: { _all: 3 } }])
  db.$queryRaw.mockResolvedValue([{ companyId: 'c-1', debt: 1200 }])
})

describe('DSN-7 GET /workspace/companies — агрегати клієнтів', () => {
  it('власник: замовлень/активних/остання активність + сума й борг', async () => {
    const res = await list(OWNER)
    expect(res.statusCode).toBe(200)
    const [acme, beta] = res.json().data.companies
    expect(acme).toMatchObject({ ordersTotal: 150, ordersActive: 3, totalValue: 9000, debt: 1200 })
    expect(acme.lastActivityAt).toBe('2026-09-01T00:00:00.000Z')
    expect(beta).toMatchObject({ ordersTotal: 0, ordersActive: 0, debt: 0, lastActivityAt: null })
  })

  it('менеджер без billing.view: без сум і боргу, SQL боргу не виконується', async () => {
    const res = await list(MANAGER)
    expect(res.statusCode).toBe(200)
    const [acme] = res.json().data.companies
    expect(acme).toMatchObject({
      ordersTotal: 150,
      totalValue: null,
      debt: null,
      loyaltyTier: null,
    })
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })
})
