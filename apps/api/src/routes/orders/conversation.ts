import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { writeAuditAsync } from '../../services/audit.js'
import { requireOrderParticipant, requireTeamOrder } from './access.js'

/**
 * 18-хвости (chat-hub):
 *  - mute/archive стану треду per-user (18-Б): GET/PUT /orders/:id/conversation.
 *    muted → воркер не шле chat.new_comment цьому профілю (@mention пробиває mute свідомо).
 *  - відповідальний за тред (18-В): PATCH /workspace/orders/:id/chat-owner. null = «авто»
 *    (UI показує першого assignee).
 *  - «без відповіді > N год» (18-Г): GET /workspace/chats/unanswered — активні замовлення,
 *    де останнє публічне повідомлення від КЛІЄНТА і команда мовчить довше за поріг.
 */
const putStateSchema = z
  .object({
    muted: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((d) => d.muted !== undefined || d.archived !== undefined, {
    message: 'Потрібно вказати muted або archived',
  })

const chatOwnerSchema = z.object({ profileId: z.string().min(1).nullable() }).strict()

const unansweredQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(720).default(4),
})

const conversationRoute: FastifyPluginAsync = (fastify) => {
  // ── Per-user conversation state (both apps' participants) ─────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/orders/:id/conversation',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const [state, order] = await withTenant((tx) =>
        Promise.all([
          tx.conversationState.findUnique({
            where: { profileId_orderId: { profileId: request.user.sub, orderId: access.orderId } },
            select: { muted: true, archivedAt: true },
          }),
          tx.order.findUnique({
            where: { id: access.orderId },
            select: { chatOwnerId: true, assigneeId: true },
          }),
        ])
      )
      return reply.send({
        success: true,
        data: {
          muted: state?.muted ?? false,
          archivedAt: state?.archivedAt ?? null,
          // 18-В: ефективний відповідальний (явний або «авто» = перший assignee)
          chatOwnerId: order?.chatOwnerId ?? null,
          effectiveChatOwnerId: order?.chatOwnerId ?? order?.assigneeId ?? null,
        },
      })
    }
  )

  fastify.put<{ Params: { id: string } }>(
    '/orders/:id/conversation',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const input = putStateSchema.parse(request.body)
      const state = await withTenant((tx) =>
        tx.conversationState.upsert({
          where: { profileId_orderId: { profileId: request.user.sub, orderId: access.orderId } },
          create: {
            agencyId: access.agencyId,
            profileId: request.user.sub,
            orderId: access.orderId,
            muted: input.muted ?? false,
            archivedAt: input.archived ? new Date() : null,
          },
          update: {
            ...(input.muted !== undefined ? { muted: input.muted } : {}),
            ...(input.archived !== undefined
              ? { archivedAt: input.archived ? new Date() : null }
              : {}),
          },
          select: { muted: true, archivedAt: true },
        })
      )
      return reply.send({ success: true, data: state })
    }
  )

  // ── 18-В: відповідальний за тред (internal team; null = «авто») ───────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/orders/:id/chat-owner',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orderId, agencyId } = await requireTeamOrder(request, request.params.id)
      const { profileId } = chatOwnerSchema.parse(request.body)

      if (profileId !== null) {
        const member = await withTenant((tx) =>
          tx.agencyMember.findFirst({
            where: { agencyId, profileId },
            select: { id: true },
          })
        )
        if (!member) {
          throw new AppError(
            ApiErrorCode.VALIDATION_ERROR,
            'Відповідальний має бути членом команди агенції',
            400
          )
        }
      }

      await withTenant((tx) =>
        tx.order.update({ where: { id: orderId }, data: { chatOwnerId: profileId } })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'orders.chat_owner_changed',
        resourceType: 'order',
        resourceId: orderId,
        result: 'allowed',
        metadata: { chatOwnerId: profileId },
      })
      return reply.send({ success: true, data: { orderId, chatOwnerId: profileId } })
    }
  )

  // ── 18-Г: «без відповіді > N год» (view поверх коментарів) ────────────────────
  fastify.get(
    '/workspace/chats/unanswered',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = user.activeAgencyId
      if (!agencyId || user.agencyMemberships.length === 0) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
      }
      const { hours } = unansweredQuerySchema.parse(request.query)
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

      const rows = await withTenant(async (tx) => {
        // Team profile ids — to classify the LAST public message as client-authored.
        const staff = await tx.agencyMember.findMany({
          where: { agencyId },
          select: { profileId: true },
        })
        const staffSet = new Set(staff.map((s) => s.profileId))

        const orders = await tx.order.findMany({
          where: {
            agencyId,
            deletedAt: null,
            internalStatus: { notIn: ['done', 'cancelled'] },
            comments: { some: { isInternal: false, deletedAt: null } },
          },
          select: {
            id: true,
            title: true,
            chatOwnerId: true,
            assigneeId: true,
            company: { select: { name: true } },
            comments: {
              where: { isInternal: false, deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { authorId: true, createdAt: true },
            },
          },
          take: 300,
        })

        return orders.flatMap((o) => {
          const last = o.comments[0]
          if (!last) return []
          if (staffSet.has(last.authorId)) return [] // команда відповіла останньою
          if (last.createdAt > cutoff) return [] // ще в межах порогу
          return [
            {
              orderId: o.id,
              title: o.title,
              companyName: o.company?.name ?? null,
              lastClientMessageAt: last.createdAt.toISOString(),
              hoursSince: Math.floor((Date.now() - last.createdAt.getTime()) / 3_600_000),
              chatOwnerId: o.chatOwnerId ?? o.assigneeId ?? null,
            },
          ]
        })
      })

      rows.sort((a, b) => b.hoursSince - a.hoursSince)
      return reply.send({ success: true, data: { unanswered: rows, hours } })
    }
  )

  return Promise.resolve()
}

export default conversationRoute
