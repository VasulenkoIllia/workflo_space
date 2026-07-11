import { type PrismaClient, prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ChromiumUnavailableError,
  type DocumentKind,
  htmlToPdf,
  renderClientMonthlyReportHtml,
  renderDocumentHtml,
} from '@workflo/templates'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { randomUUID } from 'node:crypto'
import { writeAuditAsync } from '../../services/audit.js'
import {
  DOC_TYPE_LABEL,
  buildRenderData,
  fmtDate,
  fmtMoney,
  loadPdfBranding,
} from '../../services/documentRender.js'
import { getStorage } from '../../services/storage.js'
import { computeClientMonthlyNumbers, moneyLabel } from '../../services/clientMonthlyReport.js'
import { dispatchNotification } from '../../services/notifications.js'
import { enqueueOutbox } from '../../services/outbox.js'
import { requireOrderParticipant, requireTeamOrder } from '../orders/access.js'

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

const NUMBER_PREFIX: Record<string, string> = {
  invoice: 'INV',
  advance_invoice: 'ADV',
  completion_act: 'ACT',
  specification: 'SPC',
  reconciliation_act: 'REC',
  contract: 'CTR',
  monthly_report: 'RPT', // 19-Г: місячний звіт клієнту
}

const DOC_SELECT = {
  id: true,
  type: true,
  number: true,
  status: true,
  generatedAt: true,
  sentAt: true,
  // 06-ПІДПИС: хто і коли прийняв (для бейджів/тултіпів обох апок)
  acceptedAt: true,
  acceptedByName: true,
  // 06-ДОГОВІР-2: зовнішній договір (файл/лінк; storedAs = ознака наявності файла)
  signedExternally: true,
  contractDate: true,
  externalUrl: true,
  storedAs: true,
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

  // ── 06-ДОГОВІР-2: реєстрація ЗОВНІШНЬОГО договору (підписаний поза системою) ──
  // Owner/executor (не manager — фінартефакт): власний номер + дата підписання +
  // підписант + файл (multipart, PDF) АБО посилання. Створюється одразу accepted.
  fastify.post<{ Params: { companyId: string } }>(
    '/workspace/companies/:companyId/contracts/external',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const company = await withTenant((tx) =>
        tx.company.findFirst({
          where: { id: request.params.companyId, agencyId },
          select: { id: true },
        })
      )
      if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)

      // multipart (файл + поля) або чистий JSON (без файла)
      let fields: Record<string, unknown>
      let fileBuffer: Buffer | null = null
      if (request.isMultipart()) {
        const part = await request.file()
        if (part) {
          if (part.mimetype !== 'application/pdf') {
            throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Файл договору — лише PDF', 415)
          }
          fileBuffer = await part.toBuffer()
          fields = Object.fromEntries(
            Object.entries(part.fields).map(([k, v]) => [
              k,
              (v as { value?: unknown }).value ?? undefined,
            ])
          )
        } else {
          fields = {}
        }
      } else {
        fields = (request.body ?? {}) as Record<string, unknown>
      }

      const input = z
        .object({
          number: z.string().trim().min(1).max(60),
          contractDate: z.coerce.date(),
          signerName: z.string().trim().min(3).max(120),
          externalUrl: z.string().trim().url().max(500).optional(),
        })
        .parse(fields)

      const docId = randomUUID()
      let storedAs: string | null = null
      if (fileBuffer) {
        storedAs = `${agencyId}/contracts/${docId}.pdf`
        await getStorage().upload({
          key: storedAs,
          buffer: fileBuffer,
          contentType: 'application/pdf',
        })
      }

      let document
      try {
        document = await withTenant((tx) =>
          tx.document.create({
            data: {
              id: docId,
              agency: { connect: { id: agencyId } },
              type: 'contract',
              number: input.number,
              company: { connect: { id: company.id } },
              status: 'accepted',
              signedExternally: true,
              contractDate: input.contractDate,
              acceptedAt: input.contractDate,
              acceptedByName: input.signerName,
              ...(storedAs ? { storedAs } : {}),
              ...(input.externalUrl ? { externalUrl: input.externalUrl } : {}),
              createdBy: { connect: { id: user.sub } },
            },
            select: {
              ...DOC_SELECT,
              signedExternally: true,
              contractDate: true,
              externalUrl: true,
            },
          })
        )
      } catch (err) {
        if (storedAs)
          await getStorage()
            .delete(storedAs)
            .catch(() => undefined)
        if ((err as { code?: string }).code === 'P2002') {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            `Договір з номером «${input.number}» у цієї компанії вже є`,
            409
          )
        }
        throw err
      }

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'documents.external_contract_registered',
        resourceType: 'document',
        resourceId: document.id,
        result: 'allowed',
        metadata: { number: input.number, companyId: company.id, hasFile: !!storedAs },
      })
      return reply.status(201).send({ success: true, data: { document } })
    }
  )

  // ── 06-ДОГОВІР-2: віддати збережений файл договору (storedAs) ─────────────────
  fastify.get<{ Params: { docId: string } }>(
    '/documents/:docId/file',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const doc = await withTenant((tx) =>
        tx.document.findFirst({
          where: { id: request.params.docId, storedAs: { not: null } },
          select: { number: true, storedAs: true, agencyId: true, companyId: true },
        })
      )
      if (!doc?.storedAs) throw new AppError(ApiErrorCode.NOT_FOUND, 'Файл не знайдено', 404)
      const isTeam =
        isInternalTeam(user) &&
        user.agencyMemberships.some((m) => m.agencyId === doc.agencyId) &&
        !isAgencyManager(user, doc.agencyId)
      const isCompanyClient = user.memberships.some((m) => m.companyId === doc.companyId)
      if (!isTeam && !isCompanyClient) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до документа', 403)
      }
      const buffer = await getStorage().read(doc.storedAs)
      // Зовнішні номери містять не-ASCII («№ 8/2026») — у header лише ASCII-safe
      // fallback + RFC 5987 filename* з повним номером.
      const safeName = doc.number.replace(/[^\w.-]+/g, '_') || 'contract'
      return reply
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `inline; filename="${safeName}.pdf"; filename*=UTF-8''${encodeURIComponent(doc.number)}.pdf`
        )
        .send(buffer)
    }
  )

  // ── 06-SEND: усі документи клієнта одним списком (портал /documents) ─────────
  // Клієнт бачить лише НАДІСЛАНІ/ПРИЙНЯТІ документи своїх компаній (чернетки та
  // «сформовані, але не надіслані» — внутрішня кухня агенції). monthly_report — теж.
  fastify.get(
    '/portal/documents',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const companyIds = request.user.memberships.map((m) => m.companyId)
      if (companyIds.length === 0) {
        return reply.send({ success: true, data: { documents: [] } })
      }
      const documents = await withTenant((tx) =>
        tx.document.findMany({
          where: { companyId: { in: companyIds }, status: { in: ['sent', 'accepted'] } },
          orderBy: { generatedAt: 'desc' },
          select: { ...DOC_SELECT, order: { select: { id: true, title: true } } },
          take: 200,
        })
      )
      return reply.send({ success: true, data: { documents } })
    }
  )

  // ── 06-ПІДПИС: клієнт приймає договір/акт у порталі (клік + ПІБ) ─────────────
  // Typed signature: фіксуємо ПІБ/час/IP/акаунт (аудит + поля документа). Приймати
  // можна лише НАДІСЛАНЕ (sent) — атомарний claim sent→accepted (TOCTOU як у send).
  fastify.post<{ Params: { docId: string } }>(
    '/portal/documents/:docId/accept',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { fullName } = z
        .object({ fullName: z.string().trim().min(3).max(120) })
        .strict()
        .parse(request.body)
      const user = request.user

      const doc = await withTenant((tx) =>
        tx.document.findFirst({
          where: { id: request.params.docId, type: { in: ['contract', 'completion_act'] } },
          select: {
            id: true,
            type: true,
            number: true,
            agencyId: true,
            companyId: true,
            company: { select: { name: true } },
          },
        })
      )
      if (!doc) throw new AppError(ApiErrorCode.NOT_FOUND, 'Документ не знайдено', 404)
      // LOW-2 (рішення власника 08.07): юридично приймати договір/акт (клік + ПІБ = підпис) може
      // ЛИШЕ власник компанії-клієнта, як реквізити/секрети — не будь-який рядовий учасник.
      // Гейт по companyId (owner-роль); тенант уже забезпечений скоупленим doc-запитом вище —
      // portal-клієнт має activeAgencyId=null, тож agencyId у can тут не передаємо.
      if (!can(user, 'company.update_settings', { companyId: doc.companyId })) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Приймати документ може лише власник компанії',
          403
        )
      }

      const now = new Date()
      await tenantTransaction(prisma, async (tx) => {
        const claim = await tx.document.updateMany({
          where: { id: doc.id, status: 'sent' },
          data: {
            status: 'accepted',
            acceptedAt: now,
            acceptedById: user.sub,
            acceptedByName: fullName,
            acceptedIp: request.ip,
          },
        })
        if (claim.count === 0) {
          throw new AppError(
            ApiErrorCode.VALIDATION_ERROR,
            'Документ ще не надіслано або вже прийнято',
            409
          )
        }
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId: doc.agencyId,
        action: 'documents.accepted',
        resourceType: 'document',
        resourceId: doc.id,
        result: 'allowed',
        metadata: { number: doc.number, type: doc.type, fullName, ip: request.ip },
      })

      // In-app власникам агенції (без email-шаблону — notify пропустить email сам)
      const owners = await withTenant((tx) =>
        tx.agencyMember.findMany({
          where: { agencyId: doc.agencyId, role: 'owner' },
          select: { profileId: true },
        })
      )
      for (const o of owners) {
        dispatchNotification(request.log, {
          profileId: o.profileId,
          event: 'documents.accepted',
          vars: { number: doc.number, fullName },
          inApp: {
            title: `Документ ${doc.number} прийнято`,
            body: `${doc.company?.name ?? 'Клієнт'}: ${fullName} прийняв(ла) ${DOC_TYPE_LABEL[doc.type] ?? doc.type}.`,
          },
        })
      }

      return reply.send({
        success: true,
        data: { id: doc.id, status: 'accepted', acceptedAt: now, acceptedByName: fullName },
      })
    }
  )

  // ── 19-Г: PDF company-scoped документа БЕЗ замовлення (monthly_report) ───────
  // Команда агенції (не manager — фінартефакт) АБО клієнт-учасник компанії документа.
  // Дані перераховуються з вікна попереднього місяця відносно generatedAt —
  // місяць закритий, тож рендер детермінований.
  fastify.get<{ Params: { docId: string } }>(
    '/documents/:docId/pdf',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const doc = await withTenant((tx) =>
        tx.document.findFirst({
          where: { id: request.params.docId, type: 'monthly_report' },
          select: {
            id: true,
            number: true,
            generatedAt: true,
            agencyId: true,
            companyId: true,
            agency: { select: { name: true } },
            company: { select: { name: true } },
          },
        })
      )
      if (!doc) throw new AppError(ApiErrorCode.NOT_FOUND, 'Документ не знайдено', 404)

      const isTeam =
        isInternalTeam(user) &&
        user.agencyMemberships.some((m) => m.agencyId === doc.agencyId) &&
        !isAgencyManager(user, doc.agencyId)
      const isCompanyClient = user.memberships.some((m) => m.companyId === doc.companyId)
      if (!isTeam && !isCompanyClient) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до документа', 403)
      }

      const g = doc.generatedAt
      const monthStart = new Date(Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), 1))
      const prevStart = new Date(Date.UTC(g.getUTCFullYear(), g.getUTCMonth() - 1, 1))
      const numbers = await withTenant((tx) =>
        computeClientMonthlyNumbers(tx, {
          agencyId: doc.agencyId,
          companyId: doc.companyId,
          from: prevStart,
          to: monthStart,
        })
      )
      const html = renderClientMonthlyReportHtml({
        agencyName: doc.agency.name,
        companyName: doc.company.name,
        periodLabel: new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(
          prevStart
        ),
        number: doc.number,
        generatedAt: doc.generatedAt.toLocaleDateString('uk-UA'),
        newOrders: numbers.newOrders,
        completedOrders: numbers.completedOrders,
        hoursByProject: numbers.hoursByProject,
        totalHours: numbers.totalHours,
        paidLabel: moneyLabel(numbers.paid),
        debtLabel: moneyLabel(numbers.debt),
      })
      try {
        const pdf = await htmlToPdf(html)
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `inline; filename="${doc.number}.pdf"`)
          .send(pdf)
      } catch (err) {
        if (err instanceof ChromiumUnavailableError) {
          return reply.header('Content-Type', 'text/html; charset=utf-8').send(html)
        }
        throw err
      }
    }
  )

  // ── List ALL documents of a client (across orders) — team document overview ──
  // The client card 360° "Документи" tab (28-Б). Document carries companyId directly, so this
  // is a flat company-scoped read. Internal team, manager-blocked (financial/legal artefacts,
  // like requisites/finance). A cross-tenant id returns [] (agencyId filter + RLS), no leak.
  fastify.get<{ Params: { id: string } }>(
    '/workspace/clients/:id/documents',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const documents = await withTenant((tx) =>
        tx.document.findMany({
          where: { companyId: request.params.id, agencyId },
          orderBy: { generatedAt: 'desc' },
          select: { ...DOC_SELECT, order: { select: { id: true, title: true } } },
        })
      )
      return reply.send({ success: true, data: { documents } })
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

export default documentsRoute
