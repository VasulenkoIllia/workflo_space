import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// S12-06: ранковий дайджест — збірка непрочитаних Notification-рядків у один email.
const db = {
  notificationSettings: { findMany: vi.fn(), update: vi.fn() },
  notification: { findMany: vi.fn() },
}

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    prisma: db,
    runWithSystemContext: (fn: () => unknown) => fn(),
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  }
})

const dispatchNotification = vi.fn()
vi.mock('../src/services/notifications.js', () => ({ dispatchNotification }))

const { runNotifyDigestOnce } = await import('../src/cron/notifyDigest.js')

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
} as never

// Липень: Kyiv = UTC+3 → 05:00Z = 08:00 Kyiv (дайджест-година), 12:00Z = 15:00 Kyiv.
const AT_8_KYIV = new Date('2026-07-11T05:10:00Z')
const AT_15_KYIV = new Date('2026-07-11T12:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  db.notificationSettings.update.mockResolvedValue({})
})
afterEach(() => vi.clearAllMocks())

describe('runNotifyDigestOnce (S12-06)', () => {
  it('поза 8-ю Kyiv — не робить нічого', async () => {
    const sent = await runNotifyDigestOnce(logger, AT_15_KYIV)
    expect(sent).toBe(0)
    expect(db.notificationSettings.findMany).not.toHaveBeenCalled()
  })

  it('о 8-й: шле system.digest зі списком сповіщень і зсуває lastDigestAt', async () => {
    db.notificationSettings.findMany.mockResolvedValue([
      { id: 's1', profileId: 'p1', lastDigestAt: new Date('2026-07-10T05:00:00Z') },
    ])
    db.notification.findMany.mockResolvedValue([
      { title: 'Статус змінено', body: 'Замовлення X → в роботі' },
      { title: 'Нова заявка', body: 'Відпустка 5 дн.' },
    ])
    const sent = await runNotifyDigestOnce(logger, AT_8_KYIV)
    expect(sent).toBe(1)
    expect(dispatchNotification).toHaveBeenCalledWith(
      logger,
      expect.objectContaining({
        profileId: 'p1',
        event: 'system.digest',
        vars: expect.objectContaining({
          count: 2,
          rows: [
            ['Статус змінено', 'Замовлення X → в роботі'],
            ['Нова заявка', 'Відпустка 5 дн.'],
          ],
        }),
      })
    )
    expect(db.notificationSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } })
    )
  })

  it('порожньо: маркер зсувається, лист НЕ шлеться', async () => {
    db.notificationSettings.findMany.mockResolvedValue([
      { id: 's1', profileId: 'p1', lastDigestAt: null },
    ])
    db.notification.findMany.mockResolvedValue([])
    const sent = await runNotifyDigestOnce(logger, AT_8_KYIV)
    expect(sent).toBe(0)
    expect(dispatchNotification).not.toHaveBeenCalled()
    expect(db.notificationSettings.update).toHaveBeenCalled()
  })
})
