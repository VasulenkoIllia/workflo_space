import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Header title (left). Renders the `.wfp-card-h` header when provided. */
  title?: ReactNode
  /** Mono auxiliary label (right) — e.g. a count or code. Ignored if `actions` is set. */
  aux?: ReactNode
  /** Header actions node (right). Takes precedence over `aux`. */
  actions?: ReactNode
}

/** Surface container (`.wfp-card`) with an optional title/aux header. */
export function Card({ title, aux, actions, className, children, ...props }: CardProps) {
  const hasHeader = title != null || aux != null || actions != null
  return (
    <div className={cn('wfp-card', className)} {...props}>
      {hasHeader && (
        <div className="wfp-card-h">
          {title != null && <div className="wfp-card-h-t">{title}</div>}
          {(actions ?? aux) != null && <div className="wfp-card-h-aux">{actions ?? aux}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
