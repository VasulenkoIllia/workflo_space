import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const otpFindFirst = vi.fn()
const otpUpsert = vi.fn()
const otpUpdate = vi.fn()
const profileFindUnique = vi.fn()
const profileUpdate = vi.fn()

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  const db = {
    otpToken: { findFirst: otpFindFirst, upsert: otpUpsert, update: otpUpdate },
    profile: { findUnique: profileFindUnique, update: profileUpdate },
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
const dispatchNotification = vi.fn()
vi.mock('../src/services/notifications.js', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
}))

const { buildApp } = await import('../src/app.js')
// $transaction(array) form — resolve the already-started promises.
const { prisma } = (await import('@workflo/db')) as unknown as {
  prisma: { $transaction: (ops: Promise<unknown>[]) => Promise<unknown[]> }
}
prisma.$transaction = (ops: Promise<unknown>[]) => Promise.all(ops)

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

beforeEach(() => {
  vi.clearAllMocks()
  otpUpsert.mockResolvedValue({})
  otpUpdate.mockResolvedValue({})
  profileUpdate.mockResolvedValue({})
})
afterEach(() => vi.clearAllMocks())

describe('POST /auth/verify-email', () => {
  it('consumes a live token: marks it used and sets emailVerifiedAt', async () => {
    otpFindFirst.mockResolvedValue({
      id: 'otp-1',
      profileId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    })
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.verified).toBe(true)
    expect(otpUpdate.mock.calls[0][0].data.usedAt).toBeInstanceOf(Date)
    expect(profileUpdate.mock.calls[0][0]).toMatchObject({ where: { id: 'user-1' } })
    expect(profileUpdate.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date)
    await app.close()
  })

  it('410s an expired token', async () => {
    otpFindFirst.mockResolvedValue({
      id: 'otp-1',
      profileId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    })
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(410)
    expect(profileUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('410s an already-used token (no double consume)', async () => {
    otpFindFirst.mockResolvedValue({
      id: 'otp-1',
      profileId: 'user-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    })
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(410)
    await app.close()
  })

  it('410s an unknown token', async () => {
    otpFindFirst.mockResolvedValue(null)
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(410)
    await app.close()
  })
})

describe('POST /auth/resend-verification', () => {
  it('mints a replacement token and dispatches the email', async () => {
    profileFindUnique.mockResolvedValue({ emailVerifiedAt: null })
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    // Upsert keyed by (profileId, purpose) — resend replaces the old link.
    expect(otpUpsert.mock.calls[0][0].where).toMatchObject({
      profileId_purpose: { profileId: 'user-1', purpose: 'email_verify' },
    })
    expect(dispatchNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'auth.email_verification',
        vars: expect.objectContaining({
          verifyUrl: expect.stringContaining('/verify-email?token='),
        }),
      })
    )
    await app.close()
  })

  it('400s when the email is already verified', async () => {
    profileFindUnique.mockResolvedValue({ emailVerifiedAt: new Date() })
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    expect(otpUpsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('requires auth (401 without a token)', async () => {
    const { app } = await authed(PROFILE)
    const res = await app.inject({ method: 'POST', url: '/auth/resend-verification' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
