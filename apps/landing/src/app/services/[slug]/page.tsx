import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TermPageShell } from '@/components/TermPageShell'
import { SERVICES, serviceBySlug } from '@/data/pages'

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const s = serviceBySlug(slug)
  return s
    ? { title: `${s.name} — workflo.space`, description: s.summary }
    : { title: 'Послуга — workflo.space' }
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = serviceBySlug(slug)
  if (!s) notFound()

  return (
    <TermPageShell
      cwd={`~/illia/workflo/services/${s.slug}`}
      crumbs={[
        { label: '~', href: '/' },
        { label: 'services', href: '/services' },
        { label: s.slug },
      ]}
      cmd={`man ~/services/${s.slug}`}
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> services/{s.slug}
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>{s.typical}</span>
        </>
      }
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 6 }}>
        <div className="wf-tm-project-hero-top">
          <span className="wf-tm-svc-glyph wf-tm-svc-glyph--lg">{s.glyph}</span>
          <span className="wf-tm-case-card-meta">
            {s.num} · {s.typical}
          </span>
        </div>
        <h1 className="wf-tm-page-h1">{s.name}</h1>
        <p className="wf-tm-project-hero-summary">{s.summary}</p>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## коли це про вас</div>
        <ul className="wf-tm-art-ul">
          {s.problem.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## що отримаєте</div>
        <div className="wf-tm-svc-deliver">
          {s.deliverables.map((d) => (
            <div className="wf-tm-svc-deliver-row" key={d}>
              <span className="wf-tm-bullet" style={{ color: 'var(--wf-accent)' }}>
                ▸
              </span>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## stack</div>
        <div className="wf-tm-stack-chips">
          {s.stack.map((t) => (
            <span key={t} className="wf-tm-stack-chip">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## приклади</div>
        <p className="wf-tm-art-p">{s.examples}</p>
      </div>

      <div className="wf-tm-cta-band" style={{ marginTop: 28 }}>
        <div>
          <div className="wf-tm-cta-band-t">Схожа задача?</div>
          <div className="wf-tm-cta-band-sub">// безкоштовний дзвінок · 30 хв</div>
        </div>
        <a className="wf-tm-btn wf-tm-btn--primary" href="/#contact">
          [ обговорити → ]
        </a>
      </div>
    </TermPageShell>
  )
}
