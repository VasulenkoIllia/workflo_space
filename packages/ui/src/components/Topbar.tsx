'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon.js'
import { useShellMobile } from './AppShell.js'
import { cn } from '../lib/cn.js'

export interface TopbarProps {
  /** Breadcrumb pieces; the last is highlighted. */
  crumbs?: ReactNode[]
  /** Extra action nodes shown before the icon buttons. */
  actions?: ReactNode
  /** Avatar initials or node on the far right. */
  avatar?: ReactNode
  onSearch?: () => void
  onBell?: () => void
  /** Show the unread dot on the bell. */
  bellDot?: boolean
  /** Dropdown anchored at the bell (18): render-prop gets a close(). Takes precedence over onBell. */
  bellPanel?: (close: () => void) => ReactNode
  className?: string
}

/** App top bar (`.wfp-topbar`): breadcrumbs + actions + search/bell + avatar. */
export function Topbar({
  crumbs = [],
  actions,
  avatar,
  onSearch,
  onBell,
  bellDot = false,
  bellPanel,
  className,
}: TopbarProps) {
  const mobile = useShellMobile()
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLSpanElement>(null)
  // Клік поза дзвіночком/панеллю закриває дропдаун.
  useEffect(() => {
    if (!bellOpen) return
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [bellOpen])
  return (
    <div className={cn('wfp-topbar', className)}>
      {mobile && (
        <button
          type="button"
          className="wfp-tb-burger"
          aria-label="Меню"
          aria-expanded={mobile.open}
          onClick={mobile.toggle}
        >
          ☰
        </button>
      )}
      <div className="wfp-crumb">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="wfp-crumb-sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'wfp-crumb-current' : undefined}>{c}</span>
          </Fragment>
        ))}
      </div>
      <div className="wfp-tb-right">
        {actions}
        {onSearch && (
          <button
            type="button"
            className="wfp-iconbtn"
            title="Пошук (⌘K)"
            aria-label="Пошук"
            onClick={onSearch}
          >
            <Icon name="search" size={15} />
          </button>
        )}
        {(onBell || bellPanel) && (
          <span ref={bellRef} style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              type="button"
              className="wfp-iconbtn"
              title="Нотифікації"
              aria-label="Нотифікації"
              aria-expanded={bellPanel ? bellOpen : undefined}
              onClick={bellPanel ? () => setBellOpen((v) => !v) : onBell}
            >
              <Icon name="bell" size={15} />
              {bellDot && <span className="wfp-iconbtn-dot" />}
            </button>
            {bellPanel && bellOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  zIndex: 60,
                }}
              >
                {bellPanel(() => setBellOpen(false))}
              </div>
            )}
          </span>
        )}
        {avatar != null && <div className="wfp-tb-avatar">{avatar}</div>}
      </div>
    </div>
  )
}
