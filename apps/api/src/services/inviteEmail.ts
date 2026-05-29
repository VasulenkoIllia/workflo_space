import {
  type LocaleKey,
  renderInviteCompanyMemberEmail,
  renderInviteExecutorEmail,
  sendEmail,
} from '@workflo/notifications'
import type { FastifyBaseLogger } from 'fastify'

/**
 * Invite emails go to an address that may NOT yet have a profile, so they
 * bypass the profile-centric notify() pipeline and render + send directly.
 * Fire-and-forget: never blocks or throws into the request path.
 */
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
  const tpl = renderInviteExecutorEmail({
    inviterName: opts.inviterName,
    acceptUrl: opts.acceptUrl,
    expiresAt: opts.expiresAt,
    locale: opts.locale ?? 'uk',
  })
  void sendEmail({ to: opts.to, subject: tpl.subject, html: tpl.html })
    .then((result) => {
      if (result.status !== 'sent') {
        logger.warn({ to: opts.to, result }, 'executor invite email not sent')
      }
    })
    .catch((err: unknown) => {
      logger.error({ err, to: opts.to }, 'executor invite email failed')
    })
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
  const tpl = renderInviteCompanyMemberEmail({
    inviterName: opts.inviterName,
    companyName: opts.companyName,
    acceptUrl: opts.acceptUrl,
    locale: opts.locale ?? 'uk',
  })
  void sendEmail({ to: opts.to, subject: tpl.subject, html: tpl.html })
    .then((result) => {
      if (result.status !== 'sent') {
        logger.warn({ to: opts.to, result }, 'company member invite email not sent')
      }
    })
    .catch((err: unknown) => {
      logger.error({ err, to: opts.to }, 'company member invite email failed')
    })
}
