import { bindTranslator, type LocaleKey } from '../i18n.js'
import { escapeText, renderHeading, renderLayout, renderMuted, renderParagraph } from '../render.js'
import type { RenderedEmail } from './welcome.js'

/**
 * S11: місячний дайджест власнику агенції (cron, opt-in тумблер у settings).
 * Всі числа рахує API (cron) — шаблон лише рендерить рядки «показник → значення».
 */
export interface MonthlyReportEmailVars {
  /** «червень 2026» — уже локалізований лейбл періоду. */
  periodLabel: string
  /** Рядки дайджесту в порядку показу: [label, value]. */
  rows: [string, string][]
  locale?: LocaleKey
}

function renderRows(rows: [string, string][]): string {
  const trs = rows
    .map(
      ([label, value]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;color:#555;font-size:14px;">${escapeText(label)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-weight:600;font-size:14px;text-align:right;white-space:nowrap;">${escapeText(value)}</td>
    </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;border-collapse:separate;overflow:hidden;margin:16px 0;">${trs}</table>`
}

export function renderMonthlyReportEmail(vars: MonthlyReportEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = `${t('monthlyReport.subject')} — ${vars.periodLabel}`
  const bodyHtml = [
    renderHeading(subject),
    renderParagraph(t('monthlyReport.body')),
    renderRows(vars.rows),
    renderMuted(t('monthlyReport.footer')),
  ].join('\n')
  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }),
  }
}
