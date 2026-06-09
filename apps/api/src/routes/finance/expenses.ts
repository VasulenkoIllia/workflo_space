import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, createExpenseSchema, updateExpenseSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'

interface ExpenseRow {
  id: string
  type: string
  category: string
  source: string
  vendor: string | null
  amount: Prisma.Decimal
  currency: string
  frequency: string | null
  startDate: Date
  endDate: Date | null
  executorId: string | null
  isActive: boolean
  createdAt: Date
}

const EXPENSE_SELECT = {
  id: true,
  type: true,
  category: true,
  source: true,
  vendor: true,
  amount: true,
  currency: true,
  frequency: true,
  startDate: true,
  endDate: true,
  executorId: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.ExpenseSelect

function toDto(e: ExpenseRow) {
  return {
    id: e.id,
    type: e.type,
    category: e.category,
    source: e.source,
    vendor: e.vendor,
    amount: e.amount.toFixed(2),
    currency: e.currency,
    frequency: e.frequency,
    startDate: e.startDate.toISOString().slice(0, 10),
    endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
    executorId: e.executorId,
    isActive: e.isActive,
    createdAt: e.createdAt,
  }
}

function requireOwner(
  user: Parameters<typeof isAgencyOwner>[0] & { activeAgencyId: string | null },
  agencyId: string
): void {
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Лише власник агенції має доступ до фінансів', 403)
  }
}

/**
 * Operating expenses (S5-10) — owner-only. All rows are operator-entered
 * (`source=manual`); executor-rate salary is synthesized in P&L, never stored here.
 */
const expensesRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/expenses',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      requireOwner(user, agencyId)
      const rows = await withTenant((tx) =>
        tx.expense.findMany({
          where: { agencyId },
          select: EXPENSE_SELECT,
          orderBy: { startDate: 'desc' },
        })
      )
      return reply.send({ success: true, data: { expenses: rows.map(toDto) } })
    }
  )

  fastify.post(
    '/workspace/expenses',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = createExpenseSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      requireOwner(user, agencyId)

      const expense = await withTenant((tx) =>
        tx.expense.create({
          data: {
            agencyId,
            type: input.type,
            category: input.category,
            source: 'manual',
            vendor: input.vendor ?? null,
            amount: input.amount,
            currency: input.currency,
            frequency: input.frequency ?? null,
            startDate: new Date(input.startDate),
            endDate: input.endDate ? new Date(input.endDate) : null,
            executorId: input.executorId ?? null,
            isActive: true,
            createdById: user.sub,
          },
          select: EXPENSE_SELECT,
        })
      )
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'expense.created',
        resourceType: 'expense',
        resourceId: expense.id,
        result: 'allowed',
        metadata: { category: input.category, amount: input.amount },
      })
      return reply.status(201).send({ success: true, data: { expense: toDto(expense) } })
    }
  )

  fastify.put<{ Params: { id: string } }>(
    '/workspace/expenses/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateExpenseSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      requireOwner(user, agencyId)

      const expense = await withTenant(async (tx) => {
        const existing = await tx.expense.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Витрату не знайдено', 404)
        }
        return tx.expense.update({
          where: { id: existing.id },
          data: {
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
            ...(input.amount !== undefined ? { amount: input.amount } : {}),
            ...(input.currency !== undefined ? { currency: input.currency } : {}),
            ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
            ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}),
            ...(input.endDate !== undefined
              ? { endDate: input.endDate ? new Date(input.endDate) : null }
              : {}),
          },
          select: EXPENSE_SELECT,
        })
      })
      return reply.send({ success: true, data: { expense: toDto(expense) } })
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/workspace/expenses/:id/archive',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      requireOwner(user, agencyId)
      const expense = await withTenant(async (tx) => {
        const existing = await tx.expense.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Витрату не знайдено', 404)
        }
        return tx.expense.update({
          where: { id: existing.id },
          data: { isActive: false },
          select: EXPENSE_SELECT,
        })
      })
      return reply.send({ success: true, data: { expense: toDto(expense) } })
    }
  )

  fastify.delete<{ Params: { id: string } }>(
    '/workspace/expenses/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      requireOwner(user, agencyId)
      await withTenant(async (tx) => {
        const existing = await tx.expense.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, isActive: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Витрату не знайдено', 404)
        }
        // Safety gate: archive before a hard delete (keeps an active cost from
        // silently vanishing from a period that may already have been reported).
        if (existing.isActive) {
          throw new AppError(ApiErrorCode.CONFLICT, 'Спершу архівуйте витрату', 409)
        }
        await tx.expense.delete({ where: { id: existing.id } })
      })
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'expense.deleted',
        resourceType: 'expense',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { deleted: true } })
    }
  )

  return Promise.resolve()
}

export default expensesRoute
