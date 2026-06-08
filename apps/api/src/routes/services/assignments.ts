import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, assignServiceSchema, updateAssignmentSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

interface AssignmentRow {
  id: string
  companyId: string
  serviceId: string
  customPrice: Prisma.Decimal
  frequency: string
  active: boolean
  nextChargeAt: Date | null
}

function toDto(a: AssignmentRow) {
  return {
    id: a.id,
    companyId: a.companyId,
    serviceId: a.serviceId,
    customPrice: a.customPrice.toFixed(2),
    frequency: a.frequency,
    active: a.active,
    nextChargeAt: a.nextChargeAt,
  }
}

const ASSIGNMENT_SELECT = {
  id: true,
  companyId: true,
  serviceId: true,
  customPrice: true,
  frequency: true,
  active: true,
  nextChargeAt: true,
} satisfies Prisma.CompanyServiceSelect

/** First instant of next month (UTC) — when the first recurring charge falls due. */
function firstOfNextMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

const assignmentsRoute: FastifyPluginAsync = (fastify) => {
  // ── Assign a company to a service (subscribe) ───────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/services/:id/assign',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = assignServiceSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const assignment = await withTenant(async (tx) => {
        const [service, company] = await Promise.all([
          tx.service.findUnique({
            where: { id: request.params.id },
            select: { id: true, agencyId: true },
          }),
          tx.company.findUnique({
            where: { id: input.companyId },
            select: { id: true, agencyId: true },
          }),
        ])
        if (!service || service.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Послугу не знайдено', 404)
        }
        if (!company || company.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        }

        const existing = await tx.companyService.findUnique({
          where: { companyId_serviceId: { companyId: input.companyId, serviceId: service.id } },
          select: { id: true, active: true },
        })
        if (existing?.active) {
          throw new AppError(ApiErrorCode.CONFLICT, 'Компанія вже підписана на цю послугу', 409)
        }

        const data = {
          customPrice: input.customPrice,
          active: true,
          frequency: input.frequency,
          nextChargeAt: firstOfNextMonth(new Date()),
        }
        // Reactivate a previously-cancelled subscription, or create a fresh one.
        return existing
          ? tx.companyService.update({
              where: { id: existing.id },
              data,
              select: ASSIGNMENT_SELECT,
            })
          : tx.companyService.create({
              data: { companyId: input.companyId, serviceId: service.id, ...data },
              select: ASSIGNMENT_SELECT,
            })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'service.assigned',
        resourceType: 'company_service',
        resourceId: assignment.id,
        result: 'allowed',
        metadata: { companyId: input.companyId, serviceId: request.params.id },
      })
      return reply.status(201).send({ success: true, data: { assignment: toDto(assignment) } })
    }
  )

  // ── Update a subscription (price / frequency / active) ──────────────────────
  fastify.patch<{ Params: { id: string; companyId: string } }>(
    '/workspace/services/:id/companies/:companyId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateAssignmentSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const assignment = await withTenant(async (tx) => {
        const existing = await tx.companyService.findUnique({
          where: {
            companyId_serviceId: {
              companyId: request.params.companyId,
              serviceId: request.params.id,
            },
          },
          select: { id: true, company: { select: { agencyId: true } } },
        })
        if (!existing || existing.company.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Підписку не знайдено', 404)
        }
        return tx.companyService.update({
          where: { id: existing.id },
          data: {
            ...(input.customPrice !== undefined ? { customPrice: input.customPrice } : {}),
            ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          },
          select: ASSIGNMENT_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'service.assignment_updated',
        resourceType: 'company_service',
        resourceId: assignment.id,
        result: 'allowed',
        metadata: { fields: Object.keys(input) },
      })
      return reply.send({ success: true, data: { assignment: toDto(assignment) } })
    }
  )

  // ── Unassign (cancel subscription; soft so charge history survives) ─────────
  fastify.delete<{ Params: { id: string; companyId: string } }>(
    '/workspace/services/:id/companies/:companyId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      await withTenant(async (tx) => {
        const existing = await tx.companyService.findUnique({
          where: {
            companyId_serviceId: {
              companyId: request.params.companyId,
              serviceId: request.params.id,
            },
          },
          select: { id: true, company: { select: { agencyId: true } } },
        })
        if (!existing || existing.company.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Підписку не знайдено', 404)
        }
        // Soft cancel: stop billing (active=false, clear the next-charge anchor) but keep
        // the row so existing ServiceCharge history (FK) is preserved.
        await tx.companyService.update({
          where: { id: existing.id },
          data: { active: false, nextChargeAt: null },
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'service.unassigned',
        resourceType: 'company_service',
        resourceId: `${request.params.id}:${request.params.companyId}`,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { unassigned: true } })
    }
  )

  return Promise.resolve()
}

export default assignmentsRoute
