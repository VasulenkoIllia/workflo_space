import { withTenant } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'

/**
 * 24 Calendar — агрегований read-only view: зустрічі (де я учасник) + дедлайни
 * замовлень як read-only проєкція (окремих рядків у calendar_events НЕ створюємо —
 * без дублю стану). Відпустки — коли зʼявиться модуль 23. Команда бачить усі дедлайни
 * агенції; клієнт — лише дедлайни своїх компаній.
 */
interface CalendarViewItem {
  kind: 'meeting' | 'deadline'
  id: string
  title: string
  at: string
  type?: string
  companyName?: string | null
  orderId?: string
}

const calendarViewRoute: FastifyPluginAsync = (fastify) => {
  fastify.get('/calendar/view', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user
    requireActiveAgency(user)
    const q = request.query as { from?: string; to?: string }
    const from = q.from ? new Date(q.from) : new Date()
    const to = q.to ? new Date(q.to) : new Date(from.getTime() + 31 * 86_400_000)
    const isTeam = isInternalTeam(user)
    const companyIds = user.memberships.map((m) => m.companyId)

    const [events, orders] = await withTenant((tx) =>
      Promise.all([
        tx.calendarEvent.findMany({
          where: {
            cancelledAt: null,
            startsAt: { gte: from, lte: to },
            OR: [{ createdById: user.sub }, { attendees: { some: { profileId: user.sub } } }],
          },
          orderBy: { startsAt: 'asc' },
          select: {
            id: true,
            title: true,
            type: true,
            startsAt: true,
            company: { select: { name: true } },
          },
        }),
        // Дедлайни: команда — усі; клієнт — лише своїх компаній
        tx.order.findMany({
          where: {
            deletedAt: null,
            deadline: { not: null, gte: from, lte: to },
            ...(isTeam ? {} : { companyId: { in: companyIds } }),
          },
          orderBy: { deadline: 'asc' },
          take: 300,
          select: {
            id: true,
            title: true,
            deadline: true,
            company: { select: { name: true } },
          },
        }),
      ])
    )

    const items: CalendarViewItem[] = [
      ...events.map(
        (e): CalendarViewItem => ({
          kind: 'meeting',
          id: e.id,
          title: e.title,
          at: e.startsAt.toISOString(),
          type: e.type,
          companyName: e.company?.name ?? null,
        })
      ),
      ...orders.map(
        (o): CalendarViewItem => ({
          kind: 'deadline',
          id: `deadline-${o.id}`,
          title: o.title,
          at: (o.deadline as Date).toISOString(),
          companyName: o.company?.name ?? null,
          orderId: o.id,
        })
      ),
    ].sort((a, b) => a.at.localeCompare(b.at))

    return reply.send({ success: true, data: { items } })
  })

  return Promise.resolve()
}

export default calendarViewRoute
