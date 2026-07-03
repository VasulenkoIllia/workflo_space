import { type Prisma, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  createCommentSchema,
  listCommentsQuerySchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'
import { enqueueOutbox } from '../../services/outbox.js'
import { requireOrderParticipant } from './access.js'

export const COMMENT_SELECT = {
  id: true,
  content: true,
  isInternal: true,
  createdAt: true,
  editedAt: true,
  // agencyMemberships are RLS-scoped to the order's agency, so a non-empty list means the
  // author is internal team here — used to label команда vs клієнт. Stripped before sending.
  author: { select: { id: true, name: true, agencyMemberships: { select: { agencyId: true } } } },
  // 03-чат (03.07): reply-прев'ю (SetNull-оригінал → «повідомлення видалено» на фронті)
  // + вкладення-чіпси. isInternal у replyTo потрібен leak-гарду серіалізатора.
  replyTo: {
    select: {
      id: true,
      content: true,
      isInternal: true,
      deletedAt: true,
      author: { select: { name: true } },
    },
  },
  attachments: {
    where: { deletedAt: null },
    select: { id: true, filename: true, mimeType: true, sizeBytes: true },
  },
} as const

type RawComment = {
  id: string
  content: string
  isInternal: boolean
  createdAt: Date
  editedAt: Date | null
  // The list/create selects always include author + agencyMemberships; typed loosely so the
  // serializer also tolerates partial rows (e.g. unit-test mocks) without throwing.
  author?: { id: string; name: string; agencyMemberships?: { agencyId: string }[] } | null
  replyTo?: {
    id: string
    content: string
    isInternal: boolean
    deletedAt: Date | null
    author?: { name: string } | null
  } | null
  attachments?: { id: string; filename: string; mimeType: string; sizeBytes: number }[]
}

/** Strip the raw memberships and expose only `author.kind` (team if the author is an agency
 * member of this order's agency, else client). Never leak which agencies a person belongs to. */
export function serializeComment(c: RawComment, agencyId: string, viewerIsInternal = true) {
  const author = c.author
  const kind = (author?.agencyMemberships ?? []).some((m) => m.agencyId === agencyId)
    ? 'team'
    : 'client'
  // Reply-прев'ю: видалений оригінал або team-only нотатка для клієнта → плейсхолдер
  // (leak-гард: створення reply на internal клієнтом заблоковано, але серіалізація
  // теж не має віддавати текст).
  const replyTo = c.replyTo
    ? c.replyTo.deletedAt || (c.replyTo.isInternal && !viewerIsInternal)
      ? { id: c.replyTo.id, authorName: null, preview: null }
      : {
          id: c.replyTo.id,
          authorName: c.replyTo.author?.name ?? '',
          preview: c.replyTo.content.slice(0, 140),
        }
    : null
  return {
    id: c.id,
    content: c.content,
    isInternal: c.isInternal,
    createdAt: c.createdAt,
    editedAt: c.editedAt,
    author: { id: author?.id ?? '', name: author?.name ?? '', kind },
    replyTo,
    attachments: c.attachments ?? [],
  }
}

const commentsRoute: FastifyPluginAsync = (fastify) => {
  // ── List (newest page, ascending for display) + unread meta ──────────────
  fastify.get<{ Params: { id: string } }>(
    '/orders/:id/comments',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const q = listCommentsQuerySchema.parse(request.query)
      const user = request.user

      const where: Prisma.OrderCommentWhereInput = { orderId: access.orderId, deletedAt: null }
      if (!access.isInternal) where.isInternal = false // leak guard: clients never see team notes
      if (q.before) where.createdAt = { lt: new Date(q.before) }

      // One tenant tx (F4 RLS scope): read the unread-marker first to build the
      // unread filter, then the page + unread count — a consistent snapshot, and
      // sequential awaits (Prisma interactive tx forbids concurrent queries).
      const { read, rows, unreadCount } = await withTenant(async (tx) => {
        const read = await tx.orderChatRead.findUnique({
          where: { orderId_profileId: { orderId: access.orderId, profileId: user.sub } },
          select: { lastReadAt: true },
        })
        const unreadWhere: Prisma.OrderCommentWhereInput = {
          orderId: access.orderId,
          deletedAt: null,
          authorId: { not: user.sub }, // your own messages are never "unread"
          ...(access.isInternal ? {} : { isInternal: false }),
          ...(read ? { createdAt: { gt: read.lastReadAt } } : {}),
        }
        // take limit+1 to detect older history without a separate count query.
        const rows = await tx.orderComment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: q.limit + 1,
          select: COMMENT_SELECT,
        })
        const unreadCount = await tx.orderComment.count({ where: unreadWhere })
        return { read, rows, unreadCount }
      })
      const hasMore = rows.length > q.limit
      const page = (hasMore ? rows.slice(0, q.limit) : rows).reverse() // ascending

      return reply.send({
        success: true,
        data: {
          comments: page.map((c) => serializeComment(c, access.agencyId, access.isInternal)),
          meta: { hasMore, unreadCount, lastReadAt: read?.lastReadAt ?? null },
        },
      })
    }
  )

  // ── Create ───────────────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/orders/:id/comments',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const input = createCommentSchema.parse(request.body)
      const user = request.user
      // Clients can never author internal notes regardless of the flag they send.
      const isInternal = access.isInternal && input.isInternal

      const comment = await withTenant(async (tx) => {
        // Reply-гард: оригінал мусить бути живим повідомленням ЦЬОГО замовлення, і клієнт
        // не може відповідати на team-only нотатку (existence-приховування → 404-стиль 400).
        if (input.replyToId) {
          const parent = await tx.orderComment.findFirst({
            where: {
              id: input.replyToId,
              orderId: access.orderId,
              deletedAt: null,
              ...(access.isInternal ? {} : { isInternal: false }),
            },
            select: { id: true },
          })
          if (!parent) {
            throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Повідомлення не знайдено', 400)
          }
        }
        const c = await tx.orderComment.create({
          data: {
            order: { connect: { id: access.orderId } },
            agency: { connect: { id: access.agencyId } },
            author: { connect: { id: user.sub } },
            content: input.content,
            isInternal,
            ...(input.replyToId ? { replyTo: { connect: { id: input.replyToId } } } : {}),
          },
          select: { id: true },
        })
        // Вкладення: лінкуємо ВЖЕ завантажені файли цього замовлення. Гарди в updateMany:
        // своє замовлення + ще не прив'язаний (не можна «вкрасти» чужий чат-файл) + живий.
        if (input.fileIds?.length) {
          const linked = await tx.orderFile.updateMany({
            where: {
              id: { in: input.fileIds },
              orderId: access.orderId,
              agencyId: access.agencyId,
              commentId: null,
              deletedAt: null,
            },
            data: { commentId: c.id },
          })
          if (linked.count !== input.fileIds.length) {
            throw new AppError(
              ApiErrorCode.VALIDATION_ERROR,
              'Деякі вкладення недоступні — оновіть сторінку',
              400
            )
          }
        }
        const full = await tx.orderComment.findUniqueOrThrow({
          where: { id: c.id },
          select: COMMENT_SELECT,
        })
        // Notify thread participants (chat.new_comment) — handled by the outbox worker.
        await enqueueOutbox(tx, {
          type: 'order.comment_created',
          payload: {
            orderId: access.orderId,
            authorId: user.sub,
            isInternal,
            preview: input.content.slice(0, 200),
          },
          agencyId: access.agencyId,
        })
        return full
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'order.comment_created',
        resourceType: 'order',
        resourceId: access.orderId,
        result: 'allowed',
        metadata: { commentId: comment.id, isInternal },
      })

      return reply.status(201).send({
        success: true,
        data: { comment: serializeComment(comment, access.agencyId, access.isInternal) },
      })
    }
  )

  // ── Mark read (unread tracking) ──────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/orders/:id/comments/read',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const user = request.user
      const lastReadAt = new Date()

      await withTenant((tx) =>
        tx.orderChatRead.upsert({
          where: { orderId_profileId: { orderId: access.orderId, profileId: user.sub } },
          create: { orderId: access.orderId, profileId: user.sub, lastReadAt },
          update: { lastReadAt },
        })
      )

      return reply.send({ success: true, data: { lastReadAt } })
    }
  )

  return Promise.resolve()
}

export default commentsRoute
