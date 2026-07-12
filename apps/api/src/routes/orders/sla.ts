import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, OrderPriority } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency, requireOwnerAgency } from '../../auth/tenant.js'
import { type AccessClaims, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * S10-02: SLA-політики (спека 02-orders §C) — per-agency конфіг per-пріоритет.
 * Owner upsert-ить/знімає політику; команда читає. Штампування дедлайнів на замовлення —
 * services/sla.ts при створенні; політика заднім числом наявні замовлення не міняє.
 */
const upsertSchema = z
  .object({
    priority: z.nativeEnum(OrderPriority),
    firstResponseMins: z
      .number()
      .int()
      .min(5)
      .max(30 * 24 * 60),
    resolutionMins: z
      .number()
      .int()
      .min(5)
      .max(365 * 24 * 60),
  })
  .strict()
  .refine((d) => d.resolutionMins >= d.firstResponseMins, {
    message: 'Розв’язання не може бути швидшим за першу відповідь',
  })

function assertTeam(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isInternalTeam(user)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
  }
  return agencyId
}

function assertOwner(user: AccessClaims): string {
  return requireOwnerAgency(user, 'SLA-політики редагує лише власник')
}

const SELECT = { id: true, priority: true, firstResponseMins: true, resolutionMins: true } as const

const slaRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/sla-policies',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const policies = await withTenant((tx) =>
        tx.slaPolicy.findMany({ where: { agencyId }, select: SELECT })
      )
      return reply.send({ success: true, data: { policies } })
    }
  )

  fastify.put(
    '/workspace/sla-policies',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const input = upsertSchema.parse(request.body)
      const policy = await withTenant((tx) =>
        tx.slaPolicy.upsert({
          where: { agencyId_priority: { agencyId, priority: input.priority } },
          create: { agencyId, ...input },
          update: {
            firstResponseMins: input.firstResponseMins,
            resolutionMins: input.resolutionMins,
          },
          select: SELECT,
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'orders.sla_policy_upserted',
        resourceType: 'sla_policy',
        resourceId: policy.id,
        result: 'allowed',
        metadata: { ...input },
      })
      return reply.send({ success: true, data: { policy } })
    }
  )

  fastify.delete<{ Params: { priority: string } }>(
    '/workspace/sla-policies/:priority',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const priority = z.nativeEnum(OrderPriority).parse(request.params.priority)
      const res = await withTenant((tx) =>
        tx.slaPolicy.deleteMany({ where: { agencyId, priority } })
      )
      if (res.count === 0) throw new AppError(ApiErrorCode.NOT_FOUND, 'Політику не знайдено', 404)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'orders.sla_policy_deleted',
        resourceType: 'sla_policy',
        resourceId: priority,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { priority } })
    }
  )

  return Promise.resolve()
}

export default slaRoute
