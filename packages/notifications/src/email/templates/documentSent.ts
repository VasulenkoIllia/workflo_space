import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface DocumentSentEmailVars {
  documentLabel: string
  documentNumber: string
  documentUrl: string
  locale?: LocaleKey
}

/** `documents.completion_act_ready` — клієнту: надіслано не-інвойсний документ (акт/спека/звірка/договір). */
export function renderDocumentSentEmail(vars: DocumentSentEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = t('documentSent.subject', {
    documentLabel: vars.documentLabel,
    documentNumber: vars.documentNumber,
  })
  const bodyHtml = [
    renderHeading(t('documentSent.h1')),
    renderParagraph(
      t('documentSent.body', {
        documentLabel: vars.documentLabel,
        documentNumber: vars.documentNumber,
      })
    ),
    renderButton(vars.documentUrl, t('documentSent.cta')),
  ].join('\n')
  return { subject, html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }) }
}
