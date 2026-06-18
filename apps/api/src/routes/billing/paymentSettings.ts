import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, updatePaymentSettingsSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

// Internal (owner/team) view — includes the agency-wide default net terms (P-4 tier 3)
// and the declared bonus-wallet currency (P-8).
const SETTINGS_SELECT = {
  bankName: true,
  iban: true,
  accountName: true,
  cryptoUsdt: true,
  notes: true,
  invoiceCurrency: true,
  paymentTermsDays: true,
  bonusCurrency: true,
} as const

// Client view — only the «куди платити» details. The agency-wide default term is an
// internal policy knob (other clients inherit it too) and is NOT client-facing; a
// client's effective term already surfaces as each charge's dueDate.
const CLIENT_SETTINGS_SELECT = {
  bankName: true,
  iban: true,
  accountName: true,
  cryptoUsdt: true,
  notes: true,
  invoiceCurrency: true,
} as const

/**
 * Agency payment details (bank / IBAN / USDT) shown to clients on an invoice.
 *  - GET/PATCH `/workspace/settings/payment` — internal read; owner-only write.
 *  - GET `/portal/billing/payment-settings` — the client's pay-to details.
 */
const paymentSettingsRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/settings/payment',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const settings = await withTenant((tx) =>
        tx.paymentSettings.findUnique({ where: { agencyId }, select: SETTINGS_SELECT })
      )
      return reply.send({ success: true, data: { settings } })
    }
  )

  fastify.patch(
    '/workspace/settings/payment',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updatePaymentSettingsSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції може змінювати реквізити',
          403
        )
      }

      const settings = await withTenant((tx) =>
        tx.paymentSettings.upsert({
          where: { agencyId },
          create: { agencyId, ...input },
          update: input,
          select: SETTINGS_SELECT,
        })
      )

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'payment_settings.updated',
        resourceType: 'payment_settings',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { fields: Object.keys(input) },
      })

      return reply.send({ success: true, data: { settings } })
    }
  )

  fastify.get(
    '/portal/billing/payment-settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      if (!can(user, 'billing.view', { agencyId, companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до білінгу', 403)
      }
      const settings = await withTenant((tx) =>
        tx.paymentSettings.findUnique({ where: { agencyId }, select: CLIENT_SETTINGS_SELECT })
      )
      return reply.send({ success: true, data: { settings } })
    }
  )

  return Promise.resolve()
}

export default paymentSettingsRoute
