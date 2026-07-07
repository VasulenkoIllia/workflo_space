import { Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { DEFAULT_DUNNING_STEPS, parseDunningSteps } from '../../cron/dunning.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * 05-Б дунінг (owner): ланцюжок кроків нагадувань агенції + per-company opt-out.
 * steps = офсети в днях від dueDate (відʼємні = до терміну), [] = дунінг вимкнено,
 * скидання на null = системний дефолт. Opt-out глушить лише листи — overdue-статус
 * нарахувань ставиться незалежно.
 */
const stepsSchema = z
  .object({
    steps: z.array(z.number().int().min(-30).max(60)).max(10).nullable(),
  })
  .strict()

const optOutSchema = z.object({ optOut: z.boolean() }).strict()

function assertOwner(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Налаштування дунінгу змінює лише власник', 403)
  }
  return agencyId
}

const dunningRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/agency/dunning-settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const agency = await withTenant((tx) =>
        tx.agency.findUnique({ where: { id: agencyId }, select: { dunningSteps: true } })
      )
      return reply.send({
        success: true,
        data: {
          steps: parseDunningSteps(agency?.dunningSteps),
          isDefault: agency?.dunningSteps == null,
          defaultSteps: DEFAULT_DUNNING_STEPS,
        },
      })
    }
  )

  fastify.put(
    '/workspace/agency/dunning-settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const body = stepsSchema.parse(request.body)
      const steps = body.steps === null ? null : parseDunningSteps(body.steps)
      const agency = await withTenant((tx) =>
        tx.agency.update({
          where: { id: agencyId },
          data: { dunningSteps: steps === null ? Prisma.DbNull : steps },
          select: { dunningSteps: true },
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'agency.dunning_settings_updated',
        resourceType: 'agency',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { steps },
      })
      return reply.send({
        success: true,
        data: {
          steps: parseDunningSteps(agency.dunningSteps),
          isDefault: agency.dunningSteps == null,
          defaultSteps: DEFAULT_DUNNING_STEPS,
        },
      })
    }
  )

  fastify.get<{ Params: { companyId: string } }>(
    '/workspace/companies/:companyId/dunning',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const company = await withTenant((tx) =>
        tx.company.findFirst({
          where: { id: request.params.companyId, agencyId },
          select: { dunningOptOut: true },
        })
      )
      if (!company) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Клієнта не знайдено', 404)
      }
      return reply.send({ success: true, data: { optOut: company.dunningOptOut } })
    }
  )

  fastify.patch<{ Params: { companyId: string } }>(
    '/workspace/companies/:companyId/dunning',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const body = optOutSchema.parse(request.body)
      const updated = await withTenant((tx) =>
        tx.company.updateMany({
          where: { id: request.params.companyId, agencyId },
          data: { dunningOptOut: body.optOut },
        })
      )
      if (updated.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Клієнта не знайдено', 404)
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'company.dunning_opt_out_changed',
        resourceType: 'company',
        resourceId: request.params.companyId,
        result: 'allowed',
        metadata: { optOut: body.optOut },
      })
      return reply.send({ success: true, data: { optOut: body.optOut } })
    }
  )

  return Promise.resolve()
}

export default dunningRoute
