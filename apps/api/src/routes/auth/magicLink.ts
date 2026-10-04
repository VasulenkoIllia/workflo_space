import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { generateOpaqueToken } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { dispatchNotification } from '../../services/notifications.js'
import { isEnabled } from '../../services/twoFactor.js'
import { issueSessionForProfile } from './session.js'
import { signChallenge } from './twoFactor.js'

/**
 * 01-А magic-link (рішення власника 11.06): вхід посиланням на email замість пароля,
 * на наявній OTP-інфрі (purpose=magic_link, TTL 15 хв, одноразовий — upsert по
 * (profileId, purpose) гасить попередній лінк). Request завжди відповідає 200
 * (існування адреси не палимо). Login-обмін ШАНУЄ 2FA: увімкнена — замість сесії
 * повертається той самий challenge, що й після пароля. Lockout (01-Б) НЕ блокує
 * magic-link — доставка листа сама доводить контроль скриньки.
 */
const MAGIC_TTL_MS = 15 * 60 * 1000

const requestSchema = z.object({ email: z.string().trim().email().max(200) })
const loginSchema = z.object({ token: z.string().min(10).max(200) })

const magicLinkRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/auth/magic-link',
    { config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { email } = requestSchema.parse(request.body)
      const profile = await prisma.profile.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, isActive: true },
      })
      if (profile?.isActive) {
        const token = generateOpaqueToken()
        await prisma.otpToken.upsert({
          where: { profileId_purpose: { profileId: profile.id, purpose: 'magic_link' } },
          create: {
            profileId: profile.id,
            purpose: 'magic_link',
            channel: 'email',
            code: token,
            expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
          },
          update: {
            code: token,
            usedAt: null,
            expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
          },
        })
        const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
        dispatchNotification(request.log, {
          profileId: profile.id,
          event: 'auth.magic_link',
          vars: { loginUrl: `${portalUrl}/magic-login?token=${encodeURIComponent(token)}` },
        })
        writeAuditAsync(request.log, {
          actorId: profile.id,
          action: 'auth.magic_link_requested',
          resourceType: 'profile',
          resourceId: profile.id,
          result: 'allowed',
          metadata: { ip: request.ip },
        })
      }
      // Той самий 200 незалежно від існування акаунта.
      return reply.send({ success: true, data: { sent: true } })
    }
  )

  fastify.post(
    '/auth/magic-login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { token } = loginSchema.parse(request.body)
      const row = await prisma.otpToken.findFirst({
        where: { code: token, purpose: 'magic_link' },
        select: { id: true, profileId: true, usedAt: true, expiresAt: true },
      })
      if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Посилання недійсне або прострочене', 401)
      }
      await prisma.otpToken.update({ where: { id: row.id }, data: { usedAt: new Date() } })

      // 2FA не обходиться magic-link'ом — та сама challenge-механіка, що після пароля.
      if (await isEnabled(row.profileId)) {
        writeAuditAsync(request.log, {
          actorId: row.profileId,
          action: 'auth.2fa_challenge_issued',
          resourceType: 'profile',
          resourceId: row.profileId,
          result: 'allowed',
          metadata: { ip: request.ip, via: 'magic_link' },
        })
        return reply.send({
          success: true,
          data: { twoFactorRequired: true, challengeToken: signChallenge(row.profileId) },
        })
      }

      const session = await issueSessionForProfile(reply, row.profileId, {
        userAgent: request.headers['user-agent'] ?? null,
        ip: request.ip,
      })
      if (!session) {
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Акаунт недоступний', 401)
      }
      writeAuditAsync(request.log, {
        actorId: row.profileId,
        action: 'auth.login_success',
        resourceType: 'profile',
        resourceId: row.profileId,
        result: 'allowed',
        metadata: { ip: request.ip, via: 'magic_link' },
      })
      return reply.send({ success: true, data: session })
    }
  )

  return Promise.resolve()
}

export default magicLinkRoute
