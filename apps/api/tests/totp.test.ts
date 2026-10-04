import { describe, expect, it } from 'vitest'
import {
  base32Decode,
  base32Encode,
  generateBackupCodes,
  generateTotpSecret,
  otpauthUrl,
  totpAt,
  verifyTotp,
} from '../src/services/totp.js'

describe('TOTP (RFC 6238) service', () => {
  it('base32 round-trips arbitrary bytes', () => {
    const buf = Buffer.from([0, 1, 2, 253, 254, 255, 128, 64])
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true)
  })

  it('matches the RFC 6238 SHA-1 test vector (secret "12345678901234567890")', () => {
    // The classic ASCII secret, base32-encoded; RFC appendix B @ T=59s → 94287082 (8-digit).
    // We emit 6 digits, so assert the low 6 of that vector.
    const secret = base32Encode(Buffer.from('12345678901234567890'))
    expect(totpAt(secret, 59_000)).toBe('287082')
  })

  it('verifyTotp accepts the current code and rejects a wrong one', () => {
    const secret = generateTotpSecret()
    const now = 1_700_000_000_000
    const code = totpAt(secret, now)
    expect(verifyTotp(secret, code, 1, now)).toBe(true)
    expect(verifyTotp(secret, '000000', 1, now)).toBe(false)
  })

  it('verifyTotp tolerates ±1 step of clock skew but not ±2', () => {
    const secret = generateTotpSecret()
    const now = 1_700_000_000_000
    const prev = totpAt(secret, now - 30_000)
    const twoAgo = totpAt(secret, now - 60_000)
    expect(verifyTotp(secret, prev, 1, now)).toBe(true)
    // two steps back only fails if that code differs from the accepted window
    if (
      twoAgo !== prev &&
      twoAgo !== totpAt(secret, now) &&
      twoAgo !== totpAt(secret, now + 30_000)
    ) {
      expect(verifyTotp(secret, twoAgo, 1, now)).toBe(false)
    }
  })

  it('verifyTotp rejects non-6-digit input', () => {
    const secret = generateTotpSecret()
    expect(verifyTotp(secret, '12345')).toBe(false)
    expect(verifyTotp(secret, 'abcdef')).toBe(false)
  })

  it('otpauthUrl carries issuer, secret and SHA1/6/30 params', () => {
    const url = otpauthUrl('JBSWY3DPEHPK3PXP', 'owner@workflo.space')
    expect(url).toContain('otpauth://totp/Workflo:owner%40workflo.space')
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(url).toContain('issuer=Workflo')
    expect(url).toContain('algorithm=SHA1')
    expect(url).toContain('digits=6')
    expect(url).toContain('period=30')
  })

  it('generateBackupCodes: 10 unique xxxx-xxxx codes, no ambiguous chars', () => {
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const c of codes) {
      expect(c).toMatch(/^[2-9a-hj-np-z]{4}-[2-9a-hj-np-z]{4}$/)
      expect(c).not.toMatch(/[01ilo]/)
    }
  })
})
