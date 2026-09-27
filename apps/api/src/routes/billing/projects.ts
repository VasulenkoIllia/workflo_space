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
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { moduleEnabled } from '../../saas/limits.js'
import { writeAuditAsync } from '../../services/audit.js'
import { currentCycleWindow } from '../../services/projectCycle.js'
import { closeProjectCycle } from '../../services/recurringCharges.js'
import { hasPermission, requirePermission } from '../../auth/permissions.js'

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
  nomenclatureId: true,
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
  approvalMode: true,
  invoiceApprover: true,
  active: true,
  createdAt: true,
  // TEAM-ADMIN-1: команда-виконавець (workspace-only; портальний select без team)
  teamId: true,
  team: { select: { id: true, name: true } },
} satisfies Prisma.ProjectSelect

type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_SELECT }>

const dec = (d: Prisma.Decimal | null) => (d ? d.toFixed(2) : null)

/** PERM-2: без `billing.view` (менеджер) — умови без сум/юр-особи/погоджувача рахунків. */
function toDto(p: ProjectRow, showMoney = true) {
  return {
    ...p,
    abonAmount: showMoney ? dec(p.abonAmount) : null,
    clientHourlyRate: showMoney ? dec(p.clientHourlyRate) : null,
    advanceGatePct: showMoney ? dec(p.advanceGatePct) : null,
    legalEntityId: showMoney ? p.legalEntityId : null,
    invoiceApprover: showMoney ? p.invoiceApprover : null,
    includedHoursCap: dec(p.includedHoursCap),
    nextCycleAt: p.nextCycleAt ? p.nextCycleAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
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
      await requirePermission(request, 'projects.view')
      const showMoney = await hasPermission(request, 'billing.view')
      await assertModule(agencyId)
      const { companyId } = request.query
      const rows = await withTenant((tx) =>
        tx.project.findMany({
          where: { agencyId, ...(companyId ? { companyId } : {}) },
          select: PROJECT_SELECT,
          orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        })
      )
      return reply.send({ success: true, data: { projects: rows.map((p) => toDto(p, showMoney)) } })
    }
  )

  // ── Detail ────────────────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/projects/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      await requirePermission(request, 'projects.view')
      const showMoney = await hasPermission(request, 'billing.view')
      await assertModule(agencyId)
      const project = await withTenant((tx) =>
        tx.project.findFirst({ where: { id: request.params.id, agencyId }, select: PROJECT_SELECT })
      )
      if (!project) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
      }
      // DSN-7 (project-360 KPI-hero): поточний цикл (години по замовленнях проєкту) і
      // відкриті замовлення — та сама логіка вікна, що в порталі (currentCycleWindow).
      const w = currentCycleWindow(project.billingCycle, project.nextCycleAt, new Date())
      const [agg, openOrders] = await withTenant((tx) =>
        Promise.all([
          tx.timeLog.aggregate({
            _sum: { hours: true },
            where: {
              order: { projectId: project.id, deletedAt: null },
              date: { gte: w.from, lt: w.to },
            },
          }),
          tx.order.count({
            where: {
              projectId: project.id,
              deletedAt: null,
              internalStatus: { notIn: ['done', 'cancelled'] },
            },
          }),
        ])
      )
      return reply.send({
        success: true,
        data: {
          project: toDto(project, showMoney),
          stats: {
            cycle: {
              from: w.from.toISOString(),
              to: w.to.toISOString(),
              hoursUsed: Math.round(Number(agg._sum.hours ?? 0) * 100) / 100,
            },
            nextCycleAt:
              project.nextCycleAt && project.billingCycle !== 'manual' ? w.to.toISOString() : null,
            openOrders,
          },
        },
      })
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
      await requirePermission(request, 'projects.manage')
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
            nomenclatureId: input.nomenclatureId ?? null,
            requiresApproval: input.requiresApproval ?? null,
            advanceGatePct: input.advanceGatePct ?? null,
            includedHoursCap: input.includedHoursCap ?? null,
            approvalMode: input.approvalMode ?? null,
            invoiceApprover: input.invoiceApprover ?? null,
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
      await requirePermission(request, 'projects.manage')
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
        // TEAM-ADMIN-1: команда мусить існувати в ЦЬОМУ тенанті
        if (input.teamId) {
          const team = await tx.team.findFirst({
            where: { id: input.teamId, agencyId },
            select: { id: true },
          })
          if (!team) throw new AppError(ApiErrorCode.NOT_FOUND, 'Команду не знайдено', 404)
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
            ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
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
            ...(input.nomenclatureId !== undefined ? { nomenclatureId: input.nomenclatureId } : {}),
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
            ...(input.approvalMode !== undefined ? { approvalMode: input.approvalMode } : {}),
            ...(input.invoiceApprover !== undefined
              ? { invoiceApprover: input.invoiceApprover }
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
      await requirePermission(request, 'projects.manage')
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
      // PERM-2: закриття циклу генерує живі нарахування → billing.manage
      await requirePermission(request, 'billing.manage')
      await assertModule(agencyId)

      // The schema regex accepts well-formed but non-existent calendar dates (e.g. 2024-02-30);
      // reject those as 400 before they reach the SQL period range as an Invalid Date.
      const periodStart = new Date(input.periodStart)
      const periodEnd = new Date(input.periodEnd)
      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Некоректна дата періоду', 400)
      }

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
          periodStart,
          periodEnd,
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

  // ── Portal: the client's read-only view of their own projects (#6) ────────────
  // Client-safe subset of the billing terms they agreed to — no internal fields
  // (legal entity, contract doc, advance gate, approver). nextCycleAt (дата продовження)
  // клієнт і так бачить у /portal/summary — DSN-5 віддає його й тут + години циклу.
  const CLIENT_PROJECT_SELECT = {
    id: true,
    name: true,
    type: true,
    billingModel: true,
    currency: true,
    abonAmount: true,
    clientHourlyRate: true,
    billingCycle: true,
    includedHoursCap: true,
    paymentTermsDays: true,
    active: true,
    createdAt: true,
    nextCycleAt: true,
  } satisfies Prisma.ProjectSelect

  fastify.get(
    '/portal/projects',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      if (!(await moduleEnabled(agencyId, 'billing'))) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Модуль білінгу вимкнено', 403)
      }
      if (!can(user, 'billing.view', { agencyId, companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до білінгу', 403)
      }
      const now = new Date()
      const { rows, cycleHours } = await withTenant(async (tx) => {
        const rows = await tx.project.findMany({
          where: { agencyId, companyId },
          orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
          select: CLIENT_PROJECT_SELECT,
        })
        // DSN-5: години ПОТОЧНОГО циклу по замовленнях проєкту (retainer hours-bar). Вікна
        // різні per-проєкт → по агрегату на проєкт; проєктів у компанії одиниці.
        const cycleHours = await Promise.all(
          rows.map(async (p) => {
            const w = currentCycleWindow(p.billingCycle, p.nextCycleAt, now)
            const agg = await tx.timeLog.aggregate({
              _sum: { hours: true },
              where: {
                order: { projectId: p.id, deletedAt: null },
                date: { gte: w.from, lt: w.to },
              },
            })
            return { window: w, hours: Number(agg._sum.hours ?? 0) }
          })
        )
        return { rows, cycleHours }
      })
      const projects = rows.map((p, i) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        billingModel: p.billingModel,
        currency: p.currency,
        abonAmount: dec(p.abonAmount),
        clientHourlyRate: dec(p.clientHourlyRate),
        billingCycle: p.billingCycle,
        includedHoursCap: dec(p.includedHoursCap),
        paymentTermsDays: p.paymentTermsDays,
        active: p.active,
        createdAt: p.createdAt.toISOString(),
        // DSN-6: клієнту — наступне продовження ПІСЛЯ «зараз»: якщо крон ще не зсунув якір,
        // сирий nextCycleAt у минулому («наступне списання 01.09» 27.09) — беремо кінець
        // поточного вікна (currentCycleWindow котить протухлий якір вперед).
        nextCycleAt:
          p.nextCycleAt && p.billingCycle !== 'manual'
            ? cycleHours[i]!.window.to.toISOString()
            : null,
        cycle: {
          from: cycleHours[i]!.window.from.toISOString(),
          to: cycleHours[i]!.window.to.toISOString(),
          hoursUsed: Math.round(cycleHours[i]!.hours * 100) / 100,
        },
      }))
      return reply.send({ success: true, data: { projects } })
    }
  )

  return Promise.resolve()
}

export default projectsRoute
