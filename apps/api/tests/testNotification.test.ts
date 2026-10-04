import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// DSN-7: «Тест» у хабі сповіщень — тестове повідомлення СОБІ через обраний канал.
const db = {
  notification: { create: vi.fn() },
  profile: { findUnique: vi.fn() },
  notificationSettings: { findUnique: vi.fn() },
}
const sendEmail = vi.fn()
const sendTelegram = vi.fn()
vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as { Prisma: unknown }
  return {
    prisma: db,
    Prisma: actual.Prisma,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  }
})
vi.mock('@workflo/notifications', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return { ...actual, notify: vi.fn(), sendEmail, sendTelegram }
})

const { buildApp } = await import('../src/app.js')

const ME = {
  sub: 'p-1',
  email: 'me@e.com',
  role: 'executor',
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' }],
  memberships: [],
}

async function post(payload: object) {
  const app = buildApp()
  await app.ready()
  const res = await app.inject({
    method: 'POST',
    url: '/notifications/test',
    headers: { authorization: `Bearer ${app.jwt.sign(ME as never)}` },
    payload,
  })
  await app.close()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('POST /notifications/test', () => {
  it('in_app → рядок сповіщення собі', async () => {
    db.notification.create.mockResolvedValue({})
    const res = await post({ channel: 'in_app' })
    expect(res.statusCode).toBe(200)
    expect(db.notification.create.mock.calls[0][0].data).toMatchObject({
      profileId: 'p-1',
      type: 'test',
    })
  })

  it('telegram без привʼязаного бота → 400 з поясненням, нічого не надсилаємо', async () => {
    db.notificationSettings.findUnique.mockResolvedValue({ telegramChatId: null })
    const res = await post({ channel: 'telegram' })
    expect(res.statusCode).toBe(400)
    expect(sendTelegram).not.toHaveBeenCalled()
  })

  it('email → лист на власну адресу; збій SMTP → 400', async () => {
    db.profile.findUnique.mockResolvedValue({ email: 'me@e.com' })
    sendEmail.mockResolvedValueOnce({ status: 'sent' })
    expect((await post({ channel: 'email' })).statusCode).toBe(200)
    expect(sendEmail.mock.calls[0][0].to).toBe('me@e.com')
    sendEmail.mockResolvedValueOnce({ status: 'failed', reason: 'transport_error', error: 'x' })
    expect((await post({ channel: 'email' })).statusCode).toBe(400)
  })

  it('невідомий канал → 400', async () => {
    expect((await post({ channel: 'sms' })).statusCode).toBe(400)
  })
})
