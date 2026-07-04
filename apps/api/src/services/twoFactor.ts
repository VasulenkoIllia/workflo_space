import { type Prisma, prisma } from '@workflo/db'
import bcrypt from 'bcryptjs'
import { decryptSecret, encryptSecret, requireKek } from './credentialCrypto.js'
import { generateBackupCodes, generateTotpSecret, matchTotpStep } from './totp.js'

/**
 * 2FA persistence + crypto glue (S9-01). The base32 TOTP secret is stored with the
 * vault's envelope scheme (KEK-encrypted), so 2FA requires CREDENTIALS_KEK_BASE64.
 * Backup codes are one-time bcrypt hashes.
 */

export interface TwoFactorRow {
  encryptedDek: Buffer
  dekIv: Buffer
  dekAuthTag: Buffer
  ciphertext: Buffer
  ciphertextIv: Buffer
  ciphertextAuthTag: Buffer
  enabledAt: Date | null
  backupCodes: string[]
}

/** Decrypt the stored base32 secret for a row (requires the KEK). */
export function decryptTotpSecret(row: TwoFactorRow): string {
  return decryptSecret(
    {
      encryptedDek: row.encryptedDek,
      dekIv: row.dekIv,
      dekAuthTag: row.dekAuthTag,
      ciphertext: row.ciphertext,
      ciphertextIv: row.ciphertextIv,
      ciphertextAuthTag: row.ciphertextAuthTag,
    },
    requireKek()
  )
}

/** Envelope-encrypt a fresh secret into the columns TwoFactorAuth expects. */
export function encryptTotpSecret(secret: string): {
  encryptedDek: Buffer
  dekIv: Buffer
  dekAuthTag: Buffer
  ciphertext: Buffer
  ciphertextIv: Buffer
  ciphertextAuthTag: Buffer
} {
  return encryptSecret(secret, requireKek())
}

/** Start/reset setup: generate a new secret, upsert a PENDING row (enabledAt=null). */
export async function startSetup(profileId: string): Promise<string> {
  const secret = generateTotpSecret()
  const enc = encryptTotpSecret(secret)
  await prisma.twoFactorAuth.upsert({
    where: { profileId },
    create: { profileId, ...enc, enabledAt: null, backupCodes: [] },
    // Re-setup before enabling replaces the pending secret; an already-enabled row is
    // guarded by the route (must disable first), so this update path only hits pending rows.
    update: { ...enc, enabledAt: null, backupCodes: [] },
  })
  return secret
}

export type EnableResult = { ok: false } | { ok: true; backupCodes: string[] }

/** Confirm the first code → flip enabledAt on and mint one-time backup codes. */
export async function enable(profileId: string, code: string): Promise<EnableResult> {
  const row = await prisma.twoFactorAuth.findUnique({ where: { profileId } })
  if (!row || row.enabledAt) return { ok: false }
  const secret = decryptTotpSecret(row)
  const step = matchTotpStep(secret, code)
  if (step === null) return { ok: false }

  const codes = generateBackupCodes()
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)))
  await prisma.twoFactorAuth.update({
    where: { profileId },
    // Seed lastTotpStep so the enable code can't be replayed as a login within its window.
    data: { enabledAt: new Date(), backupCodes: hashes, lastTotpStep: step },
  })
  return { ok: true, backupCodes: codes }
}

/** True if the profile has 2FA active (enabled, not just pending). */
export async function isEnabled(profileId: string): Promise<boolean> {
  const row = await prisma.twoFactorAuth.findUnique({
    where: { profileId },
    select: { enabledAt: true },
  })
  return row?.enabledAt != null
}

export type ChallengeOutcome = 'ok' | 'invalid'

/**
 * Verify a login/step-up challenge: a 6-digit TOTP OR a one-time backup code.
 * A matched TOTP step and a matched backup code are BOTH single-use. A per-profile
 * advisory lock serialises the whole read-modify-write, so two concurrent requests
 * can't double-spend a backup code or replay a TOTP step (the plain tx alone did
 * NOT prevent this — the array/step writes are unconditional overwrites of a stale
 * read; same lock pattern as timer/leads/rates).
 */
export async function verifyChallenge(profileId: string, code: string): Promise<ChallengeOutcome> {
  const trimmed = code.trim()
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`2fa:${profileId}`}))`
    const row = await tx.twoFactorAuth.findUnique({ where: { profileId } })
    if (!row || !row.enabledAt) return 'invalid'

    if (/^\d{6}$/.test(trimmed)) {
      const secret = decryptTotpSecret(row)
      const step = matchTotpStep(secret, trimmed)
      if (step !== null) {
        // Replay guard: each step is accepted at most once (RFC 6238 §5.2).
        if (row.lastTotpStep != null && step <= row.lastTotpStep) return 'invalid'
        await tx.twoFactorAuth.update({ where: { profileId }, data: { lastTotpStep: step } })
        return 'ok'
      }
    }

    // Backup-code path: find the first matching hash, consume it.
    for (const hash of row.backupCodes) {
      if (await bcrypt.compare(trimmed.toLowerCase(), hash)) {
        await tx.twoFactorAuth.update({
          where: { profileId },
          data: { backupCodes: row.backupCodes.filter((h) => h !== hash) },
        })
        return 'ok'
      }
    }
    return 'invalid'
  })
}

/** Disable 2FA (delete the row). Caller must have re-authenticated (code or password). */
export async function disable(profileId: string): Promise<void> {
  await prisma.twoFactorAuth.deleteMany({ where: { profileId } })
}
