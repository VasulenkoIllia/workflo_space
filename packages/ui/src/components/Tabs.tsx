'use client'

import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface TabItem {
  id: string
  label: ReactNode
  badge?: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  /** Optional right-aligned slot (e.g. an "Activity →" link). */
  right?: ReactNode
  className?: string
}

/** Underline tab bar (`.wfp-od-tabs`). Controlled via `value`/`onChange`. */
export function Tabs({ items, value, onChange, right, className }: TabsProps) {
  return (
    <div className={cn('wfp-od-tabs', className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          className="wfp-od-tab"
          data-on={item.id === value || undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.badge != null && <span className="wfp-od-tab-badge">{item.badge}</span>}
        </button>
      ))}
      {right != null && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>{right}</div>
      )}
    </div>
  )
}
