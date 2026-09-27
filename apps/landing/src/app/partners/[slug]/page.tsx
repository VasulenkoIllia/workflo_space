import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TermPageShell } from '@/components/TermPageShell'
import { UA } from '@/data/content'

/**
 * DSN-8 · design-v2 terminal-pages.jsx → CompanyPage. Картки партнерів на головній вели на
 * мертвий якір #company-…; тепер — профіль партнера (hero · about · CTA).
 */

function findPartner(slug: string) {
  return UA.partners.find((p) => p.slug === slug) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const p = findPartner(slug)
  if (!p) return { title: 'Партнер — workflo.space' }
  return {
    title: `${p.name} — партнер workflo.space`,
    description: p.bio,
    alternates: { canonical: `/partners/${slug}` },
  }
}

export default async function PartnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = findPartner(slug)
  if (!p) notFound()
  const years = Math.max(1, new Date().getFullYear() - Number.parseInt(p.since, 10))
  const [city, country] = p.location.split(',').map((x) => x.trim())

  return (
    <TermPageShell
      cwd={`~/illia/workflo/companies/${slug}`}
      crumbs={[
        { label: '~', href: '/' },
        { label: 'companies', href: '/#partners' },
        { label: slug },
      ]}
      cmd={`cat ~/companies/${slug}.md`}
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> companies/{slug}
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>з {p.since}</span>
        </>
      }
    >
      <div className="wf-tm-company-hero">
        <div className="wf-tm-company-hero-top">
          <div className="wf-tm-company-logo" style={{ background: p.accent }}>
            {p.logoGlyph}
          </div>
          <div className="wf-tm-company-hero-id">
            <h1 className="wf-tm-page-h1" style={{ margin: 0 }}>
              {p.name}
            </h1>
            <div className="wf-tm-company-hero-industry">{p.industry}</div>
          </div>
          <div className="wf-tm-company-hero-status">
            <span className="wf-tm-status-dot" />
            <span>active partnership</span>
          </div>
        </div>
        <div className="wf-tm-company-hero-stats">
          <div className="wf-tm-company-stat">
            <div className="wf-tm-company-stat-v">{p.projectsCount}</div>
            <div className="wf-tm-company-stat-l">
              {p.projectsCount === 1 ? 'проєкт' : 'проєкти'}
            </div>
          </div>
          <div className="wf-tm-company-stat">
            <div className="wf-tm-company-stat-v">{years}</div>
            <div className="wf-tm-company-stat-l">{years === 1 ? 'рік разом' : 'роки разом'}</div>
          </div>
          <div className="wf-tm-company-stat">
            <div className="wf-tm-company-stat-v wf-tm-company-stat-v--text">{city}</div>
            <div className="wf-tm-company-stat-l">{country ?? ''}</div>
          </div>
        </div>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## about</div>
        <div className="wf-tm-prose">
          <p className="wf-tm-prose-p">{p.bio}</p>
        </div>
      </div>

      <div className="wf-tm-cta-band">
        <div>
          <div className="wf-tm-cta-band-t">Хочете так само?</div>
          <div className="wf-tm-cta-band-sub">
            // подивіться кейси або напишіть задачу — відповім у день
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="wf-tm-btn" href="/cases">
            [ кейси ]
          </a>
          <a className="wf-tm-btn wf-tm-btn--primary" href="/contact">
            [ обговорити → ]
          </a>
        </div>
      </div>
    </TermPageShell>
  )
}
