import { type LocaleKey, notifyRecipient } from '@workflo/notifications'
import type { FastifyBaseLogger } from 'fastify'

/**
 * Invite emails go to an address that may NOT yet have a profile, so they use
 * the profile-less notifyRecipient() path (audit D2) — same dispatch/render
 * pipeline as everything else (consistent templates + escaping), instead of a
 * bespoke sendEmail call. Fire-and-forget: never blocks the request path.
 */
function fireAndForget(
  logger: FastifyBaseLogger,
  label: string,
  to: string,
  promise: Promise<{ results: ReadonlyArray<{ result: { status: string } }> }>
): void {
  void promise
    .then((outcome) => {
      const ok = outcome.results.some((r) => r.result.status === 'sent')
      if (!ok) logger.warn({ to, label, outcome }, 'invite email not sent')
    })
    .catch((err: unknown) => {
      logger.error({ err, to, label }, 'invite email failed')
    })
}

export function sendExecutorInviteEmail(
  logger: FastifyBaseLogger,
  opts: {
    to: string
    inviterName: string
    acceptUrl: string
    expiresAt: string
    locale?: LocaleKey
  }
): void {
  const locale = opts.locale ?? 'uk'
  fireAndForget(
    logger,
    'executor_invite',
    opts.to,
    notifyRecipient({
      recipient: { email: opts.to, locale },
      event: 'system.invite_sent',
      vars: { inviterName: opts.inviterName, acceptUrl: opts.acceptUrl, expiresAt: opts.expiresAt },
    })
  )
}

export function sendCompanyMemberInviteEmail(
  logger: FastifyBaseLogger,
  opts: {
    to: string
    inviterName: string
    companyName: string
    acceptUrl: string
    locale?: LocaleKey
  }
): void {
  const locale = opts.locale ?? 'uk'
  fireAndForget(
    logger,
    'company_member_invite',
    opts.to,
    notifyRecipient({
      recipient: { email: opts.to, locale },
      event: 'system.invite_sent',
      vars: {
        inviterName: opts.inviterName,
        companyName: opts.companyName,
        acceptUrl: opts.acceptUrl,
      },
    })
  )
}
