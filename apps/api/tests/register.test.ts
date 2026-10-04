import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Must be set before app import (jwt plugin reads JWT_SECRET at register time).
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.PORTAL_URL = 'https://portal.test'

// ─── Mock @workflo/db ────────────────────────────────────────────────────────
class FakePrismaKnownError extends Error {
  code: string
  constructor(code: string) {
    super(`prisma error ${code}`)
    this.code = code
  }
}

const profileFindUnique = vi.fn()
const txProfileCreate = vi.fn()
const txCompanyFindUnique = vi.fn()
const txCompanyCreate = vi.fn()
const txCompanyMemberCreate = vi.fn()
const txNotificationSettingsCreate = vi.fn()
const txNotificationPreferenceCreateMany = vi.fn()
const txRefreshTokenCreate = vi.fn()
const txAgencyFindUnique = vi.fn()
const transaction = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    // register also mints the email-verify token (S9) — resolve quietly.
    otpToken: { upsert: vi.fn().mockResolvedValue({}) },
    $transaction: transaction,
  },
  tenantTransaction: (client: { $transaction: (fn: unknown) => unknown }, fn: unknown) =>
    client.$transaction(fn),
  Prisma: { PrismaClientKnownRequestError: FakePrismaKnownError },
}))

// ─── Mock @workflo/notifications ─────────────────────────────────────────────
const notify = vi.fn().mockResolvedValue({ results: [], attempted: [] })
vi.mock('@workflo/notifications', () => ({ notify }))

// Import AFTER mocks are declared (vi.mock is hoisted).
const { buildApp } = await import('../src/app.js')

function makeTxClient() {
  return {
    profile: { create: txProfileCreate },
    company: { findUnique: txCompanyFindUnique, create: txCompanyCreate },
    companyMember: { create: txCompanyMemberCreate },
    notificationSettings: { create: txNotificationSettingsCreate },
    notificationPreference: { createMany: txNotificationPreferenceCreateMany },
    refreshToken: { create: txRefreshTokenCreate },
    agency: { findUnique: txAgencyFindUnique },
  }
}

function wireHappyPath() {
  profileFindUnique.mockResolvedValue(null) // email free
  txProfileCreate.mockResolvedValue({ id: 'profile-1' })
  txCompanyFindUnique.mockResolvedValue(null) // slug free
  txCompanyCreate.mockResolvedValue({ id: 'company-1', name: 'Acme', slug: 'acme' })
  txAgencyFindUnique.mockResolvedValue({ id: 'agency-1' }) // platform tenant (ADR-004)
  txCompanyMemberCreate.mockResolvedValue({})
  txNotificationSettingsCreate.mockResolvedValue({ id: 'settings-1' })
  txNotificationPreferenceCreateMany.mockResolvedValue({ count: 21 })
  txRefreshTokenCreate.mockResolvedValue({})
  transaction.mockImplementation(async (cb: (tx: ReturnType<typeof makeTxClient>) => unknown) =>
    cb(makeTxClient())
  )
}

const validBody = {
  email: 'New@Example.com',
  password: 'supersecret',
  displayName: 'New User',
  companyName: 'Acme LLC',
}

describe('POST /auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notify.mockResolvedValue({ results: [], attempted: [] })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('registers a new user and returns 201 with token + profile + company', async () => {
    wireHappyPath()
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: validBody })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(typeof body.data.accessToken).toBe('string')
    expect(body.data.profile.email).toBe('new@example.com') // normalized lowercase
    expect(body.data.profile.role).toBe('client')
    expect(body.data.company.role).toBe('owner')
    await app.close()
  })

  it('sets an HttpOnly refresh cookie scoped to /auth/refresh', async () => {
    wireHappyPath()
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: validBody })

    const setCookie = res.headers['set-cookie']
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie)
    expect(cookieStr).toContain('refresh_token=')
    expect(cookieStr).toContain('HttpOnly')
    expect(cookieStr).toContain('Path=/auth/refresh')
    expect(cookieStr.toLowerCase()).toContain('samesite=lax')
    await app.close()
  })

  it('creates profile, company, owner membership, settings + 27 preferences', async () => {
    wireHappyPath()
    const app = buildApp()
    await app.inject({ method: 'POST', url: '/auth/register', payload: validBody })

    expect(txProfileCreate).toHaveBeenCalledOnce()
    expect(txCompanyCreate).toHaveBeenCalledOnce()
    expect(txCompanyMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'owner' }) })
    )
    const prefArg = txNotificationPreferenceCreateMany.mock.calls[0][0]
    expect(prefArg.data).toHaveLength(27) // 9 categories × 3 channels (SUPPORT + CALENDAR)
    await app.close()
  })

  it('dispatches a welcome notification (fire-and-forget)', async () => {
    wireHappyPath()
    const app = buildApp()
    await app.inject({ method: 'POST', url: '/auth/register', payload: validBody })
    // allow the fire-and-forget microtask to run
    await new Promise((r) => setTimeout(r, 0))

    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ event: 'auth.welcome', profileId: 'profile-1' })
    )
    await app.close()
  })

  it('returns 409 when email already exists', async () => {
    profileFindUnique.mockResolvedValue({ id: 'existing' })
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: validBody })

    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('CONFLICT')
    expect(transaction).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 409 on a unique-violation race inside the transaction', async () => {
    profileFindUnique.mockResolvedValue(null)
    transaction.mockRejectedValue(new FakePrismaKnownError('P2002'))
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: validBody })

    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('returns 400 for an invalid email', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...validBody, email: 'not-an-email' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    await app.close()
  })

  it('returns 400 for a too-short password', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...validBody, password: 'short' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
