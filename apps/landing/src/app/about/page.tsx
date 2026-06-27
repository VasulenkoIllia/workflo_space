import type { Metadata } from 'next'
import { TermPageShell } from '@/components/TermPageShell'
import { ABOUT } from '@/data/pages'

export const metadata: Metadata = {
  title: 'Про нас — workflo.space',
  description: ABOUT.intro,
}

function Avatar({ initials, size = 44 }: { initials: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in oklab, var(--wf-accent) 14%, transparent)',
        border: '1px solid color-mix(in oklab, var(--wf-accent) 30%, transparent)',
        color: 'var(--wf-accent)',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        fontSize: Math.round(size * 0.34),
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

export default function AboutPage() {
  const f = ABOUT.founder
  return (
    <TermPageShell
      cwd="~/illia/workflo/about"
      crumbs={[{ label: '~', href: '/' }, { label: 'about' }]}
      cmd="whoami && cat ~/team.md"
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> about
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>{ABOUT.members.length + 1} людей</span>
        </>
      }
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">Про нас</h1>
        <p className="wf-tm-page-lead">{ABOUT.intro}</p>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## whoami</div>
        <div className="wf-tm-about-founder">
          <div className="wf-tm-about-founder-av">
            <Avatar initials={f.initials} size={72} />
          </div>
          <div className="wf-tm-about-founder-main">
            <div className="wf-tm-about-founder-name">{f.name}</div>
            <div className="wf-tm-about-founder-role">// {f.role}</div>
            <div style={{ marginTop: 12 }}>
              {f.bio.map((p) => (
                <p
                  key={p.slice(0, 16)}
                  style={{
                    margin: '0 0 10px',
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--wf-fg-secondary)',
                    maxWidth: 640,
                  }}
                >
                  {p}
                </p>
              ))}
            </div>
            <div className="wf-tm-about-stats">
              {f.stats.map((st) => (
                <div className="wf-tm-about-stat" key={st.k}>
                  <span className="wf-tm-about-stat-v">{st.v}</span>
                  <span className="wf-tm-about-stat-k">{st.k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## команда</div>
        <div className="wf-tm-about-team">
          {ABOUT.members.map((m) => (
            <div className="wf-tm-about-member" key={m.name}>
              <Avatar initials={m.initials} size={44} />
              <div className="wf-tm-about-member-main">
                <div className="wf-tm-about-member-name">{m.name}</div>
                <div className="wf-tm-about-member-role">// {m.role}</div>
                <div className="wf-tm-about-member-focus">{m.focus}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## принципи</div>
        <div className="wf-tm-about-principles">
          {ABOUT.principles.map((p, i) => (
            <div className="wf-tm-about-principle" key={p[0]}>
              <div className="wf-tm-about-principle-n">[{String(i + 1).padStart(2, '0')}]</div>
              <div>
                <div className="wf-tm-about-principle-t">{p[0]}</div>
                <div className="wf-tm-about-principle-d">{p[1]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="wf-tm-cta-band">
        <div>
          <div className="wf-tm-cta-band-t">Хочете працювати з нами?</div>
          <div className="wf-tm-cta-band-sub">// почнемо з короткого дзвінка</div>
        </div>
        <a className="wf-tm-btn wf-tm-btn--primary" href="/#contact">
          [ звʼязатися → ]
        </a>
      </div>
    </TermPageShell>
  )
}
