import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const refreshFindMany = vi.fn()
const refreshUpdateMany = vi.fn()

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  const db = {
    refreshToken: { findMany: refreshFindMany, updateMany: refreshUpdateMany },
  }
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
    enterAgencyContext: vi.fn(),
  }
})

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const SID = 'fam-current'
const PROFILE = {
  sub: 'user-1',
  email: 'u@e.com',
  role: 'owner' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
  sid: SID,
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

function row(id: string, familyId: string) {
  return {
    id,
    familyId,
    userAgent: 'Mozilla/5.0 test',
    ip: '127.0.0.1',
    firstIssuedAt: new Date('2026-07-01T10:00:00Z'),
    createdAt: new Date('2026-07-03T10:00:00Z'),
    expiresAt: new Date('2026-08-01T10:00:00Z'),
  }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('GET /auth/sessions', () => {
  it('lists active sessions and marks the current one by sid', async () => {
    refreshFindMany.mockResolvedValue([row('rt-1', SID), row('rt-2', 'fam-other')])
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'GET',
      url: '/auth/sessions',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const { sessions } = res.json().data
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({ id: 'rt-1', current: true, ip: '127.0.0.1' })
    expect(sessions[1]).toMatchObject({ id: 'rt-2', current: false })
    // Only the caller's live rows are queried.
    expect(refreshFindMany.mock.calls[0][0].where).toMatchObject({
      profileId: PROFILE.sub,
      revokedAt: null,
    })
    await app.close()
  })

  it('requires auth (401 without a token)', async () => {
    const { app } = await authed(PROFILE)
    const res = await app.inject({ method: 'GET', url: '/auth/sessions' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('DELETE /auth/sessions/:id', () => {
  it('revokes an own active session', async () => {
    refreshUpdateMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'DELETE',
      url: '/auth/sessions/6b1f0a1e-0000-4000-8000-000000000001',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    // Revocation is scoped to the caller — profileId is in the WHERE.
    expect(refreshUpdateMany.mock.calls[0][0].where).toMatchObject({
      profileId: PROFILE.sub,
      revokedAt: null,
    })
    await app.close()
  })

  it("404s on someone else's / already-revoked session", async () => {
    refreshUpdateMany.mockResolvedValue({ count: 0 })
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'DELETE',
      url: '/auth/sessions/6b1f0a1e-0000-4000-8000-000000000002',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('POST /auth/sessions/revoke-others', () => {
  it('revokes every session except the current family', async () => {
    refreshUpdateMany.mockResolvedValue({ count: 3 })
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/sessions/revoke-others',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.revoked).toBe(3)
    expect(refreshUpdateMany.mock.calls[0][0].where).toMatchObject({
      profileId: PROFILE.sub,
      revokedAt: null,
      NOT: { familyId: SID },
    })
    await app.close()
  })

  it('400s on a legacy token without sid (would revoke itself too)', async () => {
    const { app, token } = await authed({ ...PROFILE, sid: undefined })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/sessions/revoke-others',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    expect(refreshUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })
})
