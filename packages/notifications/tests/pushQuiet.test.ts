import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationChannel } from '@workflo/types'

// S12-03/06: push-канал + тихі години. web-push мокаємо, щоб не ходити в мережу.
const sendNotification = vi.fn()
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}))

const { notify, inQuietHours } = await import('../src/notify.js')
const { resetPushAdapterForTests } = await import('../src/adapters/PushAdapter.js')
import type { NotifyPrisma } from '../src/notify.js'

function makePrismaStub(opts: {
  prefs: Array<{ channel: string }>
  quietFrom?: number | null
  quietTo?: number | null
}): NotifyPrisma {
  return {
    notificationPreference: {
      findMany: vi
        .fn()
        .mockResolvedValue(opts.prefs.map((p) => ({ channel: p.channel, enabled: true }))),
    },
    notificationSettings: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'settings-1',
        profileId: 'p1',
        language: 'uk',
        telegramChatId: null,
        quietFrom: opts.quietFrom ?? null,
        quietTo: opts.quietTo ?? null,
      }),
    },
    profile: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'p1', email: 'a@b.com', name: 'Test', language: 'uk' }),
    },
    notificationLog: { create: vi.fn().mockResolvedValue({}) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  }
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  delete process.env.VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
  resetPushAdapterForTests()
})

describe('inQuietHours — вікно тихих годин (Kyiv)', () => {
  // Липень: Kyiv = UTC+3. 20:00Z → 23:00 Kyiv; 09:00Z → 12:00 Kyiv.
  const at = (iso: string) => new Date(iso)
  it('вікно через північ 22→8: 23:00 Kyiv — тихо, 12:00 — ні', () => {
    expect(inQuietHours(22, 8, at('2026-07-11T20:00:00Z'))).toBe(true)
    expect(inQuietHours(22, 8, at('2026-07-11T09:00:00Z'))).toBe(false)
  })
  it('денне вікно 9→18: 12:00 Kyiv — тихо, 23:00 — ні', () => {
    expect(inQuietHours(9, 18, at('2026-07-11T09:00:00Z'))).toBe(true)
    expect(inQuietHours(9, 18, at('2026-07-11T20:00:00Z'))).toBe(false)
  })
  it('null або from===to → вимкнено', () => {
    expect(inQuietHours(null, 8, at('2026-07-11T20:00:00Z'))).toBe(false)
    expect(inQuietHours(10, 10, at('2026-07-11T09:00:00Z'))).toBe(false)
  })
})

describe('notify — тихі години (S12-06)', () => {
  it('некритична подія у вікні: email skipped quiet_hours, in_app лишається', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-11T20:00:00Z'), toFake: ['Date'] }) // 23:00 Kyiv
    const prisma = makePrismaStub({
      prefs: [{ channel: 'email' }, { channel: 'in_app' }],
      quietFrom: 22,
      quietTo: 8,
    })
    const out = await notify(
      { prisma, logger },
      {
        profileId: 'p1',
        event: 'orders.status_changed',
        vars: { orderTitle: 'X', orderUrl: 'u', newClientStatus: 'in_progress' },
        inApp: { title: 'Статус', body: 'Оновлено' },
      }
    )
    const email = out.results.find((r) => r.channel === NotificationChannel.EMAIL)
    expect(email?.result).toMatchObject({ status: 'skipped', reason: 'quiet_hours' })
    expect(prisma.notification.create).toHaveBeenCalled() // in_app пишеться завжди
  })

  it('критична подія (CRITICAL_EVENTS) ігнорує тихі години', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-11T20:00:00Z'), toFake: ['Date'] })
    const prisma = makePrismaStub({
      prefs: [{ channel: 'email' }],
      quietFrom: 22,
      quietTo: 8,
    })
    const out = await notify(
      { prisma, logger },
      { profileId: 'p1', event: 'auth.password_reset', vars: { resetUrl: 'https://x' } }
    )
    const email = out.results.find((r) => r.channel === NotificationChannel.EMAIL)
    expect(email).toBeDefined()
    if (email && 'reason' in email.result) {
      expect(email.result.reason).not.toBe('quiet_hours')
    }
  })
})

describe('notify — push-канал (S12-03)', () => {
  const pushPrefs = { prefs: [{ channel: 'push' }] }
  const inApp = { title: 'Тест', body: 'Пуш' }
  const sub = { endpoint: 'https://push.example/e1', p256dh: 'k', auth: 'a' }

  it('без inApp-пейлоада → skipped no_payload; без deps → push_deps_missing', async () => {
    const prisma = makePrismaStub(pushPrefs)
    const noPayload = await notify(
      {
        prisma,
        logger,
        pushSubscriptions: { list: async () => [sub], removeByEndpoint: async () => {} },
      },
      { profileId: 'p1', event: 'orders.status_changed', vars: {} }
    )
    expect(noPayload.results[0]?.result).toMatchObject({ reason: 'no_payload' })
    const noDeps = await notify(
      { prisma: makePrismaStub(pushPrefs), logger },
      { profileId: 'p1', event: 'orders.status_changed', vars: {}, inApp }
    )
    expect(noDeps.results[0]?.result).toMatchObject({ reason: 'push_deps_missing' })
  })

  it('без VAPID-ключів → skipped push_not_configured (канал м’яко вимкнений)', async () => {
    const prisma = makePrismaStub(pushPrefs)
    const out = await notify(
      {
        prisma,
        logger,
        pushSubscriptions: { list: async () => [sub], removeByEndpoint: async () => {} },
      },
      { profileId: 'p1', event: 'orders.status_changed', vars: {}, inApp }
    )
    expect(out.results[0]?.result).toMatchObject({
      status: 'skipped',
      reason: 'push_not_configured',
    })
  })

  it('з ключами: sent на живу підписку; 410 → підписка видаляється', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    resetPushAdapterForTests()
    sendNotification
      .mockResolvedValueOnce({}) // перша — жива
      .mockRejectedValueOnce({ statusCode: 410 }) // друга — Gone
    const removed: string[] = []
    const prisma = makePrismaStub(pushPrefs)
    const out = await notify(
      {
        prisma,
        logger,
        pushSubscriptions: {
          list: async () => [sub, { ...sub, endpoint: 'https://push.example/dead' }],
          removeByEndpoint: async (e) => void removed.push(e),
        },
      },
      { profileId: 'p1', event: 'orders.status_changed', vars: {}, inApp }
    )
    // друга підписка: 410 Gone
    expect(sendNotification).toHaveBeenCalledTimes(2)
    expect(out.results[0]?.result).toMatchObject({ status: 'sent' })
    expect(removed).toEqual(['https://push.example/dead'])
  })
})
