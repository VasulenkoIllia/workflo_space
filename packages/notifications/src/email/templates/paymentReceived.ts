import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface PaymentReceivedEmailVars {
  amount: string
  method?: string | null
  portalUrl: string
  locale?: LocaleKey
}

/** `billing.invoice_paid` — клієнту: квитанція «оплату отримано». */
export function renderPaymentReceivedEmail(vars: PaymentReceivedEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = t('paymentReceived.subject', { amount: vars.amount })
  const parts = [
    renderHeading(t('paymentReceived.h1')),
    renderParagraph(t('paymentReceived.body', { amount: vars.amount })),
  ]
  if (vars.method)
    parts.push(renderParagraph(t('paymentReceived.body_method', { method: vars.method })))
  parts.push(renderButton(vars.portalUrl, t('paymentReceived.cta')))
  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml: parts.join('\n') }),
  }
}
