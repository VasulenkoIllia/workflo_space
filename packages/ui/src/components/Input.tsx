'use client'

import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Field label (rendered as the design's uppercase mono caption). */
  label?: ReactNode
  /** Helper text below the field. */
  hint?: ReactNode
  /** Error message — turns the field red and is announced to screen readers. */
  error?: string
  /** Explicit id (otherwise auto-generated for label association). */
  id?: string
}

/**
 * Labeled text field. Renders the design's `.wfp-field` (label + input + hint),
 * with the error state (`.wfp-field--error`) wired to `aria-invalid`/`aria-describedby`.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, ...props },
  ref
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const message = error ?? hint
  const hintId = message != null ? `${inputId}-hint` : undefined
  return (
    <div className={cn('wfp-field', error != null && 'wfp-field--error', className)}>
      {label != null && <label htmlFor={inputId}>{label}</label>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error != null || undefined}
        aria-describedby={hintId}
        {...props}
      />
      {message != null && (
        <span
          id={hintId}
          className={cn('wfp-field-hint', error != null && 'wfp-field-hint--error')}
        >
          {message}
        </span>
      )}
    </div>
  )
})
