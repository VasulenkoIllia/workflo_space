import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// ─── Mock @workflo/db ────────────────────────────────────────────────────────
const profileFindUnique = vi.fn()
const profileUpdate = vi.fn()
const otpFindFirst = vi.fn()
const otpUpsert = vi.fn()
const otpUpdate = vi.fn()

vi.mock('@workflo/db', () => {
  const db = {
    profile: { findUnique: profileFindUnique, update: profileUpdate },
    otpToken: { findFirst: otpFindFirst, upsert: otpUpsert, update: otpUpdate },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  }
  return {
    prisma: db,
    Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  }
})

const sendMail = vi.fn().mockResolvedValue({})
vi.mock('@workflo/notifications', () => ({
  notify: vi.fn(),
  getMailer: () => ({ sendMail }),
  getActiveFrom: () => ({ name: 'workflo', address: 'no-reply@workflo.space' }),
  renderEmailChangeConfirmEmail: (vars: { confirmUrl: string }) => ({
    subject: 'Підтвердіть нову адресу',
    html: `<a href="${vars.confirmUrl}">confirm</a>`,
  }),
}))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))
const dispatchNotification = vi.fn()
vi.mock('../src/services/notifications.js', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
}))

const { buildApp } = await import('../src/app.js')

import bcrypt from 'bcryptjs'
const VALID_HASH = bcrypt.hashSync('correct-password', 12)

const CLAIMS = {
  sub: 'user-1',
  email: 'old@example.com',
  role: 'client',
  activeAgencyId: null,
  activeCompanyId: null,
  agencyMemberships: [],
  memberships: [],
}

async function authed() {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(CLAIMS) }
}

/** Роут двічі кличе profile.findUnique: за id (акаунт) і за email (зайнятість). */
function wireProfileLookups({ taken = false } = {}) {
  profileFindUnique.mockImplementation((args: { where: { id?: string; email?: string } }) => {
    if (args.where.id) {
      return Promise.resolve({
        id: 'user-1',
        email: 'old@example.com',
        passwordHash: VALID_HASH,
        pendingEmail: 'new@example.com',
      })
    }
    return Promise.resolve(taken ? { id: 'other-user' } : null)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  profileUpdate.mockResolvedValue({})
  otpUpsert.mockResolvedValue({})
  otpUpdate.mockResolvedValue({})
  sendMail.mockResolvedValue({})
})
afterEach(() => vi.clearAllMocks())

describe('POST /auth/change-email (01-Г)', () => {
  const body = { newEmail: 'New@Example.com', password: 'correct-password' }

  it('re-auths with the password, stores pendingEmail, mails BOTH addresses', async () => {
    wireProfileLookups()
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-email',
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.pendingEmail).toBe('new@example.com')
    expect(profileUpdate.mock.calls[0][0].data.pendingEmail).toBe('new@example.com')
    expect(otpUpsert.mock.calls[0][0].where.profileId_purpose.purpose).toBe('email_change')
    // попередження — на СТАРУ адресу через notify-канал
    expect(dispatchNotification.mock.calls[0][1]).toMatchObject({
      event: 'auth.email_change_requested',
      vars: { newEmail: 'new@example.com' },
    })
    // confirm-лінк — на НОВУ адресу напряму мейлером
    await new Promise((r) => setTimeout(r, 0))
    expect(sendMail.mock.calls[0][0].to).toBe('new@example.com')
    expect(sendMail.mock.calls[0][0].html).toContain('/confirm-email-change?token=')
    await app.close()
  })

  it('401s on a wrong password (re-auth guard)', async () => {
    wireProfileLookups()
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-email',
      headers: { authorization: `Bearer ${token}` },
      payload: { ...body, password: 'wrong-password' },
    })
    expect(res.statusCode).toBe(401)
    expect(profileUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('409s when the new address is already taken', async () => {
    wireProfileLookups({ taken: true })
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-email',
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    })
    expect(res.statusCode).toBe(409)
    expect(profileUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('400s when the new address equals the current one', async () => {
    wireProfileLookups()
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-email',
      headers: { authorization: `Bearer ${token}` },
      payload: { ...body, newEmail: 'old@example.com' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('401s without a session (authenticated-only)', async () => {
    const { app } = await authed()
    const res = await app.inject({ method: 'POST', url: '/auth/change-email', payload: body })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('POST /auth/confirm-email-change (01-Г)', () => {
  const liveToken = () =>
    otpFindFirst.mockResolvedValue({
      id: 'otp-1',
      profileId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    })

  it('consumes the token and flips email → pendingEmail (verified)', async () => {
    liveToken()
    wireProfileLookups() // by-email lookup → null (адреса вільна)
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/confirm-email-change',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.changed).toBe(true)
    expect(otpUpdate.mock.calls[0][0].data.usedAt).toBeInstanceOf(Date)
    const upd = profileUpdate.mock.calls[0][0]
    expect(upd.data.email).toBe('new@example.com')
    expect(upd.data.pendingEmail).toBeNull()
    expect(upd.data.emailVerifiedAt).toBeInstanceOf(Date)
    await app.close()
  })

  it('409s when the address got taken between request and confirm (race)', async () => {
    liveToken()
    wireProfileLookups({ taken: true })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/confirm-email-change',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(409)
    expect(profileUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('410s an expired/used/unknown token', async () => {
    otpFindFirst.mockResolvedValue(null)
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/confirm-email-change',
      payload: { token: 'a'.repeat(43) },
    })
    expect(res.statusCode).toBe(410)
    await app.close()
  })
})
