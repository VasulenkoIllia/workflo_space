import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// PERM-4: скоуп own/team з РЕАЛЬНИМИ дефолтами каталогу (без «широкої» фікстури сетапу):
// виконавець бачить лише свої замовлення, без сум; чуже — 404 (існування не світимо).
const orderCount = vi.fn()
const orderFindMany = vi.fn()
const orderFindUnique = vi.fn()
const db = {
  order: { count: orderCount, findMany: orderFindMany, findUnique: orderFindUnique },
  agencyMember: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn() },
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
const { fetchPermissionData } = await import('../src/auth/permissionStore.js')

const EXECUTOR = {
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor',
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' }],
  memberships: [],
}
const DEFAULTS = { leadTeamIds: [], teamId: null, roleRows: [], memberRows: [] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchPermissionData).mockResolvedValue(DEFAULTS) // дефолти каталогу
})

describe('PERM-4 скоуп замовлень виконавця (дефолт orders.view = own)', () => {
  it('GET /orders — фільтр «мої» (виконавець/співвиконавець/задача) + без сум', async () => {
    orderCount.mockResolvedValue(1)
    orderFindMany.mockResolvedValue([
      {
        id: 'o-1',
        title: 'Моє',
        internalStatus: 'in_progress',
        clientStatus: 'in_progress',
        priority: 'medium',
        deadline: null,
        totalAmount: '1000.00',
        companyId: 'c-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { stages: 0 },
        tags: [],
        assignee: { id: 'exec-1', name: 'E' },
        coAssignees: [],
      },
    ])
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { authorization: `Bearer ${app.jwt.sign(EXECUTOR as never)}` },
    })
    expect(res.statusCode).toBe(200)
    const where = orderFindMany.mock.calls[0][0].where
    expect(where.AND[0].OR).toEqual(
      expect.arrayContaining([
        { assigneeId: 'exec-1' },
        { coAssignees: { some: { profileId: 'exec-1' } } },
      ])
    )
    expect(res.json().data.orders[0].totalAmount).toBeNull()
    await app.close()
  })

  it('GET /orders/:id чужого замовлення → 404', async () => {
    orderFindUnique.mockResolvedValue({
      id: 'o-2',
      agencyId: 'agency-1',
      companyId: 'c-1',
      deletedAt: null,
    })
    orderCount.mockResolvedValue(0) // не покривається скоупом «мої»
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/orders/o-2',
      headers: { authorization: `Bearer ${app.jwt.sign(EXECUTOR as never)}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('коментарі чужого замовлення (під-ресурс через requireOrderParticipant) → 404', async () => {
    orderFindUnique.mockResolvedValue({
      id: 'o-2',
      agencyId: 'agency-1',
      companyId: 'c-1',
      deletedAt: null,
    })
    orderCount.mockResolvedValue(0)
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/orders/o-2/comments',
      headers: { authorization: `Bearer ${app.jwt.sign(EXECUTOR as never)}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('ліди виконавцю закриті (leads.manage) → 403', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leads',
      headers: { authorization: `Bearer ${app.jwt.sign(EXECUTOR as never)}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

// security-review 27.09: тімлід (orders.assign = team) не призначає на замовлення чужого
// підрозділу; роль береться з БД (пониження/видалення діє без чекання спливу токена).
describe('PERM-4 скоуп orders.assign тімліда + роль із БД', () => {
  const LEAD = { ...EXECUTOR, sub: 'lead-1' }
  const LEAD_DATA = { ...DEFAULTS, leadTeamIds: ['team-a'], teamId: 'team-a' }

  it.each([
    ['PATCH', '/orders/o-9/assign', { assigneeId: '00000000-0000-4000-8000-000000000002' }],
    ['PUT', '/orders/o-9/assignees', { profileIds: ['exec-2'] }],
  ])('%s %s на замовлення іншого підрозділу → 404', async (method, url, payload) => {
    vi.mocked(fetchPermissionData).mockResolvedValue(LEAD_DATA)
    orderFindUnique.mockResolvedValue({
      id: 'o-9',
      agencyId: 'agency-1',
      title: 'Чуже',
      assigneeId: 'exec-3',
      deletedAt: null,
    })
    orderCount.mockResolvedValue(0) // не в підрозділі team-a
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: method as 'PATCH' | 'PUT',
      url,
      payload,
      headers: { authorization: `Bearer ${app.jwt.sign(LEAD as never)}` },
    })
    await app.close()
    expect(res.statusCode).toBe(404)
    const where = orderCount.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain('team-a')
  })

  it('менеджера понижено до виконавця в БД — токен ще «manager», але ліди вже 403', async () => {
    vi.mocked(fetchPermissionData).mockResolvedValue({ ...DEFAULTS, role: 'executor' })
    const MANAGER = {
      ...EXECUTOR,
      sub: 'mgr-1',
      agencyMemberships: [{ agencyId: 'agency-1', role: 'manager' }],
    }
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leads',
      headers: { authorization: `Bearer ${app.jwt.sign(MANAGER as never)}` },
    })
    await app.close()
    expect(res.statusCode).toBe(403)
  })
})
