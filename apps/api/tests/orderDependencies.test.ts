import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// S10-03: залежності замовлень — CRUD + DFS cycle-guard + гейт старту роботи.
const db = {
  order: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  orderDependency: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  activityLog: { create: vi.fn() },
  outboxEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  orderExecutorSettlement: { findMany: vi.fn().mockResolvedValue([]) },
  timeLog: { groupBy: vi.fn().mockResolvedValue([]) },
  agencyMember: { findMany: vi.fn().mockResolvedValue([]) },
  // audit-M5: advisory-lock у create-транзакції залежностей
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
const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const A = '11111111-1111-4111-8111-aaaaaaaaaaaa'
const B = '22222222-2222-4222-8222-bbbbbbbbbbbb'
const C = '33333333-3333-4333-8333-cccccccccccc'

const orderRow = (id: string, over: Partial<Record<string, unknown>> = {}) => ({
  id,
  agencyId: AGENCY,
  companyId: 'company-1',
  deletedAt: null,
  ...over,
})

async function authed(claims: unknown = OWNER) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.auditLog.create.mockResolvedValue({})
  db.orderDependency.findMany.mockResolvedValue([])
  db.orderDependency.findFirst.mockResolvedValue(null)
  db.orderExecutorSettlement.findMany.mockResolvedValue([])
  db.timeLog.groupBy.mockResolvedValue([])
  db.agencyMember.findMany.mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

describe('POST /orders/:id/dependencies', () => {
  it('клієнт → 403; self-залежність → 400', async () => {
    db.order.findUnique.mockResolvedValue(orderRow(A))
    const { app, token } = await authed(CLIENT)
    const forbidden = await app.inject({
      method: 'POST',
      url: `/orders/${A}/dependencies`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dependsOnId: B },
    })
    expect(forbidden.statusCode).toBe(403)

    const { app: app2, token: token2 } = await authed()
    const self = await app2.inject({
      method: 'POST',
      url: `/orders/${A}/dependencies`,
      headers: { authorization: `Bearer ${token2}` },
      payload: { dependsOnId: A },
    })
    expect(self.statusCode).toBe(400)
    expect(db.orderDependency.create).not.toHaveBeenCalled()
    await app.close()
    await app2.close()
  })

  it('блокер з іншої агенції/видалений → 404; дублікат → 409', async () => {
    db.order.findUnique.mockResolvedValue(orderRow(A))
    db.order.findFirst.mockResolvedValueOnce(null) // блокер не знайдено в агенції
    const { app, token } = await authed()
    const miss = await app.inject({
      method: 'POST',
      url: `/orders/${A}/dependencies`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dependsOnId: B },
    })
    expect(miss.statusCode).toBe(404)

    db.order.findFirst.mockResolvedValue({ id: B, title: 'B', internalStatus: 'in_progress' })
    db.orderDependency.findFirst.mockResolvedValueOnce({ id: 'dup' })
    const dup = await app.inject({
      method: 'POST',
      url: `/orders/${A}/dependencies`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dependsOnId: B },
    })
    expect(dup.statusCode).toBe(409)
    await app.close()
  })

  it('цикл A→B→C→A → 409 dependency_cycle; ациклічна створюється', async () => {
    db.order.findUnique.mockResolvedValue(orderRow(A))
    db.order.findFirst.mockResolvedValue({ id: B, title: 'B', internalStatus: 'todo' })
    // DFS від B: B залежить від C, C залежить від A → цикл
    db.orderDependency.findMany
      .mockResolvedValueOnce([{ dependsOnId: C }]) // frontier [B] → C
      .mockResolvedValueOnce([{ dependsOnId: A }]) // frontier [C] → A (target!)
    const { app, token } = await authed()
    const cycle = await app.inject({
      method: 'POST',
      url: `/orders/${A}/dependencies`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dependsOnId: B },
    })
    expect(cycle.statusCode).toBe(409)
    expect(cycle.json().error.message).toContain('dependency_cycle')
    expect(db.orderDependency.create).not.toHaveBeenCalled()

    // без циклу: B ні від кого не залежить
    db.orderDependency.findMany.mockResolvedValue([])
    db.orderDependency.create.mockResolvedValue({
      id: 'dep-1',
      dependsOn: { id: B, title: 'B', internalStatus: 'todo' },
      createdAt: new Date(),
    })
    const ok = await app.inject({
      method: 'POST',
      url: `/orders/${A}/dependencies`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dependsOnId: B },
    })
    expect(ok.statusCode).toBe(201)
    await app.close()
  })
})

describe('DELETE /orders/:id/dependencies/:depId', () => {
  it('видаляє свою; чужа/неіснуюча → 404', async () => {
    db.order.findUnique.mockResolvedValue(orderRow(A))
    db.orderDependency.deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    const { app, token } = await authed()
    const ok = await app.inject({
      method: 'DELETE',
      url: `/orders/${A}/dependencies/dep-1`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(ok.statusCode).toBe(200)
    const miss = await app.inject({
      method: 'DELETE',
      url: `/orders/${A}/dependencies/dep-2`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(miss.statusCode).toBe(404)
    await app.close()
  })
})

describe('PATCH /orders/:id/status — гейт блокерів (S10-03)', () => {
  const transitionRow = (over: Partial<Record<string, unknown>> = {}) => ({
    id: A,
    agencyId: AGENCY,
    companyId: null, // без компанії → договір-гейт не чіпає
    title: 'A',
    internalStatus: 'new',
    requiresApproval: false,
    approvalStatus: null,
    deletedAt: null,
    assigneeId: null,
    submittedById: null,
    acceptedAt: null,
    coAssignees: [],
    project: null,
    company: null,
    ...over,
  })

  it('живий блокер → 409 з назвою; done/cancelled блокери не блокують', async () => {
    db.order.findUnique.mockResolvedValue(transitionRow())
    db.orderDependency.findMany.mockResolvedValueOnce([{ dependsOn: { title: 'Блокер Б' } }])
    const { app, token } = await authed()
    const blocked = await app.inject({
      method: 'PATCH',
      url: `/orders/${A}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_progress' },
    })
    expect(blocked.statusCode).toBe(409)
    expect(blocked.json().error.message).toContain('Блокер Б')
    expect(db.order.updateMany).not.toHaveBeenCalled()

    // блокери погашені → перехід проходить
    db.orderDependency.findMany.mockResolvedValue([])
    db.order.updateMany.mockResolvedValue({ count: 1 })
    db.order.findUniqueOrThrow.mockResolvedValue({
      id: A,
      internalStatus: 'in_progress',
      clientStatus: 'in_progress',
      onHoldReason: null,
      cancelledReason: null,
      updatedAt: new Date(),
    })
    db.activityLog.create.mockResolvedValue({})
    db.outboxEvent.create.mockResolvedValue({})
    const ok = await app.inject({
      method: 'PATCH',
      url: `/orders/${A}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_progress' },
    })
    expect(ok.statusCode).toBe(200)
    await app.close()
  })

  it('audit-H1: гейт блокерів виключає soft-deleted блокери (deletedAt=null у запиті)', async () => {
    db.order.findUnique.mockResolvedValue(transitionRow())
    db.orderDependency.findMany.mockResolvedValue([]) // жодного живого блокера
    db.order.updateMany.mockResolvedValue({ count: 1 })
    db.order.findUniqueOrThrow.mockResolvedValue({
      id: A,
      internalStatus: 'in_progress',
      clientStatus: 'in_progress',
      onHoldReason: null,
      cancelledReason: null,
      updatedAt: new Date(),
    })
    db.activityLog.create.mockResolvedValue({})
    db.outboxEvent.create.mockResolvedValue({})
    const { app, token } = await authed()
    await app.inject({
      method: 'PATCH',
      url: `/orders/${A}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_progress' },
    })
    // Запит живих блокерів має вимагати НЕ видалених (інакше видалений in_progress
    // блокер дедлочив би залежне назавжди).
    const gateCall = db.orderDependency.findMany.mock.calls.find(
      (c) => (c[0] as { where?: { orderId?: unknown } })?.where?.orderId === A
    )
    expect(gateCall?.[0].where.dependsOn).toMatchObject({ deletedAt: null })
    await app.close()
  })
})
