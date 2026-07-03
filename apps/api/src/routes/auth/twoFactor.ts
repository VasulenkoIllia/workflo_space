import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { resolveJwtSecret } from '../../auth/jwtSecret.js'
import { verifyPassword } from '../../auth/password.js'
import { writeAuditAsync } from '../../services/audit.js'
import { otpauthUrl } from '../../services/totp.js'
import {
  disable,
  enable,
  isEnabled,
  startSetup,
  verifyChallenge,
} from '../../services/twoFactor.js'
import { issueSessionForProfile } from './session.js'

/**
 * A 2FA login challenge token — a compact HMAC of `profileId.expiryMs`, signed with
 * the JWT secret. Deliberately NOT a JWT: it can never be presented as an access
 * token (different shape, own verifier), so a stolen challenge grants nothing but a
 * second 2FA attempt within its 5-minute window.
 */
const CHALLENGE_TTL_MS = 5 * 60 * 1000

export function signChallenge(profileId: string): string {
  const exp = Date.now() + CHALLENGE_TTL_MS
  const body = `${profileId}.${exp}`
  const mac = createHmac('sha256', resolveJwtSecret()).update(body).digest('base64url')
  return `${body}.${mac}`
}

export function verifyChallengeToken(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [profileId, expStr, mac] = parts as [string, string, string]
  const expected = createHmac('sha256', resolveJwtSecret())
    .update(`${profileId}.${expStr}`)
    .digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (Number(expStr) < Date.now()) return null
  return profileId
}

const setupEnableSchema = z.object({ code: z.string().min(6).max(10) })
const disableSchema = z.object({
  code: z.string().min(4).max(20).optional(),
  password: z.string().optional(),
})
const loginVerifySchema = z.object({
  challengeToken: z.string().min(10),
  code: z.string().min(4).max(20),
})

const twoFactorRoute: FastifyPluginAsync = (fastify) => {
  // ── Status (is 2FA on?) ──────────────────────────────────────────────────────
  fastify.get(
    '/auth/2fa/status',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const row = await prisma.twoFactorAuth.findUnique({
        where: { profileId: request.user.sub },
        select: { enabledAt: true, backupCodes: true },
      })
      return reply.send({
        success: true,
        data: {
          enabled: row?.enabledAt != null,
          pending: row != null && row.enabledAt == null,
          backupCodesRemaining: row?.enabledAt ? row.backupCodes.length : 0,
        },
      })
    }
  )

  // ── Start setup → returns secret + otpauth URL for the QR ────────────────────
  fastify.post(
    '/auth/2fa/setup',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      if (await isEnabled(request.user.sub)) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, '2FA вже увімкнено', 409)
      }
      const secret = await startSetup(request.user.sub)
      return reply.send({
        success: true,
        data: { secret, otpauthUrl: otpauthUrl(secret, request.user.email) },
      })
    }
  )

  // ── Enable: confirm the first code → on + backup codes (shown ONCE) ──────────
  fastify.post(
    '/auth/2fa/enable',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { code } = setupEnableSchema.parse(request.body)
      const result = await enable(request.user.sub, code)
      if (!result.ok) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Невірний код — спробуйте ще раз', 400)
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'auth.2fa_enabled',
        resourceType: 'profile',
        resourceId: request.user.sub,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { backupCodes: result.backupCodes } })
    }
  )

  // ── Disable: re-auth with a live code OR the account password ────────────────
  fastify.post(
    '/auth/2fa/disable',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { code, password } = disableSchema.parse(request.body)
      if (!(await isEnabled(request.user.sub))) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, '2FA не увімкнено', 400)
      }
      let reauthenticated = false
      if (code && (await verifyChallenge(request.user.sub, code)) === 'ok') reauthenticated = true
      if (!reauthenticated && password) {
        const profile = await prisma.profile.findUnique({
          where: { id: request.user.sub },
          select: { passwordHash: true },
        })
        if (profile && (await verifyPassword(password, profile.passwordHash)))
          reauthenticated = true
      }
      if (!reauthenticated) {
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Потрібен код 2FA або пароль', 401)
      }
      await disable(request.user.sub)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'auth.2fa_disabled',
        resourceType: 'profile',
        resourceId: request.user.sub,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { disabled: true } })
    }
  )

  // ── Login step 2: exchange a valid challenge + code for real session tokens ──
  fastify.post(
    '/auth/2fa/login-verify',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { challengeToken, code } = loginVerifySchema.parse(request.body)
      const profileId = verifyChallengeToken(challengeToken)
      if (!profileId) {
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Сесію підтвердження прострочено', 401)
      }
      if ((await verifyChallenge(profileId, code)) !== 'ok') {
        writeAuditAsync(request.log, {
          actorId: profileId,
          action: 'auth.2fa_challenge_failed',
          resourceType: 'profile',
          resourceId: profileId,
          result: 'denied',
          metadata: { ip: request.ip },
        })
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Невірний код 2FA', 401)
      }
      const session = await issueSessionForProfile(reply, profileId, {
        userAgent: request.headers['user-agent'] ?? null,
        ip: request.ip,
      })
      if (!session) {
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Обліковий запис недоступний', 401)
      }
      writeAuditAsync(request.log, {
        actorId: profileId,
        action: 'auth.login_success',
        resourceType: 'profile',
        resourceId: profileId,
        result: 'allowed',
        metadata: { ip: request.ip, via: '2fa' },
      })
      return reply.status(200).send({ success: true, data: session })
    }
  )

  return Promise.resolve()
}

export { setupEnableSchema, loginVerifySchema }
export default twoFactorRoute
