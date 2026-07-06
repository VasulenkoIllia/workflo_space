import { DOCUMENT_CSS, escapeHtml as esc } from './render.js'

/**
 * 19-Г: місячний звіт клієнту (PDF). Company-scoped документ без замовлення:
 * що зроблено за місяць, години по проєктах, оплати і поточний борг.
 * Всі числа рахує API (services/clientMonthlyReport.ts) — тут лише рендер.
 */
export interface ClientMonthlyReportData {
  agencyName: string
  companyName: string
  /** «липень 2026» — локалізований лейбл періоду. */
  periodLabel: string
  number: string
  generatedAt: string
  newOrders: { title: string; amount: string | null }[]
  completedOrders: { title: string }[]
  hoursByProject: { project: string; hours: number }[]
  totalHours: number
  /** Оплати за місяць, per-currency: «500 USD · 8000 UAH». */
  paidLabel: string
  /** Поточний борг, per-currency (на момент генерації). */
  debtLabel: string
}

function ordersTable(
  rows: { title: string; amount?: string | null }[],
  amountHead?: string
): string {
  const trs = rows
    .map(
      (r, i) => `<tr>
        <td class="row-n">${i + 1}</td>
        <td>${esc(r.title)}</td>
        ${amountHead ? `<td class="num">${esc(r.amount ?? '—')}</td>` : ''}
      </tr>`
    )
    .join('')
  return `<table>
    <thead><tr><th style="width:28px">№</th><th>Замовлення</th>${amountHead ? `<th class="num">${amountHead}</th>` : ''}</tr></thead>
    <tbody>${trs}</tbody>
  </table>`
}

export function renderClientMonthlyReportHtml(d: ClientMonthlyReportData): string {
  const hours =
    d.hoursByProject.length > 0
      ? `<table>
          <thead><tr><th>Проєкт</th><th class="num">Годин</th></tr></thead>
          <tbody>
            ${d.hoursByProject
              .map(
                (h) => `<tr><td>${esc(h.project)}</td><td class="num">${String(h.hours)}</td></tr>`
              )
              .join('')}
            <tr class="totals-line"><td>Разом</td><td class="num">${String(d.totalHours)}</td></tr>
          </tbody>
        </table>`
      : `<div class="p small">За період час не логувався.</div>`

  const body = `
  <div class="brand">
    <div>
      <div class="brand-name">${esc(d.agencyName)}<span class="brand-dot">.</span></div>
      <div class="brand-sub">місячний звіт для клієнта</div>
    </div>
    <div class="doctype">
      <div class="doctype-t">Місячний звіт</div>
      <div class="doctype-n">${esc(d.number)}</div>
      <div class="doctype-r"><span class="doctype-l">період</span><span class="doctype-d">${esc(d.periodLabel)}</span></div>
      <div class="doctype-r"><span class="doctype-l">сформовано</span><span class="doctype-d">${esc(d.generatedAt)}</span></div>
    </div>
  </div>

  <div class="p" style="margin-top:16px">Клієнт: <strong>${esc(d.companyName)}</strong></div>

  <h2>Нові замовлення (${String(d.newOrders.length)})</h2>
  ${d.newOrders.length > 0 ? ordersTable(d.newOrders, 'Сума') : '<div class="p small">Нових замовлень за період не було.</div>'}

  <h2>Завершено за період (${String(d.completedOrders.length)})</h2>
  ${d.completedOrders.length > 0 ? ordersTable(d.completedOrders) : '<div class="p small">Завершених замовлень за період не було.</div>'}

  <h2>Години по проєктах</h2>
  ${hours}

  <h2>Фінанси</h2>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Оплачено за період</span><span>${esc(d.paidLabel)}</span></div>
      <div class="totals-row totals-row--grand"><span>Поточний борг</span><span class="totals-v--accent">${esc(d.debtLabel)}</span></div>
    </div>
  </div>

  <div class="note">
    <span class="note-l">примітка</span>
    Звіт сформовано автоматично за календарний місяць. Питання по звіту — просто
    відповідайте на цей лист або напишіть у чат відповідного замовлення.
  </div>`

  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8" />
<title>Місячний звіт ${esc(d.number)}</title>
<style>${DOCUMENT_CSS}</style></head>
<body>
${body}
</body></html>`
}
