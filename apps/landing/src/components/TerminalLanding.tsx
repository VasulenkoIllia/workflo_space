'use client'

import { useEffect, useState } from 'react'
import { HERO_ASCII, UA, type LandingContent } from '@/data/content'

const PORTAL_URL = 'https://app.workflo.space'

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
              <div className="wf-tm-prompt">
                <span className="wf-tm-user">illia</span>
                <span className="wf-tm-at">@</span>
                <span className="wf-tm-host">workflo</span>
                <span className="wf-tm-colon">:</span>
                <span className="wf-tm-cwd">~</span>
                <span className="wf-tm-sigil">$</span>
                <span className="wf-tm-cmd">./hello.sh</span>
              </div>
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
