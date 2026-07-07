import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { dispatchNotification } from '../../services/notifications.js'
import { createCreditNote, refundPayment, writeOffCharge } from '../../services/reversals.js'

/**
 * 05-В: сторнування / повернення / списання (owner-only). Кожна операція атомарна
 * в tenantTransaction; клієнтські сповіщення (refund/write-off/credit-note) шлемо
 * ПІСЛЯ коміту, fire-and-forget. Внутрішній аудит — завжди.
 */
const refundSchema = z
  .object({
    amount: z.number().positive().max(99_999_999),
    reason: z.string().trim().max(500).optional(),
    method: z.string().trim().max(60).optional(),
  })
  .strict()
const writeOffSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict()
const creditNoteSchema = z
  .object({
    companyId: z.string().uuid(),
    amount: z.number().positive().max(99_999_999),
    currency: z.string().trim().length(3).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()

function assertOwner(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Операцію виконує лише власник', 403)
  }
  return agencyId
}

/** Resolve a company's member profileIds (fan-out target for client notifications). */
async function clientMemberIds(companyId: string): Promise<string[]> {
  const members = await withTenant((tx) =>
    tx.companyMember.findMany({ where: { companyId }, select: { profileId: true } })
  )
  return members.map((m) => m.profileId)
}

const reversalsRoute: FastifyPluginAsync = (fastify) => {
  // ── Повернення платежу (повне/часткове) ──────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/billing/payments/:id/refund',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const body = refundSchema.parse(request.body)
      const result = await tenantTransaction(prisma, (tx) =>
        refundPayment(tx, {
          agencyId,
          paymentId: request.params.id,
          amount: body.amount,
          reason: body.reason ?? null,
          method: body.method ?? null,
          actorId: request.user.sub,
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'billing.payment_refunded',
        resourceType: 'payment',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: {
          amount: result.amount,
          fullyRefunded: result.fullyRefunded,
          clawback: result.clawbackAmount,
        },
      })
      const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
      for (const profileId of await clientMemberIds(result.companyId)) {
        dispatchNotification(request.log, {
          profileId,
          event: 'billing.payment_refunded',
          vars: {
            amount: result.amount,
            method: body.method ?? null,
            portalUrl: `${portalUrl}/billing`,
          },
          inApp: {
            title: 'Повернення коштів',
            body: `Вам повернуто ${result.amount}${result.fullyRefunded ? ' (повністю)' : ''}`,
          },
        })
      }
      return reply.send({ success: true, data: result })
    }
  )

  // ── Списання боргу (write-off) ───────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/billing/charges/:id/write-off',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const body = writeOffSchema.parse(request.body)
      const result = await tenantTransaction(prisma, (tx) =>
        writeOffCharge(tx, {
          agencyId,
          chargeId: request.params.id,
          reason: body.reason,
          actorId: request.user.sub,
          now: new Date(),
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'billing.debt_written_off',
        resourceType: 'service_charge',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: { amount: result.amount, reason: body.reason },
      })
      const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
      for (const profileId of await clientMemberIds(result.companyId)) {
        dispatchNotification(request.log, {
          profileId,
          event: 'billing.debt_written_off',
          vars: { amount: result.amount, portalUrl: `${portalUrl}/billing` },
          inApp: { title: 'Борг списано', body: `Заборгованість ${result.amount} списано` },
        })
      }
      return reply.send({ success: true, data: result })
    }
  )

  // ── Кредит-нота (внутрішнє коригування боргу вниз) ───────────────────────
  fastify.post(
    '/workspace/billing/credit-notes',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const body = creditNoteSchema.parse(request.body)
      const result = await tenantTransaction(prisma, (tx) =>
        createCreditNote(tx, {
          agencyId,
          companyId: body.companyId,
          amount: body.amount,
          currency: body.currency ?? 'USD',
          reason: body.reason,
          actorId: request.user.sub,
          now: new Date(),
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'billing.credit_note_issued',
        resourceType: 'service_charge',
        resourceId: result.chargeId,
        result: 'allowed',
        metadata: { amount: result.amount, reason: body.reason },
      })
      const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
      for (const profileId of await clientMemberIds(body.companyId)) {
        dispatchNotification(request.log, {
          profileId,
          event: 'billing.credit_note_issued',
          vars: { amount: result.amount, portalUrl: `${portalUrl}/billing` },
          inApp: { title: 'Кредит-нота', body: `Ваш борг зменшено на ${result.amount}` },
        })
      }
      return reply.send({ success: true, data: result })
    }
  )

  return Promise.resolve()
}

export default reversalsRoute
