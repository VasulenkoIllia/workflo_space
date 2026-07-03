import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface ApprovalDecidedEmailVars {
  orderTitle: string
  orderUrl: string
  approved: boolean
  comment?: string | null
  locale?: LocaleKey
}

/** `orders.approval_decided` — команді: рішення клієнта по оцінці (+ коментар при правках). */
export function renderApprovalDecidedEmail(vars: ApprovalDecidedEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const key = vars.approved ? 'ok' : 'no'
  const subject = t(`approvalDecided.subject_${key}`, { orderTitle: vars.orderTitle })
  const parts = [
    renderHeading(t(`approvalDecided.h1_${key}`)),
    renderParagraph(t(`approvalDecided.body_${key}`, { orderTitle: vars.orderTitle })),
  ]
  if (!vars.approved && vars.comment) {
    parts.push(renderParagraph(t('approvalDecided.comment', { comment: vars.comment })))
  }
  parts.push(renderButton(vars.orderUrl, t('approvalDecided.cta')))
  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml: parts.join('\n') }),
  }
}
