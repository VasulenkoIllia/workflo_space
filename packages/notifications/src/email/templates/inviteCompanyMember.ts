import { bindTranslator, type LocaleKey } from '../i18n.js'
import {
  renderButton,
  renderHeading,
  renderLayout,
  renderParagraph,
} from '../render.js'
import type { RenderedEmail } from './welcome.js'

export interface InviteCompanyMemberEmailVars {
  inviterName: string
  companyName: string
  acceptUrl: string
  locale?: LocaleKey
}

export function renderInviteCompanyMemberEmail(vars: InviteCompanyMemberEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const bodyHtml = [
    renderHeading(t('inviteCompanyMember.h1', { companyName: vars.companyName })),
    renderParagraph(
      t('inviteCompanyMember.body', {
        inviterName: vars.inviterName,
        companyName: vars.companyName,
      })
    ),
    renderButton(vars.acceptUrl, t('inviteCompanyMember.cta')),
  ].join('\n')

  return {
    subject: t('inviteCompanyMember.subject', { companyName: vars.companyName }),
    html: renderLayout({
      locale,
      title: t('inviteCompanyMember.subject', { companyName: vars.companyName }),
      preheader: t('inviteCompanyMember.body', {
        inviterName: vars.inviterName,
        companyName: vars.companyName,
      }),
      bodyHtml,
    }),
  }
}
