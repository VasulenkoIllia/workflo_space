import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface EmptyStateProps {
  /** Mono glyph / ASCII mark above the title. @default '// ∅' */
  glyph?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Optional action (e.g. a <Button>). */
  action?: ReactNode
  className?: string
}

/** Dashed empty-state panel (`.wfp-empty`) — glyph + title + subtitle + optional action. */
export function EmptyState({
  glyph = '// ∅',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('wfp-empty', className)}>
      {glyph != null && <div className="wfp-empty-glyph">{glyph}</div>}
      <div className="wfp-empty-t">{title}</div>
      {description != null && <div className="wfp-empty-sub">{description}</div>}
      {action}
    </div>
  )
}
