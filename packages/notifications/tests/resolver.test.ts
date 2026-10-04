import { describe, expect, it, vi } from 'vitest'
import { NotificationChannel } from '@workflo/types'
import { resolveTargetChannels, type ResolverPrisma } from '../src/resolver.js'

function makePrisma(prefs: Array<{ channel: string; enabled?: boolean }>): ResolverPrisma {
  const rows = prefs.map((p) => ({ channel: p.channel, enabled: p.enabled ?? true }))
  return {
    notificationPreference: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
  }
}

describe('resolveTargetChannels', () => {
  it('returns enabled channels for a non-critical event', async () => {
    const prisma = makePrisma([
      { channel: 'email' },
      { channel: 'telegram' },
      { channel: 'in_app' },
    ])
    const result = await resolveTargetChannels(prisma, 'settings-1', 'orders.status_changed')
    expect(result).toEqual([
      NotificationChannel.EMAIL,
      NotificationChannel.TELEGRAM,
      NotificationChannel.IN_APP,
    ])
  })

  it('forces email for critical event even when user disabled it', async () => {
    // User has only telegram enabled — but password_reset is critical
    const prisma = makePrisma([{ channel: 'telegram' }])
    const result = await resolveTargetChannels(prisma, 'settings-1', 'auth.password_reset')
    expect(result).toContain(NotificationChannel.EMAIL)
    expect(result).toContain(NotificationChannel.TELEGRAM)
  })

  it('filters out channels that are globally disabled (sms/push/webhook)', async () => {
    // User somehow enabled sms preference — but CHANNELS.sms.enabled=false
    const prisma = makePrisma([{ channel: 'email' }, { channel: 'sms' }])
    const result = await resolveTargetChannels(prisma, 'settings-1', 'orders.status_changed')
    expect(result).toContain(NotificationChannel.EMAIL)
    expect(result).not.toContain(NotificationChannel.SMS)
  })

  it('unconfigured category (zero rows) defaults to in_app (нова категорія не губиться)', async () => {
    const prisma = makePrisma([])
    const result = await resolveTargetChannels(prisma, 'settings-1', 'orders.status_changed')
    expect(result).toEqual([NotificationChannel.IN_APP])
  })

  it('explicit all-disabled → zero channels (вибір поважається)', async () => {
    const prisma = makePrisma([
      { channel: 'email', enabled: false },
      { channel: 'telegram', enabled: false },
      { channel: 'in_app', enabled: false },
    ])
    const result = await resolveTargetChannels(prisma, 'settings-1', 'orders.status_changed')
    expect(result).toEqual([])
  })

  it('critical event + zero prefs → email (critical) + in_app (default)', async () => {
    const prisma = makePrisma([])
    const result = await resolveTargetChannels(prisma, 'settings-1', 'billing.invoice_sent')
    expect(result).toEqual([NotificationChannel.EMAIL, NotificationChannel.IN_APP])
  })

  it('queries Prisma with the correct category from EVENT_TO_CATEGORY', async () => {
    const prisma = makePrisma([])
    await resolveTargetChannels(prisma, 'settings-1', 'chat.new_comment')
    const findMany = prisma.notificationPreference.findMany as ReturnType<typeof vi.fn>
    expect(findMany).toHaveBeenCalledWith({
      where: { settingsId: 'settings-1', category: 'chat' },
      select: { channel: true, enabled: true },
    })
  })

  it('deduplicates channels (prefs row + critical lock pointing at same channel)', async () => {
    const prisma = makePrisma([{ channel: 'email' }])
    const result = await resolveTargetChannels(prisma, 'settings-1', 'auth.password_reset')
    const emailCount = result.filter((c) => c === NotificationChannel.EMAIL).length
    expect(emailCount).toBe(1)
  })

  it('returns channels in stable order: email, telegram, in_app', async () => {
    const prisma = makePrisma([
      { channel: 'in_app' },
      { channel: 'telegram' },
      { channel: 'email' },
    ])
    const result = await resolveTargetChannels(prisma, 'settings-1', 'orders.status_changed')
    expect(result).toEqual([
      NotificationChannel.EMAIL,
      NotificationChannel.TELEGRAM,
      NotificationChannel.IN_APP,
    ])
  })
})
