/**
 * Document → branded HTML (06, повний UA-комплект). Pure string templating, no browser/deps —
 * unit-testable and doubles as the graceful fallback when Chromium is unavailable (the caller
 * serves this HTML and the user prints-to-PDF). The PDF path (pdf.ts) feeds the same HTML.
 *
 * Visual language mirrors `design-v2/project/documents-screens.jsx` (wfd-*): ASCII brand mark,
 * doctype block, parties grid, per-type body, signature row — stone/lime, print-light.
 * Чесний субсет дизайну: без QR/крипто-блоків (нема даних) і без rich-специфікації
 * (goals/milestones — полів у моделі ще нема); решта — 1:1 за структурою.
 */

import { EU_BODY_BY_KIND, EU_CSS } from './renderEu.js'

export type DocumentKind =
  | 'invoice'
  | 'advance_invoice'
  | 'completion_act'
  | 'specification'
  | 'reconciliation_act'
  | 'contract'

export interface DocumentParty {
  name: string
  legalName?: string | null
  taxId?: string | null
  legalAddress?: string | null
  bankName?: string | null
  iban?: string | null
  signerName?: string | null
  signerTitle?: string | null
  // 06-Е (EU-комплект): EU VAT ID у шапці сторін + BIC/SWIFT у платіжному блоці
  vatId?: string | null
  bic?: string | null
}

/** Одна позиція таблиці робіт (рахунок/акт/специфікація). Усі значення вже відформатовані. */
export interface DocumentLine {
  name: string
  qty: string
  unit: string
  price: string
  sum: string
}

/** Рядок деталізації акта звірки. debit/credit — відформатовані суми або null («—»). */
export interface ReconciliationRow {
  date: string
  doc: string
  desc: string
  debit: string | null
  credit: string | null
}

export interface ContractSection {
  h: string
  p: string[]
}

export interface DocumentRenderData {
  // 06-Е: комплект документів — 'eu' перемикає на EN/VAT-layout (renderEu.ts).
  // Дані для 'eu' приходять уже EN-відформатованими (дати/суми/лейбли).
  kit?: 'ua' | 'eu'
  typeLabel: string // «Рахунок», «Акт виконаних робіт», … / 'Invoice', …
  number: string // INV-2026-000001
  date: string // already-formatted issue date
  orderTitle: string
  amount: string // already-formatted grand total, e.g. «12 000,00»
  currency: string // UAH · USD · EUR
  issuer: DocumentParty // agency legal entity (від кого)
  recipient: DocumentParty // client company (кому)
  // ── збагачення (усі опційні — кожен рендерер має фолбек) ──
  projectName?: string | null
  lines?: DocumentLine[] // нема → одна позиція з orderTitle
  vatNote?: string // «Без ПДВ (неплатник)» / «У т.ч. ПДВ 20%»
  uahTotal?: string // грн-еквівалент (для не-UAH валют)
  rateNote?: string // «за курсом НБУ 41,2857»
  dueDate?: string // invoice: сплатити до
  paymentPurpose?: string // invoice: призначення платежу
  basisRef?: string // act: підстава (рахунок №… від …)
  contractRef?: string // 06-ДОГОВІР-2: «Договір № … від …» (invoice/act)
  periodFrom?: string
  periodTo?: string
  description?: string | null // specification: контекст із замовлення
  opening?: string // reconciliation: сальдо на початок
  totalDebit?: string
  totalCredit?: string
  closing?: string
  operations?: ReconciliationRow[]
  contractPlace?: string // contract: місце укладання
  contractSections?: ContractSection[] // нема → типові рамкові розділи
  // 06-А: редагована примітка з шаблону агенції (всі типи, крім contract — там секції)
  customNote?: string
  // 06-А PDF-брендинг: лого (data-URI), назва замість «workflo.space», акцентний колір
  branding?: { logoDataUri?: string; brandName?: string; accentColor?: string }
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

function parties(d: DocumentRenderData, fromLabel: string, toLabel: string): string {
  return `<div class="parties">${partyBlock(fromLabel, d.issuer)}${partyBlock(toLabel, d.recipient)}</div>`
}

function head(d: DocumentRenderData, extraRows: { k: string; v: string }[] = []): string {
  const rows = [{ k: 'дата', v: d.date }, ...extraRows]
    .map(
      (r) =>
        `<div class="doctype-r"><span class="doctype-l">${esc(r.k)}</span><span class="doctype-d">${esc(r.v)}</span></div>`
    )
    .join('')
  const brandBlock = d.branding?.logoDataUri
    ? `<img src="${d.branding.logoDataUri}" alt="" style="max-height:42px;max-width:220px;display:block" />`
    : d.branding?.brandName
      ? `<div class="brand-name">${esc(d.branding.brandName)}<span class="brand-dot">.</span></div>`
      : `<div class="brand-name">workflo<span class="brand-dot">.</span>space</div>
      <div class="brand-sub">цифровий офіс команди автоматизаторів</div>`
  return `
  <div class="brand">
    <div>
      ${brandBlock}
    </div>
    <div class="doctype">
      <div class="doctype-t">${esc(d.typeLabel)}</div>
      <div class="doctype-n">${esc(d.number)}</div>
      ${rows}
    </div>
  </div>`
}

function projectRow(d: DocumentRenderData, extra: { k: string; v: string }[] = []): string {
  const rows = [
    { k: 'проєкт', v: `${d.projectName ? `${d.projectName} · ` : ''}${d.orderTitle}` },
    ...extra,
  ]
  return `<div class="project">${rows
    .map((r) => `<div class="project-k">${esc(r.k)}</div><div class="project-v">${esc(r.v)}</div>`)
    .join('')}</div>`
}

function fallbackLines(d: DocumentRenderData): DocumentLine[] {
  return [{ name: d.orderTitle, qty: '1', unit: 'послуга', price: d.amount, sum: d.amount }]
}

function linesTable(lines: DocumentLine[], nameHeader: string): string {
  const body = lines
    .map(
      (l, i) => `<tr>
        <td class="row-n">${String(i + 1).padStart(2, '0')}</td>
        <td>${esc(l.name)}</td>
        <td class="num">${esc(l.qty)}</td>
        <td>${esc(l.unit)}</td>
        <td class="num">${esc(l.price)}</td>
        <td class="num"><strong>${esc(l.sum)}</strong></td>
      </tr>`
    )
    .join('')
  return `<table>
    <thead><tr>
      <th style="width:28px">#</th><th>${esc(nameHeader)}</th>
      <th class="num" style="width:52px">К-сть</th><th style="width:58px">Од.</th>
      <th class="num" style="width:86px">Ціна</th><th class="num" style="width:96px">Сума</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`
}

function totalsBox(
  d: DocumentRenderData,
  rows: { k: string; v: string; grand?: boolean }[]
): string {
  const items = rows
    .map(
      (r) =>
        `<div class="totals-row${r.grand ? ' totals-row--grand' : ''}"><span class="totals-k">${esc(
          r.k
        )}</span><span class="totals-v${r.grand ? ' totals-v--accent' : ''}">${esc(r.v)}</span></div>`
    )
    .join('')
  const note = d.rateNote ? `<div class="rate-note">${esc(d.rateNote)}</div>` : ''
  return `<div class="totals"><div class="totals-box">${items}${note}</div></div>`
}

/** Двосторонні підписи (акт/звірка/договір/специфікація). */
function sigs(d: DocumentRenderData, leftRole = 'Виконавець', rightRole = 'Замовник'): string {
  const side = (role: string, p: DocumentParty) => `
    <div class="sig">
      <div class="sig-role">${esc(role)}</div>
      <div class="sig-line"></div>
      <div class="sig-name">${esc(p.signerName ?? '')}</div>
      <div class="sig-title">${esc(p.signerTitle ?? (p.legalName || p.name))}</div>
    </div>`
  return `<div class="sigs">${side(leftRole, d.issuer)}${side(rightRole, d.recipient)}</div>`
}

function issuerSig(d: DocumentRenderData): string {
  const signer = d.issuer.signerName
    ? `${esc(d.issuer.signerTitle ?? 'Підпис')}: ${esc(d.issuer.signerName)}`
    : 'Підпис: ________________'
  return `<div class="sign"><div>${signer}</div><div>Дата: ${esc(d.date)}</div></div>`
}

function foot(d: DocumentRenderData): string {
  return `<div class="foot">${esc(d.number)} · згенеровано workflo.space</div>`
}

// ── per-type bodies ───────────────────────────────────────────────────────────

/** 06-А: редагована примітка з шаблону агенції ({{змінні}} вже підставлені). */
function noteBlock(d: DocumentRenderData): string {
  if (!d.customNote) return ''
  return `<div class="note"><span class="note-l">примітка</span>${esc(d.customNote)}</div>`
}

function invoiceBody(d: DocumentRenderData): string {
  const lines = d.lines?.length ? d.lines : fallbackLines(d)
  const totals: { k: string; v: string; grand?: boolean }[] = []
  if (d.vatNote) totals.push({ k: 'ПДВ', v: d.vatNote })
  totals.push({ k: 'до сплати', v: `${d.amount} ${d.currency}`, grand: true })
  if (d.uahTotal) totals.push({ k: 'в гривні', v: `₴${d.uahTotal}` })
  const purpose = d.paymentPurpose
    ? `<div class="note"><span class="note-l">// призначення платежу</span>${esc(d.paymentPurpose)}</div>`
    : ''
  return [
    head(d, d.dueDate ? [{ k: 'сплатити до', v: d.dueDate }] : []),
    parties(d, '// Постачальник · From', '// Платник · To'),
    projectRow(d, d.contractRef ? [{ k: 'договір', v: d.contractRef }] : []),
    linesTable(lines, 'Опис робіт'),
    totalsBox(d, totals),
    purpose,
    noteBlock(d),
    issuerSig(d),
    foot(d),
  ].join('\n')
}

function completionActBody(d: DocumentRenderData): string {
  const lines = d.lines?.length ? d.lines : fallbackLines(d)
  const period =
    d.periodFrom && d.periodTo ? [{ k: 'період', v: `${d.periodFrom} – ${d.periodTo}` }] : []
  const totals: { k: string; v: string; grand?: boolean }[] = [
    { k: 'всього робіт', v: `${lines.length} поз.` },
    { k: 'сума за актом', v: `${d.amount} ${d.currency}`, grand: true },
  ]
  if (d.uahTotal) totals.push({ k: 'в гривні', v: `₴${d.uahTotal}` })
  return [
    head(d, period),
    parties(d, '// Виконавець', '// Замовник'),
    projectRow(d, [
      ...(d.basisRef ? [{ k: 'підстава', v: d.basisRef }] : []),
      ...(d.contractRef ? [{ k: 'договір', v: d.contractRef }] : []),
    ]),
    `<h2>Перелік виконаних робіт</h2>`,
    linesTable(lines, 'Найменування робіт'),
    totalsBox(d, totals),
    `<h2>Прийняття-передача</h2>
     <p class="p">Виконавець передав, а Замовник прийняв роботи (послуги), наведені в цьому Акті.
     Роботи виконано в повному обсязі та у встановлені строки. Якість робіт відповідає вимогам
     Замовника. Сторони претензій одна до одної не мають.</p>`,
    noteBlock(d),
    sigs(d),
    foot(d),
  ].join('\n')
}

function specificationBody(d: DocumentRenderData): string {
  const lines = d.lines?.length ? d.lines : fallbackLines(d)
  const context = d.description ? `<h2>Контекст</h2><p class="p">${esc(d.description)}</p>` : ''
  return [
    head(d),
    projectRow(d, [{ k: 'замовник', v: d.recipient.name }]),
    context,
    `<h2>Скоуп робіт · позиції</h2>`,
    linesTable(lines, 'Позиція'),
    totalsBox(d, [
      { k: 'бюджет', v: `${d.amount} ${d.currency}`, grand: true },
      ...(d.uahTotal ? [{ k: 'в гривні', v: `₴${d.uahTotal}` }] : []),
    ]),
    noteBlock(d),
    sigs(d),
    foot(d),
  ].join('\n')
}

function reconciliationBody(d: DocumentRenderData): string {
  const ops = d.operations ?? []
  const period =
    d.periodFrom && d.periodTo ? [{ k: 'період', v: `${d.periodFrom} – ${d.periodTo}` }] : []
  const rows = ops
    .map(
      (x) => `<tr>
        <td class="mono">${esc(x.date)}</td>
        <td class="mono strong">${esc(x.doc)}</td>
        <td>${esc(x.desc)}</td>
        <td class="num debit">${x.debit ? esc(x.debit) : '—'}</td>
        <td class="num credit">${x.credit ? esc(x.credit) : '—'}</td>
      </tr>`
    )
    .join('')
  return [
    head(d, period),
    parties(d, '// Виконавець', '// Замовник'),
    `<p class="p">Цей акт складено для звірки взаєморозрахунків між Сторонами за період
     <strong>${esc(d.periodFrom ?? '—')} – ${esc(d.periodTo ?? d.date)}</strong>.
     Усі суми наведено у ${esc(d.currency)}.</p>`,
    `<div class="rec">
      <div class="rec-cell"><div class="rec-l">сальдо на початок</div><div class="rec-v">${esc(d.opening ?? '0,00')}</div></div>
      <div class="rec-cell"><div class="rec-l">обороти · дебет / кредит</div><div class="rec-v"><span class="debit">${esc(d.totalDebit ?? '0,00')}</span> · <span class="credit">${esc(d.totalCredit ?? '0,00')}</span></div></div>
      <div class="rec-cell"><div class="rec-l">сальдо на кінець</div><div class="rec-v rec-v--closing">${esc(d.closing ?? '0,00')}</div></div>
    </div>`,
    `<h2>Деталізація операцій</h2>`,
    `<table>
      <thead><tr>
        <th style="width:74px">Дата</th><th style="width:120px">Документ</th><th>Опис</th>
        <th class="num" style="width:100px">Дебет · нарах.</th><th class="num" style="width:100px">Кредит · оплат.</th>
      </tr></thead>
      <tbody>${rows}
        <tr class="totals-line"><td colspan="3" class="num strong">РАЗОМ ОБОРОТИ:</td>
          <td class="num debit"><strong>${esc(d.totalDebit ?? '0,00')}</strong></td>
          <td class="num credit"><strong>${esc(d.totalCredit ?? '0,00')}</strong></td></tr>
      </tbody>
    </table>`,
    `<div class="closing"><div><div class="note-l">// підсумок</div>
      Заборгованість Замовника перед Виконавцем станом на ${esc(d.date)}</div>
      <div class="closing-v">${esc(d.closing ?? '0,00')} ${esc(d.currency)}</div></div>`,
    `<p class="p small">Сторони підтверджують правильність взаєморозрахунків, наведених у цьому
     Акті. У разі наявності розбіжностей Сторони зобов'язуються повідомити одна одну протягом
     10 (десяти) календарних днів з моменту отримання цього Акту.</p>`,
    sigs(d),
    foot(d),
  ].join('\n')
}

/** Типові розділи рамкового договору — коли зі спеки/UI ще нічого не передано. */
export function defaultContractSections(d: DocumentRenderData): ContractSection[] {
  return [
    {
      h: '1. Предмет договору',
      p: [
        `Виконавець зобов'язується надати Замовнику послуги з розробки програмного забезпечення та суміжні послуги (далі — «Послуги») за замовленнями Замовника, зокрема «${d.orderTitle}», а Замовник зобов'язується прийняти та оплатити Послуги.`,
        "Обсяг, строки та вартість кожного етапу робіт узгоджуються Сторонами у специфікаціях та/або рахунках, які є невід'ємною частиною цього Договору.",
      ],
    },
    {
      h: '2. Порядок виконання та приймання',
      p: [
        "Факт надання Послуг підтверджується Актом виконаних робіт. Якщо Замовник не надав мотивовану відмову протягом 5 (п'яти) робочих днів з дати передачі Акта, Послуги вважаються прийнятими.",
      ],
    },
    {
      h: '3. Вартість та порядок розрахунків',
      p: [
        'Вартість Послуг визначається у рахунках Виконавця. Оплата здійснюється у безготівковій формі протягом строку, зазначеного в рахунку.',
      ],
    },
    {
      h: '4. Права інтелектуальної власності',
      p: [
        'Майнові права інтелектуальної власності на результати робіт переходять до Замовника з моменту повної оплати відповідних Послуг. До моменту оплати всі права належать Виконавцю.',
      ],
    },
    {
      h: '5. Конфіденційність',
      p: [
        "Сторони зобов'язуються не розголошувати конфіденційну інформацію, отриману у зв'язку з виконанням цього Договору, протягом строку його дії та 3 (трьох) років після припинення.",
      ],
    },
    {
      h: '6. Відповідальність та форс-мажор',
      p: [
        "Сторони несуть відповідальність згідно з чинним законодавством України. Сторона звільняється від відповідальності за порушення зобов'язань, якщо воно сталося внаслідок обставин непереборної сили.",
      ],
    },
    {
      h: '7. Строк дії та інші умови',
      p: [
        "Договір набирає чинності з моменту підписання та діє до повного виконання Сторонами своїх зобов'язань. Зміни та доповнення оформлюються письмово за згодою обох Сторін.",
      ],
    },
  ]
}

function contractBody(d: DocumentRenderData): string {
  const sections = d.contractSections?.length ? d.contractSections : defaultContractSections(d)
  const card = (label: string, p: DocumentParty) => {
    const rows = [
      p.taxId ? { k: 'код', v: p.taxId } : null,
      p.legalAddress ? { k: 'адреса', v: p.legalAddress } : null,
      p.iban ? { k: 'IBAN', v: p.iban } : null,
      p.bankName ? { k: 'банк', v: p.bankName } : null,
    ].filter((x): x is { k: string; v: string } => x != null)
    return `<div class="c-party">
      <div class="party-label">${esc(label)}</div>
      <div class="party-name">${esc(p.legalName ?? p.name)}</div>
      ${rows.map((r) => `<div class="c-party-row"><span class="c-party-k">${esc(r.k)}</span><span>${esc(r.v)}</span></div>`).join('')}
    </div>`
  }
  const clauses = sections
    .map(
      (s) =>
        `<div class="clause"><div class="clause-h">${esc(s.h)}</div>${s.p
          .map((p) => `<p class="clause-p">${esc(p)}</p>`)
          .join('')}</div>`
    )
    .join('')
  return [
    head(d, d.contractPlace ? [{ k: 'місце', v: d.contractPlace }] : []),
    `<p class="p">Цей договір про надання послуг (далі — «Договір») укладено <strong>${esc(d.date)}</strong>${
      d.contractPlace ? ` у ${esc(d.contractPlace)}` : ''
    } між:</p>`,
    `<div class="c-parties">${card('// Виконавець', d.issuer)}${card('// Замовник', d.recipient)}</div>`,
    `<p class="p">разом іменовані «Сторони», а кожна окремо — «Сторона», уклали цей Договір про наступне:</p>`,
    `<div class="clauses">${clauses}</div>`,
    sigs(d),
    foot(d),
  ].join('\n')
}

// ── shell ─────────────────────────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1c1917; background: #fff; font-size: 13px; line-height: 1.5;
    padding: 24px 28px;
  }
  .mono, .doctype-l, .doctype-d, .note-l, .rate-note, .foot, .row-n { font-family: 'SFMono-Regular', 'Menlo', monospace; }
  .brand { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1c1917; padding-bottom: 14px; }
  .brand-name { font-weight: 700; font-size: 18px; letter-spacing: -0.02em; }
  .brand-dot { color: #A3D90D; } /* --wf-accent (light) */
  .brand-sub { color: #78716c; font-size: 11px; margin-top: 2px; }
  .doctype { text-align: right; }
  .doctype-t { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #78716c; }
  .doctype-n { font-weight: 700; font-size: 16px; }
  .doctype-r { font-size: 11px; }
  .doctype-l { color: #a8a29e; margin-right: 6px; }
  .doctype-d { color: #44403c; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 22px 0; }
  .party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #a8a29e; margin-bottom: 4px; }
  .party-name { font-weight: 600; }
  .party-row { color: #57534e; font-size: 12px; }
  .project { display: grid; grid-template-columns: 72px 1fr; gap: 2px 12px; margin: 0 0 16px; font-size: 12px; }
  .project-k { color: #a8a29e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding-top: 2px; }
  .project-v { color: #1c1917; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #44403c; margin: 20px 0 8px; border-bottom: 1px solid #e7e5e4; padding-bottom: 4px; }
  .p { font-size: 12px; color: #44403c; margin: 8px 0; }
  .p.small { font-size: 10.5px; color: #57534e; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #a8a29e; border-bottom: 1px solid #e7e5e4; padding: 6px 8px; }
  td { padding: 8px; border-bottom: 1px solid #f5f5f4; vertical-align: top; font-size: 12px; }
  td.num, th.num { text-align: right; font-feature-settings: 'tnum'; }
  td.strong { font-weight: 600; }
  .row-n { color: #a8a29e; font-size: 10px; }
  .debit { color: #b91c1c; }
  .credit { color: #15803d; }
  .totals-line td { background: #fafaf9; font-weight: 600; }
  .totals { display: flex; justify-content: flex-end; margin-top: 12px; }
  .totals-box { min-width: 260px; }
  .totals-row { display: flex; justify-content: space-between; gap: 24px; padding: 4px 0; font-size: 12px; color: #57534e; }
  .totals-row--grand { border-top: 2px solid #1c1917; margin-top: 4px; padding-top: 8px; font-weight: 700; font-size: 14px; color: #1c1917; }
  .totals-v--accent { background: #1c1917; color: #d3f36b; padding: 1px 8px; border-radius: 3px; }
  .rate-note { font-size: 9.5px; color: #78716c; text-align: right; margin-top: 4px; }
  .note { margin-top: 14px; padding: 10px 14px; border: 1px dashed #d6d3d1; border-radius: 6px; font-size: 11.5px; color: #44403c; }
  .note-l { display: block; font-size: 9.5px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .rec { display: grid; grid-template-columns: 1fr 1.4fr 1fr; gap: 12px; margin: 14px 0; }
  .rec-cell { padding: 10px 14px; border: 1px solid #e7e5e4; border-radius: 6px; background: #fafaf9; }
  .rec-l { font-size: 9.5px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .rec-v { font-weight: 600; font-feature-settings: 'tnum'; }
  .rec-v--closing { background: #1c1917; color: #d3f36b; display: inline-block; padding: 1px 8px; border-radius: 3px; }
  .closing { margin-top: 14px; padding: 12px 16px; border: 2px solid #1c1917; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #fafaf9; font-size: 12px; }
  .closing-v { font-size: 20px; font-weight: 700; font-feature-settings: 'tnum'; white-space: nowrap; }
  .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; }
  .sig-role { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #78716c; margin-bottom: 26px; }
  .sig-line { border-bottom: 1px solid #1c1917; margin-bottom: 4px; }
  .sig-name { font-weight: 600; font-size: 12px; min-height: 15px; }
  .sig-title { font-size: 10.5px; color: #78716c; }
  .sign { margin-top: 40px; display: flex; justify-content: space-between; color: #57534e; font-size: 12px; }
  .c-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
  .c-party { border: 1px solid #e7e5e4; border-radius: 6px; padding: 12px 14px; }
  .c-party-row { display: grid; grid-template-columns: 52px 1fr; gap: 8px; font-size: 11px; color: #44403c; margin-top: 2px; }
  .c-party-k { color: #a8a29e; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.05em; padding-top: 1px; }
  .clauses { column-count: 2; column-gap: 24px; margin-top: 8px; }
  .clause { break-inside: avoid; margin-bottom: 12px; }
  .clause-h { font-weight: 700; font-size: 11px; margin-bottom: 4px; }
  .clause-p { font-size: 10px; color: #44403c; margin: 0 0 6px; line-height: 1.55; }
  .foot { margin-top: 28px; border-top: 1px solid #e7e5e4; padding-top: 8px; color: #a8a29e; font-size: 10px; }
`

const BODY_BY_KIND: Record<DocumentKind, (d: DocumentRenderData) => string> = {
  invoice: invoiceBody,
  advance_invoice: invoiceBody,
  completion_act: completionActBody,
  specification: specificationBody,
  reconciliation_act: reconciliationBody,
  contract: contractBody,
}

export function renderDocumentHtml(kind: DocumentKind, d: DocumentRenderData): string {
  // 06-Е: kit='eu' → окремий європейський layout (EN, VAT-блок) з renderEu.ts
  const isEu = d.kit === 'eu'
  const body = (isEu ? EU_BODY_BY_KIND : BODY_BY_KIND)[kind](d)
  // 06-А брендинг: акцентний колір агенції підміняє системний у CSS (крапка бренду
  // та тотал-плашки). Формат кольору валідовано на вході (#hex).
  let css = isEu ? EU_CSS : CSS
  const accent = d.branding?.accentColor
  if (accent) {
    css = css
      .split('#A3D90D')
      .join(accent)
      .split('#d3f36b')
      .join(accent)
      .split('#C5F82A')
      .join(accent)
  }
  return `<!doctype html>
<html lang="${isEu ? 'en' : 'uk'}"><head><meta charset="utf-8" />
<title>${esc(d.typeLabel)} ${esc(d.number)}</title>
<style>${css}</style></head>
<body>
${body}
</body></html>`
}

// 19-Г: спільний стиль/екранування для standalone-шаблонів (client monthly report).
export const DOCUMENT_CSS = CSS
export const escapeHtml = esc
