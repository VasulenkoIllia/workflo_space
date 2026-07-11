import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { writeAuditAsync } from '../../services/audit.js'
import { requireTeamOrder } from './access.js'

/**
 * S10-03 (спека 02-D): залежності між замовленнями — «orderId заблокований, поки
 * dependsOnId не done». Team-only (той самий гейт, що статуси/документи).
 * Цикл-guard: DFS від dependsOn по його блокерах — якщо досяжний orderId,
 * звʼязок замкнув би коло → 409 dependency_cycle. Гейт на старт роботи —
 * у transitionOrderStatus (→ in_progress поки блокери живі → 409).
 */

const createSchema = z.object({ dependsOnId: z.string().uuid() }).strict()

/** Чи досяжний target з start по ребрах «order → його блокери» (batch-DFS). */
async function reachesTarget(
  tx: { orderDependency: { findMany: (args: never) => Promise<{ dependsOnId: string }[]> } },
  agencyId: string,
  start: string,
  target: string
): Promise<boolean> {
  const visited = new Set<string>([start])
  let frontier = [start]
  // Захисна межа: глибина/обсяг графа замовлень агенції обмежені; 50 ітерацій
  // покривають будь-який реальний ланцюг, а патологію рвемо як «цикл».
  for (let depth = 0; depth < 50 && frontier.length > 0; depth++) {
    const edges = await tx.orderDependency.findMany({
      where: { agencyId, orderId: { in: frontier } },
      select: { dependsOnId: true },
    } as never)
    const next: string[] = []
    for (const e of edges) {
      if (e.dependsOnId === target) return true
      if (!visited.has(e.dependsOnId)) {
        visited.add(e.dependsOnId)
        next.push(e.dependsOnId)
      }
    }
    frontier = next
  }
  return frontier.length > 0 // межу вибили — консервативно вважаємо циклом
}

const dependenciesRoute: FastifyPluginAsync = (fastify) => {
  // ── Додати блокер ─────────────────────────────────────────────────────────────
  fastify.post<{ Params: { orderId: string } }>(
    '/orders/:orderId/dependencies',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, orderId } = await requireTeamOrder(request, request.params.orderId)
      const { dependsOnId } = createSchema.parse(request.body)
      if (dependsOnId === orderId) {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Замовлення не може блокувати саме себе',
          400
        )
      }

      const dependency = await tenantTransaction(prisma, async (tx) => {
        const blocker = await tx.order.findFirst({
          where: { id: dependsOnId, agencyId, deletedAt: null },
          select: { id: true, title: true, internalStatus: true },
        })
        if (!blocker)
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення-блокер не знайдено', 404)

        const duplicate = await tx.orderDependency.findFirst({
          where: { orderId, dependsOnId },
          select: { id: true },
        })
        if (duplicate) throw new AppError(ApiErrorCode.CONFLICT, 'Така залежність уже є', 409)

        // Цикл: блокер (транзитивно) залежить від цього замовлення → коло
        if (await reachesTarget(tx as never, agencyId, dependsOnId, orderId)) {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'dependency_cycle: залежність утворила б цикл',
            409
          )
        }

        return tx.orderDependency.create({
          data: { agencyId, orderId, dependsOnId },
          select: {
            id: true,
            dependsOn: { select: { id: true, title: true, internalStatus: true } },
            createdAt: true,
          },
        })
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'order.dependency_added',
        resourceType: 'order',
        resourceId: orderId,
        result: 'allowed',
        metadata: { dependsOnId },
      })
      return reply.status(201).send({ success: true, data: { dependency } })
    }
  )

  // ── Прибрати блокер ───────────────────────────────────────────────────────────
  fastify.delete<{ Params: { orderId: string; depId: string } }>(
    '/orders/:orderId/dependencies/:depId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, orderId } = await requireTeamOrder(request, request.params.orderId)
      const removed = await tenantTransaction(prisma, (tx) =>
        tx.orderDependency.deleteMany({
          where: { id: request.params.depId, orderId, agencyId },
        })
      )
      if (removed.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Залежність не знайдено', 404)
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'order.dependency_removed',
        resourceType: 'order',
        resourceId: orderId,
        result: 'allowed',
        metadata: { dependencyId: request.params.depId },
      })
      return reply.send({ success: true, data: { removed: true } })
    }
  )

  return Promise.resolve()
}

export default dependenciesRoute
