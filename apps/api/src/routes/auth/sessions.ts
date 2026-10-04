import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * Active-sessions list + revoke (S9-02). A "session" is a refresh-token family:
 * rotation revokes the old row and creates a new one with the SAME familyId, so
 * active rows (revokedAt IS NULL, not expired) map 1:1 to live devices. The
 * access token carries sid = familyId, which is how we mark «current».
 *
 * Revoking kills the refresh token only — a live access token keeps working for
 * its remaining TTL (≤15m); the device is logged out at its next refresh.
 */

const idParamSchema = z.object({ id: z.string().uuid() })

const sessionsRoute: FastifyPluginAsync = (fastify) => {
  // ── List active sessions ─────────────────────────────────────────────────────
  fastify.get('/auth/sessions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const rows = await prisma.refreshToken.findMany({
      where: {
        profileId: request.user.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        familyId: true,
        userAgent: true,
        ip: true,
        firstIssuedAt: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({
      success: true,
      data: {
        sessions: rows.map((r) => ({
          id: r.id,
          userAgent: r.userAgent,
          ip: r.ip,
          signedInAt: r.firstIssuedAt,
          lastActiveAt: r.createdAt,
          expiresAt: r.expiresAt,
          current: r.familyId === request.user.sid,
        })),
      },
    })
  })

  // ── Revoke one session by row id ─────────────────────────────────────────────
  fastify.delete(
    '/auth/sessions/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params)
      // Scoped to the caller's own rows — a leaked row id revokes nothing for others.
      const updated = await prisma.refreshToken.updateMany({
        where: { id, profileId: request.user.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      if (updated.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Сесію не знайдено', 404)
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'auth.session_revoked',
        resourceType: 'profile',
        resourceId: request.user.sub,
        result: 'allowed',
        metadata: { ip: request.ip, sessionId: id },
      })
      return reply.send({ success: true, data: { revoked: true } })
    }
  )

  // ── Revoke everything except the current session ─────────────────────────────
  fastify.post(
    '/auth/sessions/revoke-others',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const sid = request.user.sid
      if (!sid) {
        // Pre-S9-02 access token (no sid claim) — the client can't be told apart
        // from the sessions it wants to kill. Re-login refreshes the claim.
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Сесія без ідентифікатора — увійдіть заново і повторіть',
          400
        )
      }
      const updated = await prisma.refreshToken.updateMany({
        where: { profileId: request.user.sub, revokedAt: null, NOT: { familyId: sid } },
        data: { revokedAt: new Date() },
      })
      if (updated.count > 0) {
        writeAuditAsync(request.log, {
          actorId: request.user.sub,
          action: 'auth.sessions_revoked_others',
          resourceType: 'profile',
          resourceId: request.user.sub,
          result: 'allowed',
          metadata: { ip: request.ip, revoked: updated.count },
        })
      }
      return reply.send({ success: true, data: { revoked: updated.count } })
    }
  )

  return Promise.resolve()
}

export default sessionsRoute
