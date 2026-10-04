import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ContactForm } from '@/components/ContactForm'
import { TermPageShell } from '@/components/TermPageShell'
import { CONTACT_PAGE, type ContactChannel } from '@/data/pages'

export const metadata: Metadata = {
  title: 'Контакт — workflo.space',
  description: CONTACT_PAGE.intro,
  alternates: { canonical: '/contact' },
}

const ICON: Record<ContactChannel['kind'], ReactNode> = {
  telegram: <path d="M21 4L3 11l6 2 2 6 3-4 4 3 3-14z" />,
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M3 6l9 7 9-7" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
    </>
  ),
}

export default function ContactPage() {
  return (
    <TermPageShell
      cwd="~/illia/workflo/contact"
      crumbs={[{ label: '~', href: '/' }, { label: 'contact' }]}
      cmd="cat ~/contact.md"
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> contact
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>відповідь у день</span>
        </>
      }
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">Контакт</h1>
        <p className="wf-tm-page-lead">{CONTACT_PAGE.intro}</p>
      </div>

      <div className="wf-tm-contact">
        <ContactForm />

        <aside className="wf-tm-contact-channels">
          <div className="wf-tm-contact-form-h">// або напряму</div>
          {CONTACT_PAGE.channels.map((ch) => (
            <a
              key={ch.kind}
              className="wf-tm-contact-channel"
              href={ch.href}
              target="_blank"
              rel="noreferrer"
              data-primary={ch.primary || undefined}
            >
              <span className="wf-tm-contact-channel-ic">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICON[ch.kind]}
                </svg>
              </span>
              <div className="wf-tm-contact-channel-main">
                <div className="wf-tm-contact-channel-label">{ch.label}</div>
                <div className="wf-tm-contact-channel-val">{ch.value}</div>
              </div>
              <span className="wf-tm-contact-channel-note">{ch.note}</span>
            </a>
          ))}
          <div className="wf-tm-contact-meta">
            <div className="wf-tm-contact-meta-row">
              <span>Працюємо</span>
              <span>Пн–Пт · 10:00–19:00 (EET)</span>
            </div>
            <div className="wf-tm-contact-meta-row">
              <span>Оплата</span>
              <span>ФОП · USD/₴ · USDT</span>
            </div>
            <div className="wf-tm-contact-meta-row">
              <span>NDA</span>
              <span>за потреби</span>
            </div>
          </div>
        </aside>
      </div>
    </TermPageShell>
  )
}
