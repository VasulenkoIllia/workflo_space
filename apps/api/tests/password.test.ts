import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.APP_PORTAL_URL = 'https://portal.test'

const profileFindUnique = vi.fn()
const profileUpdate = vi.fn()
const prtCreate = vi.fn()
const prtFindUnique = vi.fn()
const prtUpdate = vi.fn()
const refreshTokenUpdateMany = vi.fn()
const auditLogCreate = vi.fn()
const transaction = vi.fn()
const notify = vi.fn().mockResolvedValue({ results: [], attempted: [] })

vi.mock('@workflo/db', () => ({
  prisma: {
    profile: { findUnique: profileFindUnique, update: profileUpdate },
    passwordResetToken: { create: prtCreate, findUnique: prtFindUnique, update: prtUpdate },
    refreshToken: { updateMany: refreshTokenUpdateMany },
    auditLog: { create: auditLogCreate },
    notificationSettings: { findUnique: vi.fn() },
    $transaction: transaction,
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))

vi.mock('@workflo/notifications', () => ({ notify }))

const { buildApp } = await import('../src/app.js')

describe('POST /auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('creates a reset token + dispatches notification for an existing active account', async () => {
    profileFindUnique.mockResolvedValue({ id: 'p1', isActive: true })
    prtCreate.mockResolvedValue({ token: 'reset-tok-123' })
    auditLogCreate.mockResolvedValue({})

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'User@Example.com' },
    })
    expect(res.statusCode).toBe(200)
    await new Promise((r) => setTimeout(r, 0))

    expect(prtCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'user@example.com' }) })
    )
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'auth.password_reset',
        vars: expect.objectContaining({
          resetUrl: expect.stringContaining('reset-password?token=reset-tok-123'),
        }),
      })
    )
    await app.close()
  })

  it('returns 200 WITHOUT creating a token for an unknown email (anti-enumeration)', async () => {
    profileFindUnique.mockResolvedValue(null)
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'nobody@example.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(prtCreate).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    await app.close()
  })

  it('does not dispatch for a deactivated account but still returns 200', async () => {
    profileFindUnique.mockResolvedValue({ id: 'p1', isActive: false })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'u@e.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(prtCreate).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('POST /auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  function wireValidToken() {
    prtFindUnique.mockResolvedValue({
      id: 'prt-1',
      email: 'u@e.com',
      usedAt: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    })
    profileFindUnique.mockResolvedValue({ id: 'p1', isActive: true })
    transaction.mockResolvedValue([{}, {}, { count: 2 }])
    auditLogCreate.mockResolvedValue({})
  }

  it('resets the password, marks token used, revokes sessions', async () => {
    wireValidToken()
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'reset-tok-123', password: 'new-strong-password' },
    })
    expect(res.statusCode).toBe(200)
    // transaction was called with the 3 ops (update profile, use token, revoke refresh)
    expect(transaction).toHaveBeenCalledOnce()
    expect(transaction.mock.calls[0][0]).toHaveLength(3)
    await app.close()
  })

  it('returns 410 for an unknown token', async () => {
    prtFindUnique.mockResolvedValue(null)
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'bad', password: 'new-strong-password' },
    })
    expect(res.statusCode).toBe(410)
    await app.close()
  })

  it('returns 410 for a used token', async () => {
    prtFindUnique.mockResolvedValue({
      id: 'prt-1',
      email: 'u@e.com',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 100000),
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'reset-tok-123', password: 'new-strong-password' },
    })
    expect(res.statusCode).toBe(410)
    expect(transaction).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 410 for an expired token', async () => {
    prtFindUnique.mockResolvedValue({
      id: 'prt-1',
      email: 'u@e.com',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'reset-tok-123', password: 'new-strong-password' },
    })
    expect(res.statusCode).toBe(410)
    await app.close()
  })

  it('returns 400 for a too-short password', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'reset-tok-123', password: 'short' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
