import { type Prisma, prisma } from '@workflo/db'
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
  author: { select: { id: true, name: true } },
} as const

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

      // take limit+1 to detect older history without a second count
      const rows = await prisma.orderComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.limit + 1,
        select: COMMENT_SELECT,
      })
      const hasMore = rows.length > q.limit
      const page = (hasMore ? rows.slice(0, q.limit) : rows).reverse() // ascending

      const read = await prisma.orderChatRead.findUnique({
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
      const unreadCount = await prisma.orderComment.count({ where: unreadWhere })

      return reply.send({
        success: true,
        data: {
          comments: page,
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

      const comment = await prisma.orderComment.create({
        data: {
          order: { connect: { id: access.orderId } },
          agency: { connect: { id: access.agencyId } },
          author: { connect: { id: user.sub } },
          content: input.content,
          isInternal,
        },
        select: COMMENT_SELECT,
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'order.comment_created',
        resourceType: 'order',
        resourceId: access.orderId,
        result: 'allowed',
        metadata: { commentId: comment.id, isInternal },
      })

      return reply.status(201).send({ success: true, data: { comment } })
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

      await prisma.orderChatRead.upsert({
        where: { orderId_profileId: { orderId: access.orderId, profileId: user.sub } },
        create: { orderId: access.orderId, profileId: user.sub, lastReadAt },
        update: { lastReadAt },
      })

      return reply.send({ success: true, data: { lastReadAt } })
    }
  )

  return Promise.resolve()
}

export default commentsRoute
