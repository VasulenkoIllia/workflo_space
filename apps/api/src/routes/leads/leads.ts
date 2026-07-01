import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, LeadStatus } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency } from '../../auth/tenant.js'
import { type AccessClaims, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * Leads / CRM pipeline (module 26). Tenant-scoped (RLS via agencyId), internal-team only
 * (sales surface — not finance-gated, so managers pass too). Fixed-stage pipeline
 * (LeadStatus). Convert turns a won lead into a client Order, linking both sides.
 */

const LEAD_SELECT = {
  id: true,
  name: true,
  contactName: true,
  email: true,
  phone: true,
  source: true,
  status: true,
  estimatedValue: true,
  currency: true,
  notes: true,
  assigneeId: true,
  companyId: true,
  convertedOrderId: true,
  lostReason: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} as const

type LeadRow = Prisma.LeadGetPayload<{ select: typeof LEAD_SELECT }>

function toDto(l: LeadRow) {
  return {
    ...l,
    estimatedValue: l.estimatedValue ? l.estimatedValue.toFixed(2) : null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).nullish(),
  email: z.string().trim().email().max(200).nullish(),
  phone: z.string().trim().max(50).nullish(),
  source: z.string().trim().max(60).nullish(),
  estimatedValue: z.number().nonnegative().max(1_000_000_000).nullish(),
  currency: z.string().trim().length(3).optional(),
  notes: z.string().trim().max(2000).nullish(),
  assigneeId: z.string().min(1).nullish(),
})

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    contactName: z.string().trim().max(200).nullish(),
    email: z.string().trim().email().max(200).nullish(),
    phone: z.string().trim().max(50).nullish(),
    source: z.string().trim().max(60).nullish(),
    status: z.nativeEnum(LeadStatus).optional(),
    estimatedValue: z.number().nonnegative().max(1_000_000_000).nullish(),
    notes: z.string().trim().max(2000).nullish(),
    assigneeId: z.string().min(1).nullish(),
    lostReason: z.string().trim().max(500).nullish(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати хоча б одне поле' })

const listQuerySchema = z.object({ status: z.nativeEnum(LeadStatus).optional() })
const convertSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
})

function assertTeam(user: Pick<AccessClaims, 'agencyMemberships' | 'activeAgencyId'>): string {
  const agencyId = requireActiveAgency(user)
  if (!isInternalTeam(user)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
  }
  return agencyId
}

const leadsRoute: FastifyPluginAsync = (fastify) => {
  // ── Board: all agency leads (optional status filter) ──────────────────────────
  fastify.get(
    '/workspace/leads',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const q = listQuerySchema.parse(request.query)
      const rows = await withTenant((tx) =>
        tx.lead.findMany({
          where: { agencyId, ...(q.status ? { status: q.status } : {}) },
          orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
          select: LEAD_SELECT,
        })
      )
      return reply.send({ success: true, data: { leads: rows.map(toDto) } })
    }
  )

  // ── Detail (single lead) ──────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/leads/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const lead = await withTenant((tx) =>
        tx.lead.findFirst({ where: { id: request.params.id, agencyId }, select: LEAD_SELECT })
      )
      if (!lead) throw new AppError(ApiErrorCode.NOT_FOUND, 'Лід не знайдено', 404)
      return reply.send({ success: true, data: { lead: toDto(lead) } })
    }
  )

  // ── Create ────────────────────────────────────────────────────────────────────
  fastify.post(
    '/workspace/leads',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const input = createSchema.parse(request.body)
      const lead = await withTenant((tx) =>
        tx.lead.create({
          data: {
            agency: { connect: { id: agencyId } },
            name: input.name,
            contactName: input.contactName ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            source: input.source ?? null,
            estimatedValue: input.estimatedValue ?? null,
            currency: input.currency ?? 'USD',
            notes: input.notes ?? null,
            assigneeId: input.assigneeId ?? null,
          },
          select: LEAD_SELECT,
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'lead.created',
        resourceType: 'lead',
        resourceId: lead.id,
        result: 'allowed',
        metadata: { name: lead.name },
      })
      return reply.status(201).send({ success: true, data: { lead: toDto(lead) } })
    }
  )

  // ── Update (fields / stage / assignee / lost-reason) ──────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/leads/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const input = updateSchema.parse(request.body)
      // «won» is an outcome of conversion (which creates the linked Order), never a free stage
      // move — otherwise a drag-to-won leaves status=won with no order/company (audit HIGH).
      if (input.status === LeadStatus.WON) {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Лід стає «виграно» лише через конвертацію в замовлення',
          400
        )
      }
      const lead = await withTenant(async (tx) => {
        const existing = await tx.lead.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Лід не знайдено', 404)
        return tx.lead.update({
          where: { id: existing.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            ...(input.source !== undefined ? { source: input.source } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
            ...(input.lostReason !== undefined ? { lostReason: input.lostReason } : {}),
          },
          select: LEAD_SELECT,
        })
      })
      return reply.send({ success: true, data: { lead: toDto(lead) } })
    }
  )

  // ── Convert a lead → client Order (links both sides; idempotent guard) ────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/leads/:id/convert',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const input = convertSchema.parse(request.body)
      const result = await tenantTransaction(prisma, async (tx) => {
        // Serialize concurrent converts of the same lead (double-click / retry) so the
        // idempotency check can't be raced into two orphaned Orders (audit MEDIUM).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`lead:${request.params.id}`}))`
        const lead = await tx.lead.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true, name: true, convertedOrderId: true },
        })
        if (!lead) throw new AppError(ApiErrorCode.NOT_FOUND, 'Лід не знайдено', 404)
        if (lead.convertedOrderId) {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Лід вже конвертовано', 409)
        }
        const company = await tx.company.findFirst({
          where: { id: input.companyId, agencyId },
          select: { id: true },
        })
        if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)

        const order = await tx.order.create({
          data: {
            agency: { connect: { id: agencyId } },
            company: { connect: { id: company.id } },
            createdBy: { connect: { id: request.user.sub } },
            title: input.title ?? lead.name,
          },
          select: { id: true },
        })
        const updated = await tx.lead.update({
          where: { id: lead.id },
          data: { status: LeadStatus.WON, companyId: company.id, convertedOrderId: order.id },
          select: LEAD_SELECT,
        })
        return { lead: updated, orderId: order.id }
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'lead.converted',
        resourceType: 'lead',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: { orderId: result.orderId, companyId: input.companyId },
      })
      return reply.send({
        success: true,
        data: { lead: toDto(result.lead), orderId: result.orderId },
      })
    }
  )

  // ── Delete ──────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/leads/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const res = await withTenant((tx) =>
        tx.lead.deleteMany({ where: { id: request.params.id, agencyId } })
      )
      if (res.count === 0) throw new AppError(ApiErrorCode.NOT_FOUND, 'Лід не знайдено', 404)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'lead.deleted',
        resourceType: 'lead',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  return Promise.resolve()
}

export default leadsRoute
