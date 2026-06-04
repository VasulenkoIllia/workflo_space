import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Used to derive initials and the tooltip. */
  name?: string
  /** Optional image URL (falls back to initials). */
  src?: string
  /** Diameter in px. @default 22 (design default) */
  size?: number
  /** Explicit initials override. */
  initials?: string
}

function initialsFrom(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

/**
 * Round initials/image avatar (`.wfp-av`). Defaults to the design's base style;
 * pass `style={{ background, color }}` for an accent highlight (e.g. assignee).
 */
export function Avatar({
  name,
  src,
  size = 22,
  initials,
  className,
  style,
  ...props
}: AvatarProps) {
  const label = initials ?? initialsFrom(name)
  return (
    <span
      className={cn('wfp-av', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.45)),
        ...style,
      }}
      title={name}
      {...props}
    >
      {src != null ? (
        <img
          src={src}
          alt={name ?? ''}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        label
      )}
    </span>
  )
}

export type AvatarStackProps = HTMLAttributes<HTMLSpanElement>

/** Overlapping avatar group (`.wfp-av-stack`). */
export function AvatarStack({ className, children, ...props }: AvatarStackProps) {
  return (
    <span className={cn('wfp-av-stack', className)} {...props}>
      {children}
    </span>
  )
}
