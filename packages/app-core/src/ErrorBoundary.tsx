import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * AR-41 (audit 2026-06-11): root error boundary — without one, ANY render error
 * white-screens the whole SPA. Plain styles (no UI-kit dependency) so the boundary
 * itself can never be the thing that crashes.
 */
interface ErrorBoundaryProps {
  children: ReactNode
  /** Hook for logging/Sentry — called once per caught error. */
  onError?: (error: unknown, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError?.(error, info)
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <strong style={{ fontSize: 18 }}>Щось пішло не так</strong>
        <span style={{ opacity: 0.7 }}>
          Сталася неочікувана помилка. Спробуйте оновити сторінку.
        </span>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            cursor: 'pointer',
            border: '1px solid currentColor',
            borderRadius: 6,
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
          }}
        >
          Оновити сторінку
        </button>
      </div>
    )
  }
}
