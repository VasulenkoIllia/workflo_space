import { Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, decideChargeApprovalSchema, InvoiceApprover } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { type AccessClaims, isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { refreshMoneyBalance } from '../../services/allocation.js'
import { resolveInvoiceApprover } from '../../services/approvalPolicy.js'
import { writeAuditAsync } from '../../services/audit.js'
import { enqueueOutbox } from '../../services/outbox.js'

type AuthUser = AccessClaims

interface ChargeForApproval {
  id: string
  agencyId: string
  companyId: string
  totalAmount: Prisma.Decimal | null
  amount: Prisma.Decimal
  approvalStatus: string | null
  project: { invoiceApprover: string | null } | null
  company: { invoiceApprover: string | null }
  agency: { defaultInvoiceApprover: string }
}

const CHARGE_APPROVAL_SELECT = {
  id: true,
  agencyId: true,
  companyId: true,
  totalAmount: true,
  amount: true,
  approvalStatus: true,
  project: { select: { invoiceApprover: true } },
  company: { select: { invoiceApprover: true } },
  agency: { select: { defaultInvoiceApprover: true } },
} satisfies Prisma.ServiceChargeSelect

/** The invoice approver configured for this charge (project → company → agency floor). */
function chargeApprover(c: ChargeForApproval): InvoiceApprover {
  return resolveInvoiceApprover({
    project: { invoiceApprover: c.project?.invoiceApprover as InvoiceApprover | null },
    company: { invoiceApprover: c.company.invoiceApprover as InvoiceApprover | null },
    agencyDefault: c.agency.defaultInvoiceApprover as InvoiceApprover,
  })
}

/**
 * Decide a draft on_actuals charge (P-11, PROJECTS_SPEC §8). `channel` is the route's side
 * (`internal` = workspace self-review, `client` = portal) and must match the charge's resolved
 * invoiceApprover. approve → released (counts toward moneyBalance); a counter-offer
 * (approvedAmount < billed) lowers totalAmount and records the concession; reject → held.
 */
async function decideCharge(
  request: { params: { id: string }; body: unknown; log: unknown },
  reply: { send: (b: unknown) => unknown },
  user: AuthUser,
  channel: InvoiceApprover
) {
  const input = decideChargeApprovalSchema.parse(request.body)
  const agencyId = requireActiveAgency(user)

  const charge = (await withTenant((tx) =>
    tx.serviceCharge.findFirst({
      where: { id: request.params.id, agencyId },
      select: CHARGE_APPROVAL_SELECT,
    })
  )) as ChargeForApproval | null
  if (!charge) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Нарахування не знайдено', 404)
  }
  if (charge.approvalStatus !== 'pending') {
    throw new AppError(ApiErrorCode.CONFLICT, 'Немає чернетки, що очікує погодження', 409)
  }
  // Client channel: the caller must own (or be a delegate of) THIS charge's company — scoped
  // to charge.companyId, NOT the session company, so a client can't reach another company's
  // charge in the same tenant. Internal channel was gated by isInternalTeam in the route.
  if (channel === InvoiceApprover.CLIENT) {
    const m = user.memberships.find((mm) => mm.companyId === charge.companyId)
    const ok = m != null && (m.role === 'owner' || m.permissions?.can_approve_estimates === true)
    if (!ok) {
      throw new AppError(
        ApiErrorCode.FORBIDDEN,
        'Погоджувати рахунок може лише власник або уповноважений контакт',
        403
      )
    }
  }
  // The configured approver decides the channel; the other side can't release the charge.
  if (chargeApprover(charge) !== channel) {
    throw new AppError(
      ApiErrorCode.FORBIDDEN,
      channel === InvoiceApprover.CLIENT
        ? 'Цей рахунок погоджує команда, не клієнт'
        : 'Цей рахунок погоджує клієнт',
      403
    )
  }

  const approved = input.decision === 'approve'
  const comment = input.comment?.trim() || null
  const billed = new Prisma.Decimal(charge.totalAmount ?? charge.amount)

  // Counter-offer: approve at a LOWER sum than billed; the difference is a concession.
  let finalTotal = billed
  if (approved && input.approvedAmount != null) {
    const offered = new Prisma.Decimal(input.approvedAmount)
    if (offered.greaterThan(billed)) {
      throw new AppError(
        ApiErrorCode.VALIDATION_ERROR,
        'Погоджена сума не може перевищувати виставлену',
        400
      )
    }
    finalTotal = offered
  }

  const updated = await tenantTransaction(prisma, async (tx) => {
    // Guard on pending: a concurrent decision can't be double-applied.
    const guarded = await tx.serviceCharge.updateMany({
      where: { id: charge.id, approvalStatus: 'pending' },
      data: approved
        ? {
            approvalStatus: 'approved',
            approvalDecidedAt: new Date(),
            approvalDecidedById: user.sub,
            approvalComment: comment,
            approvedAmount: input.approvedAmount != null ? finalTotal : null,
            totalAmount: finalTotal, // counter-offer lowers the owed amount; `amount` keeps the quote
          }
        : {
            approvalStatus: 'rejected',
            approvalDecidedAt: new Date(),
            approvalDecidedById: user.sub,
            approvalComment: comment,
          },
    })
    if (guarded.count === 0) {
      throw new AppError(ApiErrorCode.CONFLICT, 'Стан погодження щойно змінився', 409)
    }
    // Approval makes the charge live → refresh the money-account; rejection keeps it inert.
    if (approved) {
      await refreshMoneyBalance(tx, { agencyId, companyId: charge.companyId })
    }
    await enqueueOutbox(tx, {
      type: approved ? 'charge.approval_approved' : 'charge.approval_rejected',
      payload: {
        chargeId: charge.id,
        actorId: user.sub,
        approvedAmount: approved && input.approvedAmount != null ? finalTotal.toFixed(2) : null,
        comment,
      },
      agencyId,
    })
    return tx.serviceCharge.findUniqueOrThrow({
      where: { id: charge.id },
      select: {
        id: true,
        approvalStatus: true,
        approvalDecidedAt: true,
        approvalComment: true,
        approvedAmount: true,
        amount: true,
        totalAmount: true,
      },
    })
  })

  writeAuditAsync(request.log as Parameters<typeof writeAuditAsync>[0], {
    actorId: user.sub,
    agencyId,
    action: approved ? 'charge.approval_approved' : 'charge.approval_rejected',
    resourceType: 'service_charge',
    resourceId: charge.id,
    result: 'allowed',
    metadata: { channel, approvedAmount: input.approvedAmount ?? null, comment },
  })

  // Normalize to a string/ISO DTO (Decimals → fixed-2, Date → ISO) so the response matches the
  // wire contract the clients declare — never ship a raw Prisma payload.
  const dto = {
    id: updated.id,
    approvalStatus: updated.approvalStatus,
    approvalComment: updated.approvalComment,
    approvalDecidedAt: updated.approvalDecidedAt ? updated.approvalDecidedAt.toISOString() : null,
    approvedAmount: updated.approvedAmount ? updated.approvedAmount.toFixed(2) : null,
    amount: updated.amount.toFixed(2),
    totalAmount: updated.totalAmount ? updated.totalAmount.toFixed(2) : null,
  }
  return reply.send({ success: true, data: { charge: dto } })
}

/**
 * P-11 on_actuals charge release. Two channels share the same machine; the charge's resolved
 * invoiceApprover decides which one may act:
 *  - POST /workspace/billing/charges/:id/approval — internal team (self-review before sending).
 *  - POST /portal/charges/:id/approval — the client company owner / delegated approver.
 */
const chargeApprovalRoutes: FastifyPluginAsync = (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/workspace/billing/charges/:id/approval',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      // Releasing a draft into the live balance is a finance action (class of payment.confirm)
      // → owner/executor only; a manager is finance-blocked (MOD-4 pattern).
      if (!isInternalTeam(user) || isAgencyManager(user, requireActiveAgency(user))) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      return decideCharge(request, reply, user, InvoiceApprover.INTERNAL)
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/portal/charges/:id/approval',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      // Authz (owner/delegate of the CHARGE's company) is enforced inside decideCharge,
      // scoped to charge.companyId once the charge is loaded.
      return decideCharge(request, reply, request.user, InvoiceApprover.CLIENT)
    }
  )

  return Promise.resolve()
}

export default chargeApprovalRoutes
