import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface ApprovalRequestedEmailVars {
  orderTitle: string
  orderUrl: string
  locale?: LocaleKey
}

/** `orders.approval_requested` (02-А) — клієнту: погодьте оцінку, CTA у портал. */
export function renderApprovalRequestedEmail(vars: ApprovalRequestedEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = t('approvalRequested.subject', { orderTitle: vars.orderTitle })
  const bodyHtml = [
    renderHeading(t('approvalRequested.h1')),
    renderParagraph(t('approvalRequested.body', { orderTitle: vars.orderTitle })),
    renderButton(vars.orderUrl, t('approvalRequested.cta')),
  ].join('\n')
  return { subject, html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }) }
}
