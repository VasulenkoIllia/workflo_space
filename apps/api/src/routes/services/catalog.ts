import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, createServiceSchema, updateServiceSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { type AccessClaims, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

interface ServiceRow {
  id: string
  name: string
  description: string | null
  isActive: boolean
  isRecurring: boolean
  defaultPriceUsd: Prisma.Decimal | null
  createdAt: Date
  _count: { companyAssigns: number }
}

function toDto(s: ServiceRow) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    isActive: s.isActive,
    isRecurring: s.isRecurring,
    defaultPriceUsd: s.defaultPriceUsd ? s.defaultPriceUsd.toFixed(2) : null,
    assignmentCount: s._count.companyAssigns,
    createdAt: s.createdAt,
  }
}

const SERVICE_SELECT = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  isRecurring: true,
  defaultPriceUsd: true,
  createdAt: true,
  _count: { select: { companyAssigns: true } },
} satisfies Prisma.ServiceSelect

/** Workspace-only catalog management. Internal team manages the agency's services. */
function assertInternal(user: Pick<AccessClaims, 'agencyMemberships'>): void {
  if (!isInternalTeam(user)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
  }
}

const catalogRoute: FastifyPluginAsync = (fastify) => {
  // ── List ──────────────────────────────────────────────────────────────────
  fastify.get(
    '/workspace/services',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)
      const rows = await withTenant((tx) =>
        tx.service.findMany({
          where: { agencyId },
          select: SERVICE_SELECT,
          orderBy: { createdAt: 'desc' },
        })
      )
      return reply.send({ success: true, data: { services: rows.map(toDto) } })
    }
  )

  // ── Create ────────────────────────────────────────────────────────────────
  fastify.post(
    '/workspace/services',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = createServiceSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)

      const service = await withTenant((tx) =>
        tx.service.create({
          data: {
            agencyId,
            name: input.name,
            description: input.description ?? null,
            defaultPriceUsd: input.defaultPriceUsd ?? null,
            isRecurring: input.isRecurring,
          },
          select: SERVICE_SELECT,
        })
      )
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'service.created',
        resourceType: 'service',
        resourceId: service.id,
        result: 'allowed',
        metadata: { name: input.name },
      })
      return reply.status(201).send({ success: true, data: { service: toDto(service) } })
    }
  )

  // ── Update ────────────────────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/services/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateServiceSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)

      const service = await withTenant(async (tx) => {
        const existing = await tx.service.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Послугу не знайдено', 404)
        }
        // A price change must not silently re-price live subscriptions — block while any are active.
        if (input.defaultPriceUsd !== undefined) {
          const active = await tx.companyService.count({
            where: { serviceId: existing.id, active: true },
          })
          if (active > 0) {
            throw new AppError(
              ApiErrorCode.CONFLICT,
              'Не можна змінити ціну, поки є активні підписки на цю послугу',
              409
            )
          }
        }
        return tx.service.update({
          where: { id: existing.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.defaultPriceUsd !== undefined
              ? { defaultPriceUsd: input.defaultPriceUsd }
              : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.isRecurring !== undefined ? { isRecurring: input.isRecurring } : {}),
          },
          select: SERVICE_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'service.updated',
        resourceType: 'service',
        resourceId: service.id,
        result: 'allowed',
        metadata: { fields: Object.keys(input) },
      })
      return reply.send({ success: true, data: { service: toDto(service) } })
    }
  )

  // ── Delete ────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/services/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)

      await withTenant(async (tx) => {
        const existing = await tx.service.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Послугу не знайдено', 404)
        }
        // Subscriptions (and their charge history) reference this service — refuse to orphan them.
        const assigned = await tx.companyService.count({ where: { serviceId: existing.id } })
        if (assigned > 0) {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Не можна видалити послугу з підписками — спершу відпишіть компанії',
            409
          )
        }
        await tx.service.delete({ where: { id: existing.id } })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'service.deleted',
        resourceType: 'service',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { deleted: true } })
    }
  )

  return Promise.resolve()
}

export default catalogRoute
