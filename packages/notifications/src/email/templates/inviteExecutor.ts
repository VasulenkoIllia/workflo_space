import { bindTranslator, type LocaleKey } from '../i18n.js'
import {
  renderButton,
  renderHeading,
  renderLayout,
  renderMuted,
  renderParagraph,
} from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface InviteExecutorEmailVars {
  inviterName: string
  acceptUrl: string
  expiresAt: string  // formatted DateTime string (caller is responsible for locale formatting)
  locale?: LocaleKey
}

export function renderInviteExecutorEmail(vars: InviteExecutorEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const bodyHtml = [
    renderHeading(t('inviteExecutor.h1')),
    renderParagraph(t('inviteExecutor.body', { inviterName: vars.inviterName })),
    renderButton(vars.acceptUrl, t('inviteExecutor.cta')),
    renderMuted(t('inviteExecutor.expiry_note', { expiresAt: vars.expiresAt })),
  ].join('\n')

  return {
    subject: t('inviteExecutor.subject'),
    html: renderLayout({
      locale,
      title: t('inviteExecutor.subject'),
      preheader: t('inviteExecutor.body', { inviterName: vars.inviterName }),
      bodyHtml,
    }),
  }
}
