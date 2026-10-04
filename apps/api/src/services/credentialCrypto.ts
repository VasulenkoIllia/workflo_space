import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'
import { ApiErrorCode, AppError } from '@workflo/types'

/**
 * Envelope encryption for the Credentials Vault (module 17).
 *
 * A per-record 256-bit DEK encrypts the secret (AES-256-GCM); that DEK is itself wrapped by a
 * platform KEK held only in env (`CREDENTIALS_KEK_BASE64`) — never persisted. A leak of the
 * `credential_vault` table alone therefore does NOT expose any secret: the attacker still needs
 * the KEK. KEK rotation only re-wraps DEKs (cheap), leaving the ciphertext untouched.
 *
 * GCM gives authenticated encryption: a tampered ciphertext / wrong key fails `final()` with an
 * auth-tag error, which the reveal path surfaces rather than returning garbage.
 */
export interface EncryptedRecord {
  encryptedDek: Buffer
  dekIv: Buffer
  dekAuthTag: Buffer
  ciphertext: Buffer
  ciphertextIv: Buffer
  ciphertextAuthTag: Buffer
}

const KEY_LEN = 32 // AES-256
const IV_LEN = 12 // 96-bit nonce, the GCM standard

/** Decode the platform KEK from env; `null` when the vault isn't provisioned (dev/test). */
export function getKek(): Buffer | null {
  const b64 = process.env.CREDENTIALS_KEK_BASE64
  if (!b64) return null
  const kek = Buffer.from(b64, 'base64')
  if (kek.length !== KEY_LEN) {
    // Misconfiguration is fatal to the feature, not silently weak — refuse to run with a
    // wrong-length key rather than derive/pad one.
    throw new Error('CREDENTIALS_KEK_BASE64 must decode to exactly 32 bytes (AES-256)')
  }
  return kek
}

/** KEK or a 503 — call from vault routes so the API still boots when the key is absent. */
export function requireKek(): Buffer {
  const kek = getKek()
  if (!kek) {
    throw new AppError(
      ApiErrorCode.INTERNAL_ERROR,
      'Сховище секретів не налаштоване (відсутній ключ шифрування)',
      503
    )
  }
  return kek
}

/** Encrypt a plaintext secret into an envelope record. The DEK is wiped from memory after use. */
export function encryptSecret(plaintext: string, kek: Buffer): EncryptedRecord {
  const dek = randomBytes(KEY_LEN)
  const dekIv = randomBytes(IV_LEN)
  const ciphertextIv = randomBytes(IV_LEN)

  // Wrap the DEK with the KEK.
  const dekCipher = createCipheriv('aes-256-gcm', kek, dekIv)
  const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()])
  const dekAuthTag = dekCipher.getAuthTag()

  // Encrypt the secret with the DEK.
  const ctCipher = createCipheriv('aes-256-gcm', dek, ciphertextIv)
  const ciphertext = Buffer.concat([ctCipher.update(plaintext, 'utf8'), ctCipher.final()])
  const ciphertextAuthTag = ctCipher.getAuthTag()

  dek.fill(0)

  return { encryptedDek, dekIv, dekAuthTag, ciphertext, ciphertextIv, ciphertextAuthTag }
}

/** Decrypt an envelope record back to plaintext. Throws on tamper / wrong KEK (GCM auth). */
export function decryptSecret(rec: EncryptedRecord, kek: Buffer): string {
  // Defense-in-depth: reject structurally malformed records up front (GCM would also throw,
  // but this gives a precise error if the row were ever corrupted outside encryptSecret()).
  if (rec.dekIv.length !== IV_LEN || rec.ciphertextIv.length !== IV_LEN) {
    throw new Error('credentialCrypto: bad IV length')
  }
  if (rec.dekAuthTag.length !== 16 || rec.ciphertextAuthTag.length !== 16) {
    throw new Error('credentialCrypto: bad GCM auth-tag length')
  }
  const dekDecipher = createDecipheriv('aes-256-gcm', kek, rec.dekIv)
  dekDecipher.setAuthTag(rec.dekAuthTag)
  const dek = Buffer.concat([dekDecipher.update(rec.encryptedDek), dekDecipher.final()])

  try {
    const ctDecipher = createDecipheriv('aes-256-gcm', dek, rec.ciphertextIv)
    ctDecipher.setAuthTag(rec.ciphertextAuthTag)
    return Buffer.concat([ctDecipher.update(rec.ciphertext), ctDecipher.final()]).toString('utf8')
  } finally {
    dek.fill(0)
  }
}

/** Constant-time equality helper (used by the 2FA-challenge follow-up; exported for reuse). */
export function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}
