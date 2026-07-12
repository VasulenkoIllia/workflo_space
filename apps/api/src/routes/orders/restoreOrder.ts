import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireOwnerAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * S10-07: soft-delete restore («кошик»). Owner-only, 30-денне вікно — старші за нього
 * видалення вважаються остаточними (410, рядок лишається в БД для аудиту/звітів).
 * Сховище вже soft-delete (`deletedAt`) — тут лише список + відкат.
 */
const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function assertOwner(user: AccessClaims): string {
  return requireOwnerAgency(user, 'Кошик доступний лише власнику')
}

const restoreOrderRoute: FastifyPluginAsync = (fastify) => {
  // ── «Кошик»: видалені за останні 30 днів ───────────────────────────────────────
  fastify.get(
    '/workspace/orders/deleted',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const windowStart = new Date(Date.now() - RESTORE_WINDOW_MS)
      const rows = await withTenant((tx) =>
        tx.order.findMany({
          where: { agencyId, deletedAt: { not: null, gte: windowStart } },
          select: {
            id: true,
            title: true,
            deletedAt: true,
            company: { select: { name: true } },
          },
          orderBy: { deletedAt: 'desc' },
          take: 100,
        })
      )
      return reply.send({
        success: true,
        data: {
          orders: rows.map((o) => {
            const deletedAt = o.deletedAt as Date
            return {
              id: o.id,
              title: o.title,
              companyName: o.company?.name ?? null,
              deletedAt: deletedAt.toISOString(),
              daysLeft: Math.max(
                0,
                Math.ceil((deletedAt.getTime() + RESTORE_WINDOW_MS - Date.now()) / 86_400_000)
              ),
            }
          }),
        },
      })
    }
  )

  // ── Відкат ──────────────────────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/orders/:id/restore',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const order = await withTenant((tx) =>
        tx.order.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true, deletedAt: true },
        })
      )
      if (!order || order.deletedAt === null) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Видалене замовлення не знайдено', 404)
      }
      if (order.deletedAt.getTime() < Date.now() - RESTORE_WINDOW_MS) {
        throw new AppError(
          ApiErrorCode.CONFLICT,
          'Вікно відновлення (30 днів) минуло — замовлення видалено остаточно',
          410
        )
      }

      await withTenant((tx) =>
        tx.order.update({ where: { id: order.id }, data: { deletedAt: null } })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'order.restored',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { id: order.id } })
    }
  )

  return Promise.resolve()
}

export default restoreOrderRoute
