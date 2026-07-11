import { randomBytes } from 'node:crypto'
import { prisma, runWithSystemContext, tenantTransaction, withTenant } from '@workflo/db'
import {
  ChromiumUnavailableError,
  type DocumentKind,
  htmlToPdf,
  renderDocumentHtml,
} from '@workflo/templates'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'
import { buildRenderData, loadPdfBranding } from '../../services/documentRender.js'
import { requireTeamOrder } from '../orders/access.js'

/**
 * 06-Д: публічна сторінка рахунку — hosted-лінк без логіна (дизайн PublicInvoicePage,
 * workspace-documents-eu.jsx). Команда видає лінк на рахунок (invoice/advance_invoice),
 * клієнт відкриває сторінку/PDF без акаунта. Безпека — непередбачуваний токен
 * (192 біти, base64url, globally unique) + відкликання (DELETE → token=null).
 * Кнопки онлайн-оплати нема свідомо — провайдери 05-А ще не підключені; сторінка
 * показує банківські реквізити з самого документа.
 */

/** Токен 24 байти → 32 символи base64url — непідбирний, без спецсимволів у URL. */
const newPublicToken = (): string => randomBytes(24).toString('base64url')

const PUBLIC_LINK_TYPES = new Set(['invoice', 'advance_invoice'])

/** Селект документа для публічного рендера — той самий DocRow, що й авторизований PDF. */
const PUBLIC_DOC_SELECT = {
  id: true,
  type: true,
  number: true,
  status: true,
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
  company: { select: { name: true, legalName: true, taxId: true, legalAddress: true } },
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
} as const

/** Обгортка документа тоб-баром публічної сторінки (статус + PDF + «без логіна»). */
function wrapPublicPage(
  docHtml: string,
  opts: {
    number: string
    status: string
    amount: string
    currency: string
    en: boolean
    token: string
  }
): string {
  const t = opts.en
    ? {
        secure: 'secure link · no login required',
        status: opts.status === 'accepted' ? 'accepted' : 'awaiting payment',
        pdf: 'Download PDF',
        pay: 'Online payment is not enabled yet — please use the bank details below',
      }
    : {
        secure: 'захищене посилання · без логіна',
        status: opts.status === 'accepted' ? 'прийнято' : 'до оплати',
        pdf: 'Завантажити PDF',
        pay: 'Онлайн-оплата ще не підключена — скористайтесь банківськими реквізитами в документі',
      }
  const bar = `<div style="position:sticky;top:0;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 28px;background:#0c0a09;color:#fafaf9;font-family:'SFMono-Regular','Menlo',monospace;font-size:11px;z-index:10">
    <strong style="font-size:12px">${opts.number}</strong>
    <span style="border:1px solid #57534e;border-radius:3px;padding:1px 8px">${t.status}</span>
    <span>${opts.amount} ${opts.currency}</span>
    <a href="/public/documents/${opts.token}/pdf" style="margin-left:auto;color:#C5F82A;text-decoration:none;border:1px solid #C5F82A;border-radius:3px;padding:2px 10px">${t.pdf} ↓</a>
    <span style="flex-basis:100%;color:#a8a29e">🔒 ${t.secure} · ${t.pay}</span>
  </div>`
  // Документ — самодостатня сторінка; вставляємо бар одразу після <body>
  return docHtml.replace('<body>', `<body>\n${bar}`)
}

const publicInvoiceRoute: FastifyPluginAsync = (fastify) => {
  // ── Видати/отримати публічний лінк (team-only; ідемпотентно) ─────────────────
  fastify.post<{ Params: { orderId: string; docId: string } }>(
    '/orders/:orderId/documents/:docId/public-link',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, orderId } = await requireTeamOrder(request, request.params.orderId)
      const token = await tenantTransaction(prisma, async (tx) => {
        const doc = await tx.document.findFirst({
          where: { id: request.params.docId, orderId },
          select: { id: true, type: true, publicToken: true },
        })
        if (!doc) throw new AppError(ApiErrorCode.NOT_FOUND, 'Документ не знайдено', 404)
        if (!PUBLIC_LINK_TYPES.has(doc.type)) {
          throw new AppError(
            ApiErrorCode.VALIDATION_ERROR,
            'Публічний лінк доступний лише для рахунків',
            400
          )
        }
        if (doc.publicToken) return doc.publicToken
        const fresh = newPublicToken()
        await tx.document.update({ where: { id: doc.id }, data: { publicToken: fresh } })
        return fresh
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'documents.public_link_issued',
        resourceType: 'document',
        resourceId: request.params.docId,
        result: 'allowed',
      })
      const base = process.env.API_PUBLIC_URL ?? 'https://dev-api.workflo.space'
      return reply.send({
        success: true,
        data: { publicToken: token, url: `${base}/public/documents/${token}` },
      })
    }
  )

  // ── Відкликати лінк (team-only) — сторінка одразу стає 404 ───────────────────
  fastify.delete<{ Params: { orderId: string; docId: string } }>(
    '/orders/:orderId/documents/:docId/public-link',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, orderId } = await requireTeamOrder(request, request.params.orderId)
      const cleared = await withTenant((tx) =>
        tx.document.updateMany({
          where: { id: request.params.docId, orderId, publicToken: { not: null } },
          data: { publicToken: null },
        })
      )
      if (cleared.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Лінк не знайдено', 404)
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'documents.public_link_revoked',
        resourceType: 'document',
        resourceId: request.params.docId,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { revoked: true } })
    }
  )

  // ── Публічні читання (без auth): токен = вся авторизація ─────────────────────
  // Читання поза user-контекстом → системний RLS-контекст; row знаходиться ЛИШЕ
  // по globally-unique токену, тенант «зашитий» у сам рядок — крос-тенант витоку нема.
  async function loadPublicDoc(token: string) {
    if (token.length < 16) return null // явно не наш токен — без запиту в БД
    return runWithSystemContext(() =>
      prisma.document.findUnique({ where: { publicToken: token }, select: PUBLIC_DOC_SELECT })
    )
  }

  fastify.get<{ Params: { token: string } }>(
    '/public/documents/:token',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const doc = await loadPublicDoc(request.params.token)
      if (!doc) throw new AppError(ApiErrorCode.NOT_FOUND, 'Документ не знайдено', 404)
      const { html, data } = await renderPublicHtml(doc)
      const page = wrapPublicPage(html, {
        number: doc.number,
        status: doc.status,
        amount: data.amount,
        currency: data.currency,
        en: data.kit === 'eu',
        token: request.params.token,
      })
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(page)
    }
  )

  fastify.get<{ Params: { token: string } }>(
    '/public/documents/:token/pdf',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const doc = await loadPublicDoc(request.params.token)
      if (!doc) throw new AppError(ApiErrorCode.NOT_FOUND, 'Документ не знайдено', 404)
      const { html } = await renderPublicHtml(doc)
      try {
        const pdf = await htmlToPdf(html)
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `inline; filename="${doc.number}.pdf"`)
          .send(pdf)
      } catch (err) {
        if (err instanceof ChromiumUnavailableError) {
          return reply
            .header('Content-Type', 'text/html; charset=utf-8')
            .header('X-Document-Format', 'html-fallback')
            .send(html)
        }
        throw err
      }
    }
  )

  /** Спільний рендер обох публічних ендпоінтів — той самий пайплайн, що й авторизований PDF. */
  async function renderPublicDataOf(doc: NonNullable<Awaited<ReturnType<typeof loadPublicDoc>>>) {
    return runWithSystemContext(async () => {
      const data = await buildRenderData(prisma as never, doc)
      data.branding = await loadPdfBranding(doc.agencyId, doc.agency.name)
      return data
    })
  }
  async function renderPublicHtml(doc: NonNullable<Awaited<ReturnType<typeof loadPublicDoc>>>) {
    const data = await renderPublicDataOf(doc)
    return { html: renderDocumentHtml(doc.type as DocumentKind, data), data }
  }

  return Promise.resolve()
}

export default publicInvoiceRoute
