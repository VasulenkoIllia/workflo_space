import { prisma } from '@workflo/db'
import { INTERNAL_TO_CLIENT_STATUS, type OrderInternalStatus } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireOrderParticipant } from './access.js'

/**
 * Translate a `status_changed` metadata blob to a client-safe shape: internal
 * status names → client statuses, and the (possibly internal) `comment` dropped.
 * Clients must never learn the 9-state internal machine or internal notes — the
 * same leak-guard philosophy as chat (audit S0-S2).
 */
function clientSafeMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of ['from', 'to'] as const) {
    const value = m[key]
    if (typeof value === 'string' && value in INTERNAL_TO_CLIENT_STATUS) {
      out[key] = INTERNAL_TO_CLIENT_STATUS[value as OrderInternalStatus]
    }
  }
  return out
}

/**
 * GET /orders/:id/activity — the order's user-facing timeline (status changes,
 * etc.). Participant-scoped (same IDOR rules as the order). Clients get a
 * translated, internal-detail-free view; internal team sees the raw metadata.
 */
const activityRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/orders/:id/activity',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const rows = await prisma.activityLog.findMany({
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

      const activity = access.isInternal
        ? rows
        : rows.map((row) => ({ ...row, metadata: clientSafeMetadata(row.metadata) }))

      return reply.send({ success: true, data: { activity } })
    }
  )

  return Promise.resolve()
}

export default activityRoute
