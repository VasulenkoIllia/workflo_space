import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const refreshTokenFindUnique = vi.fn()
const refreshTokenUpdate = vi.fn()
const refreshTokenUpdateMany = vi.fn()
const refreshTokenCreate = vi.fn()
const refreshTokenFindUniqueForLogout = vi.fn()
const companyMemberFindMany = vi.fn()
const auditLogCreate = vi.fn()
const transaction = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    refreshToken: {
      findUnique: refreshTokenFindUnique,
      update: refreshTokenUpdate,
      updateMany: refreshTokenUpdateMany,
      create: refreshTokenCreate,
    },
    companyMember: { findMany: companyMemberFindMany },
    auditLog: { create: auditLogCreate },
    $transaction: transaction,
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const COOKIE = 'refresh_token=valid-token-123'

function wireValidToken() {
  refreshTokenFindUnique.mockResolvedValue({
    id: 'rt-1',
    profileId: 'profile-1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    profile: { id: 'profile-1', email: 'u@e.com', role: 'client', isActive: true },
  })
  companyMemberFindMany.mockResolvedValue([{ companyId: 'company-1', role: 'owner' }])
  // Execute the real callback with a complete tx so issueRefreshToken() runs
  // (it calls tx.refreshToken.create and returns its own random token).
  transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => unknown) =>
    cb({ refreshToken: { update: refreshTokenUpdate, create: refreshTokenCreate } })
  )
  refreshTokenUpdate.mockResolvedValue({})
  refreshTokenCreate.mockResolvedValue({})
  auditLogCreate.mockResolvedValue({})
}

describe('POST /auth/refresh', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('rotates the token and returns a new access token', async () => {
    wireValidToken()
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: COOKIE },
    })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().data.accessToken).toBe('string')
    // old token revoked (by id) + new token issued inside the transaction
    expect(refreshTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1' } })
    )
    expect(refreshTokenCreate).toHaveBeenCalledOnce()
    // a fresh cookie is set, and it is NOT the old token value
    const setCookie = String(res.headers['set-cookie'])
    expect(setCookie).toContain('refresh_token=')
    expect(setCookie).not.toContain('valid-token-123')
    await app.close()
  })

  it('returns 401 when no cookie present', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/refresh' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 401 for an unknown token', async () => {
    refreshTokenFindUnique.mockResolvedValue(null)
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: COOKIE },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 401 for a revoked token', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'rt-1',
      profileId: 'p1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 100000),
      profile: { id: 'p1', email: 'u@e.com', role: 'client', isActive: true },
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: COOKIE },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 401 for an expired token', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'rt-1',
      profileId: 'p1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      profile: { id: 'p1', email: 'u@e.com', role: 'client', isActive: true },
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: COOKIE },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 403 when the account is deactivated', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'rt-1',
      profileId: 'p1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
      profile: { id: 'p1', email: 'u@e.com', role: 'client', isActive: false },
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: COOKIE },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('POST /auth/logout', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('revokes the token from body and clears the cookie', async () => {
    refreshTokenUpdateMany.mockResolvedValue({ count: 1 })
    refreshTokenFindUnique.mockResolvedValue({ profileId: 'profile-1' })
    auditLogCreate.mockResolvedValue({})
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: 'some-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.loggedOut).toBe(true)
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: 'some-token', revokedAt: null } })
    )
    // cookie cleared (Max-Age=0 / Expires in the past)
    expect(String(res.headers['set-cookie'])).toContain('refresh_token=')
    await app.close()
  })

  it('is idempotent — 200 even with no token', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/logout', payload: {} })
    expect(res.statusCode).toBe(200)
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })
})
