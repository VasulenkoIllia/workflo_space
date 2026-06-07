import * as Sentry from '@sentry/node'

/**
 * Sentry wiring (SPEC §5 observability / audit P5). Active only when SENTRY_DSN is
 * set — a safe no-op in dev/test/CI, so nothing changes locally. Manual exception
 * capture from the global error handler + worker drain; PII is NOT sent by default.
 *
 * Call `initSentry()` once at process bootstrap (web index.ts + worker.ts) BEFORE
 * serving traffic, then `captureException()` from error paths and `flushSentry()`
 * on graceful shutdown so buffered events aren't lost.
 */
let active = false

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN
  if (!dsn || active) return
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0, // error monitoring only; enable tracing later if needed
    sendDefaultPii: false, // never auto-attach IP/headers/body (PII scrub)
  })
  active = true
}

export function isSentryActive(): boolean {
  return active
}

/** Report an exception when Sentry is active; no-op otherwise. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!active) return
  Sentry.captureException(err, context ? { extra: context } : undefined)
}

/** Drain buffered events on shutdown so the last errors before exit are not lost. */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!active) return
  await Sentry.flush(timeoutMs).catch(() => undefined)
}
