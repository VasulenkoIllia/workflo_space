import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ChromiumUnavailableError,
  type DocumentKind,
  htmlToPdf,
  renderDocumentHtml,
} from '@workflo/templates'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { nextDocumentNumber } from '../../services/documentNumber.js'
import {
  buildRenderData,
  fmtDate,
  fmtMoney,
  loadPdfBranding,
} from '../../services/documentRender.js'
import { enqueueOutbox } from '../../services/outbox.js'
import { requireOrderParticipant, requireTeamOrder } from '../orders/access.js'
import { DOC_SELECT } from './shared.js'

/**
 * R2 (аудит r6, розбиття documents.ts): ORDER-scoped документообіг —
 * generate / list / PDF / send для документів, привʼязаних до замовлення.
 * Company-scoped (портал/картка клієнта) — companyDocuments.ts; зовнішні
 * договори — contracts.ts.
 */

/** Documents that can be generated from an order (повний UA-комплект, 06). Договір тут —
 * рамковий, з предметом за замовленням; company-рівневий флоу — окремо (Фаза B). */
const createDocumentSchema = z.object({
  type: z.enum([
    'invoice',
    'advance_invoice',
    'completion_act',
    'specification',
    'reconciliation_act',
    'contract',
  ]),
})

const orderDocumentsRoute: FastifyPluginAsync = (fastify) => {
  // ── Generate a document from an order (team-only) ────────────────────────────
  fastify.post<{ Params: { orderId: string } }>(
    '/orders/:orderId/documents',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, orderId } = await requireTeamOrder(request, request.params.orderId)
      const { type } = createDocumentSchema.parse(request.body)

      const order = await withTenant((tx) =>
        tx.order.findUnique({
          where: { id: orderId },
          select: { companyId: true, project: { select: { legalEntityId: true } } },
        })
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
        // Issuer legal entity: проєкт замовлення → дефолтна юр-особа агенції → без юр-особи.
        // Раніше binding не заповнювався взагалі — інвойси виходили без реквізитів оплати.
        const legalEntityId =
          order.project?.legalEntityId ??
          (
            await tx.legalEntity.findFirst({
              where: { agencyId, isDefault: true },
              select: { id: true },
            })
          )?.id ??
          null
        const number = await nextDocumentNumber(tx, agencyId, type, year)
        return tx.document.create({
          data: {
            agency: { connect: { id: agencyId } },
            type,
            number,
            order: { connect: { id: orderId } },
            company: { connect: { id: companyId } },
            ...(legalEntityId ? { legalEntity: { connect: { id: legalEntityId } } } : {}),
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
            companyId: true,
            agencyId: true,
            agency: { select: { name: true } },
            order: {
              select: {
                id: true,
                title: true,
                description: true,
                totalAmount: true,
                approvedAmount: true,
                currency: true,
                createdAt: true,
                project: { select: { id: true, name: true, contractDocumentId: true } },
              },
            },
            company: {
              select: { name: true, legalName: true, taxId: true, legalAddress: true },
            },
            legalEntity: {
              select: {
                name: true,
                legalName: true,
                taxId: true,
                vatPayer: true,
                vatId: true,
                legalAddress: true,
                bankName: true,
                iban: true,
                signerName: true,
                signerTitle: true,
                docKit: true,
                bic: true,
              },
            },
          },
        })
      )
      if (!doc) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Документ не знайдено', 404)
      }

      const data = await withTenant((tx) => buildRenderData(tx, doc))
      data.branding = await loadPdfBranding(doc.agencyId, doc.agency.name)
      const html = renderDocumentHtml(doc.type as DocumentKind, data)

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

  // ── Send a document to the client (team-only) ────────────────────────────────
  // Flips status → sent + stamps sentAt, then enqueues a notification so the client
  // learns (invoice → billing.invoice_sent email; other types → in_app).
  fastify.post<{ Params: { orderId: string; docId: string } }>(
    '/orders/:orderId/documents/:docId/send',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, orderId } = await requireTeamOrder(request, request.params.orderId)

      const now = new Date()
      const document = await tenantTransaction(prisma, async (tx) => {
        // Atomic claim: the conditional updateMany flips generated→sent for exactly one of two
        // concurrent sends (row lock → the loser gets count 0), so the client never gets two
        // invoice emails from a double-click. Status read + write happen in one statement.
        const claim = await tx.document.updateMany({
          where: { id: request.params.docId, orderId, status: { not: 'sent' } },
          data: { status: 'sent', sentAt: now },
        })
        if (claim.count === 0) {
          const exists = await tx.document.findFirst({
            where: { id: request.params.docId, orderId },
            select: { id: true },
          })
          if (!exists) throw new AppError(ApiErrorCode.NOT_FOUND, 'Документ не знайдено', 404)
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Документ вже надіслано', 409)
        }

        const doc = await tx.document.findFirstOrThrow({
          where: { id: request.params.docId, orderId },
          select: { ...DOC_SELECT, order: { select: { totalAmount: true, currency: true } } },
        })
        const settings = await tx.paymentSettings.findUnique({
          where: { agencyId },
          select: { paymentTermsDays: true },
        })
        const dueDate = new Date(now.getTime() + (settings?.paymentTermsDays ?? 7) * 86_400_000)

        await enqueueOutbox(tx, {
          type: 'document.sent',
          payload: {
            orderId,
            docId: doc.id,
            docType: doc.type,
            number: doc.number,
            amount: `${fmtMoney(doc.order?.totalAmount)} ${doc.order?.currency ?? 'UAH'}`,
            dueDate: fmtDate(dueDate),
            actorId: request.user.sub,
          },
          agencyId,
        })
        return {
          id: doc.id,
          type: doc.type,
          number: doc.number,
          status: doc.status,
          generatedAt: doc.generatedAt,
          sentAt: doc.sentAt,
        }
      })
      return reply.send({ success: true, data: { document } })
    }
  )

  return Promise.resolve()
}

export default orderDocumentsRoute
