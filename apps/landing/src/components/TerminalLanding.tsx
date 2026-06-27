'use client'

import { Fragment, useEffect, useState } from 'react'
import { HERO_ASCII, UA, type LandingContent } from '@/data/content'

const PORTAL_URL = 'https://app.workflo.space'

/** Terminal prompt line: illia@workflo:~ $ <cmd> */
function TermPrompt({ cmd, cwd = '~' }: { cmd: string; cwd?: string }) {
  return (
    <div className="wf-tm-prompt">
      <span className="wf-tm-user">illia</span>
      <span className="wf-tm-at">@</span>
      <span className="wf-tm-host">workflo</span>
      <span className="wf-tm-colon">:</span>
      <span className="wf-tm-cwd">{cwd}</span>
      <span className="wf-tm-sigil">$</span>
      <span className="wf-tm-cmd">{cmd}</span>
    </div>
  )
}

/** Section divider: dashed rule labelled `# <section>` + a prompt line. */
function TermDivider({ section, cmd }: { section: string; cmd: string }) {
  return (
    <div className="wf-tm-divider">
      <div className="wf-tm-divider-line" data-section={section} />
      <TermPrompt cmd={cmd} />
    </div>
  )
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ ·&]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')

/** Services — `ls -la`-styled list (design: TerminalServices). */
function ServicesSection({ items }: { items: LandingContent['services'] }) {
  return (
    <section className="wf-tm-section" id="services" data-screen-label="services">
      <TermDivider section="services" cmd="ls ~/services" />
      <div className="wf-tm-output">
        <div className="wf-tm-ls-head">total {items.length}</div>
        {items.map((it) => (
          <div key={it.num} className="wf-tm-service">
            <div className="wf-tm-service-row">
              <span className="wf-tm-service-perm">drwx</span>
              <span className="wf-tm-service-num">[{it.num}]</span>
              <span className="wf-tm-service-name">{slug(it.name)}</span>
              <span className="wf-tm-service-title">— {it.name}</span>
            </div>
            <div className="wf-tm-service-line">
              <span className="wf-tm-key">desc</span>
              <span className="wf-tm-val">{it.line}</span>
            </div>
            <div className="wf-tm-service-line">
              <span className="wf-tm-key">examples</span>
              <span className="wf-tm-val">{it.examples}</span>
            </div>
            <div className="wf-tm-service-line">
              <span className="wf-tm-key">tools</span>
              <span className="wf-tm-val">
                {it.tools.map((tool, j) => (
                  <Fragment key={tool}>
                    {j > 0 && <span className="wf-tm-bullet"> · </span>}
                    <span className="wf-tm-tool">{tool}</span>
                  </Fragment>
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** SSR-safe typewriter. Renders full text on the server + first client render (so the H1
 * is in the DOM for SEO + hydration matches); once `enabled` (mounted) it re-types. */
function useTypewriter(lines: string[], enabled: boolean) {
  const [visible, setVisible] = useState<string[]>(lines)
  const [activeLine, setActiveLine] = useState(lines.length - 1)
  const [done, setDone] = useState(true)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    setVisible(lines.map(() => ''))
    setActiveLine(0)
    setDone(false)
    let delay = 350
    lines.forEach((line, li) => {
      for (let ci = 1; ci <= line.length; ci++) {
        const at = delay
        timers.push(
          setTimeout(() => {
            if (cancelled) return
            setActiveLine(li)
            setVisible((v) => {
              const next = [...v]
              next[li] = line.slice(0, ci)
              return next
            })
          }, at)
        )
        delay += 34
      }
      delay += 260
    })
    timers.push(
      setTimeout(() => {
        if (!cancelled) setDone(true)
      }, delay)
    )
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [enabled, lines])

  return { visible, activeLine, done }
}

/** Split a metric string into a big value + label (e.g. "18 год → 12 хв щодня"). */
function splitMetric(m: string): { v: string; l: string } {
  const arrow = m.match(/^(.+?\s*→\s*\d+\S*)\s+(.+)$/)
  if (arrow) return { v: arrow[1] ?? '', l: arrow[2] ?? '' }
  const sp = m.indexOf(' ')
  return sp > 0 ? { v: m.slice(0, sp), l: m.slice(sp + 1) } : { v: m, l: '' }
}

/** Cases — git-log-styled proof cards (design: TerminalCases). Partner-chip + per-case
 * read-more link to #company-/#project- anchors (those pages land in later S7 slices). */
function CasesSection({ items }: { items: LandingContent['cases'] }) {
  return (
    <section className="wf-tm-section" id="work" data-screen-label="work">
      <TermDivider section="work" cmd="git log --by-partner --oneline" />
      <div className="wf-tm-output">
        <p className="wf-tm-section-intro">// {items.length} публічних кейсів · цифри реальні</p>
        <div className="wf-tm-case-grid">
          {items.map((c) => {
            const hero = splitMetric(c.metrics[0] ?? '')
            const others = c.metrics.slice(1)
            return (
              <article key={c.num} className="wf-tm-case-card">
                <div className="wf-tm-case-card-top">
                  <a className="wf-tm-case-partner-chip" href={`#company-${c.company}`}>
                    {c.company}
                  </a>
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
                {c.slug ? (
                  <a className="wf-tm-case-card-readmore" href={`#project-${c.slug}`}>
                    <span>$ cat ~/work/{c.slug}.md</span>
                    <span className="wf-tm-case-card-readmore-arrow">→</span>
                  </a>
                ) : (
                  <div className="wf-tm-case-card-readmore wf-tm-case-card-readmore--disabled">
                    <span>$ ./workflo --in-development</span>
                    <span className="wf-tm-case-card-readmore-arrow">●</span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Process — ASCII pipeline + numbered steps (design: TerminalProcess). */
function ProcessSection({ items }: { items: LandingContent['process'] }) {
  const pipeline = items.map((s) => `[${s.num}]`).join(' ──→ ')
  return (
    <section className="wf-tm-section" id="process" data-screen-label="process">
      <TermDivider section="process" cmd="man workflo-flow" />
      <div className="wf-tm-output">
        <pre className="wf-tm-pipeline" aria-hidden="true">
          {pipeline}
        </pre>
        <div className="wf-tm-steps">
          {items.map((s, i) => (
            <div key={s.num} className="wf-tm-step">
              <div className="wf-tm-step-marker">
                <span className="wf-tm-step-num">[{s.num}]</span>
                {i < items.length - 1 && <span className="wf-tm-step-line">│</span>}
              </div>
              <div className="wf-tm-step-body">
                <div className="wf-tm-step-name">{s.name}</div>
                <div className="wf-tm-step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Partners — company cards (design: TerminalPartners). Cards link to #company- anchors
 * (company detail pages land in a later slice). */
function PartnersSection({ partners }: { partners: LandingContent['partners'] }) {
  const totalProjects = partners.reduce((n, p) => n + p.projectsCount, 0)
  return (
    <section className="wf-tm-section" id="partners" data-screen-label="partners">
      <TermDivider section="partners" cmd="ls -la ~/partners" />
      <div className="wf-tm-output">
        <p className="wf-tm-section-intro">
          // {partners.length} партнерів · {totalProjects} проєктів · довгострокові партнерства
        </p>
        <div className="wf-tm-partner-grid">
          {partners.map((c) => (
            <a key={c.slug} className="wf-tm-partner-card" href={`#company-${c.slug}`}>
              <div className="wf-tm-partner-card-top">
                <div className="wf-tm-partner-logo-lg" style={{ background: c.accent }}>
                  {c.logoGlyph}
                </div>
                <span className="wf-tm-partner-card-arrow">↗</span>
              </div>
              <div className="wf-tm-partner-card-body">
                <div className="wf-tm-partner-card-name">{c.name}</div>
                <div className="wf-tm-partner-card-industry">{c.industry}</div>
                <p className="wf-tm-partner-card-bio">{c.bio}</p>
              </div>
              <div className="wf-tm-partner-card-foot">
                <span className="wf-tm-partner-card-stat">
                  <span className="wf-tm-accent">{c.projectsCount}</span>{' '}
                  {c.projectsCount === 1 ? 'проєкт' : 'проєкти'}
                </span>
                <span className="wf-tm-sb-sep">·</span>
                <span>since {c.since}</span>
                <span className="wf-tm-sb-sep">·</span>
                <span>{c.location}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Scale — stats grid + NDA project cards (design: TerminalScale). */
function ScaleSection({ scale }: { scale: LandingContent['scale'] }) {
  return (
    <section className="wf-tm-section" id="scale" data-screen-label="scale">
      <TermDivider section="scale" cmd="stats --all" />
      <div className="wf-tm-output">
        <p className="wf-tm-md-body" style={{ marginBottom: 16 }}>
          // {scale.subtitle}
        </p>
        <div className="wf-tm-scale-grid">
          {scale.stats.map((it) => (
            <div key={it.k} className="wf-tm-scale-cell">
              <div className="wf-tm-scale-v">{it.v}</div>
              <div className="wf-tm-scale-k">{it.k}</div>
            </div>
          ))}
        </div>
        <div className="wf-tm-md-section">
          <div className="wf-tm-md-h2">{scale.ndaHead}</div>
          <p
            className="wf-tm-md-body"
            style={{ color: 'var(--wf-fg-muted)', fontSize: 12, marginBottom: 12 }}
          >
            // {scale.ndaHint}
          </p>
          <div className="wf-tm-nda-grid">
            {scale.nda.map((p) => (
              <div key={p.tag} className="wf-tm-nda-card">
                <div className="wf-tm-nda-card-top">
                  <span className="wf-tm-nda-tag">[{p.tag}]</span>
                  <span className="wf-tm-nda-badge">
                    <span className="wf-tm-nda-lock">▒</span> NDA
                  </span>
                </div>
                <h4 className="wf-tm-nda-card-name">{p.name}</h4>
                <div className="wf-tm-nda-card-meta">
                  {p.year} · {p.duration}
                </div>
                <p className="wf-tm-nda-card-summary">{p.summary}</p>
                <ul className="wf-tm-nda-card-impacts">
                  {p.impact.map((m) => (
                    <li key={m}>
                      <span className="wf-tm-case-plus">+</span> {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Spotlight — Workflo product card + waitlist (design: TerminalSpotlight).
 * Waitlist submit is a local confirm for now; persistence lands with the contact API slice. */
function SpotlightSection({ spotlight }: { spotlight: LandingContent['spotlight'] }) {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  return (
    <section className="wf-tm-section" id="spotlight" data-screen-label="spotlight">
      <TermDivider section="spotlight" cmd="cat workflo/README.md" />
      <div className="wf-tm-output">
        <div className="wf-tm-spotlight">
          <div className="wf-tm-spotlight-head">
            <h2 className="wf-tm-md-h1"># {spotlight.name}</h2>
            <div className="wf-tm-spotlight-status">
              <span className="wf-tm-status-dot" />
              <span>{spotlight.status}</span>
            </div>
          </div>
          <p className="wf-tm-md-body">{spotlight.desc}</p>
          <p className="wf-tm-md-body wf-tm-md-muted">{spotlight.market}</p>
          <div className="wf-tm-md-section">
            <div className="wf-tm-md-h2">## subscribe</div>
            <form
              className="wf-tm-spotlight-form"
              onSubmit={(e) => {
                e.preventDefault()
                setDone(true)
              }}
            >
              <span className="wf-tm-sigil">$</span>
              <input
                className="wf-tm-input"
                type="email"
                required
                placeholder={spotlight.ctaEmailPh}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="wf-tm-btn wf-tm-btn--primary">
                [ {done ? 'subscribed ✓' : 'subscribe →'} ]
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

const ABOUT_ROWS: [string, string][] = [
  ['user', 'illia'],
  ['location', 'lutsk, ua'],
  ['since', '2018'],
  ['focus', 'автоматизація для команд, що виросли з Excel'],
  ['stack', 'TypeScript · Python · React · Postgres · LLMs'],
  ['status', 'available · приймаю проєкти Q3 2026'],
]

/** About — profile rows + "why" prose (design: TerminalAbout). */
function AboutSection({ about }: { about: string[] }) {
  return (
    <section className="wf-tm-section" id="who" data-screen-label="who">
      <TermDivider section="who" cmd="whoami && cat ~/profile.md" />
      <div className="wf-tm-output">
        <div className="wf-tm-profile">
          {ABOUT_ROWS.map(([k, v]) => (
            <div key={k} className="wf-tm-profile-row">
              <span className="wf-tm-profile-key">{k}</span>
              <span className="wf-tm-profile-val">{v}</span>
            </div>
          ))}
        </div>
        <div className="wf-tm-md-section">
          <div className="wf-tm-md-h2">## why</div>
          <div className="wf-tm-about-body">
            {about.map((p, i) => {
              if (p === '') return <div key={`sp-${i}`} style={{ height: 6 }} />
              const isEmph = p === 'Я роблю так, щоб цього не було.'
              return (
                <p key={`${i}-${p.slice(0, 12)}`} className={isEmph ? 'wf-tm-emph' : ''}>
                  {isEmph && <span className="wf-tm-emph-prefix">{'>>>'}</span>}
                  {p}
                </p>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export function TerminalLanding({ content = UA }: { content?: LandingContent }) {
  const c = content
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [liveIdx, setLiveIdx] = useState(0)
  const [clock, setClock] = useState('')

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('wf-theme')
    if (saved === 'dark' || saved === 'light') setTheme(saved)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setLiveIdx((i) => (i + 1) % c.live.length), 6000)
    return () => clearInterval(id)
  }, [c.live.length])

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  const setThemePersist = (t: 'light' | 'dark') => {
    setTheme(t)
    localStorage.setItem('wf-theme', t)
  }

  const tw = useTypewriter(c.hero.h1, mounted)
  const live = { text: c.live[liveIdx], ago: c.liveAgo[liveIdx] }

  return (
    <div className="wf-root wf-v-terminal-pro" data-theme={theme} data-accent="lime" id="top">
      <div className="wf-tm-wrap">
        <div className="wf-tm-window">
          {/* Title bar */}
          <div className="wf-tm-titlebar">
            <div className="wf-tm-traffic">
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
            </div>
            <div className="wf-tm-titlebar-title">~/illia/workflo — bash · 80×24</div>
            <div />
          </div>

          {/* Nav */}
          <header className="wf-tm-nav">
            <div className="wf-tm-nav-left">
              <a href="#top" className="wf-tm-wordmark">
                <span className="wf-tm-wordmark-cat">/\_/\</span>workflo.space
              </a>
              <nav className="wf-tm-nav-links">
                {c.nav.map((n) => (
                  <a key={n.href} href={n.href}>
                    {n.label.toLowerCase()}
                  </a>
                ))}
              </nav>
            </div>
            <div className="wf-tm-nav-right">
              <a className="wf-tm-portal-btn" href={PORTAL_URL} target="_blank" rel="noreferrer">
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11 V 7 a 5 5 0 0 1 10 0 v 4" />
                </svg>
                <span>{c.ctaPortal}</span>
              </a>
              <a className="wf-tm-btn wf-tm-btn--sm wf-tm-btn--primary" href="#contact">
                [ {c.ctaPrimary} → ]
              </a>
            </div>
          </header>

          {/* Body */}
          <div className="wf-tm-body">
            <section className="wf-tm-section wf-tm-hero" data-screen-label="hero">
              <pre className="wf-tm-ascii-art" aria-hidden="true">
                {HERO_ASCII}
              </pre>
              <TermPrompt cmd="./hello.sh" />
              <div className="wf-tm-output">
                <h1 className="wf-tm-h1" aria-label={c.hero.h1.join(' ')}>
                  {c.hero.h1.map((line, i) => {
                    const v = tw.visible[i] ?? ''
                    const isActive = tw.activeLine === i && !tw.done
                    const isLastDone = tw.done && i === c.hero.h1.length - 1
                    return (
                      <span key={i} className="wf-tm-h1-line">
                        <span className="wf-tm-h1-typed">{v || ' '}</span>
                        {(isActive || isLastDone) && <span className="wf-tm-cursor" />}
                      </span>
                    )
                  })}
                </h1>
                <div className="wf-tm-sub">// {c.hero.sub}</div>
                <div className="wf-tm-ctas">
                  <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">
                    [ {c.ctaPrimary} → ]
                  </a>
                  <a className="wf-tm-btn" href="#work">
                    [ {c.ctaSecondary} ]
                  </a>
                </div>
                <div className="wf-tm-live">
                  <span className="wf-tm-status-dot" />
                  <span className="wf-tm-live-l">{c.liveLabel}</span>
                  <span className="wf-tm-live-t">{live.text}</span>
                  <span className="wf-tm-live-sep">·</span>
                  <span className="wf-tm-live-a">{live.ago}</span>
                </div>
              </div>
            </section>

            <PartnersSection partners={c.partners} />
            <CasesSection items={c.cases} />
            <ScaleSection scale={c.scale} />
            <ServicesSection items={c.services} />
            <ProcessSection items={c.process} />
            <SpotlightSection spotlight={c.spotlight} />
            <AboutSection about={c.about} />
          </div>

          {/* Status bar */}
          <div className="wf-tm-statusbar">
            <div className="wf-tm-statusbar-left">
              <span className="wf-tm-sb-branch">
                <span className="wf-tm-status-dot" /> main
              </span>
              <span className="wf-tm-sb-sep">·</span>
              <span>UTF-8</span>
              <span className="wf-tm-sb-sep">·</span>
              <span className="wf-tm-sb-clock">{clock || '··:··'}</span>
              <span className="wf-tm-sb-sep">·</span>
              <span>lime</span>
            </div>
            <div className="wf-tm-statusbar-right">
              <span>ua</span>
              <span className="wf-tm-sb-sep">·</span>
              <div className="wf-tm-sb-toggle">
                <button data-on={theme === 'light'} onClick={() => setThemePersist('light')}>
                  ☀
                </button>
                <span>/</span>
                <button data-on={theme === 'dark'} onClick={() => setThemePersist('dark')}>
                  ☾
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
