import { type PrismaClient, prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ChromiumUnavailableError,
  type DocumentRenderData,
  htmlToPdf,
  renderDocumentHtml,
} from '@workflo/templates'
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

const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: 'Рахунок',
  advance_invoice: 'Аванс-рахунок',
  completion_act: 'Акт виконаних робіт',
  specification: 'Специфікація',
  reconciliation_act: 'Акт звірки',
  contract: 'Договір',
}

const DOC_SELECT = {
  id: true,
  type: true,
  number: true,
  status: true,
  generatedAt: true,
  sentAt: true,
} as const

const fmtMoney = (v: unknown): string =>
  Number(v ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d: Date): string =>
  `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`

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

  // ── Render a document as PDF (team + that order's client) ────────────────────
  // On-demand: data is read fresh from the order/parties (no stored snapshot yet — D2 follow-up).
  // When Chromium is unavailable (local/CI), gracefully serve the same HTML so the doc is still
  // viewable + printable, instead of failing the request.
  fastify.get<{ Params: { orderId: string; docId: string } }>(
    '/orders/:orderId/documents/:docId/pdf',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.orderId)
      const doc = await withTenant((tx) =>
        tx.document.findFirst({
          where: { id: request.params.docId, orderId: access.orderId },
          select: {
            type: true,
            number: true,
            generatedAt: true,
            agency: { select: { name: true } },
            order: { select: { title: true, totalAmount: true, currency: true } },
            company: {
              select: { name: true, legalName: true, taxId: true, legalAddress: true },
            },
            legalEntity: {
              select: {
                name: true,
                legalName: true,
                taxId: true,
                legalAddress: true,
                bankName: true,
                iban: true,
                signerName: true,
                signerTitle: true,
              },
            },
          },
        })
      )
      if (!doc) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Документ не знайдено', 404)
      }

      const data: DocumentRenderData = {
        typeLabel: DOC_TYPE_LABEL[doc.type] ?? doc.type,
        number: doc.number,
        date: fmtDate(doc.generatedAt),
        orderTitle: doc.order?.title ?? '—',
        amount: fmtMoney(doc.order?.totalAmount),
        currency: doc.order?.currency ?? 'UAH',
        // Issuer: the agency legal entity if the document was bound to one, else the agency name.
        issuer: doc.legalEntity ?? { name: doc.agency.name },
        recipient: {
          name: doc.company.name,
          legalName: doc.company.legalName,
          taxId: doc.company.taxId,
          legalAddress: doc.company.legalAddress,
        },
      }
      const html = renderDocumentHtml(data)

      try {
        const pdf = await htmlToPdf(html)
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `inline; filename="${doc.number}.pdf"`)
          .send(pdf)
      } catch (err) {
        if (err instanceof ChromiumUnavailableError) {
          request.log.warn(
            { number: doc.number },
            'documents: Chromium unavailable → serving HTML fallback'
          )
          return reply
            .header('Content-Type', 'text/html; charset=utf-8')
            .header('X-Document-Format', 'html-fallback')
            .send(html)
        }
        throw err
      }
    }
  )

  return Promise.resolve()
}

export default documentsRoute
