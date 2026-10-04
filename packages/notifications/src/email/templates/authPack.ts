import { bindTranslator, type LocaleKey } from '../i18n.js'
import {
  renderButton,
  renderHeading,
  renderLayout,
  renderMuted,
  renderParagraph,
} from '../render.js'
import type { RenderedEmail } from './welcome.js'

/** 01-А: passwordless sign-in link (TTL 15 min, single-use). */
export interface MagicLinkEmailVars {
  loginUrl: string
  locale?: LocaleKey
}

export function renderMagicLinkEmail(vars: MagicLinkEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const bodyHtml = [
    renderHeading(t('magicLink.h1')),
    renderParagraph(t('magicLink.body')),
    renderButton(vars.loginUrl, t('magicLink.cta')),
    renderMuted(t('magicLink.ignore')),
  ].join('\n')
  return {
    subject: t('magicLink.subject'),
    html: renderLayout({
      locale,
      title: t('magicLink.subject'),
      preheader: t('magicLink.body'),
      bodyHtml,
    }),
  }
}

/** 01-Г: confirmation sent to the NEW address. */
export interface EmailChangeConfirmEmailVars {
  confirmUrl: string
  locale?: LocaleKey
}

export function renderEmailChangeConfirmEmail(vars: EmailChangeConfirmEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const bodyHtml = [
    renderHeading(t('emailChangeConfirm.h1')),
    renderParagraph(t('emailChangeConfirm.body')),
    renderButton(vars.confirmUrl, t('emailChangeConfirm.cta')),
    renderMuted(t('emailChangeConfirm.ignore')),
  ].join('\n')
  return {
    subject: t('emailChangeConfirm.subject'),
    html: renderLayout({
      locale,
      title: t('emailChangeConfirm.subject'),
      preheader: t('emailChangeConfirm.body'),
      bodyHtml,
    }),
  }
}

/** 01-Г: warning sent to the OLD address BEFORE the switch. */
export interface EmailChangeRequestedEmailVars {
  newEmail: string
  locale?: LocaleKey
}

export function renderEmailChangeRequestedEmail(
  vars: EmailChangeRequestedEmailVars
): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const bodyHtml = [
    renderHeading(t('emailChangeRequested.h1')),
    renderParagraph(t('emailChangeRequested.body').replace('{newEmail}', vars.newEmail)),
    renderMuted(t('emailChangeRequested.warn')),
  ].join('\n')
  return {
    subject: t('emailChangeRequested.subject'),
    html: renderLayout({
      locale,
      title: t('emailChangeRequested.subject'),
      preheader: t('emailChangeRequested.warn'),
      bodyHtml,
    }),
  }
}
