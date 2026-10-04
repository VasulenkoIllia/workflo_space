import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface AuthShellProps {
  children: ReactNode
  /** Wider card (e.g. the 2-step register wizard). */
  wide?: boolean
  className?: string
}

/** Centered auth card frame (`.wfp-auth` > `.wfp-auth-card`). Render inside <ThemeProvider>. */
export function AuthShell({ children, wide = false, className }: AuthShellProps) {
  return (
    <div className="wfp-auth">
      <div className={cn('wfp-auth-card', wide && 'wfp-auth-card--wide', className)}>
        {children}
      </div>
    </div>
  )
}

export interface AuthHeaderProps {
  title: ReactNode
  sub?: ReactNode
}

/** Brand mark + title + mono sub-label for the top of an auth card. */
export function AuthHeader({ title, sub }: AuthHeaderProps) {
  return (
    <>
      <div className="wfp-auth-mark">
        workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space
      </div>
      <div>
        <div className="wfp-auth-h1">{title}</div>
        {sub != null && <div className="wfp-auth-sub">{sub}</div>}
      </div>
    </>
  )
}

export interface AuthStatusProps {
  left?: ReactNode
  right?: ReactNode
}

/** Mono status footer for an auth card (status dot + system line). */
export function AuthStatus({ left, right }: AuthStatusProps) {
  return (
    <div className="wfp-auth-status">
      <span>
        <span className="wfp-status-dot" style={{ background: 'var(--wf-success)' }} />
        {left ?? 'all systems operational'}
      </span>
      <span>{right ?? '$ workflo.space'}</span>
    </div>
  )
}
