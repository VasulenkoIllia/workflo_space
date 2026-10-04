import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

export type StatusTone = 'accent' | 'success' | 'warning' | 'danger' | 'muted' | 'neutral'

// The design's .wfp-status-dot only defines size/shape; colour is applied inline.
const TONE_VAR: Record<StatusTone, string> = {
  accent: 'var(--wf-accent)',
  success: 'var(--wf-success)',
  warning: 'var(--wf-warning)',
  danger: 'var(--wf-destructive)',
  muted: 'var(--wf-fg-subtle)',
  neutral: 'var(--wf-fg-muted)',
}

export interface StatusDotProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  /** Semantic colour. @default 'neutral' */
  tone?: StatusTone
}

/** Small status indicator dot (`.wfp-status-dot`). Pair with adjacent text for meaning. */
export function StatusDot({ tone = 'neutral', className, style, ...props }: StatusDotProps) {
  return (
    <span
      className={cn('wfp-status-dot', className)}
      style={{ background: TONE_VAR[tone], ...style }}
      aria-hidden
      {...props}
    />
  )
}
