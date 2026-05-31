import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { assertSameTenant } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * DELETE /orders/:id — soft delete (sets deletedAt). Workspace-only operation;
 * clients cancel via the status transition instead. Tenant-guarded.
 */
const deleteOrderRoute: FastifyPluginAsync = (fastify) => {
  fastify.delete<{ Params: { id: string } }>(
    '/orders/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user

      const order = await prisma.order.findUnique({
        where: { id: request.params.id },
        select: { id: true, agencyId: true, deletedAt: true },
      })
      if (!order || order.deletedAt) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
      }
      assertSameTenant(user, order.agencyId)

      if (user.role !== 'executor') {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Видалення доступне лише команді', 403)
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { deletedAt: new Date() },
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'order.deleted',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
      })

      return reply.send({ success: true, data: { id: order.id } })
    }
  )

  return Promise.resolve()
}

export default deleteOrderRoute
