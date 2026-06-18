import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  ProjectBillingCycle,
  closeCycleSchema,
  createProjectSchema,
  defaultContractRequired,
  updateProjectSchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { type AccessClaims, isInternalTeam } from '../../auth/tokens.js'
import { moduleEnabled } from '../../saas/limits.js'
import { writeAuditAsync } from '../../services/audit.js'
import { closeProjectCycle } from '../../services/recurringCharges.js'

/**
 * Financial projects CRUD (05-ПРОЕКТИ, S5.6 P-1). Workspace-only, tenant-scoped,
 * gated by `moduleEnabled('billing')` (MOD-2). The project is the per-client
 * financial container (billing model/cycle/currency/rates); billing/charge wiring
 * lands in P-1 3b + P-2.
 */

const PROJECT_SELECT = {
  id: true,
  companyId: true,
  name: true,
  type: true,
  billingModel: true,
  currency: true,
  abonAmount: true,
  clientHourlyRate: true,
  billingCycle: true,
  cycleDay: true,
  cycleWeekday: true,
  nextCycleAt: true,
  paymentTermsDays: true,
  legalEntityId: true,
  contractRequired: true,
  contractDocumentId: true,
  requiresApproval: true,
  advanceGatePct: true,
  includedHoursCap: true,
  active: true,
  createdAt: true,
} satisfies Prisma.ProjectSelect

type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_SELECT }>

const dec = (d: Prisma.Decimal | null) => (d ? d.toFixed(2) : null)

function toDto(p: ProjectRow) {
  return {
    ...p,
    abonAmount: dec(p.abonAmount),
    clientHourlyRate: dec(p.clientHourlyRate),
    advanceGatePct: dec(p.advanceGatePct),
    includedHoursCap: dec(p.includedHoursCap),
    nextCycleAt: p.nextCycleAt ? p.nextCycleAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  }
}

function assertInternal(user: Pick<AccessClaims, 'agencyMemberships'>): void {
  if (!isInternalTeam(user)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
  }
}

async function assertModule(agencyId: string): Promise<void> {
  if (!(await moduleEnabled(agencyId, 'billing'))) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Модуль білінгу вимкнено', 403)
  }
}

/** `monthly_day_n` always needs an anchor day — default to the 1st when omitted. */
function resolveCycleDay(
  cycle: ProjectBillingCycle,
  cycleDay: number | null | undefined
): number | null {
  if (cycle === ProjectBillingCycle.MONTHLY_DAY_N) return cycleDay ?? 1
  return cycleDay ?? null
}

const projectsRoute: FastifyPluginAsync = (fastify) => {
  // ── List (optionally by company) ──────────────────────────────────────────
  fastify.get<{ Querystring: { companyId?: string } }>(
    '/workspace/projects',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)
      await assertModule(agencyId)
      const { companyId } = request.query
      const rows = await withTenant((tx) =>
        tx.project.findMany({
          where: { agencyId, ...(companyId ? { companyId } : {}) },
          select: PROJECT_SELECT,
          orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        })
      )
      return reply.send({ success: true, data: { projects: rows.map(toDto) } })
    }
  )

  // ── Detail ────────────────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/projects/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)
      await assertModule(agencyId)
      const project = await withTenant((tx) =>
        tx.project.findFirst({ where: { id: request.params.id, agencyId }, select: PROJECT_SELECT })
      )
      if (!project) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
      }
      return reply.send({ success: true, data: { project: toDto(project) } })
    }
  )

  // ── Create ────────────────────────────────────────────────────────────────
  fastify.post(
    '/workspace/projects',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = createProjectSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)
      await assertModule(agencyId)

      const project = await withTenant(async (tx) => {
        const company = await tx.company.findUnique({
          where: { id: input.companyId },
          select: { id: true, agencyId: true },
        })
        if (!company || company.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        }
        if (input.legalEntityId) {
          const le = await tx.legalEntity.findUnique({
            where: { id: input.legalEntityId },
            select: { agencyId: true },
          })
          if (!le || le.agencyId !== agencyId) {
            throw new AppError(ApiErrorCode.NOT_FOUND, 'Юр-особу не знайдено', 404)
          }
        }
        return tx.project.create({
          data: {
            agencyId,
            companyId: input.companyId,
            name: input.name,
            type: input.type ?? null,
            billingModel: input.billingModel,
            currency: input.currency,
            abonAmount: input.abonAmount ?? null,
            clientHourlyRate: input.clientHourlyRate ?? null,
            billingCycle: input.billingCycle,
            cycleDay: resolveCycleDay(input.billingCycle, input.cycleDay),
            cycleWeekday: input.cycleWeekday ?? null,
            paymentTermsDays: input.paymentTermsDays ?? null,
            legalEntityId: input.legalEntityId ?? null,
            // §5: default by billing model unless explicitly set.
            contractRequired: input.contractRequired ?? defaultContractRequired(input.billingModel),
            requiresApproval: input.requiresApproval ?? null,
            advanceGatePct: input.advanceGatePct ?? null,
            includedHoursCap: input.includedHoursCap ?? null,
          },
          select: PROJECT_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'project.created',
        resourceType: 'project',
        resourceId: project.id,
        result: 'allowed',
        metadata: { name: project.name, billingModel: project.billingModel },
      })
      return reply.status(201).send({ success: true, data: { project: toDto(project) } })
    }
  )

  // ── Update ────────────────────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/projects/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateProjectSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)
      await assertModule(agencyId)

      const project = await withTenant(async (tx) => {
        const existing = await tx.project.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, companyId: true, billingCycle: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
        }
        if (input.legalEntityId) {
          const le = await tx.legalEntity.findUnique({
            where: { id: input.legalEntityId },
            select: { agencyId: true },
          })
          if (!le || le.agencyId !== agencyId) {
            throw new AppError(ApiErrorCode.NOT_FOUND, 'Юр-особу не знайдено', 404)
          }
        }
        // П3 (P-7): linking a contract must reference a real `contract` Document of THIS
        // tenant + company — otherwise any UUID would unblock the charge gate.
        if (input.contractDocumentId) {
          const doc = await tx.document.findUnique({
            where: { id: input.contractDocumentId },
            select: { agencyId: true, companyId: true, type: true },
          })
          if (!doc || doc.agencyId !== agencyId || doc.companyId !== existing.companyId) {
            throw new AppError(ApiErrorCode.NOT_FOUND, 'Договір не знайдено', 404)
          }
          if (doc.type !== 'contract') {
            throw new AppError(ApiErrorCode.CONFLICT, 'Документ не є договором', 409)
          }
        }
        const nextCycle = (input.billingCycle ?? existing.billingCycle) as ProjectBillingCycle
        return tx.project.update({
          where: { id: existing.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.currency !== undefined ? { currency: input.currency } : {}),
            ...(input.abonAmount !== undefined ? { abonAmount: input.abonAmount } : {}),
            ...(input.clientHourlyRate !== undefined
              ? { clientHourlyRate: input.clientHourlyRate }
              : {}),
            ...(input.billingCycle !== undefined ? { billingCycle: input.billingCycle } : {}),
            ...(input.cycleDay !== undefined
              ? { cycleDay: resolveCycleDay(nextCycle, input.cycleDay) }
              : {}),
            ...(input.cycleWeekday !== undefined ? { cycleWeekday: input.cycleWeekday } : {}),
            ...(input.paymentTermsDays !== undefined
              ? { paymentTermsDays: input.paymentTermsDays }
              : {}),
            ...(input.legalEntityId !== undefined ? { legalEntityId: input.legalEntityId } : {}),
            ...(input.contractRequired !== undefined
              ? { contractRequired: input.contractRequired }
              : {}),
            ...(input.contractDocumentId !== undefined
              ? { contractDocumentId: input.contractDocumentId }
              : {}),
            ...(input.requiresApproval !== undefined
              ? { requiresApproval: input.requiresApproval }
              : {}),
            ...(input.advanceGatePct !== undefined ? { advanceGatePct: input.advanceGatePct } : {}),
            ...(input.includedHoursCap !== undefined
              ? { includedHoursCap: input.includedHoursCap }
              : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          },
          select: PROJECT_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'project.updated',
        resourceType: 'project',
        resourceId: project.id,
        result: 'allowed',
        metadata: { fields: Object.keys(input) },
      })
      return reply.send({ success: true, data: { project: toDto(project) } })
    }
  )

  // ── Delete ────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/projects/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)
      await assertModule(agencyId)

      await withTenant(async (tx) => {
        const existing = await tx.project.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
        }
        // Refuse to silently unlink orders (FK is SET NULL) — detach them first.
        const orders = await tx.order.count({ where: { projectId: existing.id } })
        if (orders > 0) {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Не можна видалити проєкт із привʼязаними замовленнями',
            409
          )
        }
        await tx.project.delete({ where: { id: existing.id } })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'project.deleted',
        resourceType: 'project',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { deleted: true } })
    }
  )

  // ── Manual cycle close (P-2c, manual billingCycle) ──────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/projects/:id/close-cycle',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = closeCycleSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user)
      await assertModule(agencyId)

      const result = await tenantTransaction(prisma, async (tx) => {
        const project = await tx.project.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true, billingCycle: true, active: true },
        })
        if (!project) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
        }
        if (project.billingCycle !== 'manual') {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Ручне закриття доступне лише для проєктів із циклом «вручну»',
            409
          )
        }
        return closeProjectCycle(tx, {
          agencyId,
          projectId: project.id,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'project.cycle_closed',
        resourceType: 'project',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: { ...input, created: result.created },
      })
      return reply.send({ success: true, data: result })
    }
  )

  return Promise.resolve()
}

export default projectsRoute
