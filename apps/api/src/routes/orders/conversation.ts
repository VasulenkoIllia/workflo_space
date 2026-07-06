import { Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { writeAuditAsync } from '../../services/audit.js'
import { requireOrderParticipant, requireTeamOrder } from './access.js'

/**
 * 18-хвости (chat-hub):
 *  - список розмов (18-А, зріз 05.07): GET /workspace/conversations — всі замовлення
 *    агенції з чат-активністю: прев'ю останнього повідомлення, unread (OrderChatRead),
 *    відповідальний, mute/archive стан юзера. Фільтри «мої»/«без відповіді»/«архів»
 *    рахує фронт із прапорців (кап 300 тредів — довше за це щоденний хаб не живе).
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

  // ── 18-А: список розмов для хабу «Чати» (workspace, команда) ──────────────────
  fastify.get(
    '/workspace/conversations',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = user.activeAgencyId
      if (!agencyId || user.agencyMemberships.length === 0) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
      }
      const me = user.sub

      const data = await withTenant(async (tx) => {
        const staff = await tx.agencyMember.findMany({
          where: { agencyId },
          select: { profileId: true },
        })
        const staffSet = new Set(staff.map((s) => s.profileId))

        const orders = await tx.order.findMany({
          where: {
            agencyId,
            deletedAt: null,
            comments: { some: { deletedAt: null } },
          },
          select: {
            id: true,
            title: true,
            internalStatus: true,
            chatOwnerId: true,
            assigneeId: true,
            companyId: true,
            company: { select: { name: true } },
            comments: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                content: true,
                isInternal: true,
                createdAt: true,
                authorId: true,
                author: { select: { name: true } },
              },
            },
            conversationStates: {
              where: { profileId: me },
              select: { muted: true, archivedAt: true },
            },
          },
          take: 300,
        })
        if (orders.length === 0) return { conversations: [] }

        const orderIds = orders.map((o) => o.id)

        // Unread per order: коментарі не від мене, новіші за мій lastReadAt (або всі,
        // якщо читання ще не було). Один raw-запит замість N.
        const unreadRows = await tx.$queryRaw<{ orderId: string; unread: bigint }[]>(Prisma.sql`
          SELECT c."orderId", count(*) AS unread
          FROM order_comments c
          LEFT JOIN order_chat_reads r
            ON r."orderId" = c."orderId" AND r."profileId" = ${me}
          WHERE c."orderId" = ANY(${orderIds})
            AND c."deletedAt" IS NULL
            AND c."authorId" <> ${me}
            AND (r."lastReadAt" IS NULL OR c."createdAt" > r."lastReadAt")
          GROUP BY c."orderId"
        `)
        const unreadByOrder = new Map(unreadRows.map((r) => [r.orderId, Number(r.unread)]))

        // Імена відповідальних — одним запитом по ефективних ids.
        const ownerIds = [
          ...new Set(
            orders.map((o) => o.chatOwnerId ?? o.assigneeId).filter((id): id is string => !!id)
          ),
        ]
        const owners =
          ownerIds.length > 0
            ? await tx.profile.findMany({
                where: { id: { in: ownerIds } },
                select: { id: true, name: true },
              })
            : []
        const ownerName = new Map(owners.map((p) => [p.id, p.name]))

        const conversations = orders
          .map((o) => {
            const last = o.comments[0]
            const state = o.conversationStates[0]
            const effectiveOwnerId = o.chatOwnerId ?? o.assigneeId ?? null
            return {
              orderId: o.id,
              title: o.title,
              internalStatus: o.internalStatus,
              companyId: o.companyId,
              companyName: o.company?.name ?? null,
              lastMessage: last
                ? {
                    preview: last.content.slice(0, 140),
                    authorName: last.author.name,
                    authorIsTeam: staffSet.has(last.authorId),
                    isInternal: last.isInternal,
                    at: last.createdAt.toISOString(),
                  }
                : null,
              unread: unreadByOrder.get(o.id) ?? 0,
              muted: state?.muted ?? false,
              archived: state?.archivedAt != null,
              chatOwnerId: effectiveOwnerId,
              chatOwnerName: effectiveOwnerId ? (ownerName.get(effectiveOwnerId) ?? null) : null,
              mine: effectiveOwnerId === me,
            }
          })
          .sort((a, b) => (b.lastMessage?.at ?? '').localeCompare(a.lastMessage?.at ?? ''))

        return { conversations }
      })

      return reply.send({ success: true, data })
    }
  )

  // ── 18-А: portal-inbox клієнта — «всі чати моїх замовлень одним списком» ──────
  fastify.get(
    '/portal/conversations',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const me = user.sub
      const companyIds = user.memberships.map((m) => m.companyId)
      if (companyIds.length === 0) {
        // Акаунт без компанії — грейсфул порожньо (той самий патерн, що CompanyGate).
        return reply.send({ success: true, data: { conversations: [] } })
      }

      const data = await withTenant(async (tx) => {
        // КЛІЄНТСЬКИЙ скоуп: лише замовлення моїх компаній і ЛИШЕ публічні повідомлення —
        // внутрішні нотатки команди не існують для порталу (ні в прев'ю, ні в unread).
        const orders = await tx.order.findMany({
          where: {
            companyId: { in: companyIds },
            deletedAt: null,
            comments: { some: { deletedAt: null, isInternal: false } },
          },
          select: {
            id: true,
            title: true,
            clientStatus: true,
            companyId: true,
            company: { select: { name: true } },
            comments: {
              where: { deletedAt: null, isInternal: false },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                content: true,
                createdAt: true,
                authorId: true,
                author: { select: { name: true } },
              },
            },
            conversationStates: {
              where: { profileId: me },
              select: { muted: true, archivedAt: true },
            },
          },
          take: 200,
        })
        if (orders.length === 0) return { conversations: [] }

        const orderIds = orders.map((o) => o.id)
        const unreadRows = await tx.$queryRaw<{ orderId: string; unread: bigint }[]>(Prisma.sql`
          SELECT c."orderId", count(*) AS unread
          FROM order_comments c
          LEFT JOIN order_chat_reads r
            ON r."orderId" = c."orderId" AND r."profileId" = ${me}
          WHERE c."orderId" = ANY(${orderIds})
            AND c."deletedAt" IS NULL
            AND c."isInternal" = false
            AND c."authorId" <> ${me}
            AND (r."lastReadAt" IS NULL OR c."createdAt" > r."lastReadAt")
          GROUP BY c."orderId"
        `)
        const unreadByOrder = new Map(unreadRows.map((r) => [r.orderId, Number(r.unread)]))

        const conversations = orders
          .map((o) => {
            const last = o.comments[0]
            const state = o.conversationStates[0]
            return {
              orderId: o.id,
              title: o.title,
              clientStatus: o.clientStatus,
              companyName: o.company?.name ?? null,
              lastMessage: last
                ? {
                    preview: last.content.slice(0, 140),
                    authorName: last.author.name,
                    isMine: last.authorId === me,
                    at: last.createdAt.toISOString(),
                  }
                : null,
              unread: unreadByOrder.get(o.id) ?? 0,
              muted: state?.muted ?? false,
              archived: state?.archivedAt != null,
            }
          })
          .sort((a, b) => (b.lastMessage?.at ?? '').localeCompare(a.lastMessage?.at ?? ''))

        return { conversations }
      })

      return reply.send({ success: true, data })
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
