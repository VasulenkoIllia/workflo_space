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

/**
 * 19-Г: лист КЛІЄНТУ з місячним звітом (PDF у вкладенні). Ті самі rows-рядки,
 * інша тональність (клієнтська) і згадка про вкладення.
 */
export interface ClientMonthlyReportEmailVars {
  agencyName: string
  periodLabel: string
  rows: [string, string][]
  locale?: LocaleKey
}

export function renderClientMonthlyReportEmail(vars: ClientMonthlyReportEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const t = bindTranslator(locale)
  const subject = `${t('clientMonthlyReport.subject')} — ${vars.periodLabel} — ${vars.agencyName}`
  const bodyHtml = [
    renderHeading(subject),
    renderParagraph(t('clientMonthlyReport.body')),
    renderRows(vars.rows),
    renderMuted(t('clientMonthlyReport.footer')),
  ].join('\n')
  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }),
  }
}

/**
 * S12-06: ранковий дайджест непрочитаних in-app сповіщень (opt-in digestDaily).
 * rows = [заголовок сповіщення, текст]. Без нових i18n-ключів — subject інлайном.
 */
export interface DigestEmailVars {
  count: number
  rows: [string, string][]
  locale?: LocaleKey
}

export function renderDigestEmail(vars: DigestEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const subject =
    locale === 'en'
      ? `Notification digest — ${vars.count} new`
      : `Дайджест сповіщень — ${vars.count} нових`
  const intro =
    locale === 'en'
      ? 'While you were away (quiet hours / since the last digest):'
      : 'Поки вас не було (тихі години / від минулого дайджесту):'
  const bodyHtml = [renderHeading(subject), renderParagraph(intro), renderRows(vars.rows)].join(
    '\n'
  )
  return {
    subject,
    html: renderLayout({ locale, title: subject, preheader: subject, bodyHtml }),
  }
}

/**
 * S12-07: owner-розсилка сегменту клієнтів. subject/body від власника (plain text,
 * подвійний перенос → абзац); увесь текст екранується.
 */
export interface BroadcastEmailVars {
  subject: string
  body: string
  locale?: LocaleKey
}

export function renderBroadcastEmail(vars: BroadcastEmailVars): RenderedEmail {
  const locale: LocaleKey = vars.locale ?? 'uk'
  const paragraphs = vars.body
    .split(/\n{2,}/)
    .map((p) => renderParagraph(escapeText(p).replace(/\n/g, '<br />')))
    .join('\n')
  const bodyHtml = [renderHeading(escapeText(vars.subject)), paragraphs].join('\n')
  return {
    subject: vars.subject,
    html: renderLayout({ locale, title: vars.subject, preheader: vars.subject, bodyHtml }),
  }
}
