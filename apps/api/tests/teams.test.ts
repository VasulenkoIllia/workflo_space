import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// TEAM-BOARDS: команди агенції — таби глобальної дошки. Читання=команда, зміни=owner.
const teamFindMany = vi.fn()
const teamFindFirst = vi.fn()
const teamCreate = vi.fn()
const teamUpdate = vi.fn()
const teamDelete = vi.fn()
const teamAggregate = vi.fn()
const memberFindFirst = vi.fn()
const memberUpdate = vi.fn()
const colFindFirst = vi.fn()
const colFindMany = vi.fn()
const colCreate = vi.fn()
const colCreateMany = vi.fn()
const colUpdate = vi.fn()
const colDelete = vi.fn()
const colAggregate = vi.fn()
const taskUpdateMany = vi.fn()

const db = {
  team: {
    findMany: teamFindMany,
    findFirst: teamFindFirst,
    create: teamCreate,
    update: teamUpdate,
    delete: teamDelete,
    aggregate: teamAggregate,
  },
  agencyMember: { findFirst: memberFindFirst, update: memberUpdate },
  teamColumn: {
    findFirst: colFindFirst,
    findMany: colFindMany,
    create: colCreate,
    createMany: colCreateMany,
    update: colUpdate,
    delete: colDelete,
    aggregate: colAggregate,
  },
  internalTask: { updateMany: taskUpdateMany, count: vi.fn().mockResolvedValue(3) },
  // 12-В KPI-картка виконавця
  timeLog: { aggregate: vi.fn().mockResolvedValue({ _sum: { hours: 42 } }) },
  orderExecutorSettlement: { aggregate: vi.fn().mockResolvedValue({ _sum: { payableHours: 30 } }) },
  payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountUsd: null } }) },
  paymentRefund: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountUsd: null } }) },
  order: {
    count: vi.fn().mockResolvedValue(2),
    findMany: vi.fn().mockResolvedValue([
      { acceptedAt: new Date('2026-07-01'), deadline: new Date('2026-07-05') }, // вчасно
      { acceptedAt: new Date('2026-07-09'), deadline: new Date('2026-07-05') }, // прострочено
    ]),
  },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', async (importOriginal) => {
  // Prisma.Decimal потрібен KPI-роуту (нетто-виручка) — беремо справжній конструктор
  const actual = (await importOriginal()) as { Prisma: unknown }
  return {
    prisma: db,
    Prisma: actual.Prisma,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  }
})
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
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}

const TEAM_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE = '22222222-2222-4222-8222-222222222222'

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => {
  vi.clearAllMocks()
  teamAggregate.mockResolvedValue({ _max: { position: null } })
  colAggregate.mockResolvedValue({ _max: { position: null } })
  colCreateMany.mockResolvedValue({ count: 0 })
})
afterEach(() => vi.clearAllMocks())

describe('TEAM-BOARDS /workspace/teams', () => {
  it('executor читає список команд (таби дошки)', async () => {
    teamFindMany.mockResolvedValue([
      { id: TEAM_ID, name: 'Dev', color: '#22c55e', position: 0, _count: { members: 2, tasks: 5 } },
    ])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/teams',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.teams).toHaveLength(1)
    await app.close()
  })

  it('owner створює команду (колір з палітри за позицією)', async () => {
    teamFindFirst.mockResolvedValue(null) // без дубля
    teamCreate.mockResolvedValue({
      id: TEAM_ID,
      name: 'Dev',
      color: '#22c55e',
      position: 0,
      _count: { members: 0, tasks: 0 },
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Dev' },
    })
    expect(res.statusCode).toBe(201)
    expect(teamCreate.mock.calls[0][0].data.color).toBe('#22c55e') // PALETTE[0]
    await app.close()
  })

  it('executor НЕ може створити команду (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Dev' },
    })
    expect(res.statusCode).toBe(403)
    expect(teamCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('дубль назви → 400', async () => {
    teamFindFirst.mockResolvedValue({ id: 'other' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Dev' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('owner призначає члена в команду; чужа команда → 400', async () => {
    memberFindFirst.mockResolvedValue({ id: 'member-1' })
    teamFindFirst.mockResolvedValue({ id: TEAM_ID })
    memberUpdate.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const ok = await app.inject({
      method: 'PATCH',
      url: `/workspace/executors/${PROFILE}/team`,
      headers: { authorization: `Bearer ${token}` },
      payload: { teamId: TEAM_ID },
    })
    expect(ok.statusCode).toBe(200)
    expect(memberUpdate.mock.calls[0][0].data.teamId).toBe(TEAM_ID)

    // команда не з цієї агенції (tenant-скоуплений findFirst → null) → 400
    vi.clearAllMocks()
    memberFindFirst.mockResolvedValue({ id: 'member-1' })
    teamFindFirst.mockResolvedValue(null)
    const bad = await app.inject({
      method: 'PATCH',
      url: `/workspace/executors/${PROFILE}/team`,
      headers: { authorization: `Bearer ${token}` },
      payload: { teamId: TEAM_ID },
    })
    expect(bad.statusCode).toBe(400)
    expect(memberUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('teamId=null знімає члена з команди', async () => {
    memberFindFirst.mockResolvedValue({ id: 'member-1' })
    memberUpdate.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: `/workspace/executors/${PROFILE}/team`,
      headers: { authorization: `Bearer ${token}` },
      payload: { teamId: null },
    })
    expect(res.statusCode).toBe(200)
    expect(memberUpdate.mock.calls[0][0].data.teamId).toBeNull()
    await app.close()
  })

  // TASK-COLUMNS: колонки дошки команди
  it('owner/manager створює колонку з kind-мапінгом; дубль назви → 400', async () => {
    teamFindFirst.mockResolvedValue({ id: TEAM_ID })
    colFindFirst.mockResolvedValue(null)
    colCreate.mockResolvedValue({ id: 'col-1', name: "Рев'ю", kind: 'in_progress', position: 3 })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/teams/${TEAM_ID}/columns`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Рев'ю", kind: 'in_progress' },
    })
    expect(res.statusCode).toBe(201)
    expect(colCreate.mock.calls[0][0].data.kind).toBe('in_progress')

    vi.clearAllMocks()
    teamFindFirst.mockResolvedValue({ id: TEAM_ID })
    colFindFirst.mockResolvedValue({ id: 'col-x' }) // дубль
    const dup = await app.inject({
      method: 'POST',
      url: `/workspace/teams/${TEAM_ID}/columns`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Рев'ю", kind: 'in_progress' },
    })
    expect(dup.statusCode).toBe(400)
    await app.close()
  })

  it('зміна kind колонки ПЕРЕ-ДЗЕРКАЛЮЄ статуси її задач (консистентність з головною)', async () => {
    colFindFirst.mockResolvedValue({ id: 'col-1', kind: 'in_progress' })
    colUpdate.mockResolvedValue({ id: 'col-1', name: "Рев'ю", kind: 'done', position: 3 })
    taskUpdateMany.mockResolvedValue({ count: 2 })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: `/workspace/teams/${TEAM_ID}/columns/col-1`,
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'done' },
    })
    expect(res.statusCode).toBe(200)
    expect(taskUpdateMany).toHaveBeenCalledWith({
      where: { columnId: 'col-1' },
      data: { status: 'done' },
    })
    await app.close()
  })

  it('executor-НЕ-лід не налаштовує дошку (403)', async () => {
    teamFindFirst.mockResolvedValue({ id: TEAM_ID, leadId: 'someone-else' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/teams/${TEAM_ID}/columns`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X', kind: 'todo' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  // ── TEAM-ADMIN-1: тімлід підрозділу ─────────────────────────────────────────
  it('owner призначає тімліда; не-член команди → 400', async () => {
    teamFindFirst.mockResolvedValue({ id: TEAM_ID })
    memberFindFirst.mockResolvedValueOnce(null) // лід не в цій команді
    const { app, token } = await authed(OWNER)
    const bad = await app.inject({
      method: 'PATCH',
      url: `/workspace/teams/${TEAM_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { leadId: PROFILE },
    })
    expect(bad.statusCode).toBe(400)

    memberFindFirst.mockResolvedValueOnce({ id: 'am-1' }) // член команди
    teamUpdate.mockResolvedValue({ id: TEAM_ID, name: 'Dev', leadId: PROFILE })
    const ok = await app.inject({
      method: 'PATCH',
      url: `/workspace/teams/${TEAM_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { leadId: PROFILE },
    })
    expect(ok.statusCode).toBe(200)
    expect(teamUpdate.mock.calls[0][0].data.leadId).toBe(PROFILE)
    // валідація шукала члена САМЕ цієї команди
    expect(memberFindFirst.mock.calls[1][0].where.teamId).toBe(TEAM_ID)
    await app.close()
  })

  it('тімлід (executor) налаштовує колонки СВОЄЇ команди', async () => {
    teamFindFirst.mockResolvedValue({ id: TEAM_ID, leadId: 'exec-1' })
    colFindFirst.mockResolvedValue(null)
    colCreate.mockResolvedValue({ id: 'col-1', name: 'QA', kind: 'in_progress', position: 0 })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/teams/${TEAM_ID}/columns`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'QA', kind: 'in_progress' },
    })
    expect(res.statusCode).toBe(201)
    await app.close()
  })

  it('executor бачить лише свою команду у списку (скоуп members.some)', async () => {
    teamFindMany.mockResolvedValue([])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/teams',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    // другий виклик findMany — власне список; перший — lazy-seed порожніх колонок
    const listCall = teamFindMany.mock.calls[1][0]
    expect(listCall.where.members).toEqual({ some: { profileId: 'exec-1' } })
    await app.close()
  })

  // 12-В KPI-картка виконавця
  it('KPI: owner отримує метрики; вчасність = вчасні/усі з дедлайном', async () => {
    memberFindFirst.mockResolvedValue({ profileId: PROFILE })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/executors/${PROFILE}/kpi`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const kpi = res.json().data.kpi
    expect(kpi.hoursLogged).toBe(42)
    expect(kpi.hoursAccepted).toBe(30)
    expect(kpi.activeOrders).toBe(2)
    expect(kpi.tasksDone).toBe(3)
    expect(kpi.onTimePct).toBe(50) // 1 з 2 вчасно
    await app.close()
  })

  it('KPI: executor 403; не-член агенції 404', async () => {
    const { app, token } = await authed(EXECUTOR)
    const forb = await app.inject({
      method: 'GET',
      url: `/workspace/executors/${PROFILE}/kpi`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(forb.statusCode).toBe(403)

    memberFindFirst.mockResolvedValue(null)
    const { app: app2, token: t2 } = await authed(OWNER)
    const nf = await app2.inject({
      method: 'GET',
      url: `/workspace/executors/${PROFILE}/kpi`,
      headers: { authorization: `Bearer ${t2}` },
    })
    expect(nf.statusCode).toBe(404)
    await app.close()
    await app2.close()
  })

  it('delete: команда зникає, люди/задачі лишаються (FK SetNull — без каскаду в роуті)', async () => {
    teamFindFirst.mockResolvedValue({ id: TEAM_ID })
    teamDelete.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: `/workspace/teams/${TEAM_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(teamDelete).toHaveBeenCalledWith({ where: { id: TEAM_ID } })
    await app.close()
  })
})
