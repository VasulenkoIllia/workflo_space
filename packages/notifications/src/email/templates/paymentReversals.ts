import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

/**
 * 05-В: клієнтські листи про повернення коштів, списання боргу і кредит-ноту.
 * Тема/вступ у перших двох кастомізуються через 08-EMAIL; тіло — фіксований макет.
 */
export interface PaymentRefundedEmailVars {
  amount: string
  method?: string | null
  portalUrl: string
  locale?: LocaleKey
}

export function renderPaymentRefundedEmail(vars: PaymentRefundedEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = t('paymentRefunded.subject', { amount: vars.amount })
  const bodyHtml = [
    renderHeading(t('paymentRefunded.h1')),
    renderParagraph(t('paymentRefunded.body', { amount: vars.amount })),
    ...(vars.method ? [renderParagraph(t('paymentRefunded.method', { method: vars.method }))] : []),
    renderButton(vars.portalUrl, t('paymentRefunded.cta')),
  ].join('\n')
  return { subject, html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }) }
}

export interface DebtWrittenOffEmailVars {
  amount: string
  portalUrl: string
  locale?: LocaleKey
}

export function renderDebtWrittenOffEmail(vars: DebtWrittenOffEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = t('debtWrittenOff.subject', { amount: vars.amount })
  const bodyHtml = [
    renderHeading(t('debtWrittenOff.h1')),
    renderParagraph(t('debtWrittenOff.body', { amount: vars.amount })),
    renderButton(vars.portalUrl, t('debtWrittenOff.cta')),
  ].join('\n')
  return { subject, html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }) }
}

export interface CreditNoteEmailVars {
  amount: string
  portalUrl: string
  locale?: LocaleKey
}

export function renderCreditNoteEmail(vars: CreditNoteEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = t('creditNote.subject', { amount: vars.amount })
  const bodyHtml = [
    renderHeading(t('creditNote.h1')),
    renderParagraph(t('creditNote.body', { amount: vars.amount })),
    renderButton(vars.portalUrl, t('creditNote.cta')),
  ].join('\n')
  return { subject, html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }) }
}
