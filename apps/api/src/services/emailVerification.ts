import { prisma } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { generateOpaqueToken } from '../auth/tokens.js'
import { dispatchNotification } from './notifications.js'

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000 // canon (01-auth §B): 24h

/**
 * Email-verify token lifecycle (S9). Tokens live in otp_tokens with
 * purpose=email_verify — @@unique([profileId, purpose]) means one live token
 * per profile: a resend replaces the previous link (upsert).
 */

/** Mint (or replace) the verify token and send the CRITICAL email. */
export async function sendVerificationEmail(
  log: FastifyBaseLogger,
  profileId: string
): Promise<void> {
  const token = generateOpaqueToken()
  await prisma.otpToken.upsert({
    where: { profileId_purpose: { profileId, purpose: 'email_verify' } },
    create: {
      profileId,
      purpose: 'email_verify',
      channel: 'email',
      code: token,
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    },
    update: {
      code: token,
      usedAt: null,
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    },
  })

  const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
  dispatchNotification(log, {
    profileId,
    event: 'auth.email_verification',
    vars: { verifyUrl: `${portalUrl}/verify-email?token=${encodeURIComponent(token)}` },
  })
}

export type VerifyOutcome = 'ok' | 'invalid'

/** Consume a verify token → set Profile.emailVerifiedAt. Idempotent per token. */
export async function consumeVerificationToken(token: string): Promise<VerifyOutcome> {
  const row = await prisma.otpToken.findFirst({
    where: { code: token, purpose: 'email_verify' },
    select: { id: true, profileId: true, usedAt: true, expiresAt: true },
  })
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return 'invalid'

  await prisma.$transaction([
    prisma.otpToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.profile.update({
      where: { id: row.profileId },
      data: { emailVerifiedAt: new Date() },
    }),
  ])
  return 'ok'
}

/**
 * Mark the mailbox proven via a side-channel that already delivered an
 * email-bound link (invite accept, password reset). Never un-verifies.
 */
export async function markEmailVerified(profileId: string): Promise<void> {
  await prisma.profile.updateMany({
    where: { id: profileId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  })
}
