import { runWithAgency, withTenant } from '@workflo/db'
import { ApiErrorCode } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import {
  subscribeChanges,
  subscribeChat,
  subscribeReads,
  subscribeTyping,
} from '../../services/chatBus.js'
import { requireOrderParticipant } from './access.js'
import { COMMENT_SELECT, serializeComment } from './comments.js'

const HEARTBEAT_MS = 30_000

// R-4: cap concurrent SSE streams per user (connection / DB-handle exhaustion guard).
// Per-replica in-memory — fine for the single-replica deployment (see rate-limit note).
const MAX_STREAMS_PER_USER = 5
const openStreamsByUser = new Map<string, number>()

// AR-30 (audit 2026-06-11): registry of live SSE closers. Hijacked sockets keep
// `server.close()` pending forever, so SIGTERM hung until the orchestrator SIGKILLed
// the process (skipping prisma.$disconnect/Sentry flush). Shutdown drains this first.
const liveStreamClosers = new Set<() => void>()

/** End every live chat stream (sends a final `shutdown` event). Returns how many were open. */
export function closeAllChatStreams(): number {
  const count = liveStreamClosers.size
  for (const close of [...liveStreamClosers]) close()
  return count
}

// Live payload reuses the list/create select+serializer (comments.ts) — reply/вкладення включно.

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
      let slotReleased = false
      const releaseSlot = (): void => {
        if (slotReleased) return
        slotReleased = true
        const remaining = (openStreamsByUser.get(uid) ?? 1) - 1
        if (remaining <= 0) openStreamsByUser.delete(uid)
        else openStreamsByUser.set(uid, remaining)
      }

      const res = reply.raw

      // If hijack/writeHead throws, release the slot so it can't leak (else the
      // user is permanently 503'd on this replica after 5 such failures).
      try {
        reply.hijack()
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no', // disable proxy buffering (nginx/traefik)
        })
      } catch (err) {
        releaseSlot()
        throw err
      }

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
        // Bus callbacks run outside the request's async context, so bind the
        // order's (already access-checked) agency explicitly so this RLS-scoped
        // read sets the tenant GUC (F4) instead of relying on ALS propagation.
        runWithAgency(access.agencyId, () =>
          withTenant((tx) =>
            tx.orderComment.findUnique({
              where: { id: event.commentId },
              select: { ...COMMENT_SELECT, deletedAt: true },
            })
          )
        )
          .then((comment) => {
            if (!comment || comment.deletedAt) return
            if (comment.isInternal && !access.isInternal) return // leak guard (authoritative)
            const payload = serializeComment(
              comment,
              access.agencyId,
              access.isInternal,
              request.user.sub
            )
            write(`id: ${event.commentId}\nevent: comment\ndata: ${JSON.stringify(payload)}\n\n`)
          })
          .catch((err: unknown) => request.log.warn({ err }, 'sse: comment fetch failed'))
      })

      // Read receipts (S10): tiny trusted payload straight off the in-process bus —
      // no DB re-fetch needed (it carries no message content to leak-guard).
      const unsubscribeReads = subscribeReads(access.orderId, (event) => {
        if (closed) return
        if (event.profileId === request.user.sub) return // own marker is uninteresting
        write(`event: read\ndata: ${JSON.stringify(event)}\n\n`)
      })

      // Edit/delete/reactions (S10 канон 03-B/C): `updated` re-fetches from DB truth
      // (same authoritative leak-guard as inserts); `deleted` carries only the id.
      const unsubscribeChanges = subscribeChanges(access.orderId, (event) => {
        if (closed) return
        if (event.kind === 'deleted') {
          write(`event: comment_deleted\ndata: ${JSON.stringify({ id: event.commentId })}\n\n`)
          return
        }
        runWithAgency(access.agencyId, () =>
          withTenant((tx) =>
            tx.orderComment.findUnique({
              where: { id: event.commentId },
              select: { ...COMMENT_SELECT, deletedAt: true },
            })
          )
        )
          .then((comment) => {
            if (!comment || comment.deletedAt) return
            if (comment.isInternal && !access.isInternal) return // leak guard
            const payload = serializeComment(
              comment,
              access.agencyId,
              access.isInternal,
              request.user.sub
            )
            write(`event: comment_updated\ndata: ${JSON.stringify(payload)}\n\n`)
          })
          .catch((err: unknown) => request.log.warn({ err }, 'sse: updated fetch failed'))
      })

      // Typing (03-Б): ephemeral; clients never learn the team is drafting a note.
      const unsubscribeTyping = subscribeTyping(access.orderId, (event) => {
        if (closed) return
        if (event.profileId === request.user.sub) return
        if (event.internal && !access.isInternal) return // leak guard
        const pub = { profileId: event.profileId, name: event.name }
        write(`event: typing\ndata: ${JSON.stringify(pub)}\n\n`)
      })

      const heartbeat = setInterval(() => write('event: heartbeat\ndata: {}\n\n'), HEARTBEAT_MS)
      heartbeat.unref()

      const cleanup = (): void => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        unsubscribeReads()
        unsubscribeChanges()
        unsubscribeTyping()
        releaseSlot()
        liveStreamClosers.delete(shutdownClose)
        res.end()
      }
      // AR-30: registered closer notifies the client (EventSource auto-reconnects
      // after the deploy) and ends the socket so app.close() can resolve.
      const shutdownClose = (): void => {
        write('event: shutdown\ndata: {}\n\n')
        cleanup()
      }
      liveStreamClosers.add(shutdownClose)
      request.raw.on('close', cleanup)
      request.raw.on('error', cleanup)
    }
  )

  return Promise.resolve()
}

export default commentsStreamRoute
