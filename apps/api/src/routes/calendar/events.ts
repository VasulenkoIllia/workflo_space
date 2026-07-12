import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import type { AccessClaims } from '../../auth/tokens.js'
import { z } from 'zod'
import { assertSameTenant, requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { dispatchNotification } from '../../services/notifications.js'

/**
 * 24 Calendar MVP — зустрічі команда↔команда і команда↔клієнт. Створює команда
 * (owner/executor); запрошені (Profile) отримують in-app-нотифікацію і accept/decline.
 * Зовнішні email-гості й recurrence — Фаза 2. timezone IANA per-event (рендер у глядача).
 */
const createSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    type: z.enum(['internal_meeting', 'client_meeting']),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    timezone: z.string().trim().max(64).optional(),
    location: z.string().trim().max(300).optional(),
    meetingUrl: z.string().trim().url().max(500).optional(),
    companyId: z.string().uuid().nullable().optional(),
    attendeeIds: z.array(z.string().uuid()).max(50).default([]),
  })
  .strict()
  .refine((b) => new Date(b.endsAt).getTime() > new Date(b.startsAt).getTime(), {
    message: 'Кінець має бути пізніше початку',
  })
  .refine((b) => b.type !== 'client_meeting' || b.companyId != null, {
    message: 'Зустріч із клієнтом потребує компанії',
  })

const patchSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    timezone: z.string().trim().max(64).optional(),
    location: z.string().trim().max(300).nullable().optional(),
    meetingUrl: z.string().trim().url().max(500).nullable().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'Порожній запит' })

const respondSchema = z.object({ response: z.enum(['accepted', 'declined']) }).strict()

const EVENT_SELECT = {
  id: true,
  title: true,
  description: true,
  type: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  location: true,
  meetingUrl: true,
  companyId: true,
  createdById: true,
  cancelledAt: true,
  company: { select: { id: true, name: true } },
  attendees: {
    select: {
      profileId: true,
      response: true,
      respondedAt: true,
      profile: { select: { id: true, name: true } },
    },
  },
} as const

const calendarEventsRoute: FastifyPluginAsync = (fastify) => {
  // ─── Створити зустріч + запросити ────────────────────────────────────────────
  fastify.post(
    '/calendar/events',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Зустріч планує команда', 403)
      }
      const body = createSchema.parse(request.body)

      // Валідація запрошених: член агенції АБО член компанії події (для client_meeting).
      const uniqueIds = [...new Set(body.attendeeIds)].filter((id) => id !== user.sub)
      if (uniqueIds.length > 0) {
        const [agencyMembers, companyMembers] = await withTenant((tx) =>
          Promise.all([
            tx.agencyMember.findMany({
              where: { agencyId, profileId: { in: uniqueIds } },
              select: { profileId: true },
            }),
            body.companyId
              ? tx.companyMember.findMany({
                  where: { companyId: body.companyId, profileId: { in: uniqueIds } },
                  select: { profileId: true },
                })
              : Promise.resolve([]),
          ])
        )
        const valid = new Set([
          ...agencyMembers.map((m) => m.profileId),
          ...companyMembers.map((m) => m.profileId),
        ])
        if (uniqueIds.some((id) => !valid.has(id))) {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Невідомий учасник у списку', 400)
        }
      }

      const event = await tenantTransaction(prisma, async (tx) => {
        const e = await tx.calendarEvent.create({
          data: {
            agencyId,
            title: body.title,
            description: body.description ?? null,
            type: body.type,
            startsAt: new Date(body.startsAt),
            endsAt: new Date(body.endsAt),
            timezone: body.timezone ?? 'Europe/Kyiv',
            location: body.location ?? null,
            meetingUrl: body.meetingUrl ?? null,
            companyId: body.type === 'client_meeting' ? (body.companyId ?? null) : null,
            createdById: user.sub,
          },
          select: { id: true },
        })
        if (uniqueIds.length > 0) {
          await tx.calendarAttendee.createMany({
            data: uniqueIds.map((profileId) => ({ agencyId, eventId: e.id, profileId })),
          })
        }
        return e
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'calendar.event_created',
        resourceType: 'calendar_event',
        resourceId: event.id,
        result: 'allowed',
        metadata: { type: body.type, attendees: uniqueIds.length },
      })

      for (const profileId of uniqueIds) {
        dispatchNotification(request.log, {
          profileId,
          event: 'calendar.invited',
          vars: { title: body.title, startsAt: body.startsAt, eventId: event.id },
          inApp: { title: 'Запрошення на зустріч', body: body.title },
        })
      }
      return reply.status(201).send({ success: true, data: { id: event.id } })
    }
  )

  // ─── Список подій (свої + де запрошений) ─────────────────────────────────────
  fastify.get(
    '/calendar/events',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const q = request.query as { from?: string; to?: string; type?: string }
      const range: Record<string, Date> = {}
      if (q.from) range.gte = new Date(q.from)
      if (q.to) range.lte = new Date(q.to)
      const events = await withTenant((tx) =>
        tx.calendarEvent.findMany({
          where: {
            cancelledAt: null,
            ...(Object.keys(range).length ? { startsAt: range } : {}),
            ...(q.type === 'internal_meeting' || q.type === 'client_meeting'
              ? { type: q.type }
              : {}),
            // свої: creator АБО attendee
            OR: [{ createdById: user.sub }, { attendees: { some: { profileId: user.sub } } }],
          },
          orderBy: { startsAt: 'asc' },
          take: 500,
          select: EVENT_SELECT,
        })
      )
      // S13-05 (хвіст): погоджені відсутності команди у вікні — read-side merge
      // (без dual-write у CalendarEvent: reject/cancel не потребують синку).
      // Видимі команді агенції (хто відсутній — нормальна командна інформація);
      // портальний клієнт (без agencyMemberships) їх не бачить.
      const isTeam = user.agencyMemberships.some((m) => m.agencyId === agencyId)
      const leaves =
        isTeam && q.from && q.to
          ? await withTenant((tx) =>
              tx.leaveRequest.findMany({
                where: {
                  agencyId,
                  status: 'approved',
                  startDate: { lte: new Date(q.to ?? '') },
                  endDate: { gte: new Date(q.from ?? '') },
                },
                orderBy: { startDate: 'asc' },
                take: 200,
                select: {
                  id: true,
                  type: true,
                  startDate: true,
                  endDate: true,
                  days: true,
                  profile: { select: { id: true, name: true } },
                },
              })
            )
          : []
      return reply.send({ success: true, data: { events, leaves } })
    }
  )

  // ─── Редагувати (creator/owner) ──────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/calendar/events/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const body = patchSchema.parse(request.body)
      const ev = await loadOwned(request.params.id, user, agencyId)

      if (body.startsAt && body.endsAt && new Date(body.endsAt) <= new Date(body.startsAt)) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Кінець має бути пізніше початку', 400)
      }
      const updated = await withTenant((tx) =>
        tx.calendarEvent.update({
          where: { id: ev.id },
          data: {
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.description !== undefined ? { description: body.description } : {}),
            ...(body.startsAt !== undefined ? { startsAt: new Date(body.startsAt) } : {}),
            ...(body.endsAt !== undefined ? { endsAt: new Date(body.endsAt) } : {}),
            ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
            ...(body.location !== undefined ? { location: body.location } : {}),
            ...(body.meetingUrl !== undefined ? { meetingUrl: body.meetingUrl } : {}),
          },
          select: EVENT_SELECT,
        })
      )
      for (const profileId of ev.attendees.map((a) => a.profileId)) {
        dispatchNotification(request.log, {
          profileId,
          event: 'calendar.updated',
          vars: { title: updated.title, startsAt: updated.startsAt.toISOString(), eventId: ev.id },
          inApp: { title: 'Зустріч оновлено', body: updated.title },
        })
      }
      return reply.send({ success: true, data: { event: updated } })
    }
  )

  // ─── Скасувати (creator/owner) ───────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/calendar/events/:id/cancel',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const ev = await loadOwned(request.params.id, user, agencyId)
      if (ev.cancelledAt) {
        throw new AppError(ApiErrorCode.CONFLICT, 'Зустріч уже скасовано', 409)
      }
      await withTenant((tx) =>
        tx.calendarEvent.update({ where: { id: ev.id }, data: { cancelledAt: new Date() } })
      )
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'calendar.event_cancelled',
        resourceType: 'calendar_event',
        resourceId: ev.id,
        result: 'allowed',
        metadata: {},
      })
      for (const profileId of ev.attendees.map((a) => a.profileId)) {
        dispatchNotification(request.log, {
          profileId,
          event: 'calendar.cancelled',
          vars: { title: ev.title, startsAt: ev.startsAt.toISOString(), eventId: ev.id },
          inApp: { title: 'Зустріч скасовано', body: ev.title },
        })
      }
      return reply.send({ success: true, data: { cancelled: true } })
    }
  )

  // ─── Відповідь запрошеного (accept/decline) ─────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/calendar/events/:id/respond',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const body = respondSchema.parse(request.body)
      const updated = await withTenant((tx) =>
        tx.calendarAttendee.updateMany({
          where: { eventId: request.params.id, profileId: user.sub, agencyId },
          data: { response: body.response, respondedAt: new Date() },
        })
      )
      if (updated.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Вас не запрошено на цю зустріч', 404)
      }
      return reply.send({ success: true, data: { response: body.response } })
    }
  )

  return Promise.resolve()
}

/** Завантажити подію, доступну на редагування: creator АБО owner агенції. */
async function loadOwned(id: string, user: AccessClaims, agencyId: string) {
  const ev = await withTenant((tx) =>
    tx.calendarEvent.findFirst({
      where: { id, agencyId },
      select: {
        id: true,
        title: true,
        startsAt: true,
        createdById: true,
        cancelledAt: true,
        agencyId: true,
        attendees: { select: { profileId: true } },
      },
    })
  )
  if (!ev) throw new AppError(ApiErrorCode.NOT_FOUND, 'Зустріч не знайдено', 404)
  assertSameTenant(user, ev.agencyId)
  const isOwner = user.agencyMemberships.some((m) => m.agencyId === agencyId && m.role === 'owner')
  if (ev.createdById !== user.sub && !isOwner) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Змінити може автор або власник', 403)
  }
  return ev
}

export default calendarEventsRoute
