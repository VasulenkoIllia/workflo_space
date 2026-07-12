import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, TICKET_CATEGORIES } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { agencyStaffIds, clientMemberIds, fanOut } from '../../services/recipients.js'
import { publishTicketEvent } from '../../services/ticketBus.js'
import {
  requireTicketParticipant,
  serializeTicketMessage,
  TICKET_MESSAGE_SELECT,
} from './access.js'

/**
 * 29 Support MVP — тікети підтримки (звернення поза замовленням). Portal: клієнт
 * (будь-який учасник компанії) відкриває/відповідає/бачить свої. Workspace: команда
 * веде чергу, відповідає (public/internal), змінює статус/пріоритет/призначення.
 * Leak-guard: internal-нотатки клієнту невидимі (фільтр у read + serialize мітить kind).
 */
const createSchema = z
  .object({
    subject: z.string().trim().min(3).max(200),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    message: z.string().trim().min(1).max(10_000),
  })
  .strict()
const replySchema = z
  .object({ content: z.string().trim().min(1).max(10_000), isInternal: z.boolean().optional() })
  .strict()
const patchSchema = z
  .object({
    status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'Порожній запит' })

const TICKET_SELECT = {
  id: true,
  companyId: true,
  openedById: true,
  subject: true,
  category: true,
  priority: true,
  status: true,
  source: true, // portal | email — бейдж джерела у workspace-черзі (S12-05)
  assignedToId: true,
  firstResponseAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true } },
  _count: { select: { messages: true } },
} as const

const STATUS_LABEL: Record<string, string> = {
  open: 'відкрито',
  pending: 'очікує вас',
  resolved: 'вирішено',
  closed: 'закрито',
}

const supportRoute: FastifyPluginAsync = (fastify) => {
  // ─── PORTAL (клієнт) ────────────────────────────────────────────────────────
  fastify.post(
    '/support/tickets',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Тікети відкриває клієнт із порталу', 403)
      }
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      const body = createSchema.parse(request.body)

      const ticket = await tenantTransaction(prisma, async (tx) => {
        const t = await tx.ticket.create({
          data: {
            agencyId,
            companyId,
            openedById: user.sub,
            subject: body.subject,
            category: body.category ?? null,
            priority: body.priority ?? 'normal',
            status: 'open',
            source: 'portal',
          },
          select: { id: true },
        })
        await tx.ticketMessage.create({
          data: { agencyId, ticketId: t.id, authorId: user.sub, content: body.message },
        })
        return t
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'support.ticket_opened',
        resourceType: 'ticket',
        resourceId: ticket.id,
        result: 'allowed',
        metadata: { subject: body.subject },
      })

      // Notify команду агенції (in-app; email-шаблону нема → пропуститься)
      fanOut(request.log, await agencyStaffIds(agencyId), {
        event: 'support.new_ticket',
        vars: { subject: body.subject, ticketId: ticket.id },
        inApp: { title: 'Новий тікет підтримки', body: body.subject },
      })
      return reply.status(201).send({ success: true, data: { id: ticket.id } })
    }
  )

  fastify.get(
    '/support/tickets',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      requireActiveAgency(user)
      const companyIds = user.memberships.map((m) => m.companyId)
      if (companyIds.length === 0) return reply.send({ success: true, data: { tickets: [] } })
      const tickets = await withTenant((tx) =>
        tx.ticket.findMany({
          where: { companyId: { in: companyIds } },
          orderBy: { updatedAt: 'desc' },
          select: TICKET_SELECT,
        })
      )
      return reply.send({ success: true, data: { tickets } })
    }
  )

  // ─── Спільне: тред + відповідь (portal і workspace через один access-guard) ──
  fastify.get<{ Params: { id: string } }>(
    '/support/tickets/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireTicketParticipant(request, request.params.id)
      const ticket = await withTenant((tx) =>
        tx.ticket.findUnique({ where: { id: access.ticketId }, select: TICKET_SELECT })
      )
      const raw = await withTenant((tx) =>
        tx.ticketMessage.findMany({
          where: {
            ticketId: access.ticketId,
            deletedAt: null,
            // leak-guard: клієнт не бачить internal-нотаток
            ...(access.isInternal ? {} : { isInternal: false }),
          },
          orderBy: { createdAt: 'asc' },
          select: TICKET_MESSAGE_SELECT,
        })
      )
      const messages = raw.map((m) => serializeTicketMessage(m, access.agencyId))
      return reply.send({ success: true, data: { ticket, messages } })
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/support/tickets/:id/messages',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireTicketParticipant(request, request.params.id)
      const body = replySchema.parse(request.body)
      // internal-нотатку може лишити лише команда
      const isInternal = body.isInternal === true && access.isInternal

      const { message, ticket } = await tenantTransaction(prisma, async (tx) => {
        const t = await tx.ticket.findUniqueOrThrow({
          where: { id: access.ticketId },
          select: {
            id: true,
            companyId: true,
            openedById: true,
            assignedToId: true,
            status: true,
            subject: true,
            firstResponseAt: true,
          },
        })
        const created = await tx.ticketMessage.create({
          data: {
            agencyId: access.agencyId,
            ticketId: access.ticketId,
            authorId: request.user.sub,
            content: body.content,
            isInternal,
          },
          select: TICKET_MESSAGE_SELECT,
        })
        // статус-логіка: команда відповіла публічно → pending (чекаємо клієнта) +
        // firstResponseAt; клієнт відповів → open (повернувся до нас). Internal — статус не чіпає.
        const data: Record<string, unknown> = {}
        if (!isInternal) {
          if (access.isInternal) {
            if (t.firstResponseAt == null) data.firstResponseAt = new Date()
            if (t.status === 'open') data.status = 'pending'
          } else if (t.status === 'pending' || t.status === 'resolved') {
            data.status = 'open'
          }
        }
        if (Object.keys(data).length > 0) {
          await tx.ticket.update({ where: { id: t.id }, data })
        } else {
          await tx.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date() } })
        }
        return { message: created, ticket: t }
      })

      // SSE fan-out (leak-guard застосовується у стрімі при re-fetch)
      publishTicketEvent({
        ticketId: access.ticketId,
        messageId: message.id,
        authorId: request.user.sub,
        isInternal,
        createdAt: message.createdAt.toISOString(),
      })

      // Notify протилежну сторону (не автора). Internal — лише команді (тут — нікому, MVP).
      if (!isInternal) {
        if (access.isInternal) {
          // команда відповіла → клієнту (учасники компанії, крім автора)
          if (ticket.companyId) {
            fanOut(request.log, await clientMemberIds(ticket.companyId, request.user.sub), {
              event: 'support.ticket_reply',
              vars: { subject: ticket.subject, ticketId: ticket.id },
              inApp: { title: 'Відповідь у тікеті', body: ticket.subject },
            })
          }
        } else {
          // клієнт відповів → призначеному виконавцю (або всій команді)
          const targets = ticket.assignedToId
            ? [ticket.assignedToId]
            : await agencyStaffIds(access.agencyId)
          fanOut(request.log, targets, {
            event: 'support.ticket_reply',
            vars: { subject: ticket.subject, ticketId: ticket.id },
            inApp: { title: 'Клієнт відповів у тікеті', body: ticket.subject },
          })
        }
      }

      return reply.status(201).send({
        success: true,
        data: { message: serializeTicketMessage(message, access.agencyId) },
      })
    }
  )

  // ─── WORKSPACE (команда) ────────────────────────────────────────────────────
  fastify.get(
    '/workspace/tickets',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const q = request.query as {
        status?: string
        priority?: string
        assignee?: string
      }
      const where: Record<string, unknown> = { agencyId }
      if (q.status && ['open', 'pending', 'resolved', 'closed'].includes(q.status))
        where.status = q.status
      if (q.priority && ['low', 'normal', 'high', 'urgent'].includes(q.priority))
        where.priority = q.priority
      if (q.assignee === 'me') where.assignedToId = user.sub
      else if (q.assignee === 'unassigned') where.assignedToId = null
      const tickets = await withTenant((tx) =>
        tx.ticket.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: 200,
          select: TICKET_SELECT,
        })
      )
      return reply.send({ success: true, data: { tickets } })
    }
  )

  fastify.patch<{ Params: { id: string } }>(
    '/workspace/tickets/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const body = patchSchema.parse(request.body)

      const before = await withTenant((tx) =>
        tx.ticket.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true, status: true, companyId: true, subject: true },
        })
      )
      if (!before) throw new AppError(ApiErrorCode.NOT_FOUND, 'Тікет не знайдено', 404)

      const data: Record<string, unknown> = {}
      if (body.status !== undefined) {
        data.status = body.status
        if (body.status === 'resolved') data.resolvedAt = new Date()
      }
      if (body.priority !== undefined) data.priority = body.priority
      if (body.assignedToId !== undefined) {
        // Призначати можна лише члена ЦІЄЇ агенції — інакше чужий profileId отримав би
        // нотифікацію з темою+id тікета, а черга б зіпсувалась (LOW-1, аудит 08.07).
        const assignee = body.assignedToId
        if (assignee !== null) {
          const member = await withTenant((tx) =>
            tx.agencyMember.findFirst({
              where: { agencyId, profileId: assignee },
              select: { profileId: true },
            })
          )
          if (!member) {
            throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Виконавець не є членом агенції', 400)
          }
        }
        data.assignedToId = assignee
      }
      if (body.category !== undefined) data.category = body.category

      const updated = await withTenant((tx) =>
        tx.ticket.update({ where: { id: before.id }, data, select: TICKET_SELECT })
      )
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'support.ticket_updated',
        resourceType: 'ticket',
        resourceId: before.id,
        result: 'allowed',
        metadata: { ...body },
      })

      // Зміна статусу → сповіщення клієнту
      if (body.status !== undefined && body.status !== before.status && before.companyId) {
        fanOut(request.log, await clientMemberIds(before.companyId), {
          event: 'support.ticket_status',
          vars: { subject: before.subject, status: body.status, ticketId: before.id },
          inApp: {
            title: 'Статус тікета змінено',
            body: `«${before.subject}» — ${STATUS_LABEL[body.status] ?? body.status}`,
          },
        })
      }
      return reply.send({ success: true, data: { ticket: updated } })
    }
  )

  return Promise.resolve()
}

export default supportRoute
