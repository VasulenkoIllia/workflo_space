'use client'

import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export type ModalSize = 'md' | 'lg' | 'xl'

const SIZE_CLASS: Record<ModalSize, string> = {
  md: '',
  lg: 'wfp-modal--lg',
  xl: 'wfp-modal--xl',
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Mono aux label on the right of the header. */
  aux?: ReactNode
  /** @default 'md' */
  size?: ModalSize
  /** Footer node (e.g. action buttons). */
  footer?: ReactNode
  children?: ReactNode
  /** Close when the backdrop is clicked. @default true */
  closeOnOverlay?: boolean
  /** Close on the Escape key. @default true */
  closeOnEsc?: boolean
}

/**
 * Centered modal dialog (`.wfp-modal*`). Rendered inline (inside the `.wfp-root`
 * token scope) with a fixed full-viewport backdrop; closes on Esc / backdrop click,
 * locks body scroll, and focuses the dialog. Not a full focus-trap yet.
 */
export function Modal({
  open,
  onClose,
  title,
  aux,
  size = 'md',
  footer,
  children,
  closeOnOverlay = true,
  closeOnEsc = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Lock body scroll + focus the dialog while open (depends on `open` only, so a
  // changing onClose identity can't release the lock mid-render).
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open || !closeOnEsc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closeOnEsc, onClose])

  if (!open) return null

  return (
    <div
      className="wfp-modal-overlay"
      style={{ position: 'fixed' }}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        className={cn('wfp-modal', SIZE_CLASS[size])}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title != null ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wfp-modal-h">
          {title != null && (
            <div className="wfp-modal-h-t" id={titleId}>
              {title}
            </div>
          )}
          {aux != null && <div className="wfp-modal-h-aux">{aux}</div>}
          <button
            type="button"
            className="wfp-modal-h-close"
            aria-label="Закрити"
            onClick={onClose}
            style={aux == null ? { marginLeft: 'auto' } : undefined}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="wfp-modal-body">{children}</div>
        {footer != null && <div className="wfp-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
