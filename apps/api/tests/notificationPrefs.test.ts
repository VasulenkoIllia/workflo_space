import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// PATCH/GET /profile/notifications — the (category × channel) preference matrix.
// Security/logic surface: ADR-003 email lock + profileId scoping + upsert-on-first-save.
const db = {
  notificationSettings: { upsert: vi.fn(), findUnique: vi.fn() },
  notificationPreference: { upsert: vi.fn(), findMany: vi.fn() },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
// Audit is fire-and-forget; stub it so it neither hits the DB nor leaks a rejection.
const writeAuditAsync = vi.fn()
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync }))

const { buildApp } = await import('../src/app.js')

const USER = {
  sub: 'profile-A',
  email: 'a@e.com',
  role: 'client' as const,
  activeCompanyId: 'company-1',
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

async function authed() {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(USER) }
}

const patch = (
  app: Awaited<ReturnType<typeof authed>>['app'],
  token: string | null,
  body: unknown
) =>
  app.inject({
    method: 'PATCH',
    url: '/profile/notifications',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: body as object,
  })

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('PATCH /profile/notifications', () => {
  it('returns 401 without a token (no writes)', async () => {
    const { app } = await authed()
    const res = await patch(app, null, { preferences: [] })
    expect(res.statusCode).toBe(401)
    expect(db.notificationSettings.upsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects disabling locked critical email (auth) with 400 — ADR-003', async () => {
    const { app, token } = await authed()
    const res = await patch(app, token, {
      preferences: [{ category: 'auth', channel: 'email', enabled: false }],
    })
    expect(res.statusCode).toBe(400)
    expect(db.notificationSettings.upsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects disabling locked critical email (billing) with 400 — ADR-003', async () => {
    const { app, token } = await authed()
    const res = await patch(app, token, {
      preferences: [{ category: 'billing', channel: 'email', enabled: false }],
    })
    expect(res.statusCode).toBe(400)
    expect(db.notificationSettings.upsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('allows disabling a NON-locked email category (orders)', async () => {
    db.notificationSettings.upsert.mockResolvedValue({ id: 'set-1' })
    db.notificationPreference.upsert.mockResolvedValue({})
    db.notificationPreference.findMany.mockResolvedValue([
      { category: 'orders', channel: 'email', enabled: false },
    ])
    const { app, token } = await authed()
    const res = await patch(app, token, {
      preferences: [{ category: 'orders', channel: 'email', enabled: false }],
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('saves the matrix for the caller (settings upsert scoped to profileId) and echoes it back', async () => {
    db.notificationSettings.upsert.mockResolvedValue({ id: 'set-1' })
    db.notificationPreference.upsert.mockResolvedValue({})
    db.notificationPreference.findMany.mockResolvedValue([
      { category: 'orders', channel: 'telegram', enabled: true },
      { category: 'auth', channel: 'email', enabled: true },
    ])
    const { app, token } = await authed()
    const res = await patch(app, token, {
      preferences: [
        { category: 'orders', channel: 'telegram', enabled: true },
        { category: 'auth', channel: 'email', enabled: true }, // enabling locked is fine
      ],
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.preferences).toHaveLength(2)
    // first save provisions the row; scoped to the caller.
    expect(db.notificationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profileId: 'profile-A' } })
    )
    expect(db.notificationPreference.upsert).toHaveBeenCalledTimes(2)
    // each pref row keyed by the resolved settingsId, never a client-supplied one.
    const firstPref = db.notificationPreference.upsert.mock.calls[0]![0] as {
      where: { settingsId_category_channel: { settingsId: string } }
    }
    expect(firstPref.where.settingsId_category_channel.settingsId).toBe('set-1')
    expect(writeAuditAsync).toHaveBeenCalledTimes(1)
    await app.close()
  })

  it('rejects an empty preferences array (400, min 1)', async () => {
    const { app, token } = await authed()
    const res = await patch(app, token, { preferences: [] })
    expect(res.statusCode).toBe(400)
    expect(db.notificationSettings.upsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects an unknown category (400)', async () => {
    const { app, token } = await authed()
    const res = await patch(app, token, {
      preferences: [{ category: 'made_up', channel: 'email', enabled: true }],
    })
    expect(res.statusCode).toBe(400)
    expect(db.notificationSettings.upsert).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('GET /profile/notifications', () => {
  it('returns 401 without a token', async () => {
    const { app } = await authed()
    const res = await app.inject({ method: 'GET', url: '/profile/notifications' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns an empty matrix when the profile has no settings row yet', async () => {
    db.notificationSettings.findUnique.mockResolvedValue(null)
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'GET',
      url: '/profile/notifications',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.preferences).toEqual([])
    expect(db.notificationPreference.findMany).not.toHaveBeenCalled()
    // read scoped to the caller's own profile.
    expect(db.notificationSettings.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profileId: 'profile-A' } })
    )
    await app.close()
  })

  it('returns the matrix scoped to the resolved settingsId', async () => {
    db.notificationSettings.findUnique.mockResolvedValue({ id: 'set-1' })
    db.notificationPreference.findMany.mockResolvedValue([
      { category: 'orders', channel: 'in_app', enabled: true },
    ])
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'GET',
      url: '/profile/notifications',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.preferences).toHaveLength(1)
    expect(db.notificationPreference.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { settingsId: 'set-1' } })
    )
    await app.close()
  })
})
