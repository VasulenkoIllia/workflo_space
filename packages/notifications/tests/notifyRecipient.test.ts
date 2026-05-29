import { describe, expect, it, vi } from 'vitest'
import { NotificationChannel } from '@workflo/types'
import { notifyRecipient } from '../src/notify.js'
import * as emailAdapter from '../src/adapters/EmailAdapter.js'
import * as telegramAdapter from '../src/adapters/TelegramAdapter.js'

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

describe('notifyRecipient (profile-less dispatch — D2)', () => {
  it('sends an executor invite email to a recipient with no profile', async () => {
    const spy = vi
      .spyOn(emailAdapter, 'sendEmail')
      .mockResolvedValue({ status: 'sent', messageId: '1' })

    const outcome = await notifyRecipient(
      {
        recipient: { email: 'new@exec.com', locale: 'uk' },
        event: 'system.invite_sent',
        vars: { inviterName: 'Admin', acceptUrl: 'https://work/invite/x', expiresAt: '2026-06-01' },
      },
      silentLogger
    )

    expect(outcome.attempted).toEqual([NotificationChannel.EMAIL])
    expect(spy).toHaveBeenCalledOnce()
    const payload = spy.mock.calls[0][0]
    expect(payload.to).toBe('new@exec.com')
    // Executor template (no companyName) → subject mentions Workspace
    expect(payload.subject).toContain('Workspace')
    spy.mockRestore()
  })

  it('renders the company-member invite template when companyName is present', async () => {
    const spy = vi
      .spyOn(emailAdapter, 'sendEmail')
      .mockResolvedValue({ status: 'sent', messageId: '2' })

    await notifyRecipient(
      {
        recipient: { email: 'invitee@e.com', locale: 'uk' },
        event: 'system.invite_sent',
        vars: { inviterName: 'Olena', companyName: 'Acme', acceptUrl: 'https://portal/invite/y' },
      },
      silentLogger
    )

    const payload = spy.mock.calls[0][0]
    expect(payload.subject).toContain('Acme')
    spy.mockRestore()
  })

  it('skips telegram when recipient has no chat id', async () => {
    const outcome = await notifyRecipient(
      {
        recipient: { email: 'a@b.com' },
        event: 'system.invite_sent',
        vars: { inviterName: 'X', acceptUrl: 'https://x' },
        channels: [NotificationChannel.TELEGRAM],
      },
      silentLogger
    )
    const tg = outcome.results[0]
    expect(tg.result.status).toBe('skipped')
  })

  it('does not throw on email transport failure (collects result)', async () => {
    const spy = vi
      .spyOn(emailAdapter, 'sendEmail')
      .mockResolvedValue({ status: 'failed', reason: 'transport_error', error: 'boom' })

    const outcome = await notifyRecipient(
      {
        recipient: { email: 'a@b.com' },
        event: 'system.invite_sent',
        vars: { inviterName: 'X', acceptUrl: 'https://x' },
      },
      silentLogger
    )
    expect(outcome.results[0].result.status).toBe('failed')
    spy.mockRestore()
  })

  it('marks unsupported channels (sms) as skipped', async () => {
    const outcome = await notifyRecipient(
      {
        recipient: { email: 'a@b.com' },
        event: 'system.invite_sent',
        vars: { inviterName: 'X', acceptUrl: 'https://x' },
        channels: [NotificationChannel.SMS],
      },
      silentLogger
    )
    expect(outcome.results[0].result.status).toBe('skipped')
    expect(telegramAdapter).toBeDefined()
  })
})
