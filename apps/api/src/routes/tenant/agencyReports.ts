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
const patchSchema = z.object({ monthlyReportEnabled: z.boolean() }).strict()

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
        select: { monthlyReportEnabled: true, monthlyReportLastSentAt: true },
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
      const { monthlyReportEnabled } = patchSchema.parse(request.body)

      const agency = await prisma.agency.update({
        where: { id: agencyId },
        data: { monthlyReportEnabled },
        select: { monthlyReportEnabled: true, monthlyReportLastSentAt: true },
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: monthlyReportEnabled
          ? 'agency.monthly_report_enabled'
          : 'agency.monthly_report_disabled',
        resourceType: 'agency',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { ip: request.ip },
      })
      return reply.send({ success: true, data: agency })
    }
  )

  return Promise.resolve()
}

export default agencyReportsRoute
