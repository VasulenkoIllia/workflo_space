import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface OrderCreatedEmailVars {
  orderTitle: string
  orderUrl: string
  locale?: LocaleKey
}

/** `orders.created` — команді: нове замовлення чекає на тріаж. */
export function renderOrderCreatedEmail(vars: OrderCreatedEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = t('orderCreated.subject', { orderTitle: vars.orderTitle })
  const bodyHtml = [
    renderHeading(t('orderCreated.h1')),
    renderParagraph(t('orderCreated.body', { orderTitle: vars.orderTitle })),
    renderButton(vars.orderUrl, t('orderCreated.cta')),
  ].join('\n')
  return { subject, html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }) }
}
