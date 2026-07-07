import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * 06-ПІДПИС: воркфлоу-налаштування агенції. requireSignedContract — «без прийнятого
 * клієнтом договору робота по замовленню не стартує» (гейт у transitionOrderStatus,
 * рамкова семантика: accepted-договір КОМПАНІЇ). Вимкнено за замовчуванням.
 */
const patchSchema = z
  .object({
    requireSignedContract: z.boolean().optional(),
    // АВТО-РАХУНОК (07.07): разове замовлення done → draft-invoice + in-app власнику
    autoInvoiceOneTime: z.boolean().optional(),
  })
  .strict()
  .refine((b) => b.requireSignedContract !== undefined || b.autoInvoiceOneTime !== undefined, {
    message: 'Порожній запит',
  })

function assertOwner(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Воркфлоу-налаштування змінює лише власник', 403)
  }
  return agencyId
}

const agencyWorkflowRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/agency/workflow-settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { requireSignedContract: true, autoInvoiceOneTime: true },
      })
      if (!agency) throw new AppError(ApiErrorCode.NOT_FOUND, 'Агенцію не знайдено', 404)
      return reply.send({ success: true, data: agency })
    }
  )

  fastify.patch(
    '/workspace/agency/workflow-settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const body = patchSchema.parse(request.body)

      const agency = await prisma.agency.update({
        where: { id: agencyId },
        data: {
          ...(body.requireSignedContract !== undefined
            ? { requireSignedContract: body.requireSignedContract }
            : {}),
          ...(body.autoInvoiceOneTime !== undefined
            ? { autoInvoiceOneTime: body.autoInvoiceOneTime }
            : {}),
        },
        select: { requireSignedContract: true, autoInvoiceOneTime: true },
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'agency.workflow_settings_updated',
        resourceType: 'agency',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { ip: request.ip, ...body },
      })
      return reply.send({ success: true, data: agency })
    }
  )

  return Promise.resolve()
}

export default agencyWorkflowRoute
