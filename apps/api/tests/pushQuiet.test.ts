import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// S12-03/06: push-підписки (upsert по endpoint, tenant-незалежні) + quiet/digest PATCH.
const db = {
  pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn() },
  notificationSettings: { upsert: vi.fn(), findUnique: vi.fn() },
  notificationPreference: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  }
})
vi.mock('@workflo/notifications', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return { ...actual, pushPublicKey: () => 'test-public-key' }
})

const { buildApp } = await import('../src/app.js')

const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}

async function authed() {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(OWNER as object) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.auditLog.create.mockResolvedValue({})
})
afterEach(() => vi.clearAllMocks())

describe('S12-03 push-підписки', () => {
  it('vapid-key віддається авторизованому', async () => {
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'GET',
      url: '/notifications/push/vapid-key',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.publicKey).toBe('test-public-key')
    await app.close()
  })

  it('subscribe: upsert по endpoint з profileId поточного юзера', async () => {
    db.pushSubscription.upsert.mockResolvedValue({})
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/push/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        endpoint: 'https://push.example/abc',
        p256dh: 'k'.repeat(20),
        auth: 'a'.repeat(10),
      },
    })
    expect(res.statusCode).toBe(201)
    const call = db.pushSubscription.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ endpoint: 'https://push.example/abc' })
    expect(call.create.profileId).toBe('owner-1')
    expect(call.update.profileId).toBe('owner-1') // ре-байнд браузера на інший акаунт
    await app.close()
  })

  it('unsubscribe: видаляє ЛИШЕ власну підписку (endpoint + profileId)', async () => {
    db.pushSubscription.deleteMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'DELETE',
      url: '/notifications/push/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { endpoint: 'https://push.example/abc' },
    })
    expect(res.statusCode).toBe(200)
    expect(db.pushSubscription.deleteMany.mock.calls[0][0].where).toEqual({
      endpoint: 'https://push.example/abc',
      profileId: 'owner-1',
    })
    await app.close()
  })
})

describe('S12-06 quiet/digest PATCH', () => {
  it('quietFrom без quietTo → 400; валідна пара + digest зберігаються', async () => {
    const { app, token } = await authed()
    const bad = await app.inject({
      method: 'PATCH',
      url: '/profile/notification-settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { quietFrom: 22 },
    })
    expect(bad.statusCode).toBe(400)

    db.notificationSettings.upsert.mockResolvedValue({
      quietFrom: 22,
      quietTo: 8,
      digestDaily: true,
    })
    const ok = await app.inject({
      method: 'PATCH',
      url: '/profile/notification-settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { quietFrom: 22, quietTo: 8, digestDaily: true },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data).toMatchObject({ quietFrom: 22, quietTo: 8, digestDaily: true })
    await app.close()
  })

  it('вимкнення: обидва null проходять', async () => {
    db.notificationSettings.upsert.mockResolvedValue({
      quietFrom: null,
      quietTo: null,
      digestDaily: false,
    })
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'PATCH',
      url: '/profile/notification-settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { quietFrom: null, quietTo: null },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
