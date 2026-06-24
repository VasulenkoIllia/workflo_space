import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.BOT_LINK_SECRET = 'test-bot-secret'

// Bot-facing link completion (POST /telegram/link). Shared-secret auth, no user session —
// the security-critical boundary, so we assert it over a real app with a mocked @workflo/db.
const otpFindFirst = vi.fn()
const otpUpdate = vi.fn()
const settingsUpdateMany = vi.fn()
const settingsUpsert = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    otpToken: { findFirst: otpFindFirst, update: otpUpdate, upsert: vi.fn() },
    notificationSettings: {
      updateMany: settingsUpdateMany,
      upsert: settingsUpsert,
      findUnique: vi.fn(),
    },
  },
  tenantTransaction: (c: unknown, fn: (tx: unknown) => unknown) => fn(c),
  withTenant: (fn: (tx: unknown) => unknown) => fn({}),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

let app: Awaited<ReturnType<typeof buildApp>>
beforeAll(async () => {
  app = await buildApp()
})
afterEach(() => vi.clearAllMocks())

const link = (headers: Record<string, string>, payload: unknown) =>
  app.inject({ method: 'POST', url: '/telegram/link', headers, payload: payload as object })

describe('POST /telegram/link — bot-secret boundary', () => {
  it('rejects a missing secret with 401 (and never touches the DB)', async () => {
    const res = await link({}, { code: 'abcd1234', chatId: '99' })
    expect(res.statusCode).toBe(401)
    expect(otpFindFirst).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret with 401', async () => {
    const res = await link({ 'x-bot-secret': 'nope' }, { code: 'abcd1234', chatId: '99' })
    expect(res.statusCode).toBe(401)
    expect(otpFindFirst).not.toHaveBeenCalled()
  })

  it('links the chat to the profile on a valid code', async () => {
    otpFindFirst.mockResolvedValue({ id: 'otp-1', profileId: 'p-1', profile: { name: 'Іван' } })
    settingsUpdateMany.mockResolvedValue({ count: 0 })
    settingsUpsert.mockResolvedValue({})
    otpUpdate.mockResolvedValue({})

    const res = await link(
      { 'x-bot-secret': 'test-bot-secret' },
      { code: 'a'.repeat(32), chatId: '12345' }
    )
    expect(res.statusCode).toBe(200)
    expect(res.json().data.profileName).toBe('Іван')
    // chat stamped onto the profile's settings + the code burned
    expect(settingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profileId: 'p-1' } })
    )
    expect(otpUpdate).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { usedAt: expect.any(Date) },
    })
  })

  it('returns 400 for an invalid / expired code', async () => {
    otpFindFirst.mockResolvedValue(null)
    const res = await link(
      { 'x-bot-secret': 'test-bot-secret' },
      { code: 'b'.repeat(32), chatId: '12345' }
    )
    expect(res.statusCode).toBe(400)
    expect(settingsUpsert).not.toHaveBeenCalled()
    expect(otpUpdate).not.toHaveBeenCalled()
  })
})
