import { type PrismaClient, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireOrderParticipant, requireTeamOrder } from '../orders/access.js'

/** Documents that can be generated from an order (contract is issued separately). */
const createDocumentSchema = z.object({
  type: z.enum([
    'invoice',
    'advance_invoice',
    'completion_act',
    'specification',
    'reconciliation_act',
  ]),
})

const NUMBER_PREFIX: Record<string, string> = {
  invoice: 'INV',
  advance_invoice: 'ADV',
  completion_act: 'ACT',
  specification: 'SPC',
  reconciliation_act: 'REC',
  contract: 'CTR',
}

const DOC_SELECT = {
  id: true,
  type: true,
  number: true,
  status: true,
  generatedAt: true,
  sentAt: true,
} as const

/**
 * Race-safe per-agency document number (06, Аудит-фіналізація A). The counter row is
 * `(agencyId, type, year)`; `INSERT … ON CONFLICT … DO UPDATE count = count + 1 RETURNING`
 * is atomic, so two concurrent issues never collide on the same `INV-2026-000001`.
 */
export async function nextDocumentNumber(
  tx: Pick<PrismaClient, '$queryRaw'>,
  agencyId: string,
  type: string,
  year: number
): Promise<string> {
  const rows = await tx.$queryRaw<{ count: number }[]>`
    INSERT INTO document_counters ("agencyId", type, year, count)
    VALUES (${agencyId}, ${type}::"DocumentType", ${year}, 1)
    ON CONFLICT ("agencyId", type, year)
    DO UPDATE SET count = document_counters.count + 1
    RETURNING count
  `
  const count = Number(rows[0]?.count ?? 1)
  return `${NUMBER_PREFIX[type] ?? 'DOC'}-${year}-${String(count).padStart(6, '0')}`
}

const documentsRoute: FastifyPluginAsync = (fastify) => {
  // ── Generate a document from an order (team-only) ────────────────────────────
  fastify.post<{ Params: { orderId: string } }>(
    '/orders/:orderId/documents',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, orderId } = await requireTeamOrder(request, request.params.orderId)
      const { type } = createDocumentSchema.parse(request.body)

      const order = await withTenant((tx) =>
        tx.order.findUnique({ where: { id: orderId }, select: { companyId: true } })
      )
      if (!order?.companyId) {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Замовлення без компанії — документ не виставити',
          400
        )
      }
      const companyId = order.companyId
      const year = new Date().getUTCFullYear()

      const document = await tenantTransaction(prisma, async (tx) => {
        const number = await nextDocumentNumber(tx, agencyId, type, year)
        return tx.document.create({
          data: {
            agency: { connect: { id: agencyId } },
            type,
            number,
            order: { connect: { id: orderId } },
            company: { connect: { id: companyId } },
            status: 'generated', // record + number are fixed; PDF render lands in D2
            createdBy: { connect: { id: request.user.sub } },
          },
          select: DOC_SELECT,
        })
      })
      return reply.status(201).send({ success: true, data: { document } })
    }
  )

  // ── List an order's documents (team + that order's client) ──────────────────
  fastify.get<{ Params: { orderId: string } }>(
    '/orders/:orderId/documents',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.orderId)
      const documents = await withTenant((tx) =>
        tx.document.findMany({
          where: { orderId: access.orderId },
          orderBy: { generatedAt: 'desc' },
          select: DOC_SELECT,
        })
      )
      return reply.send({ success: true, data: { documents } })
    }
  )

  return Promise.resolve()
}

export default documentsRoute
