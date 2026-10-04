/**
 * Open-redirect guard: allow only internal absolute paths ('/x').
 * Blocks protocol-relative ('//evil.com') and external/`javascript:` URLs.
 */
export function safeRedirect(path: string | null | undefined, fallback = '/orders'): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}
