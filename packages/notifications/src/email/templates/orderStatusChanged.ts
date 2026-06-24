import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface OrderStatusChangedEmailVars {
  orderTitle: string
  orderUrl: string
  /** Client-facing status code (OrderClientStatus); mapped to a human label, raw code as fallback. */
  newClientStatus: string
  locale?: LocaleKey
}

export function renderOrderStatusChangedEmail(vars: OrderStatusChangedEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const statusKey = `orderStatus.s.${vars.newClientStatus}`
  const label = t(statusKey)
  const status = label === statusKey ? vars.newClientStatus : label // translate() returns the key when unmapped

  const subject = t('orderStatus.subject', { orderTitle: vars.orderTitle })
  const bodyHtml = [
    renderHeading(t('orderStatus.h1')),
    renderParagraph(t('orderStatus.body', { orderTitle: vars.orderTitle, status })),
    renderButton(vars.orderUrl, t('orderStatus.cta')),
  ].join('\n')

  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: t('orderStatus.h1'), bodyHtml }),
  }
}
