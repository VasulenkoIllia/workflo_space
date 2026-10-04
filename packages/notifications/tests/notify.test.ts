import { describe, expect, it, vi } from 'vitest'
import { NotificationChannel } from '@workflo/types'
import { notify, type NotifyPrisma } from '../src/notify.js'

function makePrismaStub(opts: {
  prefs?: Array<{ channel: string; enabled?: boolean }>
  hasSettings?: boolean
  hasProfile?: boolean
  telegramChatId?: string | null
}): NotifyPrisma {
  const {
    prefs = [{ channel: 'email' }, { channel: 'in_app' }],
    hasSettings = true,
    hasProfile = true,
    telegramChatId = null,
  } = opts

  return {
    notificationPreference: {
      findMany: vi
        .fn()
        .mockResolvedValue(prefs.map((p) => ({ channel: p.channel, enabled: p.enabled ?? true }))),
    },
    notificationSettings: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          hasSettings ? { id: 'settings-1', profileId: 'p1', language: 'uk', telegramChatId } : null
        ),
    },
    profile: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          hasProfile ? { id: 'p1', email: 'a@b.com', name: 'Test User', language: 'uk' } : null
        ),
    },
    notificationLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    notification: {
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('notify', () => {
  it('returns empty when settings row is missing', async () => {
    const prisma = makePrismaStub({ hasSettings: false })
    const result = await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      { profileId: 'p1', event: 'orders.status_changed', vars: {} }
    )
    expect(result.attempted).toEqual([])
    expect(prisma.notificationLog.create).not.toHaveBeenCalled()
  })

  it('returns empty when profile row is missing', async () => {
    const prisma = makePrismaStub({ hasProfile: false })
    const result = await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      { profileId: 'p1', event: 'orders.status_changed', vars: {} }
    )
    expect(result.attempted).toEqual([])
  })

  it('dispatches email channel and logs result', async () => {
    const prisma = makePrismaStub({ prefs: [{ channel: 'email' }] })
    const result = await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      {
        profileId: 'p1',
        event: 'auth.welcome',
        vars: { portalUrl: 'https://portal' },
      }
    )
    expect(result.attempted).toEqual([NotificationChannel.EMAIL])
    expect(prisma.notificationLog.create).toHaveBeenCalledOnce()
    const logCall = (prisma.notificationLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(logCall.data.channel).toBe('email')
    expect(logCall.data.event).toBe('auth.welcome')
  })

  it('skips telegram with reason=no_chat_id when telegramChatId is null', async () => {
    const prisma = makePrismaStub({
      prefs: [{ channel: 'telegram' }],
      telegramChatId: null,
    })
    const result = await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      { profileId: 'p1', event: 'orders.status_changed', vars: {} }
    )
    const tg = result.results.find((r) => r.channel === NotificationChannel.TELEGRAM)
    expect(tg).toBeDefined()
    expect(tg!.result.status).toBe('skipped')
    if (tg!.result.status === 'skipped') {
      expect(tg!.result.reason).toBe('no_chat_id')
    }
  })

  it('persists in_app row when input.inApp is provided', async () => {
    const prisma = makePrismaStub({ prefs: [{ channel: 'in_app' }] })
    await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      {
        profileId: 'p1',
        event: 'orders.status_changed',
        vars: { orderTitle: 'X' },
        inApp: { title: 'In-app title', body: 'In-app body' },
      }
    )
    expect(prisma.notification.create).toHaveBeenCalledOnce()
  })

  it('redacts sensitive vars (resetUrl/token) before persisting to notification_logs (SC-1)', async () => {
    const prisma = makePrismaStub({ prefs: [{ channel: 'email' }] })
    await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      {
        profileId: 'p1',
        event: 'auth.password_reset',
        vars: { resetUrl: 'https://portal/reset?token=SECRET123', name: 'Bob' },
      }
    )
    const logCall = (prisma.notificationLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const persistedVars = logCall.data.metadata.vars
    expect(persistedVars.resetUrl).toBe('[redacted]')
    expect(persistedVars.name).toBe('Bob') // non-sensitive kept
    expect(JSON.stringify(logCall)).not.toContain('SECRET123')
  })

  it('always logs to notification_logs even for skipped dispatches', async () => {
    const prisma = makePrismaStub({ prefs: [{ channel: 'telegram' }] })
    await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      { profileId: 'p1', event: 'orders.status_changed', vars: {} }
    )
    expect(prisma.notificationLog.create).toHaveBeenCalled()
  })

  it('skips email with reason=suppressed when emailSuppressed returns true (S12-05)', async () => {
    const prisma = makePrismaStub({ prefs: [{ channel: 'email' }] })
    const emailSuppressed = vi.fn().mockResolvedValue(true)
    const result = await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, emailSuppressed },
      { profileId: 'p1', event: 'system.broadcast', vars: { subject: 'X', bodyHtml: '<p>x</p>' } }
    )
    expect(emailSuppressed).toHaveBeenCalledWith('a@b.com')
    const em = result.results.find((r) => r.channel === NotificationChannel.EMAIL)
    expect(em!.result.status).toBe('skipped')
    if (em!.result.status === 'skipped') {
      expect(em!.result.reason).toBe('suppressed')
    }
  })

  it('dispatches email normally when emailSuppressed returns false (S12-05)', async () => {
    const prisma = makePrismaStub({ prefs: [{ channel: 'email' }] })
    const emailSuppressed = vi.fn().mockResolvedValue(false)
    const result = await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, emailSuppressed },
      { profileId: 'p1', event: 'auth.welcome', vars: { portalUrl: 'https://portal' } }
    )
    const em = result.results.find((r) => r.channel === NotificationChannel.EMAIL)
    expect(em!.result.status).not.toBe('skipped')
  })

  it('continues dispatching subsequent channels when one fails', async () => {
    const prisma = makePrismaStub({
      prefs: [{ channel: 'email' }, { channel: 'in_app' }],
    })
    const result = await notify(
      { prisma, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      {
        profileId: 'p1',
        event: 'auth.welcome',
        vars: { portalUrl: 'https://portal' },
        inApp: { title: 'T', body: 'B' },
      }
    )
    expect(result.attempted).toHaveLength(2)
  })
})
