/**
 * Resolve the JWT signing secret. Fail-fast OUTSIDE development if it is missing or
 * weak — never silently fall back to an empty secret (which would make every access
 * token forgeable). Shared by the JWT plugin and the 2FA challenge HMAC so both use
 * the same key. Security audit 31.05.
 */
export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === 'development') {
    return 'dev-only-insecure-secret-change-me-32chars'
  }
  throw new Error(
    'JWT_SECRET is required and must be ≥32 chars outside development — refusing to start with an empty/weak JWT secret'
  )
}
