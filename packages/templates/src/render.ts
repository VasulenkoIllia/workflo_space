/**
 * Document → branded HTML (06). Pure string templating, no browser/deps — so it is unit-testable
 * and doubles as the graceful fallback when Chromium is unavailable (the caller serves this HTML
 * and the user prints-to-PDF). The PDF path (pdf.ts) feeds this same HTML to Chromium.
 *
 * Visual language mirrors `design-v2/project/documents-screens.jsx` (wfd-*): ASCII brand mark,
 * doctype block, parties grid, a single work line + total, signature row — stone/lime tokens.
 */

export interface DocumentParty {
  name: string
  legalName?: string | null
  taxId?: string | null
  legalAddress?: string | null
  bankName?: string | null
  iban?: string | null
  signerName?: string | null
  signerTitle?: string | null
}

export interface DocumentRenderData {
  typeLabel: string // «Рахунок», «Акт виконаних робіт», …
  number: string // INV-2026-000001
  date: string // already-formatted issue date
  orderTitle: string
  amount: string // already-formatted money, e.g. «12 000,00»
  currency: string // UAH · USD · EUR
  issuer: DocumentParty // agency legal entity (від кого)
  recipient: DocumentParty // client company (кому)
}

/** Minimal HTML-escape — all interpolated values are user/tenant data. */
function esc(v: string | null | undefined): string {
  if (!v) return ''
  return v.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}

function partyBlock(label: string, p: DocumentParty): string {
  const rows = [
    p.legalName && p.legalName !== p.name ? esc(p.legalName) : '',
    p.taxId ? `Код: ${esc(p.taxId)}` : '',
    p.legalAddress ? esc(p.legalAddress) : '',
    p.bankName || p.iban
      ? `${esc(p.bankName ?? '')}${p.bankName && p.iban ? ' · ' : ''}${esc(p.iban ?? '')}`
      : '',
  ].filter(Boolean)
  return `
    <div class="party">
      <div class="party-label">${esc(label)}</div>
      <div class="party-name">${esc(p.name)}</div>
      ${rows.map((r) => `<div class="party-row">${r}</div>`).join('')}
    </div>`
}

export function renderDocumentHtml(d: DocumentRenderData): string {
  const total = `${esc(d.amount)} ${esc(d.currency)}`
  const signer = d.issuer.signerName
    ? `${esc(d.issuer.signerTitle ?? 'Підпис')}: ${esc(d.issuer.signerName)}`
    : 'Підпис: ________________'
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8" />
<title>${esc(d.typeLabel)} ${esc(d.number)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1c1917; background: #fff; font-size: 13px; line-height: 1.5;
    padding: 24px 28px;
  }
  .mono { font-family: 'SFMono-Regular', 'Menlo', monospace; }
  .brand { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1c1917; padding-bottom: 14px; }
  .brand-name { font-weight: 700; font-size: 18px; letter-spacing: -0.02em; }
  .brand-dot { color: #A3D90D; } /* --wf-accent (light) — not tailwind lime-500 */
  .brand-sub { color: #78716c; font-size: 11px; margin-top: 2px; }
  .doctype { text-align: right; }
  .doctype-l { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #78716c; }
  .doctype-n { font-weight: 700; font-size: 16px; }
  .doctype-d { color: #78716c; font-size: 11px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 22px 0; }
  .party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #a8a29e; margin-bottom: 4px; }
  .party-name { font-weight: 600; }
  .party-row { color: #57534e; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #a8a29e; border-bottom: 1px solid #e7e5e4; padding: 6px 8px; }
  td { padding: 10px 8px; border-bottom: 1px solid #f5f5f4; vertical-align: top; }
  td.r, th.r { text-align: right; }
  .total { display: flex; justify-content: flex-end; gap: 24px; margin-top: 14px; }
  .total-l { color: #78716c; }
  .total-v { font-weight: 700; font-size: 16px; }
  .sign { margin-top: 40px; display: flex; justify-content: space-between; color: #57534e; font-size: 12px; }
  .foot { margin-top: 28px; border-top: 1px solid #e7e5e4; padding-top: 8px; color: #a8a29e; font-size: 10px; }
</style></head>
<body>
  <div class="brand">
    <div>
      <div class="brand-name">workflo<span class="brand-dot">.</span>space</div>
      <div class="brand-sub">цифровий офіс команди автоматизаторів</div>
    </div>
    <div class="doctype">
      <div class="doctype-l">${esc(d.typeLabel)}</div>
      <div class="doctype-n mono">${esc(d.number)}</div>
      <div class="doctype-d">від ${esc(d.date)}</div>
    </div>
  </div>

  <div class="parties">
    ${partyBlock('Виконавець', d.issuer)}
    ${partyBlock('Замовник', d.recipient)}
  </div>

  <table>
    <thead><tr><th>Опис робіт</th><th class="r">Сума</th></tr></thead>
    <tbody><tr><td>${esc(d.orderTitle)}</td><td class="r mono">${total}</td></tr></tbody>
  </table>

  <div class="total">
    <span class="total-l">Разом до сплати</span>
    <span class="total-v mono">${total}</span>
  </div>

  <div class="sign">
    <span>${signer}</span>
    <span class="mono">${esc(d.number)}</span>
  </div>

  <div class="foot">Згенеровано workflo.space · ${esc(d.date)} · номер ${esc(d.number)} є наскрізним і незмінним</div>
</body></html>`
}
