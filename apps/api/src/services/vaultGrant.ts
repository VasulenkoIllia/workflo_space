import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Short-lived step-up grant for credential reveal (module 17, 2FA-on-reveal).
 *
 * The owner re-enters their password (step-up); on success we mint a stateless, HMAC-signed
 * grant valid for GRANT_TTL_MS. The reveal endpoint requires a live grant, so a stolen/borrowed
 * session alone can't exfiltrate plaintext — you also need the password within the window. HMAC
 * (not a DB row) keeps it stateless; binding to profileId stops one owner's grant working for
 * another. TOTP-based 2FA is a later enhancement once module-01 provisions authenticator secrets;
 * password re-entry is chosen here because every account already has a password (no "2FA not set
 * up" edge case).
 */
const GRANT_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Same resolution as the JWT plugin — never a silent empty secret outside dev. */
function grantSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === 'development') return 'dev-only-insecure-secret-change-me-32chars'
  throw new Error('JWT_SECRET is required (≥32 chars) to sign vault reveal grants')
}

function sign(payload: string): string {
  return createHmac('sha256', grantSecret()).update(payload).digest('hex')
}

export interface RevealGrant {
  grant: string
  expiresAt: Date
}

/** Mint a grant bound to a profile, valid for GRANT_TTL_MS. */
export function issueRevealGrant(profileId: string, now: number = Date.now()): RevealGrant {
  const exp = now + GRANT_TTL_MS
  const body = `${profileId}|${exp}`
  return { grant: `${body}|${sign(body)}`, expiresAt: new Date(exp) }
}

/** True iff `grant` is a live, untampered grant for `profileId`. Constant-time on the MAC. */
export function verifyRevealGrant(
  grant: string | undefined | null,
  profileId: string,
  now: number = Date.now()
): boolean {
  // Guard non-string bodies (e.g. `{ grant: 123 }`) — the route casts request.body, so a
  // truthy non-string would otherwise reach .split() and throw a 500 instead of a clean reject.
  if (typeof grant !== 'string' || grant === '') return false
  const parts = grant.split('|')
  if (parts.length !== 3) return false
  const [pid, expStr, mac] = parts
  if (pid === undefined || expStr === undefined || mac === undefined) return false
  if (pid !== profileId) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp <= now) return false
  const expected = sign(`${pid}|${expStr}`)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
