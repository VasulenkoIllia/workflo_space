import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// ANNOUNCEMENTS (07-В): owner-CRUD + % прочитань; active-feed за аудиторією; read-receipt.
const aFindMany = vi.fn()
const aFindFirst = vi.fn()
const aCreate = vi.fn()
const aUpdate = vi.fn()
const aDelete = vi.fn()
const readUpsert = vi.fn()
const memberCount = vi.fn()
const cmFindMany = vi.fn()

const db = {
  announcement: {
    findMany: aFindMany,
    findFirst: aFindFirst,
    create: aCreate,
    update: aUpdate,
    delete: aDelete,
  },
  announcementRead: { upsert: readUpsert },
  agencyMember: { count: memberCount },
  companyMember: { findMany: cmFindMany },
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
const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => {
  vi.clearAllMocks()
  memberCount.mockResolvedValue(4)
  cmFindMany.mockResolvedValue([{ profileId: 'c1' }, { profileId: 'c2' }])
})
afterEach(() => vi.clearAllMocks())

describe('ANNOUNCEMENTS 07-В', () => {
  it('owner-список рахує % прочитань по цільовій аудиторії', async () => {
    aFindMany.mockResolvedValue([
      {
        id: 'a1',
        title: 'Реліз',
        body: 'Т',
        audience: 'team',
        published: true,
        archivedAt: null,
        createdAt: new Date(),
        _count: { reads: 2 },
      },
      {
        id: 'a2',
        title: 'Клієнтам',
        body: 'Т',
        audience: 'all',
        published: true,
        archivedAt: null,
        createdAt: new Date(),
        _count: { reads: 3 },
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/announcements',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const [a1, a2] = res.json().data.announcements
    expect(a1.readPct).toBe(50) // 2 з 4 team
    expect(a2.targetCount).toBe(6) // 4 team + 2 clients
    expect(a2.readPct).toBe(50) // 3 з 6
    await app.close()
  })

  it('executor 403 на адмінку; create=чернетка (published=false у моделі)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/announcements',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)

    aCreate.mockResolvedValue({ id: 'a1', title: 'Т', _count: { reads: 0 } })
    const { app: app2, token: t2 } = await authed(OWNER)
    const created = await app2.inject({
      method: 'POST',
      url: '/workspace/announcements',
      headers: { authorization: `Bearer ${t2}` },
      payload: { title: 'Новий реліз', body: 'Ми оновили платформу', audience: 'team' },
    })
    expect(created.statusCode).toBe(201)
    expect(aCreate.mock.calls[0][0].data.published).toBeUndefined() // дефолт моделі false
    await app.close()
    await app2.close()
  })

  it('active-feed: team-юзер бачить team/all, client — clients/all; лише непрочитані', async () => {
    aFindMany.mockResolvedValue([])
    const { app, token } = await authed(EXECUTOR)
    await app.inject({
      method: 'GET',
      url: '/announcements/active',
      headers: { authorization: `Bearer ${token}` },
    })
    let where = aFindMany.mock.calls[0][0].where
    expect(where.audience).toEqual({ in: ['team', 'all'] })
    expect(where.reads).toEqual({ none: { profileId: 'exec-1' } })
    expect(where.published).toBe(true)
    expect(where.archivedAt).toBeNull()

    vi.clearAllMocks()
    aFindMany.mockResolvedValue([])
    const ctoken = app.jwt.sign(CLIENT)
    await app.inject({
      method: 'GET',
      url: '/announcements/active',
      headers: { authorization: `Bearer ${ctoken}` },
    })
    where = aFindMany.mock.calls[0][0].where
    expect(where.audience).toEqual({ in: ['clients', 'all'] })
    await app.close()
  })

  it('read-receipt ідемпотентний (upsert); чуже оголошення → 404', async () => {
    aFindFirst.mockResolvedValue({ id: 'a1' })
    readUpsert.mockResolvedValue({})
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/announcements/a1/read',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(readUpsert.mock.calls[0][0].where.announcementId_profileId).toEqual({
      announcementId: 'a1',
      profileId: 'exec-1',
    })

    vi.clearAllMocks()
    aFindFirst.mockResolvedValue(null) // tenant-скоуп не знайшов
    const nf = await app.inject({
      method: 'POST',
      url: '/announcements/a1/read',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(nf.statusCode).toBe(404)
    expect(readUpsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('archive штампує archivedAt один раз; unarchive знімає', async () => {
    aFindFirst.mockResolvedValue({ id: 'a1', archivedAt: null })
    aUpdate.mockResolvedValue({ id: 'a1', _count: { reads: 0 } })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/announcements/a1',
      headers: { authorization: `Bearer ${token}` },
      payload: { archived: true },
    })
    expect(res.statusCode).toBe(200)
    expect(aUpdate.mock.calls[0][0].data.archivedAt).toBeInstanceOf(Date)

    vi.clearAllMocks()
    aFindFirst.mockResolvedValue({ id: 'a1', archivedAt: new Date('2026-07-01') })
    aUpdate.mockResolvedValue({ id: 'a1', _count: { reads: 0 } })
    const un = await app.inject({
      method: 'PATCH',
      url: '/workspace/announcements/a1',
      headers: { authorization: `Bearer ${token}` },
      payload: { archived: false },
    })
    expect(un.statusCode).toBe(200)
    expect(aUpdate.mock.calls[0][0].data.archivedAt).toBeNull()
    await app.close()
  })
})
