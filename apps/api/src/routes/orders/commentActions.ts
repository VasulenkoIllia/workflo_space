import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, reactionSchema, updateCommentSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { agencyRole } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { publishChangeEvent, publishTypingEvent } from '../../services/chatBus.js'
import { requireOrderParticipant } from './access.js'
import { COMMENT_SELECT, serializeComment } from './comments.js'

// Канон 03-B: автор редагує 15 хв від createdAt; owner агенції — будь-коли.
const EDIT_WINDOW_MS = 15 * 60 * 1000

// 03-В: пошук від 2 символів (коротший ловив би все підряд).
const searchQuerySchema = z.object({ q: z.string().trim().min(2).max(200) })

/**
 * Edit / soft-delete / reactions / typing (S10, канон 03-B/C + 03-Б).
 * Кожна дія проходить participant-гард замовлення І leak-гард самого
 * повідомлення (клієнт не бачить internal → не може його редагувати,
 * видаляти чи реагувати на нього — 404-стиль, без визнання існування).
 */
const commentActionsRoute: FastifyPluginAsync = (fastify) => {
  // ── Edit own message (owner: anyone's, anytime) ───────────────────────────
  fastify.patch<{ Params: { id: string; commentId: string } }>(
    '/orders/:id/comments/:commentId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const input = updateCommentSchema.parse(request.body)
      const user = request.user
      const isAgencyOwner = agencyRole(user, access.agencyId) === 'owner'

      const updated = await withTenant(async (tx) => {
        const row = await tx.orderComment.findFirst({
          where: {
            id: request.params.commentId,
            orderId: access.orderId,
            deletedAt: null,
            ...(access.isInternal ? {} : { isInternal: false }),
          },
          select: { id: true, authorId: true, createdAt: true },
        })
        if (!row) throw new AppError(ApiErrorCode.NOT_FOUND, 'Повідомлення не знайдено', 404)
        if (row.authorId !== user.sub && !isAgencyOwner) {
          throw new AppError(ApiErrorCode.FORBIDDEN, 'Можна редагувати лише власні', 403)
        }
        if (
          row.authorId === user.sub &&
          !isAgencyOwner &&
          Date.now() - row.createdAt.getTime() > EDIT_WINDOW_MS
        ) {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Вікно редагування (15 хв) минуло', 400)
        }
        await tx.orderComment.update({
          where: { id: row.id },
          data: { content: input.content, editedAt: new Date() },
        })
        return tx.orderComment.findUniqueOrThrow({ where: { id: row.id }, select: COMMENT_SELECT })
      })

      publishChangeEvent({ orderId: access.orderId, commentId: updated.id, kind: 'updated' })
      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'order.comment_edited',
        resourceType: 'order',
        resourceId: access.orderId,
        result: 'allowed',
        metadata: { commentId: updated.id },
      })
      return reply.send({
        success: true,
        data: { comment: serializeComment(updated, access.agencyId, access.isInternal, user.sub) },
      })
    }
  )

  // ── Soft delete (author or agency owner) ──────────────────────────────────
  fastify.delete<{ Params: { id: string; commentId: string } }>(
    '/orders/:id/comments/:commentId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const user = request.user
      const isAgencyOwner = agencyRole(user, access.agencyId) === 'owner'

      await withTenant(async (tx) => {
        const row = await tx.orderComment.findFirst({
          where: {
            id: request.params.commentId,
            orderId: access.orderId,
            deletedAt: null,
            ...(access.isInternal ? {} : { isInternal: false }),
          },
          select: { id: true, authorId: true },
        })
        if (!row) throw new AppError(ApiErrorCode.NOT_FOUND, 'Повідомлення не знайдено', 404)
        if (row.authorId !== user.sub && !isAgencyOwner) {
          throw new AppError(ApiErrorCode.FORBIDDEN, 'Можна видаляти лише власні', 403)
        }
        await tx.orderComment.update({ where: { id: row.id }, data: { deletedAt: new Date() } })
      })

      publishChangeEvent({
        orderId: access.orderId,
        commentId: request.params.commentId,
        kind: 'deleted',
      })
      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'order.comment_deleted',
        resourceType: 'order',
        resourceId: access.orderId,
        result: 'allowed',
        metadata: { commentId: request.params.commentId },
      })
      return reply.send({ success: true, data: { deleted: true } })
    }
  )

  // ── Reactions: POST adds, DELETE removes (канон 03-C) ─────────────────────
  fastify.post<{ Params: { id: string; commentId: string } }>(
    '/orders/:id/comments/:commentId/reactions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const { emoji } = reactionSchema.parse(request.body)
      const user = request.user

      await withTenant(async (tx) => {
        const row = await tx.orderComment.findFirst({
          where: {
            id: request.params.commentId,
            orderId: access.orderId,
            deletedAt: null,
            ...(access.isInternal ? {} : { isInternal: false }),
          },
          select: { id: true },
        })
        if (!row) throw new AppError(ApiErrorCode.NOT_FOUND, 'Повідомлення не знайдено', 404)
        await tx.commentReaction.upsert({
          where: {
            commentId_profileId_emoji: { commentId: row.id, profileId: user.sub, emoji },
          },
          create: { commentId: row.id, profileId: user.sub, emoji },
          update: {}, // idempotent re-add
        })
      })

      publishChangeEvent({
        orderId: access.orderId,
        commentId: request.params.commentId,
        kind: 'updated',
      })
      return reply.send({ success: true, data: { reacted: true } })
    }
  )

  fastify.delete<{ Params: { id: string; commentId: string } }>(
    '/orders/:id/comments/:commentId/reactions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const { emoji } = reactionSchema.parse(request.body)
      const user = request.user

      const removed = await withTenant((tx) =>
        tx.commentReaction.deleteMany({
          // Скоуп по orderId (як усі мутації тут): не даємо чіпати реакцію поза
          // цим замовленням навіть на свій profileId — backstop до RLS реакцій.
          where: {
            emoji,
            profileId: user.sub,
            comment: { id: request.params.commentId, orderId: access.orderId },
          },
        })
      )
      if (removed.count > 0) {
        publishChangeEvent({
          orderId: access.orderId,
          commentId: request.params.commentId,
          kind: 'updated',
        })
      }
      return reply.send({ success: true, data: { removed: removed.count > 0 } })
    }
  )

  // ── Pin / unpin (03-Г): owner/команда пінить; клієнт бачить публічні ──────
  fastify.post<{ Params: { id: string; commentId: string } }>(
    '/orders/:id/comments/:commentId/pin',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      if (!access.isInternal) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Закріплює лише команда', 403)
      }
      await withTenant(async (tx) => {
        const row = await tx.orderComment.findFirst({
          where: { id: request.params.commentId, orderId: access.orderId, deletedAt: null },
          select: { id: true },
        })
        if (!row) throw new AppError(ApiErrorCode.NOT_FOUND, 'Повідомлення не знайдено', 404)
        await tx.orderComment.update({
          where: { id: row.id },
          data: { pinnedAt: new Date(), pinnedById: request.user.sub },
        })
      })
      publishChangeEvent({
        orderId: access.orderId,
        commentId: request.params.commentId,
        kind: 'updated',
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'order.comment_pinned',
        resourceType: 'order',
        resourceId: access.orderId,
        result: 'allowed',
        metadata: { commentId: request.params.commentId },
      })
      return reply.send({ success: true, data: { pinned: true } })
    }
  )

  fastify.delete<{ Params: { id: string; commentId: string } }>(
    '/orders/:id/comments/:commentId/pin',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      if (!access.isInternal) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Відкріплює лише команда', 403)
      }
      const updated = await withTenant((tx) =>
        tx.orderComment.updateMany({
          where: { id: request.params.commentId, orderId: access.orderId, pinnedAt: { not: null } },
          data: { pinnedAt: null, pinnedById: null },
        })
      )
      if (updated.count > 0) {
        publishChangeEvent({
          orderId: access.orderId,
          commentId: request.params.commentId,
          kind: 'updated',
        })
      }
      return reply.send({ success: true, data: { unpinned: updated.count > 0 } })
    }
  )

  // ── Search (03-В): локальний пошук по коментарях ЦЬОГО замовлення ─────────
  fastify.get<{ Params: { id: string } }>(
    '/orders/:id/comments/search',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const q = searchQuerySchema.parse(request.query)

      const rows = await withTenant((tx) =>
        tx.orderComment.findMany({
          where: {
            orderId: access.orderId,
            deletedAt: null,
            ...(access.isInternal ? {} : { isInternal: false }), // leak guard
            content: { contains: q.q, mode: 'insensitive' },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: COMMENT_SELECT,
        })
      )
      return reply.send({
        success: true,
        data: {
          results: rows.map((c) =>
            serializeComment(c, access.agencyId, access.isInternal, request.user.sub)
          ),
        },
      })
    }
  )

  // ── Typing indicator (03-Б): ephemeral, no DB write ───────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/orders/:id/comments/typing',
    {
      preHandler: [fastify.authenticate],
      // Composer throttles to ~1 ping/2.5s; the limit only guards against abuse.
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const body = (request.body ?? {}) as { internal?: unknown }
      // Клієнт не може «друкувати internal» — прапорець лише для команди.
      const internal = access.isInternal && body.internal === true

      const me = await withTenant((tx) =>
        tx.profile.findUnique({ where: { id: request.user.sub }, select: { name: true } })
      )
      publishTypingEvent({
        orderId: access.orderId,
        profileId: request.user.sub,
        name: me?.name ?? '',
        internal,
      })
      return reply.send({ success: true, data: { ok: true } })
    }
  )

  return Promise.resolve()
}

export default commentActionsRoute
