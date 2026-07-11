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
const teamColumnFindFirst = vi.fn() // TASK-COLUMNS: мірор колонка→статус
const taskDelete = vi.fn()
const commentFindMany = vi.fn()
const commentCount = vi.fn()
const commentCreate = vi.fn()
// 03-чат (03.07): create → findUniqueOrThrow(full row); reply-гард findFirst; лінк вкладень.
const commentFindUniqueOrThrow = vi.fn()
const commentFindFirst = vi.fn()
const fileUpdateMany = vi.fn()
const chatReadFindUnique = vi.fn()
const chatReadUpsert = vi.fn()
const timeLogFindMany = vi.fn()
const timeLogCreate = vi.fn()
const timeLogFindUnique = vi.fn()
const timeLogUpdate = vi.fn()
const timeLogDelete = vi.fn()
const activityCreate = vi.fn()
const activityFindMany = vi.fn()
const outboxCreate = vi.fn()
const payoutFindUnique = vi.fn() // S5-04 time-log lock; default → null (unlocked)
// AR-13: guarded transition (updateMany WHERE internalStatus=from) + re-read.
const orderUpdateMany = vi.fn()
const orderFindUniqueOrThrow = vi.fn()

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as { Prisma: unknown }
  const prisma = {
    // S10-03: гейт блокерів у transition читає залежності (порожньо = не заблоковано)
    orderDependency: { findMany: vi.fn().mockResolvedValue([]) },
    order: {
      create: orderCreate,
      count: orderCount,
      findMany: orderFindMany,
      findUnique: orderFindUnique,
      update: orderUpdate,
      // S10-02: firstRespondedAt-хук першого публічного коментаря команди
      updateMany: orderUpdateMany,
    },
    // S10-02: штампування SLA-дедлайнів при створенні (null = політики нема)
    slaPolicy: { findFirst: vi.fn().mockResolvedValue(null) },
    teamColumn: { findFirst: teamColumnFindFirst },
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
      findUniqueOrThrow: commentFindUniqueOrThrow,
      findFirst: commentFindFirst,
    },
    orderFile: { updateMany: fileUpdateMany },
    orderChatRead: {
      findUnique: chatReadFindUnique,
      upsert: chatReadUpsert,
      // S10 read receipts: the list also loads OTHER participants' markers.
      findMany: vi.fn().mockResolvedValue([]),
    },
    // S10: mark-read publishes the reader's name to the live bus.
    // ПРИЙМАННЯ money-loop: getOrder резолвить імена причетних задачами (findMany).
    profile: {
      findUnique: vi.fn().mockResolvedValue({ name: 'Тест' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    timeLog: {
      findMany: timeLogFindMany,
      create: timeLogCreate,
      findUnique: timeLogFindUnique,
      update: timeLogUpdate,
      delete: timeLogDelete,
      // ПРИЙМАННЯ: getOrder агрегує факт по-виконавцях
      groupBy: vi.fn().mockResolvedValue([]),
    },
    orderExecutorSettlement: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      upsert: vi.fn(),
    },
    activityLog: { create: activityCreate, findMany: activityFindMany },
    // P-5 rate snapshot on time-log create — default to «no rate set» (tier 5).
    project: { findUnique: () => Promise.resolve(null) },
    projectExecutorRate: { findUnique: () => Promise.resolve(null) },
    executorRate: { findFirst: () => Promise.resolve(null) },
    exchangeRate: { findUnique: () => Promise.resolve(null) },
    // S5-04 time-log lock: defaults to null (unlocked); overridden per-test.
    executorPayout: { findUnique: payoutFindUnique },
    outboxEvent: { create: outboxCreate },
    agencyMember: {
      findUnique: agencyMemberFindUnique,
      // ПРИЙМАННЯ: submit-нотифікація шле власникам/тімлідам
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: { create: auditLogCreate },
    $transaction: transaction,
  }
  return {
    prisma,
    tenantTransaction: (client: { $transaction: (fn: unknown) => unknown }, fn: unknown) =>
      client.$transaction(fn),
    // Reads/single writes are wrapped in withTenant() (RLS seam); run the callback
    // against the same mocked client so the route's tx.* calls hit these mocks.
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
    Prisma: actual.Prisma,
  }
})

/** Interactive-tx ($transaction(cb)) → call cb with a tx routed to our mocks;
 *  array form ($transaction([...])) → Promise.all. */
function txImpl(arg: unknown) {
  if (typeof arg === 'function') {
    return (arg as (tx: unknown) => unknown)({
      order: {
        update: orderUpdate,
        updateMany: orderUpdateMany,
        findUniqueOrThrow: orderFindUniqueOrThrow,
      },
      activityLog: { create: activityCreate },
      outboxEvent: { create: outboxCreate },
      // ПРИЙМАННЯ: матеріалізація дефолтних settlements на done
      orderExecutorSettlement: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      timeLog: { groupBy: vi.fn().mockResolvedValue([]) },
    })
  }
  return Promise.all(arg as Promise<unknown>[])
}

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
// Agency OWNER: Profile.role='owner' but an agency member → internal team
// (regression for audit C-2: owner must NOT be locked out of team features).
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' as const }],
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
    // findUniqueOrThrow віддає повний рядок створеного коментаря (echo create-мока).
    commentFindUniqueOrThrow.mockImplementation(async () => {
      const created = await commentCreate.mock.results.at(-1)?.value
      return { replyTo: null, attachments: [], ...created }
    })
    commentFindFirst.mockResolvedValue({ id: 'parent-1' })
    fileUpdateMany.mockResolvedValue({ count: 0 })
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
    transaction.mockImplementation(txImpl)
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
    // S10-01: list-select тепер тягне теги
    tags: [] as { tag: { id: string; name: string; color: string | null } }[],
    // мультивиконавці: list-select тягне головного + співвиконавців
    assignee: null as { id: string; name: string } | null,
    coAssignees: [] as { profile: { id: string; name: string } }[],
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
    // S10-01: getOrder-select тепер тягне теги
    tags: [] as { tag: { id: string; name: string; color: string | null } }[],
    // мультивиконавці: getOrder-select тягне співвиконавців
    coAssignees: [] as { profile: { id: string; name: string } }[],
    // ПРИЙМАННЯ: acceptance-поля
    submittedAt: null,
    acceptedAt: null,
    billableHours: null,
    submittedBy: null,
    acceptedBy: null,
    settlements: [] as {
      profileId: string
      payableHours: unknown
      profile: { id: string; name: string }
    }[],
    // ПРИЙМАННЯ money-loop: ростер звірки тягне і причетних задачами
    internalTasks: [] as { assigneeId: string | null; coAssignees: { profileId: string }[] }[],
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

  it('acceptance roster includes co-executors + task performers with no logged time', async () => {
    // Money-loop: owner має бачити у звірці ВСІХ причетних — співвиконавця замовлення (без факту)
    // + виконавців задач замовлення — щоб розподілити оплату, а не лише тих, хто бив час.
    orderFindUnique.mockResolvedValue({
      ...fullOrder,
      assignee: { id: 'exec-1', name: 'Olena' },
      coAssignees: [{ profile: { id: 'exec-2', name: 'Bohdan' } }],
      internalTasks: [{ assigneeId: 'exec-3', coAssignees: [{ profileId: 'exec-4' }] }],
    })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const execs = res.json().data.order.acceptance.executors as {
      profileId: string
      trackedHours: number
      payableHours: number
    }[]
    expect(execs.map((e) => e.profileId)).toEqual(
      expect.arrayContaining(['exec-1', 'exec-2', 'exec-3', 'exec-4'])
    )
    // ніхто не бив час → факт 0 у всіх (але вони в ростері для розподілу)
    expect(execs.every((e) => e.trackedHours === 0 && e.payableHours === 0)).toBe(true)
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
    activityCreate.mockResolvedValue({})
    outboxCreate.mockResolvedValue({})
    transaction.mockImplementation(txImpl)
  })
  afterEach(() => vi.clearAllMocks())

  const base = {
    id: 'order-1',
    agencyId: 'agency-1',
    companyId: 'company-1',
    title: 'Order',
    internalStatus: 'in_progress',
    deletedAt: null,
    // ПРИЙМАННЯ: нотифікації читають виконавців + submittedBy
    assigneeId: null,
    submittedById: null,
    coAssignees: [] as { profileId: string }[],
  }

  it('executor runs a valid transition + mirrors clientStatus', async () => {
    orderFindUnique.mockResolvedValue(base)
    orderUpdateMany.mockResolvedValue({ count: 1 })
    orderFindUniqueOrThrow.mockResolvedValue({
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
    expect(orderUpdateMany.mock.calls[0][0].data.clientStatus).toBe('pending_approval')
    // AR-13: the write re-asserts the from-state inside WHERE (TOCTOU guard)
    expect(orderUpdateMany.mock.calls[0][0].where.internalStatus).toBe('in_progress')
    // S2-13: same tx writes an activity row + enqueues a notify outbox event
    expect(activityCreate.mock.calls[0][0].data.action).toBe('status_changed')
    expect(outboxCreate.mock.calls[0][0].data.type).toBe('order.status_changed')
    await app.close()
  })

  it('409 when the order moved concurrently (AR-13 TOCTOU guard, no activity/outbox)', async () => {
    orderFindUnique.mockResolvedValue(base)
    // Another transition won the race → guarded WHERE matches zero rows.
    orderUpdateMany.mockResolvedValue({ count: 0 })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'review' },
    })
    expect(res.statusCode).toBe(409)
    expect(activityCreate).not.toHaveBeenCalled()
    expect(outboxCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('does not write activity/outbox on an invalid transition', async () => {
    orderFindUnique.mockResolvedValue(base)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'done' },
    })
    expect(res.statusCode).toBe(409)
    expect(activityCreate).not.toHaveBeenCalled()
    expect(outboxCreate).not.toHaveBeenCalled()
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
    expect(orderUpdateMany).not.toHaveBeenCalled()
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
    orderUpdateMany.mockResolvedValue({ count: 1 })
    orderFindUniqueOrThrow.mockResolvedValue({
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

  // ПРИЙМАННЯ РОБОТИ: гейт ролей — приймати (→done) може лише owner/manager.
  it('executor CANNOT accept (review → done) — 403', async () => {
    orderFindUnique.mockResolvedValue({ ...base, internalStatus: 'review' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'done' },
    })
    expect(res.statusCode).toBe(403)
    expect(orderUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('owner accepts (review → done) → 200 + materializes default settlements', async () => {
    orderFindUnique.mockResolvedValue({ ...base, internalStatus: 'review' })
    orderUpdateMany.mockResolvedValue({ count: 1 })
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      internalStatus: 'done',
      clientStatus: 'completed',
      onHoldReason: null,
      cancelledReason: null,
      updatedAt: new Date(),
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'done' },
    })
    expect(res.statusCode).toBe(200)
    // штампуємо acceptedById у data
    expect(orderUpdateMany.mock.calls[0][0].data.acceptedById).toBe('owner-1')
    await app.close()
  })

  // CRIT-1 (аудит 08.07): повторне приймання (reopen→знову done) НЕ перештамповує acceptedAt —
  // інакше payout-якір переповз би у новий місяць і ті самі години нарахувались би вдруге.
  it('re-accept keeps original acceptedAt (set-once, no double-pay)', async () => {
    const firstAccept = new Date('2026-01-15T10:00:00Z')
    orderFindUnique.mockResolvedValue({
      ...base,
      internalStatus: 'review',
      acceptedAt: firstAccept, // вже приймали раніше
    })
    orderUpdateMany.mockResolvedValue({ count: 1 })
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      internalStatus: 'done',
      clientStatus: 'completed',
      onHoldReason: null,
      cancelledReason: null,
      updatedAt: new Date(),
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'done' },
    })
    expect(res.statusCode).toBe(200)
    // acceptedAt/acceptedById НЕ у data (не перезаписуємо перше приймання)
    expect(orderUpdateMany.mock.calls[0][0].data.acceptedAt).toBeUndefined()
    expect(orderUpdateMany.mock.calls[0][0].data.acceptedById).toBeUndefined()
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
        { id: 't1', title: 'A', status: 'todo', assigneeId: null, position: 0, coAssignees: [] },
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

    it('agency OWNER is internal team — can list tasks (regression: audit C-2)', async () => {
      orderFindUnique.mockResolvedValue(order)
      taskFindMany.mockResolvedValue([])
      const { app, token } = await authed(OWNER)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/tasks',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200) // was 403 before isInternalTeam() fix
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
      taskCreate.mockResolvedValue({
        id: 't1',
        title: 'Build',
        status: 'todo',
        position: 1,
        coAssignees: [],
      })
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
      taskCreate.mockResolvedValue({
        id: 't1',
        title: 'Build',
        status: 'todo',
        position: 0,
        coAssignees: [],
      })
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
      taskUpdate.mockResolvedValue({
        id: 't1',
        title: 'A',
        status: 'done',
        position: 0,
        coAssignees: [],
      })
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

    // TASK-COLUMNS МАПІНГ: drag у кастомну колонку дзеркалить status=kind + team
    it('columnId → сервер дзеркалить status=column.kind і team=column.team', async () => {
      orderFindUnique.mockResolvedValue({ id: 'order-1', agencyId: 'agency-1', deletedAt: null })
      taskFindUnique.mockResolvedValue({ id: 't1', orderId: 'order-1' })
      teamColumnFindFirst.mockResolvedValue({
        id: '55555555-5555-4555-8555-555555555555',
        kind: 'in_progress',
        teamId: 'team-1',
      })
      taskUpdate.mockResolvedValue({
        id: 't1',
        title: 'A',
        status: 'in_progress',
        assigneeId: null,
        position: 0,
        coAssignees: [],
      })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/order-1/tasks/t1',
        headers: { authorization: `Bearer ${token}` },
        payload: { columnId: '55555555-5555-4555-8555-555555555555' },
      })
      expect(res.statusCode).toBe(200)
      const data = taskUpdate.mock.calls[0][0].data
      expect(data.status).toBe('in_progress') // дзеркало kind
      expect(data.team).toEqual({ connect: { id: 'team-1' } }) // колонка тягне команду
      expect(data.column).toEqual({ connect: { id: '55555555-5555-4555-8555-555555555555' } })
      await app.close()
    })

    it('прямий рух статусу знімає задачу з колонки ІНШОГО kind (без брехні колонки)', async () => {
      orderFindUnique.mockResolvedValue({ id: 'order-1', agencyId: 'agency-1', deletedAt: null })
      // 1-й виклик: loadTaskOfOrder; 2-й: перевірка kind поточної колонки
      taskFindUnique.mockResolvedValue({
        id: 't1',
        orderId: 'order-1',
        column: { kind: 'in_progress' },
      })
      taskUpdate.mockResolvedValue({
        id: 't1',
        title: 'A',
        status: 'done',
        assigneeId: null,
        position: 0,
        coAssignees: [],
      })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/order-1/tasks/t1',
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'done' },
      })
      expect(res.statusCode).toBe(200)
      const data = taskUpdate.mock.calls[0][0].data
      expect(data.status).toBe('done')
      expect(data.column).toEqual({ disconnect: true }) // колонка in_progress ≠ done → зняли
      await app.close()
    })

    it('unassign via assigneeId:null → disconnect', async () => {
      orderFindUnique.mockResolvedValue(order)
      taskFindUnique.mockResolvedValue({ id: 't1', orderId: 'order-1' })
      taskUpdate.mockResolvedValue({
        id: 't1',
        title: 'A',
        status: 'todo',
        position: 0,
        coAssignees: [],
      })
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

    it('reply: клієнт НЕ може відповісти на internal-нотатку (гард findFirst → 400)', async () => {
      orderFindUnique.mockResolvedValue(order)
      commentFindFirst.mockResolvedValue(null) // гард не знайшов доступного оригіналу
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'reply', replyToId: '11111111-1111-4111-8111-111111111111' },
      })
      expect(res.statusCode).toBe(400)
      expect(commentCreate).not.toHaveBeenCalled()
      // клієнтський гард шукає лише публічні повідомлення цього замовлення
      expect(commentFindFirst.mock.calls[0][0].where).toMatchObject({
        orderId: 'order-1',
        deletedAt: null,
        isInternal: false,
      })
      await app.close()
    })

    it('reply: валідний оригінал конектиться у replyTo', async () => {
      orderFindUnique.mockResolvedValue(order)
      commentFindFirst.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' })
      commentCreate.mockResolvedValue({ id: 'c2', content: 'reply', isInternal: false })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'reply', replyToId: '11111111-1111-4111-8111-111111111111' },
      })
      expect(res.statusCode).toBe(201)
      expect(commentCreate.mock.calls[0][0].data.replyTo).toEqual({
        connect: { id: '11111111-1111-4111-8111-111111111111' },
      })
      await app.close()
    })

    it('вкладення: fileIds лінкуються з гардами (своє замовлення, ще не привʼязані)', async () => {
      orderFindUnique.mockResolvedValue(order)
      commentCreate.mockResolvedValue({ id: 'c3', content: '', isInternal: false })
      fileUpdateMany.mockResolvedValue({ count: 2 })
      const fileA = '22222222-2222-4222-8222-222222222222'
      const fileB = '33333333-3333-4333-8333-333333333333'
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '', fileIds: [fileA, fileB] }, // attachment-only допустимо
      })
      expect(res.statusCode).toBe(201)
      expect(fileUpdateMany.mock.calls[0][0]).toMatchObject({
        where: {
          id: { in: [fileA, fileB] },
          orderId: 'order-1',
          commentId: null,
          deletedAt: null,
        },
        data: { commentId: 'c3' },
      })
      await app.close()
    })

    it('вкладення: чужий/зайнятий файл → count-мismatch → 400', async () => {
      orderFindUnique.mockResolvedValue(order)
      commentCreate.mockResolvedValue({ id: 'c4', content: 'x', isInternal: false })
      fileUpdateMany.mockResolvedValue({ count: 0 }) // гард відсіяв
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'x', fileIds: ['44444444-4444-4444-8444-444444444444'] },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('порожній текст БЕЗ вкладень → 400 (refine)', async () => {
      orderFindUnique.mockResolvedValue(order)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '   ' },
      })
      expect(res.statusCode).toBe(400)
      expect(commentCreate).not.toHaveBeenCalled()
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

  // SSE stream: only the access-guard paths are inject-testable (they return
  // before the socket is hijacked). The live fan-out is covered by chatBus.test.ts.
  describe('GET /orders/:id/comments/stream (guard)', () => {
    it('401 without a token', async () => {
      const app = buildApp()
      await app.ready()
      const res = await app.inject({ method: 'GET', url: '/orders/order-1/comments/stream' })
      expect(res.statusCode).toBe(401)
      await app.close()
    })

    it('404 for an unknown order (guard runs before hijack)', async () => {
      orderFindUnique.mockResolvedValue(null)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/nope/comments/stream',
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
        url: '/orders/order-1/comments/stream',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })
  })
})

describe('time logs (workspace-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
    payoutFindUnique.mockResolvedValue(null) // unlocked by default (clearAllMocks keeps impls)
  })
  afterEach(() => vi.clearAllMocks())

  const order = { id: 'order-1', agencyId: 'agency-1', deletedAt: null }
  const row = {
    id: 'tl1',
    hours: 2.5,
    date: new Date('2026-05-31T00:00:00Z'),
    comment: 'work',
    executorId: 'exec-1',
    createdAt: new Date('2026-05-31T10:00:00Z'),
  }

  describe('POST /orders/:orderId/time-logs', () => {
    it('executor logs time → 201 (tenant + self stamped, date serialized)', async () => {
      orderFindUnique.mockResolvedValue(order)
      timeLogCreate.mockResolvedValue(row)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/time-logs',
        headers: { authorization: `Bearer ${token}` },
        payload: { hours: 2.5, date: '2026-05-31', comment: 'work' },
      })
      expect(res.statusCode).toBe(201)
      const data = timeLogCreate.mock.calls[0][0].data
      expect(data.agency).toEqual({ connect: { id: 'agency-1' } })
      expect(data.executor).toEqual({ connect: { id: 'exec-1' } })
      expect(res.json().data.log.date).toBe('2026-05-31')
      expect(res.json().data.log.hours).toBe(2.5)
      await app.close()
    })

    it('client cannot log time (403)', async () => {
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/time-logs',
        headers: { authorization: `Bearer ${token}` },
        payload: { hours: 1, date: '2026-05-31' },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })

    it('409 when the period is locked by an approved payout (S5-04)', async () => {
      orderFindUnique.mockResolvedValue(order)
      payoutFindUnique.mockResolvedValue({ status: 'approved' }) // period frozen
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/time-logs',
        headers: { authorization: `Bearer ${token}` },
        payload: { hours: 2, date: '2026-05-31' },
      })
      expect(res.statusCode).toBe(409)
      expect(timeLogCreate).not.toHaveBeenCalled()
      await app.close()
    })

    it('400 on hours over the daily cap', async () => {
      orderFindUnique.mockResolvedValue(order)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/time-logs',
        headers: { authorization: `Bearer ${token}` },
        payload: { hours: 25, date: '2026-05-31' },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('400 on a malformed date', async () => {
      orderFindUnique.mockResolvedValue(order)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/order-1/time-logs',
        headers: { authorization: `Bearer ${token}` },
        payload: { hours: 1, date: '31-05-2026' },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('404 unknown order', async () => {
      orderFindUnique.mockResolvedValue(null)
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'POST',
        url: '/orders/nope/time-logs',
        headers: { authorization: `Bearer ${token}` },
        payload: { hours: 1, date: '2026-05-31' },
      })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('GET /orders/:orderId/time-logs', () => {
    it('executor lists logs + totalHours', async () => {
      orderFindUnique.mockResolvedValue(order)
      timeLogFindMany.mockResolvedValue([row, { ...row, id: 'tl2', hours: 1.5 }])
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/time-logs',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.totalHours).toBe(4)
      expect(res.json().data.logs).toHaveLength(2)
      await app.close()
    })

    it('client cannot list (403)', async () => {
      const { app, token } = await authed(CLIENT)
      const res = await app.inject({
        method: 'GET',
        url: '/orders/order-1/time-logs',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
      await app.close()
    })
  })

  describe('PATCH/DELETE /orders/:orderId/time-logs/:logId', () => {
    it('author edits own entry (200)', async () => {
      orderFindUnique.mockResolvedValue(order)
      timeLogFindUnique.mockResolvedValue({
        id: 'tl1',
        orderId: 'order-1',
        executorId: 'exec-1',
        date: new Date('2026-05-31'),
      })
      timeLogUpdate.mockResolvedValue({ ...row, hours: 3 })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/order-1/time-logs/tl1',
        headers: { authorization: `Bearer ${token}` },
        payload: { hours: 3 },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.log.hours).toBe(3)
      await app.close()
    })

    it('non-author executor cannot edit (403)', async () => {
      orderFindUnique.mockResolvedValue(order)
      timeLogFindUnique.mockResolvedValue({ id: 'tl1', orderId: 'order-1', executorId: 'exec-2' })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'PATCH',
        url: '/orders/order-1/time-logs/tl1',
        headers: { authorization: `Bearer ${token}` },
        payload: { hours: 3 },
      })
      expect(res.statusCode).toBe(403)
      expect(timeLogUpdate).not.toHaveBeenCalled()
      await app.close()
    })

    it('404 when the log belongs to a different order', async () => {
      orderFindUnique.mockResolvedValue(order)
      timeLogFindUnique.mockResolvedValue({
        id: 'tl1',
        orderId: 'order-OTHER',
        executorId: 'exec-1',
      })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'DELETE',
        url: '/orders/order-1/time-logs/tl1',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('author deletes own entry (200)', async () => {
      orderFindUnique.mockResolvedValue(order)
      timeLogFindUnique.mockResolvedValue({
        id: 'tl1',
        orderId: 'order-1',
        executorId: 'exec-1',
        date: new Date('2026-05-31'),
      })
      timeLogDelete.mockResolvedValue({ id: 'tl1' })
      const { app, token } = await authed(EXECUTOR)
      const res = await app.inject({
        method: 'DELETE',
        url: '/orders/order-1/time-logs/tl1',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(timeLogDelete).toHaveBeenCalledWith({ where: { id: 'tl1' } })
      await app.close()
    })
  })
})

describe('GET /orders/:id/activity', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  const order = { id: 'order-1', agencyId: 'agency-1', companyId: 'company-1', deletedAt: null }

  const internalRow = {
    id: 'a1',
    action: 'status_changed',
    metadata: { from: 'on_hold', to: 'review', comment: 'internal-only note' },
    createdAt: new Date('2026-05-31T00:00:00Z'),
    actor: { id: 'exec-1', name: 'Olena' },
  }

  it('client gets translated metadata — no internal status names, no internal comment', async () => {
    orderFindUnique.mockResolvedValue(order)
    activityFindMany.mockResolvedValue([internalRow])
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1/activity',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const meta = res.json().data.activity[0].metadata
    // internal status names mapped → client statuses; comment dropped
    expect(meta.from).toBe('in_progress') // on_hold → in_progress
    expect(meta.to).toBe('pending_approval') // review → pending_approval
    expect(meta.comment).toBeUndefined()
    expect(JSON.stringify(meta)).not.toContain('on_hold')
    expect(JSON.stringify(meta)).not.toContain('internal-only note')
    await app.close()
  })

  it('executor sees the raw internal metadata', async () => {
    orderFindUnique.mockResolvedValue(order)
    activityFindMany.mockResolvedValue([internalRow])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1/activity',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const meta = res.json().data.activity[0].metadata
    expect(meta.from).toBe('on_hold')
    expect(meta.comment).toBe('internal-only note')
    await app.close()
  })

  it('404 when a client requests another company order', async () => {
    orderFindUnique.mockResolvedValue({ ...order, companyId: 'company-OTHER' })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1/activity',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
