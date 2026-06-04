'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default 'secondary' */
  variant?: ButtonVariant
  /** Control size. @default 'md' */
  size?: ButtonSize
  /** Show a spinner and block interaction. */
  loading?: boolean
  /** Icon rendered before the label. */
  leftIcon?: ReactNode
  /** Icon rendered after the label. */
  rightIcon?: ReactNode
  /** Stretch to fill the container width. */
  fullWidth?: boolean
}

// Mirrors exactly the variants the designer authored in product-styles.css.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'wfp-btn--primary',
  secondary: '', // base .wfp-btn is the neutral bordered button
  ghost: 'wfp-btn--ghost',
  danger: 'wfp-btn--danger',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'wfp-btn--sm',
  md: '', // base .wfp-btn is the default (md) size
}

/**
 * Primary action button. Renders the design-system `.wfp-btn` family; under the
 * terminal aesthetic (an ancestor carrying `.wfp-aesA`) it is auto-wrapped in
 * `[ … ]`. Color comes from `--wf-*` tokens — never hardcode hex.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    className,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'wfp-btn',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth && 'wfp-btn--block',
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      {loading ? <span className="wfp-btn-spinner" aria-hidden="true" /> : leftIcon}
      {children != null && <span className="wfp-btn-label">{children}</span>}
      {!loading && rightIcon}
    </button>
  )
})
