import type { Metadata } from 'next'
import { HtmlLang } from '@/components/HtmlLang'
import { TerminalLanding } from '@/components/TerminalLanding'
import { EN } from '@/data/content'

/** DSN-9: EN-версія головної. hreflang uk ↔ en, x-default — українська. */
export const metadata: Metadata = {
  title: 'workflo.space — automations for teams that outgrew Excel',
  description:
    'Illia from Lutsk builds automations for teams that outgrew Excel: Telegram bots, AI agents, integrations, custom CRMs. 6 years building product.',
  alternates: {
    canonical: '/en',
    languages: { uk: '/', en: '/en', 'x-default': '/' },
  },
  openGraph: {
    title: 'workflo.space — automations for teams',
    description: 'Telegram bots, AI agents, internal portals and integrations. Lutsk · Ukraine.',
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['uk_UA'],
    siteName: 'workflo.space',
  },
}

export default function HomePageEn() {
  return (
    <div lang="en">
      <HtmlLang lang="en" />
      <TerminalLanding content={EN} />
    </div>
  )
}
