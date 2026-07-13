import { prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireOwnerAgency } from '../../auth/tenant.js'
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
    // COV-SET-1: квота відпусток (leave-accrual читає її з першого дня, UI не було)
    vacationDaysPerYear: z.number().int().min(0).max(365).optional(),
    // COV-SET-2: agency-рівень каскаду погодження витрат (company/project можуть override)
    defaultApprovalMode: z.enum(['none', 'upfront', 'on_actuals']).optional(),
    defaultInvoiceApprover: z.enum(['client', 'internal']).optional(),
  })
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'Порожній запит',
  })

const companyApprovalSchema = z
  .object({
    approvalMode: z.enum(['none', 'upfront', 'on_actuals']).nullable().optional(),
    invoiceApprover: z.enum(['client', 'internal']).nullable().optional(),
  })
  .strict()
  .refine((b) => b.approvalMode !== undefined || b.invoiceApprover !== undefined, {
    message: 'Порожній запит',
  })

function assertOwner(user: AccessClaims): string {
  return requireOwnerAgency(user, 'Воркфлоу-налаштування змінює лише власник')
}

const agencyWorkflowRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/agency/workflow-settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: {
          requireSignedContract: true,
          autoInvoiceOneTime: true,
          vacationDaysPerYear: true,
          defaultApprovalMode: true,
          defaultInvoiceApprover: true,
        },
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
          ...(body.vacationDaysPerYear !== undefined
            ? { vacationDaysPerYear: body.vacationDaysPerYear }
            : {}),
          ...(body.defaultApprovalMode !== undefined
            ? { defaultApprovalMode: body.defaultApprovalMode }
            : {}),
          ...(body.defaultInvoiceApprover !== undefined
            ? { defaultInvoiceApprover: body.defaultInvoiceApprover }
            : {}),
        },
        select: {
          requireSignedContract: true,
          autoInvoiceOneTime: true,
          vacationDaysPerYear: true,
          defaultApprovalMode: true,
          defaultInvoiceApprover: true,
        },
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

  // COV-SET-2: per-company override каскаду погодження (schema-поля existували з 02-А,
  // write-роуту не було — knob був прибитий до agency-дефолту). null = успадкувати.
  fastify.get<{ Params: { companyId: string } }>(
    '/workspace/companies/:companyId/approval',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const company = await withTenant((tx) =>
        tx.company.findFirst({
          where: { id: request.params.companyId, agencyId },
          select: { approvalMode: true, invoiceApprover: true },
        })
      )
      if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Клієнта не знайдено', 404)
      return reply.send({ success: true, data: company })
    }
  )

  fastify.patch<{ Params: { companyId: string } }>(
    '/workspace/companies/:companyId/approval',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const body = companyApprovalSchema.parse(request.body)
      const updated = await withTenant((tx) =>
        tx.company.updateMany({
          where: { id: request.params.companyId, agencyId },
          data: {
            ...(body.approvalMode !== undefined ? { approvalMode: body.approvalMode } : {}),
            ...(body.invoiceApprover !== undefined
              ? { invoiceApprover: body.invoiceApprover }
              : {}),
          },
        })
      )
      if (updated.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Клієнта не знайдено', 404)
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'company.approval_settings_updated',
        resourceType: 'company',
        resourceId: request.params.companyId,
        result: 'allowed',
        metadata: { ...body },
      })
      return reply.send({ success: true, data: body })
    }
  )

  return Promise.resolve()
}

export default agencyWorkflowRoute
