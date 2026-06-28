import type { Metadata } from 'next'
import { TermPageShell } from '@/components/TermPageShell'
import { UA } from '@/data/content'

export const metadata: Metadata = {
  title: 'Кейси — workflo.space',
  description:
    'Реальні проєкти з реальними цифрами: інтеграції, AI-агенти, портали. Більшість — під NDA; тут публічні.',
}

function splitMetric(m: string): { v: string; l: string } {
  const arrow = m.match(/^(.+?\s*→\s*\d+\S*)\s+(.+)$/)
  if (arrow) return { v: arrow[1] ?? '', l: arrow[2] ?? '' }
  const sp = m.indexOf(' ')
  return sp > 0 ? { v: m.slice(0, sp), l: m.slice(sp + 1) } : { v: m, l: '' }
}

export default function CasesPage() {
  const cases = UA.cases
  return (
    <TermPageShell
      cwd="~/illia/workflo/work"
      crumbs={[{ label: '~', href: '/' }, { label: 'work' }]}
      cmd="git log --oneline ~/work"
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> work
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>{cases.length} публічних кейсів</span>
        </>
      }
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">Кейси</h1>
        <p className="wf-tm-page-lead">
          Реальні проєкти з реальними цифрами. Більшість — під NDA; тут зібрані публічні.
        </p>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## git log --by-partner</div>
        <div className="wf-tm-case-grid">
          {cases.map((c) => {
            const hero = splitMetric(c.metrics[0] ?? '')
            const others = c.metrics.slice(1)
            return (
              <article key={c.num} className="wf-tm-case-card">
                <div className="wf-tm-case-card-top">
                  <span className="wf-tm-case-partner-chip">{c.company}</span>
                  <span className="wf-tm-case-card-meta">
                    {c.year} · {c.duration}
                  </span>
                </div>
                <h3 className="wf-tm-case-card-title">{c.name}</h3>
                <div className="wf-tm-case-card-metric">
                  <div className="wf-tm-case-card-metric-v">{hero.v}</div>
                  <div className="wf-tm-case-card-metric-l">{hero.l}</div>
                </div>
                <p className="wf-tm-case-card-context">{c.context}</p>
                {others.length > 0 && (
                  <ul className="wf-tm-case-card-others">
                    {others.map((m) => (
                      <li key={m}>
                        <span className="wf-tm-case-plus">+</span> {m}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="wf-tm-case-card-stack">
                  {c.stack.slice(0, 5).map((s) => (
                    <span key={s} className="wf-tm-stack-chip">
                      {s}
                    </span>
                  ))}
                  {c.stack.length > 5 && (
                    <span className="wf-tm-stack-chip wf-tm-stack-chip--more">
                      +{c.stack.length - 5}
                    </span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <div className="wf-tm-cta-band">
        <div>
          <div className="wf-tm-cta-band-t">Маєте схожу задачу?</div>
          <div className="wf-tm-cta-band-sub">// безкоштовний discovery-дзвінок · 30 хв</div>
        </div>
        <a className="wf-tm-btn wf-tm-btn--primary" href="/#contact">
          [ обговорити → ]
        </a>
      </div>
    </TermPageShell>
  )
}
