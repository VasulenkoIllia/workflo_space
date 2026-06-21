'use client'

import { Fragment } from 'react'
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
  className,
}: TopbarProps) {
  const mobile = useShellMobile()
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
        {onBell && (
          <button
            type="button"
            className="wfp-iconbtn"
            title="Нотифікації"
            aria-label="Нотифікації"
            onClick={onBell}
          >
            <Icon name="bell" size={15} />
            {bellDot && <span className="wfp-iconbtn-dot" />}
          </button>
        )}
        {avatar != null && <div className="wfp-tb-avatar">{avatar}</div>}
      </div>
    </div>
  )
}
