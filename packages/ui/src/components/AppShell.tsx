import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export type ShellAesthetic = 'A' | 'B'
export type ShellDensity = 'comfortable' | 'compact'

/** Mobile-drawer state, shared from AppShell down to the Topbar burger (F6). */
interface ShellMobileCtx {
  open: boolean
  toggle: () => void
}
const ShellMobileContext = createContext<ShellMobileCtx | null>(null)
/** Topbar reads this to render its hamburger; null outside an AppShell. */
export function useShellMobile(): ShellMobileCtx | null {
  return useContext(ShellMobileContext)
}

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
  const [mobileOpen, setMobileOpen] = useState(false)
  const close = () => setMobileOpen(false)

  const shell = (
    <div
      className={cn(
        'wfp-shell',
        kind != null && `wfp-shell--${kind}`,
        `wfp-aes${aesthetic}`,
        className
      )}
      data-density={density}
      data-mobile-open={mobileOpen || undefined}
    >
      {/* Wrapper closes the off-canvas drawer on any nav click inside it (mobile). `display:contents`
          keeps `.wfp-sb` as the grid child so layout is unchanged at desktop sizes. */}
      <div style={{ display: 'contents' }} onClick={() => mobileOpen && close()}>
        {sidebar}
      </div>
      {mobileOpen && <div className="wfp-sb-scrim" onClick={close} />}
      <main className="wfp-main">
        {topbar}
        <div className="wfp-content">{children}</div>
      </main>
    </div>
  )

  const framed =
    aesthetic !== 'A' ? (
      shell
    ) : (
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

  return (
    <ShellMobileContext.Provider
      value={{ open: mobileOpen, toggle: () => setMobileOpen((v) => !v) }}
    >
      {framed}
    </ShellMobileContext.Provider>
  )
}
