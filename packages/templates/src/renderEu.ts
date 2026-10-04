/**
 * EU document kit (06-Е) — окремий європейський layout, НЕ переклад UA-комплекту
 * (дизайн: design-v2/project/workspace-documents-eu.jsx, wfd-eu-*). EN-мова,
 * VAT-блок display-only: суми системи не змінюються — «VAT 0% — reverse charge»
 * для типового intra-EU B2B кейсу; повне ПДВ-числення — S13-06 (рішення власника).
 * Дані приходять уже EN-відформатовані з buildRenderData (kit='eu').
 */
import {
  type ContractSection,
  type DocumentKind,
  type DocumentLine,
  type DocumentParty,
  type DocumentRenderData,
  escapeHtml as esc,
} from './render.js'

/** Права шапка: реквізити виставника (name + addr + Reg/VAT + email-рядка нема в моделі). */
function euSeller(p: DocumentParty): string {
  const reg = [p.taxId ? `Reg. No. ${esc(p.taxId)}` : '', p.vatId ? `VAT ${esc(p.vatId)}` : '']
    .filter(Boolean)
    .join(' · ')
  return `<div class="eu-seller">
    <strong>${esc(p.legalName ?? p.name)}</strong>
    ${p.legalAddress ? `${esc(p.legalAddress)}<br />` : ''}
    ${reg ? `${reg}<br />` : ''}
  </div>`
}

function euHead(d: DocumentRenderData): string {
  return `<div class="eu-head">
    <div>
      <div class="eu-title">${esc(d.typeLabel)}</div>
      <div class="eu-num">№ ${esc(d.number)}</div>
    </div>
    ${euSeller(d.issuer)}
  </div>`
}

function euPartyBlock(label: string, p: DocumentParty): string {
  return `<div>
    <div class="eu-block-l">${esc(label)}</div>
    <div class="eu-party">
      <strong>${esc(p.legalName ?? p.name)}</strong>
      ${p.legalAddress ? `${esc(p.legalAddress)}<br />` : ''}
      ${p.vatId ? `VAT ${esc(p.vatId)}<br />` : p.taxId ? `Reg. No. ${esc(p.taxId)}<br />` : ''}
    </div>
  </div>`
}

function euFacts(label: string, rows: { k: string; v: string }[]): string {
  const items = rows
    .map(
      (r) =>
        `<div class="eu-fact"><span class="eu-fact-k">${esc(r.k)}</span><span class="eu-fact-v">${esc(r.v)}</span></div>`
    )
    .join('')
  return `<div><div class="eu-block-l">${esc(label)}</div><div class="eu-facts">${items}</div></div>`
}

function euMeta(left: string, right: string): string {
  return `<div class="eu-meta">${left}${right}</div>`
}

function euFallbackLines(d: DocumentRenderData): DocumentLine[] {
  return [{ name: d.orderTitle, qty: '1', unit: 'service', price: d.amount, sum: d.amount }]
}

function euLinesTable(lines: DocumentLine[], nameHeader: string): string {
  const body = lines
    .map(
      (l) =>
        `<tr><td>${esc(l.name)}</td><td class="r">${esc(l.qty)}</td><td class="r">${esc(l.unit)}</td><td class="r">${esc(l.price)}</td><td class="r"><strong>${esc(l.sum)}</strong></td></tr>`
    )
    .join('')
  return `<table class="eu-table">
    <thead><tr><th>${esc(nameHeader)}</th><th class="r" style="width:52px">Qty</th><th class="r" style="width:64px">Unit</th><th class="r" style="width:92px">Price</th><th class="r" style="width:100px">Net</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`
}

/** Тотали: Net total → VAT (display-only note) → grand. Сума = amount без змін. */
function euTotals(d: DocumentRenderData, grandLabel: string): string {
  const total = `${esc(d.amount)} ${esc(d.currency)}`
  return `<div class="eu-totals"><div class="eu-totbox">
    <div class="eu-totrow"><span class="eu-totrow-k">Net total</span><span class="eu-totrow-v">${total}</span></div>
    ${d.vatNote ? `<div class="eu-totrow"><span class="eu-totrow-k">VAT</span><span class="eu-totrow-v">${esc(d.vatNote)}</span></div>` : ''}
    <div class="eu-totrow eu-totrow--grand"><span class="eu-totrow-k">${esc(grandLabel)}</span><span class="eu-totrow-v eu-accent">${total}</span></div>
    ${d.uahTotal ? `<div class="eu-totrow"><span class="eu-totrow-k">UAH equivalent</span><span class="eu-totrow-v">₴${esc(d.uahTotal)}</span></div>` : ''}
    ${d.rateNote ? `<div class="eu-rate-note">${esc(d.rateNote)}</div>` : ''}
  </div></div>`
}

/** Платіжний блок: IBAN/BIC + payment reference (design wfd-eu-pay). */
function euPayBlock(d: DocumentRenderData): string {
  const { iban, bic, bankName } = d.issuer
  if (!iban && !bic && !bankName) return ''
  const bank = [
    iban ? `IBAN <b>${esc(iban)}</b>` : '',
    bic ? `BIC <b>${esc(bic)}</b>` : '',
    bankName ? esc(bankName) : '',
  ]
    .filter(Boolean)
    .join('<br />')
  return `<div class="eu-pay">
    <div class="eu-pay-kv"><div class="eu-block-l">Bank transfer</div>${bank}</div>
    <div class="eu-pay-kv"><div class="eu-block-l">Payment reference</div><b>${esc(d.number)}</b><br />Please quote on transfer</div>
  </div>`
}

function euNote(text: string): string {
  return `<div class="eu-note">${esc(text)}</div>`
}

function euCustomNote(d: DocumentRenderData): string {
  return d.customNote ? euNote(d.customNote) : ''
}

/** Підписи двох сторін (Act/SoW/Agreement). */
function euSigs(d: DocumentRenderData): string {
  const side = (role: string, p: DocumentParty) => `
    <div class="eu-sig">
      <div class="eu-sig-line">${p.signerName ? `<span class="eu-sig-name">${esc(p.signerName)}</span>` : ''}</div>
      <div class="eu-sig-sub">${esc(role)} · ${esc(p.legalName ?? p.name)}<br />Authorised signatory</div>
    </div>`
  return `<div class="eu-sigs">${side('Service Provider', d.issuer)}${side('Client', d.recipient)}</div>`
}

function euFoot(d: DocumentRenderData): string {
  const brand = d.branding?.brandName ?? 'workflo.space'
  return `<div class="eu-foot"><span>${esc(brand)} · ${esc(d.issuer.legalName ?? d.issuer.name)}</span><span>${esc(d.typeLabel)} ${esc(d.number)} · page 1/1</span></div>`
}

// ── per-type bodies ───────────────────────────────────────────────────────────

function euInvoiceBody(d: DocumentRenderData): string {
  const lines = d.lines?.length ? d.lines : euFallbackLines(d)
  const isProforma = d.typeLabel.toLowerCase().includes('proforma')
  const facts = [
    { k: 'Issue date', v: d.date },
    ...(d.dueDate ? [{ k: 'Due date', v: d.dueDate }] : []),
    { k: 'Reference', v: d.orderTitle },
    ...(d.contractRef ? [{ k: 'Agreement', v: d.contractRef }] : []),
  ]
  const note = isProforma
    ? 'This is a proforma advance invoice, payable to commence work. Proforma documents do not constitute a VAT invoice until settled.'
    : 'For intra-EU B2B supply with a valid VAT ID, reverse charge applies (Art. 196, Directive 2006/112/EC). Payment is due by the date above.'
  return [
    euHead(d),
    euMeta(euPartyBlock('Bill to', d.recipient), euFacts('Details', facts)),
    euLinesTable(lines, 'Description'),
    euTotals(d, isProforma ? 'Amount due now' : 'Total due'),
    euPayBlock(d),
    d.paymentPurpose ? euNote(d.paymentPurpose) : euNote(note),
    euCustomNote(d),
    euFoot(d),
  ].join('\n')
}

function euServiceActBody(d: DocumentRenderData): string {
  const lines = d.lines?.length ? d.lines : euFallbackLines(d)
  const facts = [
    { k: 'Client', v: d.recipient.legalName ?? d.recipient.name },
    ...(d.periodFrom && d.periodTo ? [{ k: 'Period', v: `${d.periodFrom} – ${d.periodTo}` }] : []),
    ...(d.basisRef ? [{ k: 'Ref. invoice', v: d.basisRef }] : []),
    ...(d.contractRef ? [{ k: 'Agreement', v: d.contractRef }] : []),
  ]
  return [
    euHead(d),
    euMeta(euPartyBlock('Service Provider', d.issuer), euFacts('Details', facts)),
    euLinesTable(lines, 'Services delivered'),
    euTotals(d, 'Total accepted'),
    euNote(
      'The Client confirms that the services listed above have been delivered in full and accepted without reservation. This act forms the basis for settlement under the referenced invoice and agreement.'
    ),
    euCustomNote(d),
    euSigs(d),
    euFoot(d),
  ].join('\n')
}

function euSowBody(d: DocumentRenderData): string {
  const lines = d.lines?.length ? d.lines : euFallbackLines(d)
  const facts = [
    ...(d.projectName ? [{ k: 'Project', v: d.projectName }] : []),
    { k: 'Engagement', v: d.orderTitle },
    { k: 'Model', v: 'Fixed scope' },
  ]
  const objectives = d.description
    ? `<h2 class="eu-h2">Objectives</h2><p class="eu-p">${esc(d.description)}</p>`
    : ''
  return [
    euHead(d),
    euMeta(euPartyBlock('Client', d.recipient), euFacts('Engagement', facts)),
    objectives,
    `<h2 class="eu-h2">Deliverables & scope</h2>`,
    euLinesTable(lines, 'Item'),
    euTotals(d, 'Budget'),
    euCustomNote(d),
    euSigs(d),
    euFoot(d),
  ].join('\n')
}

function euStatementBody(d: DocumentRenderData): string {
  const ops = d.operations ?? []
  const rows = ops
    .map(
      (x) =>
        `<tr><td class="eu-mono">${esc(x.date)}</td><td class="eu-mono">${esc(x.doc)}</td><td>${esc(x.desc)}</td><td class="r eu-charge">${x.debit ? esc(x.debit) : '—'}</td><td class="r eu-payment">${x.credit ? esc(x.credit) : '—'}</td></tr>`
    )
    .join('')
  const facts = [
    ...(d.periodFrom ? [{ k: 'From', v: d.periodFrom }] : []),
    { k: 'To', v: d.periodTo ?? d.date },
    { k: 'Currency', v: d.currency },
  ]
  return [
    euHead(d),
    euMeta(euPartyBlock('Account holder', d.recipient), euFacts('Period', facts)),
    `<div class="eu-sum">
      <div class="eu-sum-cell"><div class="eu-sum-k">Opening balance</div><div class="eu-sum-v">${esc(d.opening ?? '0.00')}</div></div>
      <div class="eu-sum-cell"><div class="eu-sum-k">Charges / Payments</div><div class="eu-sum-v"><span class="eu-charge">${esc(d.totalDebit ?? '0.00')}</span> · <span class="eu-payment">${esc(d.totalCredit ?? '0.00')}</span></div></div>
      <div class="eu-sum-cell"><div class="eu-sum-k">Closing balance</div><div class="eu-sum-v eu-accent">${esc(d.closing ?? '0.00')}</div></div>
    </div>`,
    `<table class="eu-table">
      <thead><tr><th style="width:78px">Date</th><th style="width:120px">Document</th><th>Description</th><th class="r" style="width:96px">Charges</th><th class="r" style="width:96px">Payments</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
    euNote(
      `Closing balance of ${d.closing ?? '0.00'} ${d.currency} is outstanding and payable to the account below. Please reconcile and report any discrepancy within 10 days.${d.issuer.iban ? ` IBAN ${d.issuer.iban}${d.issuer.bic ? ` · BIC ${d.issuer.bic}` : ''}.` : ''}`
    ),
    euSigs(d),
    euFoot(d),
  ].join('\n')
}

/** Типові EN-клаузи рамкової угоди (дизайн EuServiceAgreementDoc) — без привʼязки
 * до конкретної юрисдикції; кастомні contractSections (06-А шаблон) мають пріоритет. */
export function defaultEuAgreementSections(d: DocumentRenderData): ContractSection[] {
  return [
    {
      h: '1. Subject',
      p: [
        `The Service Provider shall provide software development and support services ("Services") to the Client as specified in the applicable Statement of Work and order, including "${d.orderTitle}".`,
      ],
    },
    {
      h: '2. Fees & Billing',
      p: [
        'Fees are billed per the agreed engagement model (fixed scope, retainer or hourly). Invoices are issued each billing cycle and are payable by the due date stated on the invoice.',
      ],
    },
    {
      h: '3. VAT',
      p: [
        'All fees are exclusive of VAT unless stated otherwise. VAT is applied per applicable EU rules; intra-EU B2B reverse charge applies where a valid VAT ID is provided.',
      ],
    },
    {
      h: '4. Term & Termination',
      p: [
        'This Agreement remains in force until terminated by either party with 30 days written notice. Fees outstanding at termination remain payable.',
      ],
    },
    {
      h: '5. Intellectual Property',
      p: [
        'Intellectual property rights in the deliverables transfer to the Client upon full payment of the corresponding Services. Until payment, all rights remain with the Service Provider.',
      ],
    },
    {
      h: '6. Confidentiality',
      p: [
        'Each party shall keep confidential all non-public information disclosed under this Agreement during its term and for 3 years thereafter.',
      ],
    },
    {
      h: '7. Governing Law',
      p: [
        "This Agreement is governed by the laws of the Service Provider's country of establishment, unless otherwise agreed in writing.",
      ],
    },
  ]
}

function euAgreementBody(d: DocumentRenderData): string {
  const sections = d.contractSections?.length ? d.contractSections : defaultEuAgreementSections(d)
  const clauses = sections
    .map(
      (s) =>
        `<div class="eu-clause"><div class="eu-clause-h">${esc(s.h)}</div>${s.p
          .map((p) => `<p class="eu-clause-p">${esc(p)}</p>`)
          .join('')}</div>`
    )
    .join('')
  return [
    euHead(d),
    euMeta(euPartyBlock('Service Provider', d.issuer), euPartyBlock('Client', d.recipient)),
    `<div class="eu-clauses">${clauses}</div>`,
    euSigs(d),
    euFoot(d),
  ].join('\n')
}

export const EU_BODY_BY_KIND: Record<DocumentKind, (d: DocumentRenderData) => string> = {
  invoice: euInvoiceBody,
  advance_invoice: euInvoiceBody,
  completion_act: euServiceActBody,
  specification: euSowBody,
  reconciliation_act: euStatementBody,
  contract: euAgreementBody,
}

// wfd-eu look: більше повітря, тонкі лінії, JetBrains-mono факти, лайм-плашка на грандах.
export const EU_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1c1917; background: #fff; font-size: 12.5px; line-height: 1.55;
    padding: 28px 32px;
  }
  .eu-mono, .eu-num, .eu-fact-k, .eu-fact-v, .eu-sum-k, .eu-rate-note, .eu-foot { font-family: 'SFMono-Regular', 'Menlo', monospace; }
  .eu-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #0c0a09; }
  .eu-title { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
  .eu-num { font-size: 12px; color: #78716c; margin-top: 6px; }
  .eu-seller { text-align: right; font-size: 11px; color: #57534e; line-height: 1.6; }
  .eu-seller strong { display: block; color: #1c1917; font-size: 12.5px; }
  .eu-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 20px 0; }
  .eu-block-l { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.08em; color: #a8a29e; margin-bottom: 5px; }
  .eu-party { font-size: 11.5px; color: #57534e; line-height: 1.6; }
  .eu-party strong { display: block; color: #1c1917; font-size: 13px; }
  .eu-facts { display: flex; flex-direction: column; gap: 3px; }
  .eu-fact { display: flex; justify-content: space-between; gap: 16px; font-size: 11px; border-bottom: 1px solid #f5f5f4; padding: 2px 0; }
  .eu-fact-k { color: #a8a29e; }
  .eu-fact-v { color: #1c1917; text-align: right; }
  .eu-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .eu-table th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #a8a29e; border-bottom: 1px solid #0c0a09; padding: 6px 8px; }
  .eu-table td { padding: 8px; border-bottom: 1px solid #f5f5f4; vertical-align: top; font-size: 12px; }
  .eu-table .r { text-align: right; font-feature-settings: 'tnum'; }
  .eu-charge { color: #b91c1c; }
  .eu-payment { color: #15803d; }
  .eu-totals { display: flex; justify-content: flex-end; margin-top: 12px; }
  .eu-totbox { min-width: 300px; }
  .eu-totrow { display: flex; justify-content: space-between; gap: 24px; padding: 4px 0; font-size: 12px; color: #57534e; }
  .eu-totrow--grand { border-top: 2px solid #0c0a09; margin-top: 4px; padding-top: 8px; font-weight: 700; font-size: 14px; color: #0c0a09; }
  .eu-accent { background: #0c0a09; color: #C5F82A; padding: 1px 8px; border-radius: 3px; display: inline-block; }
  .eu-rate-note { font-size: 9.5px; color: #78716c; text-align: right; margin-top: 4px; }
  .eu-pay { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
  .eu-pay-kv { border: 1px solid #e7e5e4; border-radius: 6px; padding: 10px 14px; font-size: 11.5px; color: #44403c; line-height: 1.7; }
  .eu-note { margin-top: 14px; padding: 10px 14px; border: 1px dashed #d6d3d1; border-radius: 6px; font-size: 10.5px; color: #57534e; line-height: 1.6; }
  .eu-sum { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: 12px; margin: 14px 0; }
  .eu-sum-cell { padding: 10px 14px; border: 1px solid #e7e5e4; border-radius: 6px; background: #fafaf9; }
  .eu-sum-k { font-size: 9px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .eu-sum-v { font-weight: 600; font-feature-settings: 'tnum'; font-size: 13px; }
  .eu-h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #44403c; margin: 18px 0 6px; border-bottom: 1px solid #e7e5e4; padding-bottom: 4px; }
  .eu-p { font-size: 11.5px; color: #44403c; margin: 6px 0; }
  .eu-clauses { display: flex; flex-direction: column; gap: 14px; margin-top: 18px; }
  .eu-clause-h { font-size: 12px; font-weight: 600; color: #0c0a09; margin-bottom: 4px; }
  .eu-clause-p { font-size: 11px; line-height: 1.7; color: #44403c; margin: 0 0 5px; }
  .eu-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 38px; }
  .eu-sig-line { border-bottom: 1px solid #0c0a09; height: 32px; position: relative; }
  .eu-sig-name { position: absolute; bottom: 4px; left: 4px; font-size: 13px; font-weight: 600; }
  .eu-sig-sub { font-size: 10px; color: #78716c; margin-top: 6px; line-height: 1.5; }
  .eu-foot { margin-top: 30px; border-top: 1px solid #e7e5e4; padding-top: 8px; color: #a8a29e; font-size: 9.5px; display: flex; justify-content: space-between; }
`
