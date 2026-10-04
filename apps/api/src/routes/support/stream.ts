import { runWithAgency, withTenant } from '@workflo/db'
import { ApiErrorCode } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { subscribeTicket } from '../../services/ticketBus.js'
import {
  requireTicketParticipant,
  serializeTicketMessage,
  TICKET_MESSAGE_SELECT,
} from './access.js'

const HEARTBEAT_MS = 30_000
const MAX_STREAMS_PER_USER = 5
const openStreamsByUser = new Map<string, number>()
const liveStreamClosers = new Set<() => void>()

/** Завершити всі live-стріми тікетів (graceful shutdown). Реюз патерну closeAllChatStreams. */
export function closeAllTicketStreams(): number {
  const count = liveStreamClosers.size
  for (const close of [...liveStreamClosers]) close()
  return count
}

/**
 * GET /support/tickets/:id/messages/stream — SSE live-тред тікета. Доступ перевіряється
 * ДО hijack (401/403/404 — звичайний JSON). На кожну подію рядок re-fetch'иться з БД і
 * повторно проходить leak-guard (internal-нотатка ніколи не піде клієнту).
 */
const ticketStreamRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/support/tickets/:id/messages/stream',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireTicketParticipant(request, request.params.id)

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
      try {
        reply.hijack()
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
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
          // client vanished — cleanup runs on 'close'
        }
      }
      write('retry: 3000\n\n')
      write(': connected\n\n')

      const unsubscribe = subscribeTicket(access.ticketId, (event) => {
        if (closed) return
        if (event.isInternal && !access.isInternal) return // leak guard (fast path)
        // Bus callback поза request-ALS → явно біндимо агенцію тікета для RLS-GUC (F4).
        runWithAgency(access.agencyId, () =>
          withTenant((tx) =>
            tx.ticketMessage.findUnique({
              where: { id: event.messageId },
              select: { ...TICKET_MESSAGE_SELECT, deletedAt: true },
            })
          )
        )
          .then((m) => {
            if (!m || m.deletedAt) return
            if (m.isInternal && !access.isInternal) return // leak guard (authoritative)
            const payload = serializeTicketMessage(m, access.agencyId)
            write(`id: ${event.messageId}\nevent: message\ndata: ${JSON.stringify(payload)}\n\n`)
          })
          .catch((err: unknown) => request.log.warn({ err }, 'sse: ticket message fetch failed'))
      })

      const heartbeat = setInterval(() => write('event: heartbeat\ndata: {}\n\n'), HEARTBEAT_MS)
      heartbeat.unref()

      const cleanup = (): void => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        releaseSlot()
        liveStreamClosers.delete(shutdownClose)
        res.end()
      }
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

export default ticketStreamRoute
