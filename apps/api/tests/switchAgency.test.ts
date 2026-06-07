import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const profileFindUnique = vi.fn()
const profileUpdate = vi.fn()
const agencyMemberFindMany = vi.fn()
const companyMemberFindMany = vi.fn()
const auditLogCreate = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    profile: { findUnique: profileFindUnique, update: profileUpdate },
    agencyMember: { findMany: agencyMemberFindMany },
    companyMember: { findMany: companyMemberFindMany },
    auditLog: { create: auditLogCreate },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const AGENCY_A = '11111111-1111-1111-1111-111111111111'
const AGENCY_B = '22222222-2222-2222-2222-222222222222'

const CLAIMS = {
  sub: 'profile-1',
  email: 'staff@e.com',
  role: 'executor' as const,
  activeAgencyId: AGENCY_A,
  activeCompanyId: null,
  agencyMemberships: [
    { agencyId: AGENCY_A, role: 'executor' as const },
    { agencyId: AGENCY_B, role: 'owner' as const },
  ],
  memberships: [],
}

function wireActiveStaffer() {
  profileFindUnique.mockResolvedValue({
    id: 'profile-1',
    email: 'staff@e.com',
    role: 'executor',
    isActive: true,
  })
  companyMemberFindMany.mockResolvedValue([])
  profileUpdate.mockResolvedValue({})
  auditLogCreate.mockResolvedValue({})
}

describe('POST /auth/switch-agency', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('switches to an agency the caller is a member of, persists it, and re-issues a scoped token', async () => {
    wireActiveStaffer()
    agencyMemberFindMany.mockResolvedValue([
      { agencyId: AGENCY_A, role: 'executor' },
      { agencyId: AGENCY_B, role: 'owner' },
    ])

    const app = buildApp()
    await app.ready()
    const token = app.jwt.sign(CLAIMS) // currently active = AGENCY_A
    const res = await app.inject({
      method: 'POST',
      url: '/auth/switch-agency',
      headers: { authorization: `Bearer ${token}` },
      payload: { agencyId: AGENCY_B },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.activeAgencyId).toBe(AGENCY_B)
    // Persisted for refresh survival.
    expect(profileUpdate).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { lastActiveAgencyId: AGENCY_B },
    })
    // New access token is actually scoped to AGENCY_B.
    const decoded = app.jwt.verify<typeof CLAIMS>(body.data.accessToken)
    expect(decoded.activeAgencyId).toBe(AGENCY_B)
    await app.close()
  })

  it('rejects switching to an agency the caller is NOT a member of (403, no persist)', async () => {
    wireActiveStaffer()
    agencyMemberFindMany.mockResolvedValue([{ agencyId: AGENCY_A, role: 'executor' }]) // not B

    const app = buildApp()
    await app.ready()
    const token = app.jwt.sign(CLAIMS)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/switch-agency',
      headers: { authorization: `Bearer ${token}` },
      payload: { agencyId: AGENCY_B },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
    expect(profileUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 401 without a token (never touches the DB)', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/switch-agency',
      payload: { agencyId: AGENCY_B },
    })
    expect(res.statusCode).toBe(401)
    expect(agencyMemberFindMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 400 for a non-uuid agencyId', async () => {
    wireActiveStaffer()
    const app = buildApp()
    await app.ready()
    const token = app.jwt.sign(CLAIMS)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/switch-agency',
      headers: { authorization: `Bearer ${token}` },
      payload: { agencyId: 'not-a-uuid' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 401 when the account is inactive/missing despite a valid token', async () => {
    profileFindUnique.mockResolvedValue(null)
    const app = buildApp()
    await app.ready()
    const token = app.jwt.sign(CLAIMS)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/switch-agency',
      headers: { authorization: `Bearer ${token}` },
      payload: { agencyId: AGENCY_B },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
