import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, OrderInternalStatus, updateOrderSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { assertSameTenant } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * PATCH /orders/:id — edit order fields. Internal team may edit anything; a client
 * (member of the order's company) may edit only title/description/priority/dueDate
 * and only while the order is still `new` (pre-triage).
 */
const updateOrderRoute: FastifyPluginAsync = (fastify) => {
  fastify.patch<{ Params: { id: string } }>(
    '/orders/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateOrderSchema.parse(request.body)
      const user = request.user
      const notFound = () => new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)

      const order = await withTenant((tx) =>
        tx.order.findUnique({
          where: { id: request.params.id },
          select: {
            id: true,
            agencyId: true,
            companyId: true,
            internalStatus: true,
            deletedAt: true,
          },
        })
      )
      if (!order || order.deletedAt) throw notFound()
      assertSameTenant(user, order.agencyId)

      const isInternal = isInternalTeam(user)
      if (!isInternal && !user.memberships.some((m) => m.companyId === order.companyId)) {
        throw notFound()
      }

      if (!isInternal) {
        if ((order.internalStatus as OrderInternalStatus) !== OrderInternalStatus.NEW) {
          throw new AppError(
            ApiErrorCode.FORBIDDEN,
            'Редагувати можна лише нові замовлення (до взяття в роботу)',
            403
          )
        }
        if (
          input.billingType !== undefined ||
          input.fixedPrice !== undefined ||
          input.hourlyRate !== undefined ||
          input.estimatedHours !== undefined
        ) {
          throw new AppError(ApiErrorCode.FORBIDDEN, 'Клієнт не може редагувати білінг', 403)
        }
      }

      const data: Prisma.OrderUpdateInput = {}
      if (input.title !== undefined) data.title = input.title
      if (input.description !== undefined) data.description = input.description
      if (input.priority !== undefined) data.priority = input.priority
      if (input.dueDate !== undefined)
        data.deadline = input.dueDate ? new Date(input.dueDate) : null
      if (isInternal) {
        if (input.billingType !== undefined) data.billingType = input.billingType
        if (input.fixedPrice !== undefined) data.fixedPrice = input.fixedPrice
        if (input.hourlyRate !== undefined) data.hourlyRate = input.hourlyRate
        if (input.estimatedHours !== undefined) data.estimatedHours = input.estimatedHours
      }

      const updated = await withTenant((tx) =>
        tx.order.update({
          where: { id: order.id },
          data,
          select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            deadline: true,
            clientStatus: true,
            updatedAt: true,
          },
        })
      )

      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'order.updated',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { fields: Object.keys(data) },
      })

      return reply.send({ success: true, data: { order: updated } })
    }
  )

  return Promise.resolve()
}

export default updateOrderRoute
