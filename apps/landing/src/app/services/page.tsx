import type { Metadata } from 'next'
import Link from 'next/link'
import { TermPageShell } from '@/components/TermPageShell'
import { SERVICES, SERVICES_INTRO } from '@/data/pages'

export const metadata: Metadata = {
  title: 'Послуги — workflo.space',
  description: SERVICES_INTRO,
  alternates: { canonical: '/services' },
}

export default function ServicesPage() {
  return (
    <TermPageShell
      cwd="~/illia/workflo/services"
      crumbs={[{ label: '~', href: '/' }, { label: 'services' }]}
      cmd="ls -la ~/services/"
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> services
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>{SERVICES.length} типи робіт</span>
        </>
      }
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">Послуги</h1>
        <p className="wf-tm-page-lead">{SERVICES_INTRO}</p>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## ls ~/services</div>
        <div className="wf-tm-svc-grid">
          {SERVICES.map((s) => (
            <Link key={s.slug} className="wf-tm-svc-card" href={`/services/${s.slug}`}>
              <div className="wf-tm-svc-card-top">
                <span className="wf-tm-svc-glyph">{s.glyph}</span>
                <span className="wf-tm-svc-num">{s.num}</span>
              </div>
              <h3 className="wf-tm-svc-name">{s.name}</h3>
              <p className="wf-tm-svc-line">{s.line}</p>
              <p className="wf-tm-svc-summary">{s.summary}</p>
              <div className="wf-tm-stack-chips">
                {s.stack.slice(0, 4).map((t) => (
                  <span key={t} className="wf-tm-stack-chip">
                    {t}
                  </span>
                ))}
                {s.stack.length > 4 && (
                  <span className="wf-tm-stack-chip wf-tm-stack-chip--more">
                    +{s.stack.length - 4}
                  </span>
                )}
              </div>
              <div className="wf-tm-svc-card-foot">
                <span className="wf-tm-svc-typical">{s.typical}</span>
                <span className="wf-tm-svc-open">$ open →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="wf-tm-cta-band">
        <div>
          <div className="wf-tm-cta-band-t">Не бачите свою задачу?</div>
          <div className="wf-tm-cta-band-sub">// напишіть — скажу чесно, чи берусь</div>
        </div>
        <a className="wf-tm-btn wf-tm-btn--primary" href="/#contact">
          [ обговорити → ]
        </a>
      </div>
    </TermPageShell>
  )
}
