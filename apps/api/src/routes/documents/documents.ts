import { type Prisma, type PrismaClient, prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ChromiumUnavailableError,
  type DocumentKind,
  type DocumentLine,
  type DocumentRenderData,
  type ReconciliationRow,
  htmlToPdf,
  renderClientMonthlyReportHtml,
  renderDocumentHtml,
} from '@workflo/templates'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
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

const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: 'Рахунок',
  advance_invoice: 'Аванс-рахунок',
  completion_act: 'Акт виконаних робіт',
  specification: 'Специфікація',
  reconciliation_act: 'Акт звірки',
  contract: 'Договір',
  monthly_report: 'Місячний звіт', // 19-Г
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

/** Doc row shape used by the PDF endpoint (result of its select). */
interface DocRow {
  type: string
  number: string
  generatedAt: Date
  companyId: string
  agencyId: string
  agency: { name: string }
  order: {
    id: string
    title: string
    description: string | null
    totalAmount: unknown
    approvedAmount: unknown
    currency: string
    createdAt: Date
    project: { id: string; name: string } | null
  } | null
  company: {
    name: string
    legalName: string | null
    taxId: string | null
    legalAddress: string | null
  }
  legalEntity: {
    name: string
    legalName: string | null
    taxId: string | null
    vatPayer: boolean
    legalAddress: string | null
    bankName: string | null
    iban: string | null
    signerName: string | null
    signerTitle: string | null
  } | null
}

/**
 * Пер-типова збірка даних рендера (06, повний UA-комплект): позиції — з estimate-ліній
 * проєкту (фолбек: одна позиція за замовленням), грн-еквівалент — з ExchangeRate,
 * звірка — з реальних charges/payments компанії. Дані читаються свіжими (без снапшоту —
 * D2 follow-up).
 */
async function buildRenderData(
  tx: Prisma.TransactionClient,
  doc: DocRow
): Promise<DocumentRenderData> {
  const kind = doc.type as DocumentKind
  const order = doc.order
  const currency = order?.currency ?? 'UAH'
  const amountNum = Number(order?.approvedAmount ?? order?.totalAmount ?? 0)

  const data: DocumentRenderData = {
    typeLabel: DOC_TYPE_LABEL[doc.type] ?? doc.type,
    number: doc.number,
    date: fmtDate(doc.generatedAt),
    orderTitle: order?.title ?? '—',
    projectName: order?.project?.name ?? null,
    amount: fmtMoney(amountNum),
    currency,
    issuer: doc.legalEntity ?? { name: doc.agency.name },
    recipient: {
      name: doc.company.name,
      legalName: doc.company.legalName,
      taxId: doc.company.taxId,
      legalAddress: doc.company.legalAddress,
    },
  }

  // ── позиції: estimate-лінії проєкту (P-6); нема → фолбек у рендерері ──
  if (kind !== 'reconciliation_act' && kind !== 'contract' && order?.project) {
    const lines = await tx.estimateLine.findMany({
      where: { projectId: order.project.id },
      orderBy: { createdAt: 'asc' },
      select: { name: true, hours: true, amount: true },
    })
    if (lines.length > 0) {
      data.lines = lines.map((l): DocumentLine => {
        const hours = Number(l.hours)
        const sum = l.amount != null ? Number(l.amount) : 0
        const rate = hours > 0 && sum > 0 ? sum / hours : null
        return {
          name: l.name,
          qty: hours > 0 ? fmtMoney(hours) : '1',
          unit: hours > 0 ? 'год' : 'послуга',
          price: rate != null ? fmtMoney(rate) : sum > 0 ? fmtMoney(sum) : 'включено',
          sum: sum > 0 ? fmtMoney(sum) : '0,00',
        }
      })
    }
  }

  // ── грн-еквівалент для не-UAH валют (курс агенції, S5-03a) ──
  if (currency !== 'UAH' && amountNum > 0) {
    const rate = await tx.exchangeRate.findUnique({
      where: { agencyId: doc.agencyId },
      select: { usdToUah: true, eurToUah: true, updatedAt: true },
    })
    const uah =
      currency === 'USD' && rate?.usdToUah
        ? Number(rate.usdToUah)
        : currency === 'EUR' && rate?.eurToUah
          ? Number(rate.eurToUah)
          : null
    if (uah != null && rate) {
      data.uahTotal = fmtMoney(amountNum * uah)
      data.rateNote = `за курсом ${fmtMoney(uah)} грн/${currency} від ${fmtDate(rate.updatedAt)}`
    }
  }

  data.vatNote = doc.legalEntity?.vatPayer ? 'у т.ч. ПДВ 20%' : 'без ПДВ (неплатник ПДВ)'

  if (kind === 'invoice' || kind === 'advance_invoice') {
    const settings = await tx.paymentSettings.findUnique({
      where: { agencyId: doc.agencyId },
      select: { paymentTermsDays: true },
    })
    const terms = settings?.paymentTermsDays ?? 7
    data.dueDate = fmtDate(new Date(doc.generatedAt.getTime() + terms * 86_400_000))
    const advance = kind === 'advance_invoice' ? 'Авансова оплата' : 'Оплата'
    data.paymentPurpose = `${advance} за рахунком № ${doc.number} від ${data.date} за послуги з розробки ПЗ (${data.orderTitle}). ${data.vatNote === 'без ПДВ (неплатник ПДВ)' ? 'Без ПДВ.' : 'З ПДВ.'}`
  }

  if (kind === 'completion_act' && order) {
    data.periodFrom = fmtDate(order.createdAt)
    data.periodTo = fmtDate(doc.generatedAt)
    const invoice = await tx.document.findFirst({
      where: { orderId: order.id, type: { in: ['invoice', 'advance_invoice'] } },
      orderBy: { generatedAt: 'desc' },
      select: { number: true, generatedAt: true },
    })
    if (invoice) data.basisRef = `Рахунок ${invoice.number} від ${fmtDate(invoice.generatedAt)}`
  }

  if (kind === 'specification') {
    data.description = order?.description ?? null
  }

  if (kind === 'reconciliation_act') {
    // Звірка по КОМПАНІЇ: нарахування (charges, без pending-гейта) = дебет,
    // підтверджені оплати = кредит. Суми «як записано» — мульти-валютні кейси
    // позначаються валютою документа (MVP-обмеження, задокументовано).
    const [charges, payments] = await Promise.all([
      tx.serviceCharge.findMany({
        where: { companyId: doc.companyId, approvalStatus: { not: 'pending' } },
        orderBy: { month: 'asc' },
        select: {
          month: true,
          kind: true,
          amount: true,
          totalAmount: true,
          project: { select: { name: true } },
        },
      }),
      tx.payment.findMany({
        where: { companyId: doc.companyId },
        orderBy: { confirmedAt: 'asc' },
        select: { confirmedAt: true, amount: true, paymentMethod: true },
      }),
    ])
    const ops: (ReconciliationRow & { at: number })[] = []
    let debit = 0
    let credit = 0
    for (const c of charges) {
      const v = Number(c.totalAmount ?? c.amount)
      debit += v
      ops.push({
        at: c.month.getTime(),
        date: fmtDate(c.month),
        doc: c.kind === 'subscription' ? 'нарахування' : c.kind,
        desc: c.project?.name ?? 'Разове нарахування',
        debit: fmtMoney(v),
        credit: null,
      })
    }
    for (const p of payments) {
      const v = Number(p.amount)
      credit += v
      ops.push({
        at: p.confirmedAt.getTime(),
        date: fmtDate(p.confirmedAt),
        doc: 'оплата',
        desc: p.paymentMethod ?? 'Платіж',
        debit: null,
        credit: fmtMoney(v),
      })
    }
    ops.sort((a, b) => a.at - b.at)
    data.operations = ops.map(({ at: _at, ...row }) => row)
    data.opening = fmtMoney(0)
    data.totalDebit = fmtMoney(debit)
    data.totalCredit = fmtMoney(credit)
    data.closing = fmtMoney(debit - credit)
    data.amount = fmtMoney(debit - credit)
    if (ops.length > 0) {
      data.periodFrom = ops[0]?.date
      data.periodTo = fmtDate(doc.generatedAt)
    }
  }

  if (kind === 'contract') {
    data.contractPlace = doc.legalEntity?.legalAddress?.split(',')[0]?.trim() || undefined
  }

  return data
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
                project: { select: { id: true, name: true } },
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

      const data = await withTenant((tx) => buildRenderData(tx, doc))
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
      if (!user.memberships.some((m) => m.companyId === doc.companyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до документа', 403)
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
