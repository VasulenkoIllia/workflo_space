import { TermPageShell } from '@/components/TermPageShell'
import { LEGAL } from '@/data/legal'

/** DSN-8 · design-v2 landing-pricing.jsx → LegalPage: TOC + нумеровані розділи + CTA. */
export function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const doc = LEGAL[kind]
  return (
    <TermPageShell
      cwd={`~/illia/workflo/legal/${kind}`}
      crumbs={[{ label: '~', href: '/' }, { label: 'legal' }, { label: kind }]}
      cmd={`less ~/legal/${kind}.txt`}
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> legal/{kind}
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>{doc.updated}</span>
        </>
      }
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 6 }}>
        <h1 className="wf-tm-page-h1">{doc.title}</h1>
        <div className="wf-tm-legal-updated">{doc.updated}</div>
        <p className="wf-tm-legal-intro">{doc.intro}</p>
      </div>

      <div className="wf-tm-md-section wf-tm-legal">
        <nav className="wf-tm-legal-toc">
          <div className="wf-tm-art-toc-h">## розділи</div>
          {doc.sections.map(([h], i) => (
            <a key={h} className="wf-tm-art-toc-link" href={`#sec-${i}`}>
              {String(i + 1).padStart(2, '0')} · {h}
            </a>
          ))}
        </nav>
        <div className="wf-tm-legal-body">
          {doc.sections.map(([h, p], i) => (
            <section key={h} id={`sec-${i}`} className="wf-tm-legal-sec">
              <div className="wf-tm-legal-sec-h">
                <span className="wf-tm-legal-sec-num">{String(i + 1).padStart(2, '0')}</span>
                <span>{h}</span>
              </div>
              <div className="wf-tm-legal-sec-body">{p}</div>
            </section>
          ))}

          <div className="wf-tm-cta-band" style={{ marginTop: 24 }}>
            <div>
              <div className="wf-tm-cta-band-t">
                {kind === 'terms' ? 'Питання щодо умов?' : 'Питання щодо даних?'}
              </div>
              <div className="wf-tm-cta-band-sub">// напишіть — відповім особисто</div>
            </div>
            <a className="wf-tm-btn" href="/contact">
              [ контакт → ]
            </a>
          </div>
        </div>
      </div>
    </TermPageShell>
  )
}
