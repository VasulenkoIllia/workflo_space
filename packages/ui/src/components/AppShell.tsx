import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export type ShellAesthetic = 'A' | 'B'
export type ShellDensity = 'comfortable' | 'compact'

export interface AppShellProps {
  /** Sidebar node (e.g. <Sidebar/>). */
  sidebar: ReactNode
  /** Topbar node (e.g. <Topbar/>). */
  topbar?: ReactNode
  children: ReactNode
  /** 'A' = terminal window chrome, 'B' = clean studio (no chrome). @default 'A' */
  aesthetic?: ShellAesthetic
  /** @default 'comfortable' */
  density?: ShellDensity
  /** Shell variant suffix, e.g. 'portal' | 'workspace' → `.wfp-shell--{kind}`. */
  kind?: string
  /** Window title bar text (aesthetic A). */
  windowTitle?: ReactNode
  /** Status bar slots (aesthetic A). */
  statusBarLeft?: ReactNode
  statusBarRight?: ReactNode
  className?: string
}

/**
 * The app frame: sidebar + (topbar + scrollable content). In aesthetic A it is
 * wrapped in the terminal window chrome (traffic lights, title, status bar).
 * Render inside a <ThemeProvider> — it does not own the `.wfp-root` token scope.
 */
export function AppShell({
  sidebar,
  topbar,
  children,
  aesthetic = 'A',
  density = 'comfortable',
  kind,
  windowTitle = 'portal.workflo.space — bash',
  statusBarLeft,
  statusBarRight,
  className,
}: AppShellProps) {
  const shell = (
    <div
      className={cn(
        'wfp-shell',
        kind != null && `wfp-shell--${kind}`,
        `wfp-aes${aesthetic}`,
        className
      )}
      data-density={density}
    >
      {sidebar}
      <main className="wfp-main">
        {topbar}
        <div className="wfp-content">{children}</div>
      </main>
    </div>
  )

  if (aesthetic !== 'A') return shell

  return (
    <div className="wfp-window" style={{ height: '100%' }}>
      <div className="wfp-window-title">
        <div className="wfp-window-traffic">
          <span className="wfp-window-traffic-dot" />
          <span className="wfp-window-traffic-dot" />
          <span className="wfp-window-traffic-dot" />
        </div>
        <div className="wfp-window-title-c">{windowTitle}</div>
        <div />
      </div>
      <div className="wfp-window-body">{shell}</div>
      <div className="wfp-window-statusbar">
        <div className="wfp-window-statusbar-l">
          {statusBarLeft ?? (
            <>
              <span className="wfp-status-dot" style={{ background: 'var(--wf-success)' }} />
              <span>main</span>
            </>
          )}
        </div>
        <div className="wfp-window-statusbar-r">{statusBarRight ?? <span>/</span>}</div>
      </div>
    </div>
  )
}
