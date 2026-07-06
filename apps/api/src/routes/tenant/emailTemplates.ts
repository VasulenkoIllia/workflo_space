import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { EDITABLE_EMAIL_EVENTS } from '../../services/emailTemplates.js'

/**
 * 08-EMAIL (owner): override теми/вступу бізнес-листів, окремо uk/en. Обидва поля
 * локалі порожні = локаль без override (рядок видаляється). Auth-листи не редагуються
 * свідомо — їх нема у EDITABLE_EMAIL_EVENTS.
 */
const EDITABLE_SET = new Set(EDITABLE_EMAIL_EVENTS.map((e) => e.event))

const localeSchema = z
  .object({
    subject: z.string().trim().max(200).optional(),
    intro: z.string().trim().max(1000).optional(),
  })
  .strict()
const putSchema = z
  .object({ uk: localeSchema.optional(), en: localeSchema.optional() })
  .strict()
  .refine((b) => b.uk !== undefined || b.en !== undefined, {
    message: 'Потрібно передати хоча б одну локаль',
  })

function assertOwner(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Email-шаблони змінює лише власник', 403)
  }
  return agencyId
}

const emailTemplatesRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/agency/email-templates',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const templates = await withTenant((tx) =>
        tx.emailTemplate.findMany({
          where: { agencyId },
          select: { event: true, locale: true, subject: true, intro: true, updatedAt: true },
        })
      )
      return reply.send({
        success: true,
        data: { events: EDITABLE_EMAIL_EVENTS, templates },
      })
    }
  )

  fastify.put<{ Params: { event: string } }>(
    '/workspace/agency/email-templates/:event',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const event = request.params.event
      if (!EDITABLE_SET.has(event)) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Цей лист не редагується', 400)
      }
      const body = putSchema.parse(request.body)

      await withTenant(async (tx) => {
        for (const locale of ['uk', 'en'] as const) {
          const fields = body[locale]
          if (fields === undefined) continue
          const subject = fields.subject?.trim() || null
          const intro = fields.intro?.trim() || null
          if (!subject && !intro) {
            await tx.emailTemplate.deleteMany({ where: { agencyId, event, locale } })
          } else {
            await tx.emailTemplate.upsert({
              where: { agencyId_event_locale: { agencyId, event, locale } },
              create: { agencyId, event, locale, subject, intro, updatedById: request.user.sub },
              update: { subject, intro, updatedById: request.user.sub },
            })
          }
        }
      })

      const templates = await withTenant((tx) =>
        tx.emailTemplate.findMany({
          where: { agencyId, event },
          select: { event: true, locale: true, subject: true, intro: true, updatedAt: true },
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'agency.email_template_updated',
        resourceType: 'email_template',
        resourceId: event,
        result: 'allowed',
        metadata: { event },
      })
      return reply.send({ success: true, data: { templates } })
    }
  )

  fastify.delete<{ Params: { event: string } }>(
    '/workspace/agency/email-templates/:event',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      await withTenant((tx) =>
        tx.emailTemplate.deleteMany({ where: { agencyId, event: request.params.event } })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'agency.email_template_reset',
        resourceType: 'email_template',
        resourceId: request.params.event,
        result: 'allowed',
        metadata: {},
      })
      return reply.send({ success: true, data: { reset: true } })
    }
  )

  return Promise.resolve()
}

export default emailTemplatesRoute
