import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface InvoiceSentEmailVars {
  invoiceNumber: string
  amount: string
  dueDate: string
  invoiceUrl: string
  locale?: LocaleKey
}

export function renderInvoiceSentEmail(vars: InvoiceSentEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const subject = t('invoiceSent.subject', { invoiceNumber: vars.invoiceNumber })
  const bodyHtml = [
    renderHeading(t('invoiceSent.h1')),
    renderParagraph(
      t('invoiceSent.body', {
        invoiceNumber: vars.invoiceNumber,
        amount: vars.amount,
        dueDate: vars.dueDate,
      })
    ),
    renderButton(vars.invoiceUrl, t('invoiceSent.cta')),
  ].join('\n')

  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }),
  }
}
