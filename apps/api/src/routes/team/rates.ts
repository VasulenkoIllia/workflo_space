import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, createExecutorRateSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

interface RateRow {
  id: string
  monthlySalary: Prisma.Decimal | null
  commissionPercent: Prisma.Decimal
  currency: string
  effectiveFrom: Date
  effectiveUntil: Date | null
  hireDate: Date | null
}

const RATE_SELECT = {
  id: true,
  monthlySalary: true,
  commissionPercent: true,
  currency: true,
  effectiveFrom: true,
  effectiveUntil: true,
  hireDate: true,
} satisfies Prisma.ExecutorRateSelect

function toDto(r: RateRow) {
  return {
    id: r.id,
    monthlySalary: r.monthlySalary ? r.monthlySalary.toFixed(2) : null,
    commissionPercent: r.commissionPercent.toString(),
    currency: r.currency,
    effectiveFrom: r.effectiveFrom,
    effectiveUntil: r.effectiveUntil,
    hireDate: r.hireDate,
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
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
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
        // Close the currently-open window so the history stays non-overlapping.
        await tx.executorRate.updateMany({
          where: { agencyId, executorId, effectiveUntil: null },
          data: { effectiveUntil: now },
        })
        return tx.executorRate.create({
          data: {
            agencyId,
            executorId,
            monthlySalary: input.monthlySalary ?? null,
            commissionPercent: input.commissionPercent ?? 0,
            currency: input.currency ?? 'USD',
            effectiveFrom: now,
            hireDate: input.hireDate ? new Date(input.hireDate) : null,
          },
          select: RATE_SELECT,
        })
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

  return Promise.resolve()
}

export default ratesRoute
