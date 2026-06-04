'use client'

import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface SidebarNavItem {
  id: string
  label: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  badgeAccent?: boolean
  href?: string
}
export interface SidebarNavGroup {
  group: string
}
export type SidebarNavEntry = SidebarNavItem | SidebarNavGroup

function isGroup(e: SidebarNavEntry): e is SidebarNavGroup {
  return Object.prototype.hasOwnProperty.call(e, 'group')
}

export interface SidebarProps {
  nav: SidebarNavEntry[]
  /** id of the active item. */
  active?: string
  /** Terminal aesthetic renders group labels as `// group`. @default 'A' */
  aesthetic?: 'A' | 'B'
  /** Brand mark. Defaults to the workflo wordmark with an accent dot. */
  mark?: ReactNode
  /** Sub-label under the mark, e.g. 'portal'. */
  sub?: ReactNode
  /** Footer node (e.g. company switcher / user card with `.wfp-sb-foot`/`.wfp-sb-user`). */
  footer?: ReactNode
  /** SPA navigation handler — when set, items preventDefault and call this. */
  onNavigate?: (id: string, href?: string) => void
  className?: string
}

/** App sidebar (`.wfp-sb`) driven by a nav config. Brand-agnostic; app supplies the nav. */
export function Sidebar({
  nav,
  active,
  aesthetic = 'A',
  mark,
  sub,
  footer,
  onNavigate,
  className,
}: SidebarProps) {
  return (
    <aside className={cn('wfp-sb', className)}>
      <div className="wfp-sb-head">
        <span className="wfp-sb-mark">
          {mark ?? (
            <>
              workflo<span className="wfp-dot">.</span>space
            </>
          )}
        </span>
        {sub != null && <span className="wfp-sb-sub">{sub}</span>}
      </div>
      <nav className="wfp-sb-nav">
        {nav.map((entry, i) => {
          if (isGroup(entry)) {
            return (
              <div key={`g-${i}`} className="wfp-sb-group">
                {aesthetic === 'A' ? `// ${entry.group.toLowerCase()}` : entry.group}
              </div>
            )
          }
          return (
            <a
              key={entry.id}
              className="wfp-sb-item"
              data-on={entry.id === active || undefined}
              href={entry.href}
              onClick={
                onNavigate
                  ? (e) => {
                      e.preventDefault()
                      onNavigate(entry.id, entry.href)
                    }
                  : undefined
              }
            >
              {entry.icon != null && <span className="wfp-sb-item-icon">{entry.icon}</span>}
              <span>{entry.label}</span>
              {entry.badge != null && (
                <span
                  className={cn(
                    'wfp-sb-item-badge',
                    entry.badgeAccent && 'wfp-sb-item-badge--accent'
                  )}
                >
                  {entry.badge}
                </span>
              )}
            </a>
          )
        })}
      </nav>
      {footer}
    </aside>
  )
}
