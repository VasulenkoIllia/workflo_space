import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, LeadStatus } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency } from '../../auth/tenant.js'
import { type AccessClaims, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { ensureStages } from './leadStages.js'

/** ХВІСТ-4: перша відкрита стадія воронки агенції (сідить дефолти, якщо порожньо). */
async function firstOpenStageId(
  tx: Prisma.TransactionClient,
  agencyId: string
): Promise<string | null> {
  await ensureStages(tx, agencyId)
  const s = await tx.leadStage.findFirst({
    where: { agencyId, kind: 'open' },
    orderBy: { position: 'asc' },
    select: { id: true },
  })
  return s?.id ?? null
}

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
  // ХВІСТ-4: кастомна стадія воронки
  stageId: true,
  stage: { select: { id: true, name: true, kind: true, position: true } },
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  utmTerm: true,
  utmContent: true,
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
    // ХВІСТ-4: переміщення воронкою — цільова кастомна стадія
    stageId: z.string().uuid().optional(),
    estimatedValue: z.number().nonnegative().max(1_000_000_000).nullish(),
    notes: z.string().trim().max(2000).nullish(),
    assigneeId: z.string().min(1).nullish(),
    lostReason: z.string().trim().max(500).nullish(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати хоча б одне поле' })

const listQuerySchema = z.object({ status: z.nativeEnum(LeadStatus).optional() })

// 26-ТАЙМЛАЙН: fields whose edits show up as a generic «updated» activity entry
// (stage / assignee / lost-reason get their own richer entries instead).
const UPDATED_TRACKED_FIELDS = [
  'name',
  'contactName',
  'email',
  'phone',
  'source',
  'estimatedValue',
  'notes',
] as const
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
          orderBy: [
            { stage: { position: 'asc' } },
            { status: 'asc' },
            { position: 'asc' },
            { createdAt: 'desc' },
          ],
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
      const lead = await withTenant(async (tx) => {
        const stageId = await firstOpenStageId(tx, agencyId)
        const created = await tx.lead.create({
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
            // ХВІСТ-4: нові ліди стартують у першій відкритій стадії
            ...(stageId ? { stage: { connect: { id: stageId } } } : {}),
          },
          select: LEAD_SELECT,
        })
        await tx.leadActivity.create({
          data: {
            agencyId,
            leadId: created.id,
            actorId: request.user.sub,
            type: 'created',
            metadata: { via: 'manual' },
          },
        })
        return created
      })
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
          select: {
            id: true,
            name: true,
            contactName: true,
            email: true,
            phone: true,
            source: true,
            status: true,
            stageId: true,
            stage: { select: { name: true } },
            estimatedValue: true,
            notes: true,
            assigneeId: true,
          },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Лід не знайдено', 404)

        // ХВІСТ-4: переміщення воронкою — резолвимо цільову стадію; won-стадія лише через
        // конвертацію; status мірориться kind (lost→lost, open→new) для звітів/гейтів.
        let targetStageName: string | null = null
        let statusMirror: LeadStatus | undefined
        if (input.stageId !== undefined) {
          const target = await tx.leadStage.findFirst({
            where: { id: input.stageId, agencyId },
            select: { id: true, name: true, kind: true },
          })
          if (!target) throw new AppError(ApiErrorCode.NOT_FOUND, 'Стадію не знайдено', 404)
          if (target.kind === 'won') {
            throw new AppError(
              ApiErrorCode.VALIDATION_ERROR,
              'Лід стає «виграно» лише через конвертацію в замовлення',
              400
            )
          }
          targetStageName = target.name
          statusMirror = target.kind === 'lost' ? LeadStatus.LOST : LeadStatus.NEW
        }

        const updated = await tx.lead.update({
          where: { id: existing.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            ...(input.source !== undefined ? { source: input.source } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.stageId !== undefined
              ? { stageId: input.stageId, status: statusMirror }
              : {}),
            ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
            ...(input.lostReason !== undefined ? { lostReason: input.lostReason } : {}),
          },
          select: LEAD_SELECT,
        })

        // 26-ТАЙМЛАЙН: journal only real changes (the detail form re-sends every field
        // on save, so compare against the previous values, not mere key presence).
        const actor = { agencyId, leadId: existing.id, actorId: request.user.sub }
        const stageMoved = input.stageId !== undefined && input.stageId !== existing.stageId
        if (stageMoved) {
          await tx.leadActivity.create({
            data: {
              ...actor,
              type: 'stage_changed',
              metadata: {
                from: existing.stage?.name ?? existing.status,
                to: targetStageName,
                ...(statusMirror === LeadStatus.LOST && input.lostReason
                  ? { lostReason: input.lostReason }
                  : {}),
              },
            },
          })
        } else if (input.status !== undefined && (input.status as string) !== existing.status) {
          // legacy status-only зміна (без stageId)
          await tx.leadActivity.create({
            data: {
              ...actor,
              type: 'stage_changed',
              metadata: {
                from: existing.status,
                to: input.status,
                ...(input.status === LeadStatus.LOST && input.lostReason
                  ? { lostReason: input.lostReason }
                  : {}),
              },
            },
          })
        }
        if (input.assigneeId !== undefined && (input.assigneeId ?? null) !== existing.assigneeId) {
          await tx.leadActivity.create({
            data: {
              ...actor,
              type: 'assigned',
              metadata: { from: existing.assigneeId, to: input.assigneeId ?? null },
            },
          })
        }
        const changedFields = UPDATED_TRACKED_FIELDS.filter((k) => {
          if (input[k] === undefined) return false
          const prev =
            k === 'estimatedValue'
              ? existing.estimatedValue === null
                ? null
                : Number(existing.estimatedValue)
              : existing[k]
          return (input[k] ?? null) !== prev
        })
        if (changedFields.length > 0) {
          await tx.leadActivity.create({
            data: { ...actor, type: 'updated', metadata: { fields: changedFields } },
          })
        }
        return updated
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
        // ХВІСТ-4: переносимо лід у won-стадію воронки (kind='won') разом зі status.
        const wonStage = await tx.leadStage.findFirst({
          where: { agencyId, kind: 'won' },
          orderBy: { position: 'asc' },
          select: { id: true },
        })
        const updated = await tx.lead.update({
          where: { id: lead.id },
          data: {
            status: LeadStatus.WON,
            ...(wonStage ? { stageId: wonStage.id } : {}),
            companyId: company.id,
            convertedOrderId: order.id,
          },
          select: LEAD_SELECT,
        })
        await tx.leadActivity.create({
          data: {
            agencyId,
            leadId: lead.id,
            actorId: request.user.sub,
            type: 'converted',
            metadata: { orderId: order.id, companyId: company.id },
          },
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

  // ── Activity timeline (26-ТАЙМЛАЙН, append-only journal) ─────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/leads/:id/activity',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const rows = await withTenant(async (tx) => {
        const lead = await tx.lead.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true },
        })
        if (!lead) throw new AppError(ApiErrorCode.NOT_FOUND, 'Лід не знайдено', 404)
        return tx.leadActivity.findMany({
          where: { leadId: lead.id, agencyId },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: { id: true, actorId: true, type: true, metadata: true, createdAt: true },
        })
      })
      return reply.send({
        success: true,
        data: {
          activities: rows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
        },
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
