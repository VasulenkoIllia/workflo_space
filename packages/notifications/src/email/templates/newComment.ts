import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface NewCommentEmailVars {
  orderTitle: string
  authorName: string
  preview: string
  orderUrl: string
  locale?: LocaleKey
}

export function renderNewCommentEmail(vars: NewCommentEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const subject = t('newComment.subject', { orderTitle: vars.orderTitle })
  const bodyHtml = [
    renderHeading(t('newComment.h1')),
    renderParagraph(
      t('newComment.body', { authorName: vars.authorName, orderTitle: vars.orderTitle })
    ),
    // The comment text is user content; renderParagraph escapes it.
    renderParagraph(`«${vars.preview}»`),
    renderButton(vars.orderUrl, t('newComment.cta')),
  ].join('\n')

  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: vars.preview, bodyHtml }),
  }
}
