import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { writeAuditAsync } from '../../services/audit.js'
import {
  consumeVerificationToken,
  sendVerificationEmail,
} from '../../services/emailVerification.js'

const verifySchema = z.object({ token: z.string().min(10).max(200) })

/**
 * Email verification (S9, canon 01-auth §B). Login is never blocked on an
 * unverified email — verification only unlocks sensitive actions later.
 */
const verifyEmailRoute: FastifyPluginAsync = (fastify) => {
  // ── Consume the emailed link. Public: the token itself is the proof. ─────────
  fastify.post(
    '/auth/verify-email',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { token } = verifySchema.parse(request.body)
      if ((await consumeVerificationToken(token)) !== 'ok') {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Посилання недійсне або застаріле — запросіть новий лист',
          410
        )
      }
      return reply.send({ success: true, data: { verified: true } })
    }
  )

  // ── Resend the link (canon: 3/15хв) ──────────────────────────────────────────
  fastify.post(
    '/auth/resend-verification',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const profile = await prisma.profile.findUnique({
        where: { id: request.user.sub },
        select: { emailVerifiedAt: true },
      })
      if (profile?.emailVerifiedAt) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Email уже підтверджено', 400)
      }
      await sendVerificationEmail(request.log, request.user.sub)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'auth.verification_resent',
        resourceType: 'profile',
        resourceId: request.user.sub,
        result: 'allowed',
        metadata: { ip: request.ip },
      })
      return reply.send({ success: true, data: { sent: true } })
    }
  )

  return Promise.resolve()
}

export default verifyEmailRoute
