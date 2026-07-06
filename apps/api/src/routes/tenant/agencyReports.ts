import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * S11 scheduled email-звіти: owner-тумблер «місячний звіт на email». Cron
 * (cron/monthlyReport.ts) шле власникам дайджест за попередній місяць; тут — лише
 * стан тумблера. Щойно увімкнено → перший лист прийде на наступному прогоні крону.
 */
const patchSchema = z
  .object({
    monthlyReportEnabled: z.boolean().optional(),
    // 19-Г: місячний звіт КЛІЄНТАМ (PDF + email)
    clientMonthlyReportEnabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (d) => d.monthlyReportEnabled !== undefined || d.clientMonthlyReportEnabled !== undefined,
    {
      message: 'Потрібно вказати хоча б один тумблер',
    }
  )

const SETTINGS_SELECT = {
  monthlyReportEnabled: true,
  monthlyReportLastSentAt: true,
  clientMonthlyReportEnabled: true,
  clientMonthlyReportLastSentAt: true,
} as const

function assertOwner(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Налаштування звітів змінює лише власник', 403)
  }
  return agencyId
}

const agencyReportsRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/agency/report-settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: SETTINGS_SELECT,
      })
      if (!agency) throw new AppError(ApiErrorCode.NOT_FOUND, 'Агенцію не знайдено', 404)
      return reply.send({ success: true, data: agency })
    }
  )

  fastify.patch(
    '/workspace/agency/report-settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const input = patchSchema.parse(request.body)

      const agency = await prisma.agency.update({
        where: { id: agencyId },
        data: {
          ...(input.monthlyReportEnabled !== undefined
            ? { monthlyReportEnabled: input.monthlyReportEnabled }
            : {}),
          ...(input.clientMonthlyReportEnabled !== undefined
            ? { clientMonthlyReportEnabled: input.clientMonthlyReportEnabled }
            : {}),
        },
        select: SETTINGS_SELECT,
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'agency.report_settings_changed',
        resourceType: 'agency',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { ip: request.ip, ...input },
      })
      return reply.send({ success: true, data: agency })
    }
  )

  return Promise.resolve()
}

export default agencyReportsRoute
