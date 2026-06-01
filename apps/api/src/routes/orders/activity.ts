import { prisma } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { requireOrderParticipant } from './access.js'

/**
 * GET /orders/:id/activity — the order's user-facing timeline (status changes,
 * etc.). Participant-scoped (same IDOR rules as the order); entries logged so
 * far are client-safe status transitions.
 */
const activityRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/orders/:id/activity',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const activity = await prisma.activityLog.findMany({
        where: { orderId: access.orderId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, name: true } },
        },
      })
      return reply.send({ success: true, data: { activity } })
    }
  )

  return Promise.resolve()
}

export default activityRoute
