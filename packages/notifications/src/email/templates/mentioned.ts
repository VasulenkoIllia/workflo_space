import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface MentionedEmailVars {
  orderTitle: string
  authorName: string
  preview: string
  orderUrl: string
  locale?: LocaleKey
}

/** S10 @mention: the personal "you were mentioned" variant of the chat email. */
export function renderMentionedEmail(vars: MentionedEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const subject = t('mentioned.subject', { orderTitle: vars.orderTitle })
  const bodyHtml = [
    renderHeading(t('mentioned.h1')),
    renderParagraph(
      t('mentioned.body', { authorName: vars.authorName, orderTitle: vars.orderTitle })
    ),
    // The comment text is user content; renderParagraph escapes it.
    renderParagraph(`«${vars.preview}»`),
    renderButton(vars.orderUrl, t('mentioned.cta')),
  ].join('\n')

  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: vars.preview, bodyHtml }),
  }
}
