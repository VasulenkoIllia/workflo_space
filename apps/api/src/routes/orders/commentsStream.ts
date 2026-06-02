import { prisma } from '@workflo/db'
import { ApiErrorCode } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { subscribeChat } from '../../services/chatBus.js'
import { requireOrderParticipant } from './access.js'

const HEARTBEAT_MS = 30_000

// R-4: cap concurrent SSE streams per user (connection / DB-handle exhaustion guard).
// Per-replica in-memory — fine for the single-replica deployment (see rate-limit note).
const MAX_STREAMS_PER_USER = 5
const openStreamsByUser = new Map<string, number>()

const STREAM_COMMENT_SELECT = {
  id: true,
  content: true,
  isInternal: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  author: { select: { id: true, name: true } },
} as const

/**
 * GET /orders/:id/comments/stream — Server-Sent Events for live chat.
 *
 * Access is checked BEFORE hijacking the socket (so 401/403/404 are normal JSON
 * responses). On a new-comment event we re-fetch the full row and re-apply the
 * internal-leak guard from DB truth, so a client connection can never receive a
 * team-only note even if the bus payload were wrong.
 */
const commentsStreamRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/orders/:id/comments/stream',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)

      // R-4: reject before hijacking (so this is a normal JSON 503, not a dead stream).
      const uid = request.user.sub
      const openCount = openStreamsByUser.get(uid) ?? 0
      if (openCount >= MAX_STREAMS_PER_USER) {
        return reply.status(503).send({
          success: false,
          error: {
            code: ApiErrorCode.RATE_LIMITED,
            message: 'Забагато одночасних підключень. Закрийте зайві вкладки.',
            details: null,
          },
        })
      }
      openStreamsByUser.set(uid, openCount + 1)

      const res = reply.raw

      reply.hijack()
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // disable proxy buffering (nginx/traefik)
      })

      let closed = false
      const write = (chunk: string): void => {
        if (closed) return
        try {
          res.write(chunk)
        } catch {
          // client vanished mid-write — cleanup runs on the 'close' event
        }
      }

      write('retry: 3000\n\n')
      write(': connected\n\n')

      const unsubscribe = subscribeChat(access.orderId, (event) => {
        if (closed) return
        if (event.isInternal && !access.isInternal) return // leak guard (fast path)
        prisma.orderComment
          .findUnique({ where: { id: event.commentId }, select: STREAM_COMMENT_SELECT })
          .then((comment) => {
            if (!comment || comment.deletedAt) return
            if (comment.isInternal && !access.isInternal) return // leak guard (authoritative)
            const payload = {
              id: comment.id,
              content: comment.content,
              isInternal: comment.isInternal,
              createdAt: comment.createdAt,
              editedAt: comment.editedAt,
              author: comment.author,
            }
            write(`id: ${event.commentId}\nevent: comment\ndata: ${JSON.stringify(payload)}\n\n`)
          })
          .catch((err: unknown) => request.log.warn({ err }, 'sse: comment fetch failed'))
      })

      const heartbeat = setInterval(() => write('event: heartbeat\ndata: {}\n\n'), HEARTBEAT_MS)
      heartbeat.unref()

      const cleanup = (): void => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        const remaining = (openStreamsByUser.get(uid) ?? 1) - 1
        if (remaining <= 0) openStreamsByUser.delete(uid)
        else openStreamsByUser.set(uid, remaining)
        res.end()
      }
      request.raw.on('close', cleanup)
      request.raw.on('error', cleanup)
    }
  )

  return Promise.resolve()
}

export default commentsStreamRoute
