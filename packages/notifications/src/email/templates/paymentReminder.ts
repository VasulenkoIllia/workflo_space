import { bindTranslator, type LocaleKey } from '../i18n.js'
import { renderButton, renderHeading, renderLayout, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

/**
 * 05-Б дунінг: нагадування клієнту про оплату нарахування. Тон залежить від фази:
 * upcoming (до dueDate) — мʼяке «наближається термін», due (у день) — «сьогодні»,
 * overdue (після) — «прострочено N днів». Тема/вступ кастомізуються через 08-EMAIL.
 */
export type PaymentReminderPhase = 'upcoming' | 'due' | 'overdue'

export interface PaymentReminderEmailVars {
  amountDue: string
  dueDateLabel: string
  phase: PaymentReminderPhase
  daysOverdue: number
  periodLabel?: string | null
  portalUrl: string
  locale?: LocaleKey
}

export function renderPaymentReminderEmail(vars: PaymentReminderEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)

  const subject = t(`paymentReminder.subject_${vars.phase}`, { amountDue: vars.amountDue })
  const body =
    vars.phase === 'overdue'
      ? t('paymentReminder.body_overdue', {
          amountDue: vars.amountDue,
          dueDateLabel: vars.dueDateLabel,
          daysOverdue: String(vars.daysOverdue),
        })
      : t(`paymentReminder.body_${vars.phase}`, {
          amountDue: vars.amountDue,
          dueDateLabel: vars.dueDateLabel,
        })

  const bodyHtml = [
    renderHeading(t(`paymentReminder.h1_${vars.phase}`)),
    renderParagraph(body),
    ...(vars.periodLabel
      ? [renderParagraph(t('paymentReminder.period', { periodLabel: vars.periodLabel }))]
      : []),
    renderButton(vars.portalUrl, t('paymentReminder.cta')),
    renderParagraph(t('paymentReminder.already_paid')),
  ].join('\n')

  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }),
  }
}

/**
 * 05-Б ескалація власнику на останньому кроці ланцюжка: клієнт не платить попри
 * всі нагадування — час втручатись особисто. Завжди uk (внутрішній лист команди).
 */
export interface DunningEscalationEmailVars {
  companyName: string
  amountDue: string
  daysOverdue: number
  clientUrl: string
}

export function renderDunningEscalationEmail(vars: DunningEscalationEmailVars): RenderedEmail {
  const subject = `Прострочена оплата: ${vars.companyName} — ${vars.amountDue}`
  const bodyHtml = [
    renderHeading('Ланцюжок нагадувань вичерпано'),
    renderParagraph(
      `Клієнт «${vars.companyName}» не оплатив нарахування на ${vars.amountDue} — ` +
        `прострочення ${vars.daysOverdue} дн. Усі автоматичні нагадування надіслано; ` +
        `далі — особистий контакт або списання боргу.`
    ),
    renderButton(vars.clientUrl, 'Відкрити картку клієнта'),
  ].join('\n')

  return {
    subject,
    html: renderLayout({ locale: 'uk', title: subject, preheader: subject, bodyHtml }),
  }
}
