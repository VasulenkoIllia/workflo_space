import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'muted'

// Maps semantic tones to the design's status-badge classes (product-styles.css).
const TONE_CLASS: Record<BadgeTone, string> = {
  default: '',
  success: 'wfp-badge--paid',
  warning: 'wfp-badge--partial',
  danger: 'wfp-badge--unpaid',
  muted: 'wfp-badge--soft',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic color tone. @default 'default' */
  tone?: BadgeTone
}

/** Inline status badge (`.wfp-badge`). Lowercase mono pill with a semantic tone. */
export function Badge({ tone = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('wfp-badge', TONE_CLASS[tone], className)} {...props}>
      {children}
    </span>
  )
}
