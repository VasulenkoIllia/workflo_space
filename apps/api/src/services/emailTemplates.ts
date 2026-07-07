import { withTenant } from '@workflo/db'
import type { NotifyInput } from '@workflo/notifications'

/**
 * 08-EMAIL (рішення власника 06.07): owner-override листів — тема + вступ поверх
 * системного макета, окремо uk/en, ЛИШЕ бізнес-листи. Auth-критичні листи
 * (пароль/верифікація/magic-link/зміна email) редагуванню не підлягають — зіпсований
 * шаблон не може заблокувати вхід. {{змінні}} = ключі vars події (невідомі — видимі).
 */
export const EDITABLE_EMAIL_EVENTS: { event: string; label: string; vars: string[] }[] = [
  { event: 'orders.created', label: 'Замовлення створено', vars: ['orderTitle', 'orderUrl'] },
  {
    event: 'orders.status_changed',
    label: 'Статус замовлення змінено',
    vars: ['orderTitle', 'orderUrl', 'newClientStatus'],
  },
  { event: 'orders.assigned', label: 'Призначено виконавця', vars: ['orderTitle', 'orderUrl'] },
  {
    event: 'orders.approval_requested',
    label: 'Запит на погодження оцінки',
    vars: ['orderTitle', 'orderUrl'],
  },
  {
    event: 'orders.approval_decided',
    label: 'Рішення по погодженню',
    vars: ['orderTitle', 'orderUrl', 'approved', 'comment'],
  },
  {
    event: 'chat.new_comment',
    label: 'Нове повідомлення в чаті',
    vars: ['orderTitle', 'authorName', 'preview', 'orderUrl'],
  },
  {
    event: 'chat.mentioned',
    label: 'Згадка в чаті',
    vars: ['orderTitle', 'authorName', 'preview', 'orderUrl'],
  },
  {
    event: 'billing.invoice_sent',
    label: 'Рахунок виставлено',
    vars: ['invoiceNumber', 'amount', 'dueDate', 'invoiceUrl'],
  },
  {
    event: 'billing.payment_reminder',
    label: 'Нагадування про оплату (дунінг)',
    vars: ['amountDue', 'dueDateLabel', 'phase', 'daysOverdue', 'periodLabel', 'portalUrl'],
  },
  {
    event: 'billing.invoice_paid',
    label: 'Оплату отримано',
    vars: ['amount', 'method', 'portalUrl'],
  },
  {
    event: 'documents.completion_act_ready',
    label: 'Документ готовий (акт/інше)',
    vars: ['documentLabel', 'documentNumber', 'documentUrl'],
  },
  { event: 'reports.monthly', label: 'Місячний звіт власнику', vars: ['periodLabel'] },
  // Псевдо-подія: лист клієнту з місячним звітом (direct-mail у cron, не notify)
  {
    event: 'reports.client_monthly',
    label: 'Місячний звіт клієнту (PDF)',
    vars: ['periodLabel', 'agencyName'],
  },
]

const EDITABLE_SET = new Set(EDITABLE_EMAIL_EVENTS.map((e) => e.event))

/**
 * Override листа для отримувача: агенція резолвиться з профілю (внутрішній член →
 * перша agency; клієнт → агенція його компанії). Подія поза редагованим списком або
 * агенція без override → undefined (системний текст).
 */
export async function resolveEmailOverrides(
  profileId: string,
  event: string
): Promise<NotifyInput['emailOverrides']> {
  if (!EDITABLE_SET.has(event)) return undefined

  // email_templates під FORCE RLS → читаємо через withTenant (GUC контексту запиту)
  const rows = await withTenant(async (tx) => {
    const agencyMember = await tx.agencyMember.findFirst({
      where: { profileId },
      select: { agencyId: true },
    })
    let agencyId = agencyMember?.agencyId ?? null
    if (!agencyId) {
      const companyMember = await tx.companyMember.findFirst({
        where: { profileId },
        select: { company: { select: { agencyId: true } } },
      })
      agencyId = companyMember?.company.agencyId ?? null
    }
    if (!agencyId) return []
    return tx.emailTemplate.findMany({
      where: { agencyId, event },
      select: { locale: true, subject: true, intro: true },
    })
  })
  if (rows.length === 0) return undefined

  const overrides: NonNullable<NotifyInput['emailOverrides']> = {}
  for (const r of rows) {
    if (r.locale === 'uk' || r.locale === 'en') {
      overrides[r.locale] = { subject: r.subject, intro: r.intro }
    }
  }
  return overrides
}
