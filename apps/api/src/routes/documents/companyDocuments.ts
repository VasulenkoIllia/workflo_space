import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ChromiumUnavailableError,
  htmlToPdf,
  renderClientMonthlyReportHtml,
} from '@workflo/templates'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { computeClientMonthlyNumbers, moneyLabel } from '../../services/clientMonthlyReport.js'
import { DOC_TYPE_LABEL } from '../../services/documentRender.js'
import { dispatchNotification } from '../../services/notifications.js'
import { DOC_SELECT } from './shared.js'

/**
 * R2 (аудит r6, розбиття documents.ts): COMPANY-scoped документообіг — портальний
 * список, прийняття клієнтом (typed signature), PDF місячного звіту та огляд
 * документів клієнта на картці 360°.
 */
const companyDocumentsRoute: FastifyPluginAsync = (fastify) => {
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

  return Promise.resolve()
}

export default companyDocumentsRoute
