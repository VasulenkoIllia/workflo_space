import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.TELEGRAM_BOT_USERNAME = 'workflo_bot'
process.env.BOT_LINK_SECRET = 'test-bot-secret'

// User-facing Telegram linking (connect / status / unlink) + the link endpoint's chat
// reassignment & config-gating — the parts telegram.test.ts (bot-secret boundary) doesn't cover.
const otpUpsert = vi.fn()
const otpFindFirst = vi.fn()
const otpUpdate = vi.fn()
const settingsFindUnique = vi.fn()
const settingsUpdateMany = vi.fn()
const settingsUpsert = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    otpToken: { upsert: otpUpsert, findFirst: otpFindFirst, update: otpUpdate },
    notificationSettings: {
      findUnique: settingsFindUnique,
      updateMany: settingsUpdateMany,
      upsert: settingsUpsert,
    },
    $transaction: (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)({}),
  },
  tenantTransaction: (c: unknown, fn: (tx: unknown) => unknown) => fn(c),
  withTenant: (fn: (tx: unknown) => unknown) => fn({}),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

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

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TELEGRAM_BOT_USERNAME = 'workflo_bot'
  process.env.BOT_LINK_SECRET = 'test-bot-secret'
})
afterEach(() => vi.clearAllMocks())

describe('POST /profile/telegram/connect — mint deep link', () => {
  it('returns 401 without a token (no DB touched)', async () => {
    const { app } = await authed()
    const res = await app.inject({ method: 'POST', url: '/profile/telegram/connect' })
    expect(res.statusCode).toBe(401)
    expect(otpUpsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 503 when the bot username is not configured', async () => {
    delete process.env.TELEGRAM_BOT_USERNAME
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/profile/telegram/connect',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(503)
    expect(otpUpsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('mints a profile-scoped one-time code and returns a t.me deep link', async () => {
    otpUpsert.mockResolvedValue({})
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/profile/telegram/connect',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const { deepLink, expiresAt } = res.json().data
    expect(deepLink).toMatch(/^https:\/\/t\.me\/workflo_bot\?start=[0-9a-f]{32}$/)
    expect(expiresAt).toBeTruthy()
    // upsert keyed on the (profileId, purpose) unique → one active code per profile.
    const arg = otpUpsert.mock.calls[0]![0] as {
      where: { profileId_purpose: { profileId: string; purpose: string } }
      create: { purpose: string; channel: string }
    }
    expect(arg.where.profileId_purpose).toEqual({
      profileId: 'profile-A',
      purpose: 'telegram_link',
    })
    expect(arg.create.purpose).toBe('telegram_link')
    await app.close()
  })
})

describe('GET /profile/telegram — link status', () => {
  it('returns 401 without a token', async () => {
    const { app } = await authed()
    const res = await app.inject({ method: 'GET', url: '/profile/telegram' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('reports unlinked when there is no chat id', async () => {
    settingsFindUnique.mockResolvedValue(null)
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'GET',
      url: '/profile/telegram',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ linked: false, linkedAt: null })
    // status is read for the caller's own profile only.
    expect(settingsFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profileId: 'profile-A' } })
    )
    await app.close()
  })

  it('reports linked + linkedAt when a chat is bound', async () => {
    const at = new Date('2026-06-01T00:00:00Z')
    settingsFindUnique.mockResolvedValue({ telegramChatId: '12345', telegramLinkedAt: at })
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'GET',
      url: '/profile/telegram',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.linked).toBe(true)
    expect(res.json().data.linkedAt).toBe(at.toISOString())
    await app.close()
  })
})

describe('DELETE /profile/telegram — unlink', () => {
  it('returns 401 without a token', async () => {
    const { app } = await authed()
    const res = await app.inject({ method: 'DELETE', url: '/profile/telegram' })
    expect(res.statusCode).toBe(401)
    expect(settingsUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it("clears the caller's own chat binding only", async () => {
    settingsUpdateMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'DELETE',
      url: '/profile/telegram',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ linked: false })
    expect(settingsUpdateMany).toHaveBeenCalledWith({
      where: { profileId: 'profile-A' },
      data: { telegramChatId: null, telegramLinkedAt: null },
    })
    await app.close()
  })
})

describe('POST /telegram/link — config & chat reassignment', () => {
  it('returns 503 when BOT_LINK_SECRET is not configured', async () => {
    delete process.env.BOT_LINK_SECRET
    const { app } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/telegram/link',
      headers: { 'x-bot-secret': 'anything' },
      payload: { code: 'a'.repeat(32), chatId: '1' },
    })
    expect(res.statusCode).toBe(503)
    expect(otpFindFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects a same-length wrong secret with 401 (timing-safe compare)', async () => {
    // same byte length as 'test-bot-secret' but different content → exercises timingSafeEqual.
    const wrong = 'x'.repeat('test-bot-secret'.length)
    const { app } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/telegram/link',
      headers: { 'x-bot-secret': wrong },
      payload: { code: 'a'.repeat(32), chatId: '1' },
    })
    expect(res.statusCode).toBe(401)
    expect(otpFindFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('rebinds a chat already linked to another profile (single-owner invariant)', async () => {
    otpFindFirst.mockResolvedValue({ id: 'otp-1', profileId: 'p-new', profile: { name: 'New' } })
    settingsUpdateMany.mockResolvedValue({ count: 1 }) // released from the prior owner
    settingsUpsert.mockResolvedValue({})
    otpUpdate.mockResolvedValue({})
    const { app } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/telegram/link',
      headers: { 'x-bot-secret': 'test-bot-secret' },
      payload: { code: 'a'.repeat(32), chatId: 'chat-9' },
    })
    expect(res.statusCode).toBe(200)
    // release: same chat is unbound from every OTHER profile before binding here.
    expect(settingsUpdateMany).toHaveBeenCalledWith({
      where: { telegramChatId: 'chat-9', profileId: { not: 'p-new' } },
      data: { telegramChatId: null, telegramLinkedAt: null },
    })
    expect(settingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profileId: 'p-new' } })
    )
    expect(otpUpdate).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { usedAt: expect.any(Date) },
    })
    await app.close()
  })

  it('rejects a too-short code at the schema (400)', async () => {
    const { app } = await authed()
    const res = await app.inject({
      method: 'POST',
      url: '/telegram/link',
      headers: { 'x-bot-secret': 'test-bot-secret' },
      payload: { code: 'short', chatId: '1' },
    })
    expect(res.statusCode).toBe(400)
    expect(otpFindFirst).not.toHaveBeenCalled()
    await app.close()
  })
})
