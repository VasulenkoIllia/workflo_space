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
