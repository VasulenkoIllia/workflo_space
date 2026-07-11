import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency } from '../../auth/tenant.js'
import { agencyRole, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { dispatchNotification } from '../../services/notifications.js'

/**
 * S13-04/05 LEAVE: відсутності команди (дизайн calendar-plus WsLeaves).
 * Self-service: будь-який internal-член подає заявку (vacation/sick/dayoff/unpaid);
 * owner/manager погоджують. Перше self-vs-others правило команди: executor діє
 * лише над власними заявками; approve ВЛАСНОЇ заявки може тільки owner.
 *
 * Баланс відпустки (S13-05) — обчислюваний, без таблиці/крону:
 *   accrued = Agency.vacationDaysPerYear × повні місяці стажу в поточному році / 12
 *   (стаж від AgencyMember.hireDate, фолбек createdAt; округлення до 0.5 вниз),
 *   used = Σ days approved vacation-заявок з початком у поточному році.
 * Guard на approve: vacation понад баланс → 409. Квотується ЛИШЕ vacation.
 * Свята per-agency (23-Б) і календар-шар — задокументовані follow-ups.
 */

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат дати — YYYY-MM-DD')
  .transform((s) => new Date(`${s}T00:00:00.000Z`))

const createSchema = z
  .object({
    type: z.enum(['vacation', 'sick', 'dayoff', 'unpaid']).default('vacation'),
    startDate: dateOnly,
    endDate: dateOnly,
    reason: z.string().trim().max(500).optional(),
  })
  .strict()

const rejectSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict()

const LEAVE_SELECT = {
  id: true,
  profileId: true,
  profile: { select: { name: true } },
  type: true,
  startDate: true,
  endDate: true,
  days: true,
  status: true,
  reason: true,
  rejectReason: true,
  reviewedById: true,
  reviewedBy: { select: { name: true } },
  reviewedAt: true,
  createdAt: true,
} as const

/** Робочі дні (пн–пт) включно з обома кінцями. Свята — 23-Б follow-up. */
export function workdaysBetween(start: Date, end: Date): number {
  let count = 0
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const dow = new Date(t).getUTCDay()
    if (dow !== 0 && dow !== 6) count += 1
  }
  return count
}

/** Повні місяці між двома датами (day-of-month має настати). */
function fullMonthsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
  if (to.getUTCDate() < from.getUTCDate()) months -= 1
  return Math.max(0, months)
}

interface LeaveBalance {
  perYear: number
  accruedDays: number
  usedDays: number
  pendingDays: number
  balanceDays: number
  hireDate: string
}

/** S13-05: обчислюваний баланс vacation за поточний рік (period: startDate-рік). */
async function computeBalance(
  agencyId: string,
  profileId: string,
  now: Date
): Promise<LeaveBalance | null> {
  return withTenant(async (tx) => {
    const [member, agency] = await Promise.all([
      tx.agencyMember.findUnique({
        where: { agencyId_profileId: { agencyId, profileId } },
        select: { hireDate: true, createdAt: true },
      }),
      tx.agency.findUnique({ where: { id: agencyId }, select: { vacationDaysPerYear: true } }),
    ])
    if (!member || !agency) return null
    const hire = member.hireDate ?? member.createdAt
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    const accrualFrom = hire.getTime() > yearStart.getTime() ? hire : yearStart
    const months = Math.min(12, fullMonthsBetween(accrualFrom, now))
    // округлення вниз до 0.5 — передбачувано і на користь агенції
    const accrued = Math.floor(((agency.vacationDaysPerYear * months) / 12) * 2) / 2

    const yearEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1))
    const requests = await tx.leaveRequest.findMany({
      where: {
        agencyId,
        profileId,
        type: 'vacation',
        status: { in: ['approved', 'pending'] },
        startDate: { gte: yearStart, lt: yearEnd },
      },
      select: { days: true, status: true },
    })
    let used = 0
    let pending = 0
    for (const r of requests) {
      if (r.status === 'approved') used += r.days
      else pending += r.days
    }
    return {
      perYear: agency.vacationDaysPerYear,
      accruedDays: accrued,
      usedDays: used,
      pendingDays: pending,
      balanceDays: accrued - used,
      hireDate: hire.toISOString().slice(0, 10),
    }
  })
}

/** owner/manager вирішують заявки (MOD-4: team-mgmt менеджеру дозволений). */
function isReviewer(role: string | null): boolean {
  return role === 'owner' || role === 'manager'
}

const leaveRoute: FastifyPluginAsync = (fastify) => {
  // ── Подати заявку (self, будь-який internal-член) ────────────────────────────
  fastify.post(
    '/workspace/leave',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const input = createSchema.parse(request.body)
      if (input.endDate.getTime() < input.startDate.getTime()) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Кінець раніше за початок', 400)
      }
      if (input.endDate.getTime() - input.startDate.getTime() > 366 * 86_400_000) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Період понад рік', 400)
      }
      const days = workdaysBetween(input.startDate, input.endDate)
      if (days === 0) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Період не містить робочих днів', 400)
      }

      const leave = await tenantTransaction(prisma, async (tx) => {
        // Перетин з моїми живими заявками (pending/approved) → 409
        const overlap = await tx.leaveRequest.findFirst({
          where: {
            agencyId,
            profileId: user.sub,
            status: { in: ['pending', 'approved'] },
            startDate: { lte: input.endDate },
            endDate: { gte: input.startDate },
          },
          select: { id: true, startDate: true, endDate: true },
        })
        if (overlap) {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Період перетинається з уже поданою заявкою',
            409
          )
        }
        return tx.leaveRequest.create({
          data: {
            agencyId,
            profileId: user.sub,
            type: input.type,
            startDate: input.startDate,
            endDate: input.endDate,
            days,
            reason: input.reason ?? null,
          },
          select: LEAVE_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'leave.requested',
        resourceType: 'leave_request',
        resourceId: leave.id,
        result: 'allowed',
        metadata: { type: leave.type, days, from: input.startDate, to: input.endDate },
      })
      // owner-и та менеджери (крім самого заявника) отримують in-app
      const reviewers = await withTenant((tx) =>
        tx.agencyMember.findMany({
          where: { agencyId, role: { in: ['owner', 'manager'] }, profileId: { not: user.sub } },
          select: { profileId: true },
        })
      )
      for (const r of reviewers) {
        dispatchNotification(request.log, {
          profileId: r.profileId,
          event: 'team.leave_requested',
          vars: { name: leave.profile.name, days: String(days) },
          inApp: {
            title: 'Нова заявка на відсутність',
            body: `${leave.profile.name}: ${leave.type}, ${days} роб. дн. — на погодження.`,
          },
        })
      }
      return reply.status(201).send({ success: true, data: { leave } })
    }
  )

  // ── Список: executor — свої; owner/manager — всі (+фільтри) ──────────────────
  fastify.get<{ Querystring: { status?: string; profileId?: string } }>(
    '/workspace/leave',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const role = agencyRole(user, agencyId)
      const reviewer = isReviewer(role)
      const profileId = reviewer ? request.query.profileId : user.sub
      const status = request.query.status
      const leaves = await withTenant((tx) =>
        tx.leaveRequest.findMany({
          where: {
            agencyId,
            ...(profileId ? { profileId } : {}),
            ...(status ? { status: status as never } : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: LEAVE_SELECT,
          take: 200,
        })
      )
      return reply.send({ success: true, data: { leaves, canReview: reviewer } })
    }
  )

  // ── Баланс відпустки (self; owner/manager — будь-чий) ────────────────────────
  fastify.get<{ Querystring: { profileId?: string } }>(
    '/workspace/leave/balance',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const role = agencyRole(user, agencyId)
      const target = request.query.profileId ?? user.sub
      if (target !== user.sub && !isReviewer(role)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Чужий баланс — лише owner/manager', 403)
      }
      const balance = await computeBalance(agencyId, target, new Date())
      if (!balance) throw new AppError(ApiErrorCode.NOT_FOUND, 'Члена команди не знайдено', 404)
      return reply.send({ success: true, data: { balance } })
    }
  )

  // ── Approve (owner/manager; власну — лише owner; vacation — балансовий guard) ─
  fastify.post<{ Params: { id: string } }>(
    '/workspace/leave/:id/approve',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const role = agencyRole(user, agencyId)
      if (!isReviewer(role)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Погоджують owner або менеджер', 403)
      }
      const now = new Date()
      const leave = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.leaveRequest.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true, profileId: true, type: true, days: true, status: true },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Заявку не знайдено', 404)
        // self-approve: менеджер не погоджує власну заявку (owner — може)
        if (existing.profileId === user.sub && role !== 'owner') {
          throw new AppError(ApiErrorCode.FORBIDDEN, 'Власну заявку погоджує owner', 403)
        }
        if (existing.type === 'vacation') {
          const balance = await computeBalance(agencyId, existing.profileId, now)
          if (balance && existing.days > balance.balanceDays) {
            throw new AppError(
              ApiErrorCode.CONFLICT,
              `Понад баланс відпустки: заявка ${existing.days} дн., доступно ${balance.balanceDays}`,
              409
            )
          }
        }
        // Атомарний claim pending→approved: двоє рев'юерів — рівно один виграє
        const claim = await tx.leaveRequest.updateMany({
          where: { id: existing.id, status: 'pending' },
          data: { status: 'approved', reviewedById: user.sub, reviewedAt: now },
        })
        if (claim.count === 0) {
          throw new AppError(ApiErrorCode.CONFLICT, 'Заявка вже розглянута', 409)
        }
        return tx.leaveRequest.findFirstOrThrow({
          where: { id: existing.id },
          select: LEAVE_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'leave.approved',
        resourceType: 'leave_request',
        resourceId: leave.id,
        result: 'allowed',
        metadata: { profileId: leave.profileId, days: leave.days, type: leave.type },
      })
      dispatchNotification(request.log, {
        profileId: leave.profileId,
        event: 'team.leave_status_changed',
        vars: { status: 'approved' },
        inApp: {
          title: 'Відсутність погоджено',
          body: `Заявку (${leave.days} роб. дн.) погоджено.`,
        },
      })
      return reply.send({ success: true, data: { leave } })
    }
  )

  // ── Reject (owner/manager, з причиною) ────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/leave/:id/reject',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const role = agencyRole(user, agencyId)
      if (!isReviewer(role)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Погоджують owner або менеджер', 403)
      }
      const { reason } = rejectSchema.parse(request.body)
      const now = new Date()
      const leave = await tenantTransaction(prisma, async (tx) => {
        const claim = await tx.leaveRequest.updateMany({
          where: { id: request.params.id, agencyId, status: 'pending' },
          data: {
            status: 'rejected',
            rejectReason: reason,
            reviewedById: user.sub,
            reviewedAt: now,
          },
        })
        if (claim.count === 0) {
          const exists = await tx.leaveRequest.findFirst({
            where: { id: request.params.id, agencyId },
            select: { id: true },
          })
          if (!exists) throw new AppError(ApiErrorCode.NOT_FOUND, 'Заявку не знайдено', 404)
          throw new AppError(ApiErrorCode.CONFLICT, 'Заявка вже розглянута', 409)
        }
        return tx.leaveRequest.findFirstOrThrow({
          where: { id: request.params.id },
          select: LEAVE_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'leave.rejected',
        resourceType: 'leave_request',
        resourceId: leave.id,
        result: 'allowed',
        metadata: { profileId: leave.profileId, reason },
      })
      dispatchNotification(request.log, {
        profileId: leave.profileId,
        event: 'team.leave_status_changed',
        vars: { status: 'rejected' },
        inApp: { title: 'Відсутність відхилено', body: `Причина: ${reason}` },
      })
      return reply.send({ success: true, data: { leave } })
    }
  )

  // ── Cancel (автор, поки pending) ──────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/leave/:id/cancel',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const claim = await withTenant((tx) =>
        tx.leaveRequest.updateMany({
          where: { id: request.params.id, agencyId, profileId: user.sub, status: 'pending' },
          data: { status: 'cancelled' },
        })
      )
      if (claim.count === 0) {
        throw new AppError(
          ApiErrorCode.NOT_FOUND,
          'Заявку не знайдено або вона вже розглянута',
          404
        )
      }
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'leave.cancelled',
        resourceType: 'leave_request',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { cancelled: true } })
    }
  )

  return Promise.resolve()
}

export default leaveRoute
