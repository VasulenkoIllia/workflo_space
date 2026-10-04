import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface OrderAssignedEmailVars {
  orderTitle: string
  orderUrl: string
  locale?: LocaleKey
}

/** `orders.assigned` — виконавцю: вас призначено на замовлення. */
export function renderOrderAssignedEmail(vars: OrderAssignedEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = t('orderAssigned.subject')
  const bodyHtml = [
    renderHeading(t('orderAssigned.h1')),
    renderParagraph(t('orderAssigned.body', { orderTitle: vars.orderTitle })),
    renderButton(vars.orderUrl, t('orderAssigned.cta')),
  ].join('\n')
  return { subject, html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }) }
}
