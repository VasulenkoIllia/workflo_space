import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const profileFindUnique = vi.fn()
const companyMemberFindMany = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    companyMember: { findMany: companyMemberFindMany },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const CLAIMS = {
  sub: 'profile-1',
  email: 'u@e.com',
  role: 'client' as const,
  activeCompanyId: 'company-1',
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

describe('GET /auth/me', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with fresh profile + companies for a valid token', async () => {
    profileFindUnique.mockResolvedValue({
      id: 'profile-1',
      email: 'u@e.com',
      name: 'Test User',
      role: 'client',
      language: 'uk',
      theme: 'system',
      isActive: true,
      avatarUrl: null,
    })
    companyMemberFindMany.mockResolvedValue([
      { companyId: 'company-1', role: 'owner', company: { name: 'Acme', slug: 'acme' } },
    ])

    const app = buildApp()
    await app.ready()
    const token = app.jwt.sign(CLAIMS)
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.profile.id).toBe('profile-1')
    expect(body.data.profile.displayName).toBe('Test User')
    expect(body.data.activeCompanyId).toBe('company-1')
    expect(body.data.companies).toHaveLength(1)
    await app.close()
  })

  it('falls back to first company when token activeCompanyId is no longer a membership', async () => {
    profileFindUnique.mockResolvedValue({
      id: 'profile-1',
      email: 'u@e.com',
      name: 'Test',
      role: 'client',
      language: 'uk',
      theme: 'system',
      isActive: true,
      avatarUrl: null,
    })
    companyMemberFindMany.mockResolvedValue([
      { companyId: 'company-9', role: 'owner', company: { name: 'X', slug: 'x' } },
    ])
    const app = buildApp()
    await app.ready()
    const token = app.jwt.sign(CLAIMS) // activeCompanyId=company-1 (no longer a member)
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.json().data.activeCompanyId).toBe('company-9')
    await app.close()
  })

  it('returns 401 without a token', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
    expect(profileFindUnique).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 401 for a malformed token', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer not-a-jwt' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 401 when the account is inactive/missing despite a valid token', async () => {
    profileFindUnique.mockResolvedValue(null)
    const app = buildApp()
    await app.ready()
    const token = app.jwt.sign(CLAIMS)
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
