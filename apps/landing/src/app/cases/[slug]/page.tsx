import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { renderBlock } from '@/components/ArticleBlocks'
import { TermPageShell } from '@/components/TermPageShell'
import { fetchBlogPost } from '@/data/blog'
import { UA } from '@/data/content'
import { splitMetric } from '@/lib/metrics'

/**
 * DSN-8 · design-v2 landing-cases.jsx → CasePage. Раніше «$ cat ~/work/<slug>.md» на головній
 * вів на мертвий якір #project-…. Джерело: публічний кейс із контенту лендінгу + (якщо є)
 * опублікований у CMS case_study з тим самим slug — його текст стає тілом сторінки.
 */

function findCase(slug: string) {
  return UA.cases.find((c) => c.slug === slug) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const c = findCase(slug)
  if (!c) return { title: 'Кейс — workflo.space' }
  return {
    title: `${c.name} — кейс workflo.space`,
    description: `${c.context} ${c.metrics[0] ?? ''}`.trim(),
    alternates: { canonical: `/cases/${slug}` },
    openGraph: { title: c.name, description: c.context, type: 'article' },
  }
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = findCase(slug)
  if (!c) notFound()
  const cms = await fetchBlogPost(slug)
  const body = cms?.type === 'case_study' ? cms.body : null
  const related = UA.cases.filter((x) => x.slug && x.slug !== slug).slice(0, 3)
  const facts: [string, string][] = [
    ['галузь', c.company],
    ['рік', c.year],
    ['тривалість', c.duration],
    ['стек', c.stack.join(', ')],
  ]

  return (
    <TermPageShell
      cwd={`~/illia/workflo/cases/${slug}`}
      crumbs={[{ label: '~', href: '/' }, { label: 'cases', href: '/cases' }, { label: slug }]}
      cmd={`cat ~/cases/${slug}.md`}
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> cases/{slug}
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>{c.company}</span>
        </>
      }
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 6 }}>
        <div className="wf-tm-blog-tags" style={{ marginBottom: 4 }}>
          <span
            className="wf-tm-blog-tag"
            style={{
              borderStyle: 'solid',
              color: 'var(--wf-accent)',
              borderColor: 'var(--wf-accent)',
            }}
          >
            {c.company}
          </span>
          {c.stack.slice(0, 4).map((t) => (
            <span key={t} className="wf-tm-blog-tag">
              {t}
            </span>
          ))}
        </div>
        <h1 className="wf-tm-page-h1">{c.name}</h1>
        <p className="wf-tm-page-lead">{cms?.excerpt ?? c.context}</p>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## impact</div>
        <div className="wf-tm-case-metrics">
          {c.metrics.map((m) => {
            const { v, l } = splitMetric(m)
            return (
              <div className="wf-tm-case-metric-cell" key={m}>
                <div className="wf-tm-case-metric-v">{v}</div>
                <div className="wf-tm-case-metric-k">{l}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="wf-tm-md-section wf-tm-art">
        <nav className="wf-tm-art-toc">
          <div className="wf-tm-art-toc-h">## факти</div>
          <div className="wf-tm-case-facts">
            {facts.map(([k, v]) => (
              <div className="wf-tm-case-fact" key={k}>
                <span className="wf-tm-case-fact-k">{k}</span>
                <span className="wf-tm-case-fact-v">{v}</span>
              </div>
            ))}
          </div>
        </nav>
        <div className="wf-tm-art-body">
          {body ? (
            body.map(renderBlock)
          ) : (
            <>
              <h2 className="wf-tm-art-h2">Контекст</h2>
              <p className="wf-tm-art-p">{c.context}</p>
              <h2 className="wf-tm-art-h2">Результат</h2>
              <ul className="wf-tm-art-ul">
                {c.metrics.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <div className="wf-tm-art-callout">
                <span className="wf-tm-art-callout-k">стек</span>
                <span className="wf-tm-art-callout-v">{c.stack.join(' · ')}</span>
              </div>
            </>
          )}

          {related.length > 0 && (
            <div className="wf-tm-md-section" style={{ marginTop: 36 }}>
              <div className="wf-tm-md-h2">## related</div>
              <div className="wf-tm-related">
                {related.map((r) => (
                  <a key={r.slug} href={`/cases/${r.slug}`} className="wf-tm-related-link">
                    <span className="wf-tm-bullet">▸</span>
                    <span className="wf-tm-related-name">{r.name}</span>
                    <span className="wf-tm-related-meta">{r.company}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="wf-tm-cta-band">
            <div>
              <div className="wf-tm-cta-band-t">Маєте схожу задачу?</div>
              <div className="wf-tm-cta-band-sub">// безкоштовний discovery-дзвінок · 30 хв</div>
            </div>
            <a className="wf-tm-btn wf-tm-btn--primary" href="/contact">
              [ обговорити → ]
            </a>
          </div>
        </div>
      </div>
    </TermPageShell>
  )
}
