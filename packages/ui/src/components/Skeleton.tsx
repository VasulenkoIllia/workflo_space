import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

export type SkeletonVariant = 'block' | 'line' | 'title' | 'chip' | 'circle' | 'btn'

// Maps to the design's shimmer skeletons (polish.css `.wf-skel*`). Brief §11: skeletons, not spinners.
const VARIANT_CLASS: Record<SkeletonVariant, string> = {
  block: '',
  line: 'wf-skel--line',
  title: 'wf-skel--title',
  chip: 'wf-skel--chip',
  circle: 'wf-skel--circle',
  btn: 'wf-skel--btn',
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Shape preset. @default 'block' */
  variant?: SkeletonVariant
}

/** Shimmer placeholder (`.wf-skel`) for first-load states. Decorative (aria-hidden). */
export function Skeleton({ variant = 'block', className, ...props }: SkeletonProps) {
  return <div className={cn('wf-skel', VARIANT_CLASS[variant], className)} aria-hidden {...props} />
}
