import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// ─── Mock @workflo/db ────────────────────────────────────────────────────────
const profileFindUnique = vi.fn()
const otpFindFirst = vi.fn()
const otpUpsert = vi.fn()
const otpUpdate = vi.fn()
const companyMemberFindMany = vi.fn()
const agencyMemberFindMany = vi.fn()
const refreshTokenCreate = vi.fn()
const twoFactorFindUnique = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    otpToken: { findFirst: otpFindFirst, upsert: otpUpsert, update: otpUpdate },
    companyMember: { findMany: companyMemberFindMany },
    agencyMember: { findMany: agencyMemberFindMany },
    refreshToken: { create: refreshTokenCreate },
    twoFactorAuth: { findUnique: twoFactorFindUnique },
    agency: { findMany: vi.fn().mockResolvedValue([]) },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))
const dispatchNotification = vi.fn()
vi.mock('../src/services/notifications.js', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
}))

const { buildApp } = await import('../src/app.js')

beforeEach(() => {
  vi.clearAllMocks()
  otpUpsert.mockResolvedValue({})
  otpUpdate.mockResolvedValue({})
  refreshTokenCreate.mockResolvedValue({})
  twoFactorFindUnique.mockResolvedValue(null) // 2FA off by default
  companyMemberFindMany.mockResolvedValue([])
  agencyMemberFindMany.mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

describe('POST /auth/magic-link (01-А)', () => {
  it('creates a one-time token and dispatches the email for an active account', async () => {
    profileFindUnique.mockResolvedValue({ id: 'user-1', isActive: true })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: { email: 'User@Example.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.sent).toBe(true)
    // upsert по (profileId, purpose=magic_link) — повторний запит гасить попередній лінк
    const upsert = otpUpsert.mock.calls[0][0]
    expect(upsert.where.profileId_purpose.purpose).toBe('magic_link')
    expect(upsert.create.expiresAt.getTime()).toBeGreaterThan(Date.now())
    const [, payload] = dispatchNotification.mock.calls[0]
    expect(payload.event).toBe('auth.magic_link')
    expect(payload.vars.loginUrl).toContain('/magic-login?token=')
    await app.close()
  })

  it('returns the SAME 200 for an unknown email, sending nothing (no enumeration)', async () => {
    profileFindUnique.mockResolvedValue(null)
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: { email: 'ghost@example.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.sent).toBe(true)
    expect(otpUpsert).not.toHaveBeenCalled()
    expect(dispatchNotification).not.toHaveBeenCalled()
    await app.close()
  })

  it('sends nothing for a deactivated account (still 200)', async () => {
    profileFindUnique.mockResolvedValue({ id: 'user-1', isActive: false })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: { email: 'user@example.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(otpUpsert).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('POST /auth/magic-login (01-А)', () => {
  const liveToken = () =>
    otpFindFirst.mockResolvedValue({
      id: 'otp-1',
      profileId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    })

  const wireSessionProfile = () =>
    profileFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'client',
      name: 'Test User',
      isActive: true,
      lastActiveAgencyId: null,
      mustChangePassword: false,
    })

  it('exchanges a live token for a full session and consumes it', async () => {
    liveToken()
    wireSessionProfile()
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-login',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.data.accessToken).toBe('string')
    expect(body.data.profile.email).toBe('user@example.com')
    // токен одноразовий — спалюється ДО видачі сесії
    expect(otpUpdate.mock.calls[0][0].data.usedAt).toBeInstanceOf(Date)
    expect(String(res.headers['set-cookie'])).toContain('refresh_token=')
    await app.close()
  })

  it('does NOT bypass 2FA: enabled → challenge instead of a session', async () => {
    liveToken()
    twoFactorFindUnique.mockResolvedValue({ enabledAt: new Date() })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-login',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.twoFactorRequired).toBe(true)
    expect(typeof body.data.challengeToken).toBe('string')
    expect(body.data.accessToken).toBeUndefined()
    expect(refreshTokenCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('401s an expired token', async () => {
    otpFindFirst.mockResolvedValue({
      id: 'otp-1',
      profileId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-login',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(401)
    expect(otpUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('401s an already-used token (no replay)', async () => {
    otpFindFirst.mockResolvedValue({
      id: 'otp-1',
      profileId: 'user-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-login',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
