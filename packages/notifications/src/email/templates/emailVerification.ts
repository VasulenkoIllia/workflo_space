import { bindTranslator, type LocaleKey } from '../i18n.js'
import {
  renderButton,
  renderHeading,
  renderLayout,
  renderMuted,
  renderParagraph,
} from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface EmailVerificationEmailVars {
  verifyUrl: string
  locale?: LocaleKey
}

export function renderEmailVerificationEmail(vars: EmailVerificationEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const bodyHtml = [
    renderHeading(t('emailVerification.h1')),
    renderParagraph(t('emailVerification.body')),
    renderButton(vars.verifyUrl, t('emailVerification.cta')),
    renderMuted(t('emailVerification.ignore')),
  ].join('\n')

  return {
    subject: t('emailVerification.subject'),
    html: renderLayout({
      locale,
      title: t('emailVerification.subject'),
      preheader: t('emailVerification.body'),
      bodyHtml,
    }),
  }
}
