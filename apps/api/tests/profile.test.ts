import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const profileFindUnique = vi.fn()
const profileUpdate = vi.fn()
const npFindUnique = vi.fn()
const npUpsert = vi.fn()
const npFindMany = vi.fn()
const nsFindUnique = vi.fn()
const nsUpsert = vi.fn()
const refreshTokenUpdateMany = vi.fn()
const auditLogCreate = vi.fn()
const transaction = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    profile: { findUnique: profileFindUnique, update: profileUpdate },
    notificationSettings: { findUnique: nsFindUnique, upsert: nsUpsert },
    notificationPreference: { findUnique: npFindUnique, upsert: npUpsert, findMany: npFindMany },
    refreshToken: { updateMany: refreshTokenUpdateMany },
    auditLog: { create: auditLogCreate },
    $transaction: transaction,
  },
  tenantTransaction: (client: { $transaction: (fn: unknown) => unknown }, fn: unknown) =>
    client.$transaction(fn),
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

async function authedApp() {
  const app = buildApp()
  await app.ready()
  const token = app.jwt.sign(CLAIMS)
  return { app, token }
}

describe('PATCH /profile', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('updates display name + theme and returns the profile', async () => {
    profileUpdate.mockResolvedValue({
      id: 'profile-1',
      email: 'u@e.com',
      name: 'New Name',
      role: 'client',
      language: 'uk',
      theme: 'dark',
      avatarUrl: null,
    })
    auditLogCreate.mockResolvedValue({})
    const { app, token } = await authedApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: { displayName: 'New Name', theme: 'dark' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.profile.displayName).toBe('New Name')
    const data = profileUpdate.mock.calls[0][0].data
    expect(data).toEqual({ name: 'New Name', theme: 'dark' })
    await app.close()
  })

  it('401 without a token', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile',
      payload: { displayName: 'X' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('400 for an empty body (no fields)', async () => {
    const { app, token } = await authedApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('PATCH /profile/password', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('changes password when current is correct and revokes sessions', async () => {
    profileFindUnique.mockResolvedValue({
      id: 'profile-1',
      passwordHash: bcrypt.hashSync('old-password', 12),
    })
    profileUpdate.mockResolvedValue({})
    refreshTokenUpdateMany.mockResolvedValue({ count: 3 })
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        profile: { update: profileUpdate },
        refreshToken: { updateMany: refreshTokenUpdateMany },
      })
    )
    auditLogCreate.mockResolvedValue({})
    const { app, token } = await authedApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'old-password', newPassword: 'new-strong-password' },
    })
    expect(res.statusCode).toBe(200)
    expect(transaction).toHaveBeenCalledOnce()
    await app.close()
  })

  it('400 when current password is wrong', async () => {
    profileFindUnique.mockResolvedValue({
      id: 'profile-1',
      passwordHash: bcrypt.hashSync('old-password', 12),
    })
    const { app, token } = await authedApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'wrong', newPassword: 'new-strong-password' },
    })
    expect(res.statusCode).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
    await app.close()
  })

  it('401 without a token', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile/password',
      payload: { currentPassword: 'x', newPassword: 'new-strong-password' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('PATCH /profile/notifications', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('upserts preferences and returns the full matrix', async () => {
    nsUpsert.mockResolvedValue({ id: 'settings-1' })
    npUpsert.mockResolvedValue({})
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ notificationPreference: { upsert: npUpsert } })
    )
    npFindMany.mockResolvedValue([
      { category: 'orders', channel: 'email', enabled: false },
      { category: 'orders', channel: 'telegram', enabled: true },
    ])
    auditLogCreate.mockResolvedValue({})
    const { app, token } = await authedApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile/notifications',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        preferences: [
          { category: 'orders', channel: 'email', enabled: false },
          { category: 'orders', channel: 'telegram', enabled: true },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.preferences).toHaveLength(2)
    await app.close()
  })

  it('rejects disabling email for a critical category (ADR-003)', async () => {
    const { app, token } = await authedApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile/notifications',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferences: [{ category: 'billing', channel: 'email', enabled: false }] },
    })
    expect(res.statusCode).toBe(400)
    expect(nsUpsert).not.toHaveBeenCalled() // rejected before any DB work
    await app.close()
  })

  it('allows disabling telegram for a critical category', async () => {
    nsUpsert.mockResolvedValue({ id: 'settings-1' })
    npUpsert.mockResolvedValue({})
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ notificationPreference: { upsert: npUpsert } })
    )
    npFindMany.mockResolvedValue([{ category: 'auth', channel: 'telegram', enabled: false }])
    auditLogCreate.mockResolvedValue({})
    const { app, token } = await authedApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile/notifications',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferences: [{ category: 'auth', channel: 'telegram', enabled: false }] },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('creates the settings row when missing (upsert, no 404)', async () => {
    nsUpsert.mockResolvedValue({ id: 'new-settings' })
    npUpsert.mockResolvedValue({})
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ notificationPreference: { upsert: npUpsert } })
    )
    npFindMany.mockResolvedValue([{ category: 'orders', channel: 'email', enabled: true }])
    auditLogCreate.mockResolvedValue({})
    const { app, token } = await authedApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile/notifications',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferences: [{ category: 'orders', channel: 'email', enabled: true }] },
    })
    expect(res.statusCode).toBe(200)
    expect(nsUpsert).toHaveBeenCalled()
    await app.close()
  })
})
