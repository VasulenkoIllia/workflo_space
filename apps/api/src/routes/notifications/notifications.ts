import { prisma } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().datetime().optional(),
})

const NOTIF_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  isRead: true,
  metadata: true,
  snoozedUntil: true,
  createdAt: true,
} as const

// 18-Б: snooze на 1 год … 30 днів.
const snoozeSchema = z.object({ hours: z.coerce.number().int().min(1).max(720) })

/**
 * Personal in-app notification feed (07). Rows are profile-scoped — a user only ever sees and
 * flips their OWN notifications, so a plain `profileId` filter is the tenant/IDOR guard (the
 * table has no agencyId). The write-path lives in notify() (@workflo/notifications, in_app
 * channel); this route is the read + mark-read side the bell dropdown / inbox consume.
 */
const notificationsRoute: FastifyPluginAsync = (fastify) => {
  // ── List (newest first) + unread count ──────────────────────────────────────
  fastify.get('/notifications', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const q = listQuerySchema.parse(request.query)
    const profileId = request.user.sub
    // 18-Б: прострочені snooze «прокидаються» ліниво при кожному читанні — без крона.
    await prisma.notification.updateMany({
      where: { profileId, snoozedUntil: { lte: new Date() } },
      data: { isRead: false, snoozedUntil: null },
    })
    const where = {
      profileId,
      ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}),
    }
    // take limit+1 to detect older history without a separate count query.
    const rows = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit + 1,
      select: NOTIF_SELECT,
    })
    const unreadCount = await prisma.notification.count({ where: { profileId, isRead: false } })
    const hasMore = rows.length > q.limit
    return reply.send({
      success: true,
      data: {
        notifications: hasMore ? rows.slice(0, q.limit) : rows,
        meta: { hasMore, unreadCount },
      },
    })
  })

  // ── Mark one read (profileId guard → only your own row flips) ────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await prisma.notification.updateMany({
        where: { id: request.params.id, profileId: request.user.sub },
        data: { isRead: true },
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  // ── Mark one UNREAD (повернути в непрочитані; знімає і snooze) ───────────────
  fastify.patch<{ Params: { id: string } }>(
    '/notifications/:id/unread',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await prisma.notification.updateMany({
        where: { id: request.params.id, profileId: request.user.sub },
        data: { isRead: false, snoozedUntil: null },
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  // ── Snooze (18-Б): сховати з непрочитаних, повернути непрочитаною о T ────────
  fastify.post<{ Params: { id: string } }>(
    '/notifications/:id/snooze',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { hours } = snoozeSchema.parse(request.body)
      const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000)
      const res = await prisma.notification.updateMany({
        where: { id: request.params.id, profileId: request.user.sub },
        data: { isRead: true, snoozedUntil },
      })
      if (res.count === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Сповіщення не знайдено', details: null },
        })
      }
      return reply.send({ success: true, data: { snoozedUntil } })
    }
  )

  // ── Mark all read ────────────────────────────────────────────────────────────
  fastify.post(
    '/notifications/read-all',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const res = await prisma.notification.updateMany({
        where: { profileId: request.user.sub, isRead: false },
        data: { isRead: true },
      })
      return reply.send({ success: true, data: { updated: res.count } })
    }
  )

  return Promise.resolve()
}

export default notificationsRoute
