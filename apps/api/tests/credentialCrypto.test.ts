import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@workflo/types'
import {
  decryptSecret,
  encryptSecret,
  getKek,
  requireKek,
} from '../src/services/credentialCrypto.js'

const KEK = randomBytes(32)

describe('credentialCrypto — envelope AES-256-GCM', () => {
  it('round-trips a secret through encrypt → decrypt', () => {
    const secret = 'sup3r-s3cret-пароль-🔑'
    const rec = encryptSecret(secret, KEK)
    expect(decryptSecret(rec, KEK)).toBe(secret)
  })

  it('produces unique ciphertext/DEK per call (random IVs)', () => {
    const a = encryptSecret('same', KEK)
    const b = encryptSecret('same', KEK)
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false)
    expect(a.encryptedDek.equals(b.encryptedDek)).toBe(false)
    expect(a.ciphertextIv.equals(b.ciphertextIv)).toBe(false)
  })

  it('throws when the ciphertext is tampered (GCM auth)', () => {
    const rec = encryptSecret('secret', KEK)
    rec.ciphertext[0] ^= 0xff
    expect(() => decryptSecret(rec, KEK)).toThrow()
  })

  it('throws when decrypted with the wrong KEK', () => {
    const rec = encryptSecret('secret', KEK)
    expect(() => decryptSecret(rec, randomBytes(32))).toThrow()
  })
})

describe('credentialCrypto — KEK loading', () => {
  const original = process.env.CREDENTIALS_KEK_BASE64
  beforeEach(() => {
    delete process.env.CREDENTIALS_KEK_BASE64
  })
  afterEach(() => {
    if (original === undefined) delete process.env.CREDENTIALS_KEK_BASE64
    else process.env.CREDENTIALS_KEK_BASE64 = original
  })

  it('getKek returns null when unset', () => {
    expect(getKek()).toBeNull()
  })

  it('getKek returns a 32-byte buffer for a valid base64 key', () => {
    process.env.CREDENTIALS_KEK_BASE64 = randomBytes(32).toString('base64')
    expect(getKek()?.length).toBe(32)
  })

  it('getKek throws on a wrong-length key', () => {
    process.env.CREDENTIALS_KEK_BASE64 = randomBytes(16).toString('base64')
    expect(() => getKek()).toThrow(/32 bytes/)
  })

  it('requireKek raises a 503 AppError when unset', () => {
    try {
      requireKek()
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(503)
    }
  })
})
