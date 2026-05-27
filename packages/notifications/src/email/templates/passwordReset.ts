import { bindTranslator, type LocaleKey } from '../i18n.js'
import {
  renderButton,
  renderHeading,
  renderLayout,
  renderMuted,
  renderParagraph,
} from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface PasswordResetEmailVars {
  resetUrl: string
  locale?: LocaleKey
}

export function renderPasswordResetEmail(vars: PasswordResetEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const bodyHtml = [
    renderHeading(t('passwordReset.h1')),
    renderParagraph(t('passwordReset.body')),
    renderButton(vars.resetUrl, t('passwordReset.cta')),
    renderMuted(t('passwordReset.ignore')),
  ].join('\n')

  return {
    subject: t('passwordReset.subject'),
    html: renderLayout({
      locale,
      title: t('passwordReset.subject'),
      preheader: t('passwordReset.body'),
      bodyHtml,
    }),
  }
}
