import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, createServiceSchema, updateServiceSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'
import { hasPermission, requireAnyPermission, requirePermission } from '../../auth/permissions.js'

interface ServiceRow {
  id: string
  name: string
  description: string | null
  isActive: boolean
  isRecurring: boolean
  defaultPriceUsd: Prisma.Decimal | null
  estimatedHours: Prisma.Decimal | null
  createdAt: Date
}

function toDto(s: ServiceRow) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    isActive: s.isActive,
    isRecurring: s.isRecurring,
    defaultPriceUsd: s.defaultPriceUsd ? s.defaultPriceUsd.toFixed(2) : null,
    estimatedHours: s.estimatedHours ? s.estimatedHours.toFixed(2) : null,
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
  estimatedHours: true,
  createdAt: true,
} satisfies Prisma.ServiceSelect

const catalogRoute: FastifyPluginAsync = (fastify) => {
  // ── List ──────────────────────────────────────────────────────────────────
  fastify.get(
    '/workspace/services',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      // PERM-2: каталог читає команда; ціни — лише з правом на гроші/кошторис/каталоги
      await requireAnyPermission(request, ['orders.view', 'settings.catalogs'])
      const showPrices =
        (await hasPermission(request, 'billing.view')) ||
        (await hasPermission(request, 'orders.estimate')) ||
        (await hasPermission(request, 'settings.catalogs'))
      const rows = await withTenant((tx) =>
        tx.service.findMany({
          where: { agencyId },
          select: SERVICE_SELECT,
          orderBy: { createdAt: 'desc' },
        })
      )
      return reply.send({
        success: true,
        data: {
          services: rows.map((r) => {
            const dto = toDto(r)
            return showPrices ? dto : { ...dto, defaultPriceUsd: null }
          }),
        },
      })
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
      await requirePermission(request, 'settings.catalogs')

      const service = await withTenant((tx) =>
        tx.service.create({
          data: {
            agencyId,
            name: input.name,
            description: input.description ?? null,
            defaultPriceUsd: input.defaultPriceUsd ?? null,
            estimatedHours: input.estimatedHours ?? null,
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
      await requirePermission(request, 'settings.catalogs')

      const service = await withTenant(async (tx) => {
        const existing = await tx.service.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Послугу не знайдено', 404)
        }
        return tx.service.update({
          where: { id: existing.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.defaultPriceUsd !== undefined
              ? { defaultPriceUsd: input.defaultPriceUsd }
              : {}),
            ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
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
      await requirePermission(request, 'settings.catalogs')

      await withTenant(async (tx) => {
        const existing = await tx.service.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Послугу не знайдено', 404)
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
