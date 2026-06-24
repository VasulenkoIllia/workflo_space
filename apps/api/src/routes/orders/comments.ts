import { type Prisma, withTenant } from '@workflo/db'
import { createCommentSchema, listCommentsQuerySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'
import { requireOrderParticipant } from './access.js'

const COMMENT_SELECT = {
  id: true,
  content: true,
  isInternal: true,
  createdAt: true,
  editedAt: true,
  // agencyMemberships are RLS-scoped to the order's agency, so a non-empty list means the
  // author is internal team here — used to label команда vs клієнт. Stripped before sending.
  author: { select: { id: true, name: true, agencyMemberships: { select: { agencyId: true } } } },
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
}

/** Strip the raw memberships and expose only `author.kind` (team if the author is an agency
 * member of this order's agency, else client). Never leak which agencies a person belongs to. */
function serializeComment(c: RawComment, agencyId: string) {
  const author = c.author
  const kind = (author?.agencyMemberships ?? []).some((m) => m.agencyId === agencyId)
    ? 'team'
    : 'client'
  return {
    id: c.id,
    content: c.content,
    isInternal: c.isInternal,
    createdAt: c.createdAt,
    editedAt: c.editedAt,
    author: { id: author?.id ?? '', name: author?.name ?? '', kind },
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
          comments: page.map((c) => serializeComment(c, access.agencyId)),
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

      const comment = await withTenant((tx) =>
        tx.orderComment.create({
          data: {
            order: { connect: { id: access.orderId } },
            agency: { connect: { id: access.agencyId } },
            author: { connect: { id: user.sub } },
            content: input.content,
            isInternal,
          },
          select: COMMENT_SELECT,
        })
      )

      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'order.comment_created',
        resourceType: 'order',
        resourceId: access.orderId,
        result: 'allowed',
        metadata: { commentId: comment.id, isInternal },
      })

      return reply
        .status(201)
        .send({ success: true, data: { comment: serializeComment(comment, access.agencyId) } })
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
