import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// ─── Mock @workflo/db ────────────────────────────────────────────────────────
const profileFindUnique = vi.fn()
const companyMemberFindMany = vi.fn()
const agencyMemberFindMany = vi.fn()
const refreshTokenCreate = vi.fn()
const auditLogCreate = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    companyMember: { findMany: companyMemberFindMany },
    agencyMember: { findMany: agencyMemberFindMany },
    refreshToken: { create: refreshTokenCreate },
    auditLog: { create: auditLogCreate },
    // S9-01: login checks 2FA; default findUnique → null (2FA off) so existing tests
    // exercise the no-2FA path unchanged.
    twoFactorAuth: { findUnique: () => Promise.resolve(null) },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

// bcrypt hash of 'correct-password' (rounds=12), generated for these tests.
import bcrypt from 'bcryptjs'
const VALID_HASH = bcrypt.hashSync('correct-password', 12)

function wireProfile(overrides: Record<string, unknown> = {}) {
  profileFindUnique.mockResolvedValue({
    id: 'profile-1',
    email: 'user@example.com',
    passwordHash: VALID_HASH,
    role: 'client',
    isActive: true,
    name: 'Test User',
    ...overrides,
  })
  companyMemberFindMany.mockResolvedValue([
    {
      companyId: 'company-1',
      role: 'owner',
      company: { name: 'Acme', slug: 'acme', agencyId: 'agency-1' },
    },
    {
      companyId: 'company-2',
      role: 'member',
      company: { name: 'Beta', slug: 'beta', agencyId: 'agency-1' },
    },
  ])
  agencyMemberFindMany.mockResolvedValue([]) // client → tenant via active company's agencyId
  refreshTokenCreate.mockResolvedValue({})
  auditLogCreate.mockResolvedValue({})
}

const validBody = { email: 'User@Example.com', password: 'correct-password' }

describe('POST /auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('logs in with valid credentials → 200 + token + companies + activeCompanyId', async () => {
    wireProfile()
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: validBody })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.data.accessToken).toBe('string')
    expect(body.data.profile.email).toBe('user@example.com')
    expect(body.data.activeCompanyId).toBe('company-1')
    expect(body.data.companies).toHaveLength(2)
    expect(body.data.companies[0].role).toBe('owner')
    await app.close()
  })

  it('sets the refresh cookie on success', async () => {
    wireProfile()
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: validBody })
    const cookieStr = String(res.headers['set-cookie'])
    expect(cookieStr).toContain('refresh_token=')
    expect(cookieStr).toContain('Path=/auth/refresh')
    await app.close()
  })

  it('records an audit log on successful login', async () => {
    wireProfile()
    const app = buildApp()
    await app.inject({ method: 'POST', url: '/auth/login', payload: validBody })
    await new Promise((r) => setTimeout(r, 0))
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.login_success' }),
      })
    )
    await app.close()
  })

  it('returns 401 for a wrong password and an unknown email with an IDENTICAL message (no enumeration)', async () => {
    // wrong password (account exists)
    wireProfile()
    const app1 = buildApp()
    const wrongPass = await app1.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { ...validBody, password: 'wrong-password' },
    })
    expect(wrongPass.statusCode).toBe(401)
    expect(wrongPass.json().error.code).toBe('UNAUTHORIZED')
    await app1.close()

    // unknown email (account absent)
    profileFindUnique.mockResolvedValue(null)
    const app2 = buildApp()
    const unknownEmail = await app2.inject({
      method: 'POST',
      url: '/auth/login',
      payload: validBody,
    })
    expect(unknownEmail.statusCode).toBe(401)
    // companyMember.findMany never runs when the account is absent
    expect(companyMemberFindMany).not.toHaveBeenCalled()
    // The two failure messages must be identical — that's the anti-enumeration guarantee.
    expect(unknownEmail.json().error.message).toBe(wrongPass.json().error.message)
    await app2.close()
  })

  it('returns generic 401 for a deactivated account (no enumeration)', async () => {
    wireProfile({ isActive: false })
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: validBody })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
    await app.close()
  })

  it('returns 400 for an invalid body', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'not-an-email', password: 'x' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
