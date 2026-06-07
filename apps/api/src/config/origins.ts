/**
 * Single source of truth for the browser-origin allowlist, shared by the CORS
 * plugin and the /auth/refresh CSRF guard (audit 2026-06: they had diverged —
 * refresh.ts failed CLOSED when CORS_ALLOWED_ORIGINS was unset in prod, breaking
 * token refresh for all browser clients, while cors.ts fell back to defaults).
 *
 * Set CORS_ALLOWED_ORIGINS (comma-separated) to override the defaults per env.
 */
const DEFAULT_ALLOWED_ORIGINS_PROD = [
  'https://dev.workflo.space',
  'https://dev-portal.workflo.space',
  'https://dev-work.workflo.space',
  'https://portal.workflo.space',
  'https://work.workflo.space',
  'https://workflo.space',
]

/** Production allowlist: CORS_ALLOWED_ORIGINS if set, else the workflo defaults. */
export function allowedProdOrigins(): Set<string> {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return new Set(fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS_PROD)
}

/** A localhost origin (dev DX only). */
export function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Is `origin` allowed? No Origin header → true (non-browser/native clients can't
 * forge cross-site requests). In prod, must be in the allowlist; in dev, localhost.
 * Used by both the CORS plugin and the /auth/refresh CSRF check (ADR-001).
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true
  if (process.env.NODE_ENV !== 'production') return isLocalOrigin(origin)
  return allowedProdOrigins().has(origin)
}
