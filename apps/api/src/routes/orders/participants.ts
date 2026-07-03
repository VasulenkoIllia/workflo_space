import { withTenant } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { requireOrderParticipant } from './access.js'

/**
 * GET /orders/:id/participants — who can be @mentioned in this order's chat
 * (S10): the agency team + the client company members. The same audience that
 * can read public messages, so the list leaks nothing the chat itself doesn't.
 */
const participantsRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/orders/:id/participants',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)

      const { staff, clients } = await withTenant(async (tx) => {
        const staff = await tx.agencyMember.findMany({
          where: { agencyId: access.agencyId },
          select: { profile: { select: { id: true, name: true } } },
        })
        const clients = access.companyId
          ? await tx.companyMember.findMany({
              where: { companyId: access.companyId },
              select: { profile: { select: { id: true, name: true } } },
            })
          : []
        return { staff, clients }
      })

      const seen = new Set<string>()
      const participants: { id: string; name: string; kind: 'team' | 'client' }[] = []
      for (const m of staff) {
        if (seen.has(m.profile.id)) continue
        seen.add(m.profile.id)
        participants.push({ id: m.profile.id, name: m.profile.name, kind: 'team' })
      }
      for (const m of clients) {
        if (seen.has(m.profile.id)) continue
        seen.add(m.profile.id)
        participants.push({ id: m.profile.id, name: m.profile.name, kind: 'client' })
      }

      return reply.send({ success: true, data: { participants } })
    }
  )

  return Promise.resolve()
}

export default participantsRoute
