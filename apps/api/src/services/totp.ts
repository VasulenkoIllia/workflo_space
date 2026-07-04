import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30s step) — from scratch, no external dep.
 * Interops with Google Authenticator / 1Password / Authy. The shared secret is
 * base32 (RFC 4648, no padding); it is stored KEK-encrypted (envelope) like a
 * vault secret, never in the clear.
 */
const DIGITS = 6
const STEP_SECONDS = 30
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** New random base32 secret (20 bytes = 160 bits, the RFC-recommended SHA-1 size). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx === -1) throw new Error('base32Decode: invalid character')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** The TOTP code for a given secret at a given unix-ms time (defaults handled by caller). */
export function totpAt(secret: string, timeMs: number): string {
  const counter = Math.floor(timeMs / 1000 / STEP_SECONDS)
  const buf = Buffer.alloc(8)
  // 64-bit big-endian counter (high word is 0 until year ~10889, so this is safe).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0')
}

/**
 * Match a user-entered code against the secret and return the ABSOLUTE step it
 * matched (unix-step counter), or null if none. Accepts the current step ±`window`
 * steps (clock skew). Constant-time compare per candidate. The returned step lets
 * the caller enforce single-use (replay guard, RFC 6238 §5.2). `nowMs` injectable.
 */
export function matchTotpStep(
  secret: string,
  code: string,
  window = 1,
  nowMs = Date.now()
): number | null {
  const trimmed = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(trimmed)) return null
  const target = Buffer.from(trimmed)
  for (let w = -window; w <= window; w++) {
    const tMs = nowMs + w * STEP_SECONDS * 1000
    const candidate = Buffer.from(totpAt(secret, tMs))
    if (candidate.length === target.length && timingSafeEqual(candidate, target)) {
      return Math.floor(tMs / 1000 / STEP_SECONDS)
    }
  }
  return null
}

/** Boolean convenience over {@link matchTotpStep} (skew-tolerant, no replay tracking). */
export function verifyTotp(secret: string, code: string, window = 1, nowMs = Date.now()): boolean {
  return matchTotpStep(secret, code, window, nowMs) !== null
}

/** otpauth:// provisioning URI for QR rendering (label = issuer:account). */
export function otpauthUrl(secret: string, account: string, issuer = 'Workflo'): string {
  // Label = issuer:account with a LITERAL colon (authenticators split on it); each
  // side is percent-encoded separately.
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** N single-use backup codes (format `xxxx-xxxx`, crockford-ish, unambiguous). */
export function generateBackupCodes(count = 10): string[] {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz' // no 0/1/i/l/o
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const raw = Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join('')
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`)
  }
  return codes
}
