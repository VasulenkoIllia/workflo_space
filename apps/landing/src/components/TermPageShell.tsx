'use client'

import { Fragment, type ReactNode, useEffect, useState } from 'react'

export interface Crumb {
  label: string
  href?: string
}

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

/** Shared terminal-window chrome for the standalone landing pages (design: TermPageShell in
 * landing-blog.jsx). Titlebar → breadcrumbs → body(prompt + content + eof) → status bar.
 * Light/dark via localStorage (shared with the homepage). */
export function TermPageShell({
  cwd = '~',
  crumbs = [],
  cmd,
  statusLeft,
  children,
}: {
  cwd?: string
  crumbs?: Crumb[]
  cmd?: string
  statusLeft?: ReactNode
  children: ReactNode
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    const saved = localStorage.getItem('wf-theme')
    if (saved === 'dark' || saved === 'light') setTheme(saved)
  }, [])
  const setThemePersist = (t: 'light' | 'dark') => {
    setTheme(t)
    localStorage.setItem('wf-theme', t)
  }

  return (
    <div className="wf-root wf-v-terminal-pro" data-theme={theme} data-accent="lime" id="top">
      <div className="wf-tm-wrap">
        <div className="wf-tm-window">
          <div className="wf-tm-titlebar">
            <div className="wf-tm-traffic">
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
            </div>
            <div className="wf-tm-titlebar-title">{cwd} — bash</div>
            <div />
          </div>

          {crumbs.length > 0 && (
            <div className="wf-tm-page-crumb">
              {crumbs.map((cr, i) => (
                <Fragment key={`${i}-${cr.label}`}>
                  {i > 0 && <span className="wf-tm-crumb-sep">/</span>}
                  {i === crumbs.length - 1 ? (
                    <span className="wf-tm-crumb-current">{cr.label}</span>
                  ) : (
                    <a className="wf-tm-crumb" href={cr.href ?? '/'}>
                      {cr.label}
                    </a>
                  )}
                </Fragment>
              ))}
            </div>
          )}

          <div className="wf-tm-body">
            {cmd != null && <TermPrompt cmd={cmd} />}
            <div className="wf-tm-output">
              {children}
              <div className="wf-tm-eof">
                <TermPrompt cmd="" />
                <span className="wf-tm-cursor" />
              </div>
            </div>
          </div>

          <div className="wf-tm-statusbar">
            <div className="wf-tm-statusbar-left">{statusLeft}</div>
            <div className="wf-tm-statusbar-right">
              <span>lime</span>
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
