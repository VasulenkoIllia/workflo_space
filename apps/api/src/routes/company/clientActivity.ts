import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'

/**
 * 28-Б C360 «Активність» — агрегований per-client timeline: об'єднує події замовлень
 * (ActivityLog), підтверджені платежі та надіслані/прийняті документи цієї компанії в
 * один відсортований стрічкою фід. Останній відсутній таб дизайну client360.
 * Internal-non-manager (як інші фін-таби картки); cross-tenant company → 404.
 */
const ACTION_LABEL: Record<string, string> = {
  status_changed: 'змінив статус замовлення',
  'order.status_changed': 'змінив статус замовлення',
  comment_created: 'коментар у замовленні',
  'order.comment_created': 'коментар у замовленні',
  file_uploaded: 'завантажив файл',
  'order.file_uploaded': 'завантажив файл',
  'order.file_deleted': 'видалив файл',
  order_assigned: 'призначив виконавця',
  'order.assigned': 'призначив виконавця',
  executor_assigned: 'призначив виконавця',
  'order.time_logged': 'залогував час',
  'order.coassignees_updated': 'оновив виконавців',
  'order.reconciled': 'звірив години',
  approval_requested: 'надіслав оцінку на погодження',
  'order.approval_requested': 'надіслав оцінку на погодження',
  approval_decided: 'клієнт вирішив по оцінці',
  'order.approval_decided': 'клієнт вирішив по оцінці',
  order_created: 'створив замовлення',
  'order.created': 'створив замовлення',
}
const DOC_TYPE_LABEL: Record<string, string> = {
  contract: 'Договір',
  advance_invoice: 'Аванс-рахунок',
  invoice: 'Рахунок',
  completion_act: 'Акт',
  specification: 'Специфікація',
  reconciliation_act: 'Акт звірки',
  monthly_report: 'Звіт',
}
const num = (d: unknown): number => (d == null ? 0 : Number(d))

export interface ClientActivityItem {
  id: string
  kind: 'order' | 'payment' | 'document'
  at: string
  title: string
  orderId: string | null
  actorName: string | null
}

const clientActivityRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/workspace/clients/:id/activity',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const limit = Math.min(Math.max(Number(request.query.limit ?? 40) || 40, 1), 100)
      const companyId = request.params.id

      const items = await withTenant(async (tx) => {
        // IDOR: компанія має належати активній агенції (інакше 404, не палимо існування).
        const company = await tx.company.findFirst({
          where: { id: companyId, agencyId },
          select: { id: true },
        })
        if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Клієнта не знайдено', 404)

        const [logs, payments, docs] = await Promise.all([
          tx.activityLog.findMany({
            where: { agencyId, order: { is: { companyId } } },
            select: {
              id: true,
              action: true,
              createdAt: true,
              orderId: true,
              order: { select: { title: true } },
              actor: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
          tx.payment.findMany({
            where: { agencyId, companyId, status: 'confirmed' },
            select: {
              id: true,
              amount: true,
              currency: true,
              type: true,
              confirmedAt: true,
              orderId: true,
            },
            orderBy: { confirmedAt: 'desc' },
            take: limit,
          }),
          tx.document.findMany({
            where: { agencyId, companyId, status: { in: ['sent', 'accepted'] } },
            select: {
              id: true,
              type: true,
              number: true,
              status: true,
              sentAt: true,
              acceptedAt: true,
              orderId: true,
            },
            orderBy: { generatedAt: 'desc' },
            take: limit,
          }),
        ])

        const merged: ClientActivityItem[] = []
        for (const l of logs) {
          merged.push({
            id: `log-${l.id}`,
            kind: 'order',
            at: l.createdAt.toISOString(),
            title: `${ACTION_LABEL[l.action] ?? l.action}${l.order?.title ? ` · ${l.order.title}` : ''}`,
            orderId: l.orderId,
            actorName: l.actor?.name ?? null,
          })
        }
        for (const p of payments) {
          merged.push({
            id: `pay-${p.id}`,
            kind: 'payment',
            at: p.confirmedAt.toISOString(),
            title: `Оплата ${num(p.amount).toFixed(2)} ${p.currency}${p.type !== 'final' ? ` (${p.type})` : ''}`,
            orderId: p.orderId,
            actorName: null,
          })
        }
        for (const d of docs) {
          const at = d.status === 'accepted' ? d.acceptedAt : d.sentAt
          if (!at) continue
          merged.push({
            id: `doc-${d.id}`,
            kind: 'document',
            at: at.toISOString(),
            title: `${DOC_TYPE_LABEL[d.type] ?? d.type} №${d.number} — ${d.status === 'accepted' ? 'прийнято' : 'надіслано'}`,
            orderId: d.orderId,
            actorName: null,
          })
        }
        merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
        return merged.slice(0, limit)
      })

      return reply.send({ success: true, data: { items } })
    }
  )

  return Promise.resolve()
}

export default clientActivityRoute
