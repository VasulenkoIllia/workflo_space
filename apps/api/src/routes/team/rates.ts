import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, createExecutorRateSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

const zeroCostSchema = z.object({ zeroCostDefault: z.boolean() })

interface RateRow {
  id: string
  monthlySalary: Prisma.Decimal | null
  hourlyRate: Prisma.Decimal | null
  commissionPercent: Prisma.Decimal
  currency: string
  effectiveFrom: Date
  effectiveUntil: Date | null
  hireDate: Date | null
  zeroCostDefault: boolean
}

const RATE_SELECT = {
  id: true,
  monthlySalary: true,
  hourlyRate: true,
  commissionPercent: true,
  currency: true,
  effectiveFrom: true,
  effectiveUntil: true,
  hireDate: true,
  zeroCostDefault: true,
} satisfies Prisma.ExecutorRateSelect

function toDto(r: RateRow) {
  return {
    id: r.id,
    monthlySalary: r.monthlySalary ? r.monthlySalary.toFixed(2) : null,
    hourlyRate: r.hourlyRate ? r.hourlyRate.toFixed(2) : null,
    commissionPercent: r.commissionPercent.toString(),
    currency: r.currency,
    effectiveFrom: r.effectiveFrom,
    effectiveUntil: r.effectiveUntil,
    hireDate: r.hireDate,
    zeroCostDefault: r.zeroCostDefault,
  }
}

/** Confirm `executorId` is a member of the agency (else 404). */
async function assertAgencyMember(
  tx: Prisma.TransactionClient,
  agencyId: string,
  executorId: string
): Promise<void> {
  const member = await tx.agencyMember.findUnique({
    where: { agencyId_profileId: { agencyId, profileId: executorId } },
    select: { id: true },
  })
  if (!member) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Виконавця не знайдено в агенції', 404)
  }
}

/**
 * Executor compensation rates (S5-04). Append-only history: a POST closes the open
 * window and opens a new one (never an in-place edit), so historical P&L/payouts
 * always read the rate that was in force. Reads = internal team; writes = owner.
 */
const ratesRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/workspace/executors/:id/rates',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      // Salary history is private: the owner sees anyone's, an executor only their own.
      if (
        !isInternalTeam(user) ||
        (!isAgencyOwner(user, agencyId) && request.params.id !== user.sub)
      ) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до ставок виконавця', 403)
      }
      const rows = await withTenant(async (tx) => {
        await assertAgencyMember(tx, agencyId, request.params.id)
        return tx.executorRate.findMany({
          where: { agencyId, executorId: request.params.id },
          select: RATE_SELECT,
          orderBy: { effectiveFrom: 'desc' },
        })
      })
      return reply.send({ success: true, data: { rates: rows.map(toDto) } })
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/workspace/executors/:id/rates',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = createExecutorRateSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції може змінювати ставки',
          403
        )
      }
      const executorId = request.params.id
      const now = new Date()

      const rate = await tenantTransaction(prisma, async (tx) => {
        await assertAgencyMember(tx, agencyId, executorId)
        // Serialize window close/create per executor: a concurrent rates-POST and
        // zero-cost-PATCH would otherwise BOTH read the same open window and leave
        // TWO open ones (verified live) — same advisory-lock pattern as timer/leads.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rates:${agencyId}:${executorId}`}))`
        // Carry the zero-cost flag across salary changes — a new window must not
        // silently reset «без собівартості» (22/P-5) set via the zero-cost toggle.
        const open = await tx.executorRate.findFirst({
          where: { agencyId, executorId, effectiveUntil: null },
          select: { zeroCostDefault: true },
        })
        // Close the currently-open window so the history stays non-overlapping.
        await tx.executorRate.updateMany({
          where: { agencyId, executorId, effectiveUntil: null },
          data: { effectiveUntil: now },
        })
        const created = await tx.executorRate.create({
          data: {
            agencyId,
            executorId,
            monthlySalary: input.monthlySalary ?? null,
            hourlyRate: input.hourlyRate ?? null,
            commissionPercent: input.commissionPercent ?? 0,
            currency: input.currency ?? 'USD',
            effectiveFrom: now,
            hireDate: input.hireDate ? new Date(input.hireDate) : null,
            zeroCostDefault: open?.zeroCostDefault ?? false,
          },
          select: RATE_SELECT,
        })
        // hireDate — стаж для leave-accrual читається з AgencyMember.hireDate (S13-04),
        // а форма ставки задає його тут. Дзеркалимо на member, інакше нарахування
        // відпустки й далі падало б на createdAt (поле на ExecutorRate ніхто не читав).
        if (input.hireDate) {
          await tx.agencyMember.update({
            where: { agencyId_profileId: { agencyId, profileId: executorId } },
            data: { hireDate: new Date(input.hireDate) },
          })
        }
        return created
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'executor.rate_set',
        resourceType: 'executor_rate',
        resourceId: rate.id,
        result: 'allowed',
        metadata: { executorId, monthlySalary: input.monthlySalary ?? null },
      })

      return reply.status(201).send({ success: true, data: { rate: toDto(rate) } })
    }
  )

  // ── «Без собівартості» (22/P-5, tier-3 каскад rateResolution) ────────────────
  // Flips ExecutorRate.zeroCostDefault by closing the open window and opening a new
  // one that carries the compensation values over. An in-place edit would rewrite
  // the cost attribution of the already-elapsed part of the window — the same
  // append-only invariant the POST above protects.
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/executors/:id/zero-cost',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = zeroCostSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції може змінювати ставки',
          403
        )
      }
      const executorId = request.params.id
      const now = new Date()

      const rate = await tenantTransaction(prisma, async (tx) => {
        await assertAgencyMember(tx, agencyId, executorId)
        // Same lock as POST /rates — see the comment there (two open windows race).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rates:${agencyId}:${executorId}`}))`
        const open = await tx.executorRate.findFirst({
          where: { agencyId, executorId, effectiveUntil: null },
          select: RATE_SELECT,
        })
        // No-op when the flag already matches — don't churn rate windows.
        if (open && open.zeroCostDefault === input.zeroCostDefault) return open
        await tx.executorRate.updateMany({
          where: { agencyId, executorId, effectiveUntil: null },
          data: { effectiveUntil: now },
        })
        return tx.executorRate.create({
          data: {
            agencyId,
            executorId,
            monthlySalary: open?.monthlySalary ?? null,
            hourlyRate: open?.hourlyRate ?? null,
            commissionPercent: open?.commissionPercent ?? 0,
            currency: open?.currency ?? 'USD',
            hireDate: open?.hireDate ?? null,
            effectiveFrom: now,
            zeroCostDefault: input.zeroCostDefault,
          },
          select: RATE_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'executor.zero_cost_set',
        resourceType: 'executor_rate',
        resourceId: rate.id,
        result: 'allowed',
        metadata: { executorId, zeroCostDefault: input.zeroCostDefault },
      })

      return reply.send({ success: true, data: { rate: toDto(rate) } })
    }
  )

  return Promise.resolve()
}

export default ratesRoute
