import { bindTranslator, type LocaleKey } from '../i18n.js'
import {
  renderButton,
  renderHeading,
  renderLayout,
  renderMuted,
  renderParagraph,
} from '../render.js'

export interface WelcomeEmailVars {
  name: string
  portalUrl: string
  locale?: LocaleKey
}

export interface RenderedEmail {
  subject: string
  html: string
}

export function renderWelcomeEmail(vars: WelcomeEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const greeting = vars.name ? t('common.greeting_name', { name: vars.name }) : t('common.greeting_anon')

  const bodyHtml = [
    renderHeading(t('welcome.h1')),
    renderParagraph(greeting),
    renderParagraph(t('welcome.body')),
    renderButton(vars.portalUrl, t('welcome.cta')),
    renderMuted(t('welcome.tip_telegram')),
  ].join('\n')

  return {
    subject: t('welcome.subject'),
    html: renderLayout({
      locale,
      title: t('welcome.subject'),
      preheader: t('welcome.body'),
      bodyHtml,
    }),
  }
}
