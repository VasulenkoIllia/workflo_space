import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
process.env.GOOGLE_OAUTH_CALLBACK_URL = 'http://localhost:4000/auth/oauth/google/callback'
process.env.PORTAL_URL = 'http://localhost:3001'
process.env.WORKSPACE_URL = 'http://localhost:3002'

const oauthFindUnique = vi.fn()
const oauthFindMany = vi.fn()
const oauthCreate = vi.fn()
const oauthDeleteMany = vi.fn()
const profileFindUnique = vi.fn()
const profileUpdateMany = vi.fn()
const twoFactorFindUnique = vi.fn()
const refreshCreate = vi.fn()

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  const db = {
    oAuthAccount: {
      findUnique: oauthFindUnique,
      findMany: oauthFindMany,
      create: oauthCreate,
      deleteMany: oauthDeleteMany,
    },
    profile: { findUnique: profileFindUnique, updateMany: profileUpdateMany },
    twoFactorAuth: { findUnique: twoFactorFindUnique },
    refreshToken: { create: refreshCreate },
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
vi.mock('../src/services/notifications.js', () => ({ dispatchNotification: vi.fn() }))

const { buildApp } = await import('../src/app.js')
const { signState } = await import('../src/services/googleOauth.js')
const { hashPassword } = await import('../src/auth/password.js')

const PROFILE = {
  sub: 'user-1',
  email: 'u@e.com',
  role: 'client' as const,
  activeAgencyId: null,
  activeCompanyId: null,
  agencyMemberships: [],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

/** Stub Google's token endpoint: returns an id_token with the given payload. */
function stubGoogleExchange(payload: Record<string, unknown> | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: payload !== null,
      json: () =>
        Promise.resolve(
          payload
            ? {
                id_token: `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`,
              }
            : {}
        ),
    })
  )
}

const GOOGLE_USER = {
  sub: 'google-sub-1',
  email: 'oauth-user@example.com',
  email_verified: true,
  name: 'OAuth User',
}

beforeEach(() => {
  vi.clearAllMocks()
  oauthCreate.mockResolvedValue({})
  profileUpdateMany.mockResolvedValue({ count: 1 })
  twoFactorFindUnique.mockResolvedValue(null)
  refreshCreate.mockResolvedValue({})
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('GET /auth/oauth/providers', () => {
  it('reports google as configured', async () => {
    const { app } = await authed(PROFILE)
    const res = await app.inject({ method: 'GET', url: '/auth/oauth/providers' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.google).toBe(true)
    await app.close()
  })
})

describe('GET /auth/oauth/google', () => {
  it('302s to Google with client_id, redirect_uri and a signed state', async () => {
    const { app } = await authed(PROFILE)
    const res = await app.inject({ method: 'GET', url: '/auth/oauth/google?app=workspace' })
    expect(res.statusCode).toBe(302)
    const loc = res.headers.location as string
    expect(loc).toContain('accounts.google.com/o/oauth2/v2/auth')
    expect(loc).toContain('client_id=test-client-id')
    expect(loc).toContain('state=')
    await app.close()
  })
})

describe('GET /auth/oauth/google/callback', () => {
  it('rejects a forged state → /login?oauthError=state', async () => {
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'GET',
      url: '/auth/oauth/google/callback?code=x&state=forged.mac',
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('http://localhost:3001/login?oauthError=state')
    await app.close()
  })

  it('known OAuthAccount → session cookie + redirect to the app', async () => {
    stubGoogleExchange(GOOGLE_USER)
    oauthFindUnique.mockResolvedValue({ profileId: 'user-1' })
    profileFindUnique.mockResolvedValue({ isActive: true })
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'GET',
      url: `/auth/oauth/google/callback?code=ok&state=${encodeURIComponent(signState({ v: 'login', app: 'portal' }))}`,
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('http://localhost:3001/?oauth=ok')
    const setCookie = String(res.headers['set-cookie'])
    expect(setCookie).toContain('refresh_token=')
    expect(refreshCreate).toHaveBeenCalled()
    await app.close()
  })

  it('email matches an existing profile → auto-link + session', async () => {
    stubGoogleExchange(GOOGLE_USER)
    oauthFindUnique.mockResolvedValue(null)
    profileFindUnique
      .mockResolvedValueOnce({ id: 'user-1' }) // by email
      .mockResolvedValueOnce({ isActive: true }) // isActive check
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'GET',
      url: `/auth/oauth/google/callback?code=ok&state=${encodeURIComponent(signState({ v: 'login', app: 'portal' }))}`,
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('http://localhost:3001/?oauth=ok')
    expect(oauthCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ profileId: 'user-1', provider: 'google' }),
      })
    )
    await app.close()
  })

  it('refuses to auto-link a google-UNVERIFIED email', async () => {
    stubGoogleExchange({ ...GOOGLE_USER, email_verified: false })
    oauthFindUnique.mockResolvedValue(null)
    profileFindUnique.mockResolvedValue({ id: 'user-1' })
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'GET',
      url: `/auth/oauth/google/callback?code=ok&state=${encodeURIComponent(signState({ v: 'login', app: 'portal' }))}`,
    })
    expect(res.headers.location).toBe('http://localhost:3001/login?oauthError=unverified')
    expect(oauthCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('2FA-enabled profile → NO cookie, challenge redirect', async () => {
    stubGoogleExchange(GOOGLE_USER)
    oauthFindUnique.mockResolvedValue({ profileId: 'user-1' })
    profileFindUnique.mockResolvedValue({ isActive: true })
    twoFactorFindUnique.mockResolvedValue({ enabledAt: new Date() })
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'GET',
      url: `/auth/oauth/google/callback?code=ok&state=${encodeURIComponent(signState({ v: 'login', app: 'workspace' }))}`,
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('http://localhost:3002/login?oauth2fa=')
    expect(res.headers['set-cookie']).toBeUndefined()
    expect(refreshCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('link intent: attaches google to the state-bound profile → settings redirect', async () => {
    stubGoogleExchange(GOOGLE_USER)
    oauthFindUnique.mockResolvedValue(null)
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'GET',
      url: `/auth/oauth/google/callback?code=ok&state=${encodeURIComponent(signState({ v: 'link', app: 'portal', p: 'user-1' }))}`,
    })
    expect(res.headers.location).toBe('http://localhost:3001/settings?oauthLinked=1')
    expect(oauthCreate).toHaveBeenCalled()
    await app.close()
  })

  it('link intent: identity already linked to ANOTHER profile → taken error', async () => {
    stubGoogleExchange(GOOGLE_USER)
    oauthFindUnique.mockResolvedValue({ profileId: 'someone-else' })
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'GET',
      url: `/auth/oauth/google/callback?code=ok&state=${encodeURIComponent(signState({ v: 'link', app: 'portal', p: 'user-1' }))}`,
    })
    expect(res.headers.location).toBe('http://localhost:3001/settings?oauthError=taken')
    expect(oauthCreate).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('DELETE /auth/oauth/google (unlink)', () => {
  it('unlinks with a correct password', async () => {
    profileFindUnique.mockResolvedValue({ passwordHash: await hashPassword('Correct123!') })
    oauthDeleteMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'DELETE',
      url: '/auth/oauth/google',
      headers: { authorization: `Bearer ${token}` },
      payload: { password: 'Correct123!' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('401s on a wrong password (last-way-in guard)', async () => {
    profileFindUnique.mockResolvedValue({ passwordHash: await hashPassword('Correct123!') })
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'DELETE',
      url: '/auth/oauth/google',
      headers: { authorization: `Bearer ${token}` },
      payload: { password: 'Wrong123!' },
    })
    expect(res.statusCode).toBe(401)
    expect(oauthDeleteMany).not.toHaveBeenCalled()
    await app.close()
  })
})
