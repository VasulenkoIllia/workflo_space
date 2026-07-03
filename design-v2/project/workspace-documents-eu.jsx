// workspace-documents-eu.jsx — EU document kit (06-Е, distinct European VAT layout,
// NOT a translation of the UA set) + public invoice page (06-Д) + doc-kit viewer.

const _de = React.useState;

// EU sample data — Estonian entity → EU B2B client, EUR, VAT-centric.
const EU_DATA = {
  invoice: {
    title: 'Invoice', num: '2026-0418', issue: '24 May 2026', due: '07 Jun 2026', ref: 'WF-2026-0418',
    seller: { name: 'Workflo OÜ', reg: '16482931', vat: 'EE102564831', addr: 'Sepapaja tn 6, 15551 Tallinn, Estonia', iban: 'EE47 7700 7710 0123 4567', bic: 'LHVBEE22', email: 'billing@workflo.space' },
    buyer: { name: 'Brunky Foods GmbH', vat: 'DE314205991', addr: 'Friedrichstraße 68, 10117 Berlin, Germany', contact: 'finance@brunky.com' },
    items: [
      { desc: 'Platform support & development — monthly retainer', qty: 1, price: 3200, vat: 20 },
      { desc: '1C ↔ Telegram integration — development (28h @ €45)', qty: 28, price: 45, vat: 20 },
    ],
    cur: '€',
  },
  credit: {
    title: 'Credit Note', num: 'CN-2026-014', issue: '12 Jun 2026', ref: 'against Invoice 2026-0402',
    seller: { name: 'Workflo OÜ', reg: '16482931', vat: 'EE102564831', addr: 'Sepapaja tn 6, 15551 Tallinn, Estonia', iban: 'EE47 7700 7710 0123 4567', bic: 'LHVBEE22', email: 'billing@workflo.space' },
    buyer: { name: 'Brunky Foods GmbH', vat: 'DE314205991', addr: 'Friedrichstraße 68, 10117 Berlin, Germany', contact: 'finance@brunky.com' },
    items: [{ desc: 'Partial credit — hours not delivered (Invoice 2026-0402)', qty: 1, price: -420, vat: 20 }],
    cur: '€',
  },
  advance: {
    title: 'Proforma · Advance Invoice', num: 'PRO-2026-0421', issue: '24 May 2026', due: '31 May 2026', ref: 'WF-2026-0421',
    seller: { name: 'Workflo OÜ', reg: '16482931', vat: 'EE102564831', addr: 'Sepapaja tn 6, 15551 Tallinn, Estonia', iban: 'EE47 7700 7710 0123 4567', bic: 'LHVBEE22', email: 'billing@workflo.space' },
    buyer: { name: 'Brunky Foods GmbH', vat: 'DE314205991', addr: 'Friedrichstraße 68, 10117 Berlin, Germany', contact: 'finance@brunky.com' },
    items: [{ desc: 'CRM rebuild project — fixed scope (per SOW-2026-121)', qty: 1, price: 9800, vat: 20 }],
    advancePct: 50,
    cur: '€',
  },
};

const eur = (n) => '€' + Math.abs(n).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function EuInvoiceDoc({ data = EU_DATA.invoice, kind = 'invoice' }) {
  const lines = data.items.map((it) => ({ ...it, net: it.qty * it.price, vatAmt: it.qty * it.price * it.vat / 100 }));
  const net = lines.reduce((a, l) => a + l.net, 0);
  const vatTotal = lines.reduce((a, l) => a + l.vatAmt, 0);
  const gross = net + vatTotal;
  const adv = data.advancePct ? gross * data.advancePct / 100 : 0;
  return (
    <div className="wfd-page wfd-eu">
      <div className="wfd-eu-head">
        <div>
          <div className="wfd-eu-title">{data.title}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#78716C', marginTop: 6 }}>№ {data.num}</div>
        </div>
        <div className="wfd-eu-seller">
          <strong>{data.seller.name}</strong>
          {data.seller.addr}<br />
          Reg. No. {data.seller.reg} · VAT {data.seller.vat}<br />
          {data.seller.email}
        </div>
      </div>

      <div className="wfd-eu-meta">
        <div>
          <div className="wfd-eu-block-l">Bill to</div>
          <div className="wfd-eu-party">
            <strong>{data.buyer.name}</strong>
            {data.buyer.addr}<br />
            VAT {data.buyer.vat}<br />
            {data.buyer.contact}
          </div>
        </div>
        <div>
          <div className="wfd-eu-block-l">Details</div>
          <div className="wfd-eu-facts">
            <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Issue date</span><span className="wfd-eu-fact-v">{data.issue}</span></div>
            {data.due && <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Due date</span><span className="wfd-eu-fact-v">{data.due}</span></div>}
            <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Reference</span><span className="wfd-eu-fact-v">{data.ref}</span></div>
          </div>
        </div>
      </div>

      <table className="wfd-eu-table">
        <thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Unit</th><th className="r">VAT</th><th className="r">Net</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}><td>{l.desc}</td><td className="r">{l.qty}</td><td className="r">{eur(l.price)}</td><td className="r">{l.vat}%</td><td className="r">{l.net < 0 ? '−' : ''}{eur(l.net)}</td></tr>
          ))}
        </tbody>
      </table>

      <div className="wfd-eu-totals">
        <div className="wfd-eu-totbox">
          <div className="wfd-eu-totrow"><span className="wfd-eu-totrow-k">Net total</span><span className="wfd-eu-totrow-v">{net < 0 ? '−' : ''}{eur(net)}</span></div>
          <div className="wfd-eu-totrow"><span className="wfd-eu-totrow-k">VAT 20%</span><span className="wfd-eu-totrow-v">{vatTotal < 0 ? '−' : ''}{eur(vatTotal)}</span></div>
          <div className="wfd-eu-totrow wfd-eu-totrow--grand"><span className="wfd-eu-totrow-k">{kind === 'credit' ? 'Total credited' : kind === 'advance' ? 'Contract total' : 'Total due'}</span><span className="wfd-eu-totrow-v">{gross < 0 ? '−' : ''}{eur(gross)}</span></div>
          {kind === 'advance' && (
            <React.Fragment>
              <div className="wfd-eu-totrow" style={{ marginTop: 6 }}><span className="wfd-eu-totrow-k">Advance {data.advancePct}% — due now</span><span className="wfd-eu-totrow-v" style={{ color: '#0C0A09', fontWeight: 700 }}>{eur(adv)}</span></div>
              <div className="wfd-eu-totrow"><span className="wfd-eu-totrow-k">Balance on completion</span><span className="wfd-eu-totrow-v">{eur(gross - adv)}</span></div>
            </React.Fragment>
          )}
        </div>
      </div>

      {kind !== 'credit' && (
        <div className="wfd-eu-pay">
          <div className="wfd-eu-pay-kv"><div className="wfd-eu-block-l">Bank transfer</div>IBAN <b>{data.seller.iban}</b><br />BIC <b>{data.seller.bic}</b></div>
          <div className="wfd-eu-pay-kv"><div className="wfd-eu-block-l">Payment reference</div><b>{data.ref}</b><br />Please quote on transfer</div>
        </div>
      )}

      <div className="wfd-eu-note">
        {kind === 'credit'
          ? 'This credit note reduces the amount payable under the referenced invoice. No payment is due.'
          : kind === 'advance'
          ? `This is a proforma advance invoice. An advance of ${data.advancePct}% is payable to commence work; the balance is invoiced on completion. Proforma documents do not constitute a VAT invoice until settled.`
          : 'VAT charged under standard rate. For intra-EU B2B supply with valid VAT ID, reverse charge may apply (Art. 196, Directive 2006/112/EC). Payment due within 14 days of issue.'}
      </div>
      <div className="wfd-eu-foot"><span>workflo.space · Workflo OÜ</span><span>{data.title} {data.num} · page 1/1</span></div>
    </div>
  );
}

function EuServiceAgreementDoc() {
  const s = EU_DATA.invoice.seller, b = EU_DATA.invoice.buyer;
  const clauses = [
    ['1. Subject', 'The Service Provider shall provide software development and support services ("Services") to the Client as specified in the applicable Statement of Work and project configuration.'],
    ['2. Fees & Billing', 'Fees are billed per the project model (fixed monthly retainer or hourly). Invoices are issued each billing cycle and payable within fourteen (14) days (Net 14).'],
    ['3. VAT', 'All fees are exclusive of VAT. VAT is applied per applicable EU rules; intra-EU B2B reverse charge applies where a valid VAT ID is provided.'],
    ['4. Term & Termination', 'This Agreement remains in force until terminated by either party with 30 days written notice. Outstanding fees remain payable.'],
    ['5. Confidentiality', 'Each party shall keep confidential all non-public information disclosed under this Agreement (see separate NDA where applicable).'],
    ['6. Governing Law', 'This Agreement is governed by the laws of Estonia. Disputes shall be resolved in the courts of Tallinn.'],
  ];
  return (
    <div className="wfd-page wfd-eu wfd-page--contract">
      <div className="wfd-eu-head">
        <div><div className="wfd-eu-title" style={{ fontSize: 24 }}>Service Agreement</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#78716C', marginTop: 6 }}>№ SA-2026-121 · {EU_DATA.invoice.issue}</div></div>
        <div className="wfd-eu-seller"><strong>{s.name}</strong>{s.addr}<br />VAT {s.vat}</div>
      </div>
      <div className="wfd-eu-meta">
        <div><div className="wfd-eu-block-l">Service Provider</div><div className="wfd-eu-party"><strong>{s.name}</strong>{s.addr}<br />Reg. {s.reg} · VAT {s.vat}</div></div>
        <div><div className="wfd-eu-block-l">Client</div><div className="wfd-eu-party"><strong>{b.name}</strong>{b.addr}<br />VAT {b.vat}</div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {clauses.map(([h, t]) => (
          <div key={h}><div style={{ fontSize: 12, fontWeight: 600, color: '#0C0A09', marginBottom: 5 }}>{h}</div><div style={{ fontSize: 11, lineHeight: 1.7, color: '#44403C' }}>{t}</div></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 36 }}>
        {[s.name, b.name].map((n, i) => (
          <div key={i}><div style={{ borderBottom: '1px solid #0C0A09', height: 34 }} /><div style={{ fontSize: 10, color: '#78716C', marginTop: 6 }}>{i === 0 ? 'Service Provider' : 'Client'} · {n}</div></div>
        ))}
      </div>
      <div className="wfd-eu-foot" style={{ marginTop: 30 }}><span>workflo.space · Workflo OÜ</span><span>SA-2026-121 · page 1/1</span></div>
    </div>
  );
}

// ─── EU Service Delivery & Acceptance Act ───
function EuServiceActDoc() {
  const s = EU_DATA.invoice.seller, b = EU_DATA.invoice.buyer;
  const items = [
    { desc: 'Platform support & development — May 2026 retainer', qty: 1, price: 3200, vat: 20 },
    { desc: '1C ↔ Telegram integration — delivered (28h @ €45)', qty: 28, price: 45, vat: 20 },
  ];
  const lines = items.map((it) => ({ ...it, net: it.qty * it.price }));
  const net = lines.reduce((a, l) => a + l.net, 0);
  const vat = net * 0.2, gross = net + vat;
  return (
    <div className="wfd-page wfd-eu" style={{ position: 'relative' }}>
      <div className="wfd-stamp" style={{ right: 56, top: 88 }}>ACCEPTED<br />24 May 2026<br />workflo.space</div>
      <div className="wfd-eu-head">
        <div><div className="wfd-eu-title">Service Delivery Act</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#78716C', marginTop: 6 }}>№ SDA-2026-0418</div></div>
        <div className="wfd-eu-seller"><strong>{s.name}</strong>{s.addr}<br />Reg. No. {s.reg} · VAT {s.vat}<br />{s.email}</div>
      </div>
      <div className="wfd-eu-meta">
        <div><div className="wfd-eu-block-l">Service Provider</div><div className="wfd-eu-party"><strong>{s.name}</strong>{s.addr}<br />VAT {s.vat}</div></div>
        <div><div className="wfd-eu-block-l">Details</div><div className="wfd-eu-facts">
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Client</span><span className="wfd-eu-fact-v">{b.name}</span></div>
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Period</span><span className="wfd-eu-fact-v">01–31 May 2026</span></div>
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Ref. invoice</span><span className="wfd-eu-fact-v">2026-0418</span></div>
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Agreement</span><span className="wfd-eu-fact-v">SA-2026-121</span></div>
        </div></div>
      </div>
      <table className="wfd-eu-table">
        <thead><tr><th>Services delivered</th><th className="r">Qty</th><th className="r">Unit</th><th className="r">Net</th></tr></thead>
        <tbody>{lines.map((l, i) => <tr key={i}><td>{l.desc}</td><td className="r">{l.qty}</td><td className="r">{eur(l.price)}</td><td className="r">{eur(l.net)}</td></tr>)}</tbody>
      </table>
      <div className="wfd-eu-totals"><div className="wfd-eu-totbox">
        <div className="wfd-eu-totrow"><span className="wfd-eu-totrow-k">Net total</span><span className="wfd-eu-totrow-v">{eur(net)}</span></div>
        <div className="wfd-eu-totrow"><span className="wfd-eu-totrow-k">VAT 20%</span><span className="wfd-eu-totrow-v">{eur(vat)}</span></div>
        <div className="wfd-eu-totrow wfd-eu-totrow--grand"><span className="wfd-eu-totrow-k">Total accepted</span><span className="wfd-eu-totrow-v">{eur(gross)}</span></div>
      </div></div>
      <div className="wfd-eu-note">The Client confirms that the services listed above have been delivered in full and accepted without reservation. This act forms the basis for settlement under the referenced invoice and agreement.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 30 }}>
        {[['Service Provider', s.name, 'I. Vasiulenko', 'Authorised signatory'], ['Client', b.name, 'A. Tkach', 'Authorised signatory']].map(([role, n, who, t], i) => (
          <div key={i}><div style={{ borderBottom: '1px solid #0C0A09', height: 30, marginBottom: 6, position: 'relative' }}><span style={{ position: 'absolute', bottom: 5, left: 4, fontFamily: 'Caveat, cursive', fontSize: 22, color: '#1C1917' }}>{who}</span></div><div style={{ fontSize: 10, color: '#78716C' }}>{role} · {n}<br />{t}</div></div>
        ))}
      </div>
      <div className="wfd-eu-foot" style={{ marginTop: 28 }}><span>workflo.space · Workflo OÜ</span><span>SDA-2026-0418 · page 1/1</span></div>
    </div>
  );
}

// ─── EU Statement of Account (reconciliation) ───
function EuStatementDoc() {
  const s = EU_DATA.invoice.seller, b = EU_DATA.invoice.buyer;
  const opening = 1260;
  const rows = [
    { date: '01 May', doc: 'INV 2026-0402', desc: 'Hourly work — April', charge: 1260, pay: 0 },
    { date: '06 May', doc: 'PAY-0388', desc: 'Payment received', charge: 0, pay: 1260 },
    { date: '24 May', doc: 'INV 2026-0418', desc: 'May retainer + integration', charge: 4320, pay: 0 },
    { date: '02 Jun', doc: 'CN-2026-014', desc: 'Credit — hours not delivered', charge: -420, pay: 0 },
  ];
  let bal = opening;
  const withBal = rows.map((r) => { bal += r.charge - r.pay; return { ...r, bal }; });
  const closing = bal;
  const totC = rows.reduce((a, r) => a + (r.charge > 0 ? r.charge : 0), 0);
  const totP = rows.reduce((a, r) => a + r.pay, 0);
  return (
    <div className="wfd-page wfd-eu">
      <div className="wfd-eu-head">
        <div><div className="wfd-eu-title">Statement of Account</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#78716C', marginTop: 6 }}>№ SOA-2026-06 · as at 15 Jun 2026</div></div>
        <div className="wfd-eu-seller"><strong>{s.name}</strong>{s.addr}<br />VAT {s.vat}<br />{s.email}</div>
      </div>
      <div className="wfd-eu-meta">
        <div><div className="wfd-eu-block-l">Account holder</div><div className="wfd-eu-party"><strong>{b.name}</strong>{b.addr}<br />VAT {b.vat}</div></div>
        <div><div className="wfd-eu-block-l">Period</div><div className="wfd-eu-facts">
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">From</span><span className="wfd-eu-fact-v">01 May 2026</span></div>
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">To</span><span className="wfd-eu-fact-v">15 Jun 2026</span></div>
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Currency</span><span className="wfd-eu-fact-v">EUR</span></div>
        </div></div>
      </div>
      <div className="wfd-eu-sum">
        <div className="wfd-eu-sum-cell"><div className="wfd-eu-sum-k">Opening balance</div><div className="wfd-eu-sum-v">{eur(opening)}</div></div>
        <div className="wfd-eu-sum-cell"><div className="wfd-eu-sum-k">Charges / Payments</div><div className="wfd-eu-sum-v"><span style={{ color: '#B91C1C' }}>{eur(totC)}</span> <span style={{ color: '#A8A29E', fontWeight: 400 }}>·</span> <span style={{ color: '#15803D' }}>{eur(totP)}</span></div></div>
        <div className="wfd-eu-sum-cell"><div className="wfd-eu-sum-k">Closing balance</div><div className="wfd-eu-sum-v" style={{ color: '#C5F82A', background: '#0C0A09', padding: '2px 8px', borderRadius: 3, display: 'inline-block' }}>{eur(closing)}</div></div>
      </div>
      <table className="wfd-eu-table" style={{ marginTop: 18 }}>
        <thead><tr><th>Date</th><th>Document</th><th>Description</th><th className="r">Charges</th><th className="r">Payments</th><th className="r">Balance</th></tr></thead>
        <tbody>
          {withBal.map((r, i) => (
            <tr key={i}><td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{r.date}</td><td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#0C0A09' }}>{r.doc}</td><td>{r.desc}</td><td className="r" style={{ color: r.charge ? (r.charge < 0 ? '#15803D' : '#B91C1C') : '#A8A29E' }}>{r.charge ? (r.charge < 0 ? '−' : '') + eur(r.charge) : '—'}</td><td className="r" style={{ color: r.pay ? '#15803D' : '#A8A29E' }}>{r.pay ? eur(r.pay) : '—'}</td><td className="r"><strong>{eur(r.bal)}</strong></td></tr>
          ))}
        </tbody>
      </table>
      <div className="wfd-eu-note">Closing balance of {eur(closing)} is outstanding and payable to the account below. Please reconcile and report any discrepancy within 10 days. IBAN {s.iban} · BIC {s.bic}.</div>
      <div className="wfd-eu-foot"><span>workflo.space · Workflo OÜ</span><span>SOA-2026-06 · page 1/1</span></div>
    </div>
  );
}

// ─── EU Statement of Work (specification) ───
function EuSowDoc() {
  const s = EU_DATA.invoice.seller, b = EU_DATA.invoice.buyer;
  const deliverables = [
    { n: 1, name: 'CRM data model & migration', fmt: 'PostgreSQL · scripts' },
    { n: 2, name: 'Integration service (1C ↔ Telegram)', fmt: 'Node.js · webhook API' },
    { n: 3, name: 'Admin dashboard', fmt: 'React SPA' },
    { n: 4, name: 'Handover & docs', fmt: 'Markdown · Loom' },
  ];
  const milestones = [['w1–2', 'Discovery & data model', 'schema, migration plan'], ['w3–5', 'Integration build', 'webhook service, tests'], ['w6–7', 'Dashboard & UAT', 'SPA, acceptance'], ['w8', 'Handover', 'docs, warranty start']];
  return (
    <div className="wfd-page wfd-eu">
      <div className="wfd-eu-head">
        <div><div className="wfd-eu-title">Statement of Work</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#78716C', marginTop: 6 }}>№ SOW-2026-121 · {EU_DATA.invoice.issue}</div></div>
        <div className="wfd-eu-seller"><strong>{s.name}</strong>{s.addr}<br />VAT {s.vat}</div>
      </div>
      <div className="wfd-eu-meta">
        <div><div className="wfd-eu-block-l">Client</div><div className="wfd-eu-party"><strong>{b.name}</strong>{b.addr}<br />VAT {b.vat}</div></div>
        <div><div className="wfd-eu-block-l">Engagement</div><div className="wfd-eu-facts">
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Project</span><span className="wfd-eu-fact-v">CRM rebuild</span></div>
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Duration</span><span className="wfd-eu-fact-v">8 weeks</span></div>
          <div className="wfd-eu-fact"><span className="wfd-eu-fact-k">Model</span><span className="wfd-eu-fact-v">Fixed price</span></div>
        </div></div>
      </div>
      <h2 className="wfd-h2">Objectives</h2>
      <ol className="wfd-ol"><li>Replace the legacy spreadsheet workflow with a unified CRM.</li><li>Automate order sync between 1C and Telegram.</li><li>Give the client a self-serve admin dashboard.</li></ol>
      <h2 className="wfd-h2">Deliverables</h2>
      <table className="wfd-eu-table">
        <thead><tr><th style={{ width: 30 }}>#</th><th>Artifact</th><th>Format / stack</th></tr></thead>
        <tbody>{deliverables.map((d) => <tr key={d.n}><td>{String(d.n).padStart(2, '0')}</td><td><strong>{d.name}</strong></td><td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{d.fmt}</td></tr>)}</tbody>
      </table>
      <h2 className="wfd-h2">Milestones</h2>
      <div style={{ border: '1px solid #E7E5E4', borderRadius: 6, overflow: 'hidden' }}>
        {milestones.map((m, i) => (
          <div className="wfd-ms-row" key={i}><div><span className="wfd-ms-week">{m[0]}</span></div><div className="wfd-ms-name">{m[1]}</div><div className="wfd-ms-deliv">{m[2]}</div></div>
        ))}
      </div>
      <h2 className="wfd-h2">Budget</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 4 }}>
        <div style={{ padding: '14px 16px', border: '1px solid #E7E5E4', borderRadius: 6, background: '#FAFAF9' }}><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>fixed price</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 600, color: '#0C0A09' }}>{eur(9800)}</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#78716C', marginTop: 4 }}>excl. VAT</div></div>
        <div style={{ padding: '14px 16px', border: '1px solid #E7E5E4', borderRadius: 6, background: '#FAFAF9' }}><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>overage / hour</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 600, color: '#0C0A09' }}>{eur(45)}</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#78716C', marginTop: 4 }}>if scope grows</div></div>
        <div style={{ padding: '14px 16px', border: '1px solid #0C0A09', borderRadius: 6, background: '#0C0A09' }}><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>warranty</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 600, color: '#C5F82A' }}>30 days</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#A8A29E', marginTop: 4 }}>post-delivery</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 32 }}>
        {[['Service Provider', s.name], ['Client', b.name]].map(([role, n], i) => (
          <div key={i}><div style={{ borderBottom: '1px solid #0C0A09', height: 30 }} /><div style={{ fontSize: 10, color: '#78716C', marginTop: 6 }}>{role} · {n} · Authorised signatory</div></div>
        ))}
      </div>
      <div className="wfd-eu-foot" style={{ marginTop: 28 }}><span>workflo.space · Workflo OÜ</span><span>SOW-2026-121 · page 1/1</span></div>
    </div>
  );
}

// ─── Public invoice page (06-Д) — hosted link, no login, with pay button ───
function PublicInvoicePage({ kit = 'ua', onBack }) {
  const [status, setStatus] = _de('unpaid');
  const [method, setMethod] = _de('card');
  const D = window.WFP_DATA;
  const amount = kit === 'eu' ? '€4 320,00' : '$4 200';
  const due = kit === 'eu' ? '07 Jun 2026' : '07.06.2026';
  const num = kit === 'eu' ? 'INV 2026-0418' : 'INV-2025-0418';
  const pay = () => { setStatus('processing'); setTimeout(() => setStatus('paid'), 1600); };
  const STAT = { unpaid: 'до оплати', overdue: 'прострочено', processing: 'обробка платежу…', paid: 'оплачено', expired: 'лінк недійсний', void: 'анульовано' };
  const blocked = status === 'expired' || status === 'void';
  const DEMO = [['unpaid', 'дійсний'], ['overdue', 'прострочено'], ['paid', 'оплачено'], ['expired', 'протерм˩-лінк'], ['void', 'анульовано']];
  return (
    <div className="wfpi">
      <div className="wfpi-top">
        <span className="wfpi-mark">workflo<span className="d">.</span>space</span>
        {onBack && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={onBack}><Icon name="chevron" size={12} style={{ transform: 'rotate(90deg)' }} />назад до бланків</button>}
        <span className="wfpi-secure"><Icon name="lock" size={12} />захищене посилання · без логіна</span>
      </div>
      <div className="wfpi-demobar">
        <span className="wfpi-demobar-l">// demo стани:</span>
        {DEMO.map(([id, l]) => <button key={id} className="wfpi-demo-opt" data-on={status === id || undefined} onClick={() => setStatus(id)}>{l}</button>)}
      </div>
      <div className="wfpi-body">
        <div className="wfpi-docwrap">
          {kit === 'eu' ? <EuInvoiceDoc /> : (window.InvoiceDoc ? <InvoiceDoc /> : <div>UA invoice</div>)}
        </div>
        <div className="wfpi-pay">
          <div className="wfpi-pay-h">
            <span className="wfpi-status" data-s={status}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{STAT[status]}
            </span>
            <div className="wfpi-pay-amt" style={{ marginTop: 12 }}>{amount}</div>
            <div className="wfpi-pay-due">{num} · термін {due}</div>
            {status === 'overdue' && <div className="wfpi-dunning"><Icon name="alert" size={12} />Прострочено на 8 днів · надіслано 2 нагадування</div>}
          </div>
          <div className="wfpi-pay-b">
            {blocked ? (
              <div className="wfpi-blocked">
                <Icon name={status === 'void' ? 'alert' : 'lock'} size={22} color="var(--wf-fg-muted)" />
                <div className="wfpi-blocked-t">{status === 'void' ? 'Рахунок анульовано' : 'Посилання недійсне'}</div>
                <div className="wfpi-blocked-s">{status === 'void'
                  ? 'Цей рахунок було скасовано агенцією. Зверніться за новим рахунком.'
                  : 'Термін дії посилання сплив. Запитайте свіже посилання у агенції.'}</div>
                <div className="wfpi-kv" style={{ marginTop: 14, borderBottom: 0 }}><span className="wfpi-kv-k">Питання</span><span>illia@workflo.space</span></div>
              </div>
            ) : status === 'paid' ? (
              <React.Fragment>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--wf-success)', fontSize: 14, fontWeight: 600 }}><Icon name="check" size={20} />Платіж отримано</div>
                <button className="wfpi-paybtn wfpi-paybtn--ghost" onClick={() => window.wfToast && window.wfToast('Завантажити квитанцію · демо', 'ok')}><Icon name="download" size={14} />Завантажити квитанцію</button>
                <div className="wfpi-webhook">→ webhook: payment.succeeded<br />→ invoice INV-…0418 marked paid<br />→ act_of_work auto-generated</div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="wfpi-methods">
                  {[['card', 'card', 'Картка · Visa / Mastercard'], ['bank', 'building', 'Банківський переказ'], ['crypto', 'coins', 'USDT · TRC20']].map(([id, ic, l]) => (
                    <div key={id} className="wfpi-method" data-on={method === id || undefined} onClick={() => setMethod(id)}>
                      <Icon name={ic === 'card' ? 'receipt' : ic} size={15} color="var(--wf-fg-muted)" />{l}
                    </div>
                  ))}
                </div>
                <button className="wfpi-paybtn" onClick={pay} disabled={status === 'processing'}>
                  {status === 'processing' ? <React.Fragment><span className="wfpi-spin" />Обробка…</React.Fragment> : <React.Fragment><Icon name="lock" size={16} />Оплатити {amount}</React.Fragment>}
                </button>
                <div style={{ fontSize: 11, color: 'var(--wf-fg-subtle)', textAlign: 'center' }}>// провайдер ще не підключено · стани + webhook-сім (05-А)</div>
                <div style={{ marginTop: 4 }}>
                  <div className="wfpi-kv"><span className="wfpi-kv-k">Виставник</span><span>{kit === 'eu' ? 'Workflo OÜ' : 'ФОП Васюленко'}</span></div>
                  <div className="wfpi-kv"><span className="wfpi-kv-k">Проєкт</span><span>PRJ-118</span></div>
                  <div className="wfpi-kv" style={{ borderBottom: 0 }}><span className="wfpi-kv-k">Питання</span><span>illia@workflo.space</span></div>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Doc-kit viewer (Workspace screen) ───
const UA_TYPES = [['invoice', 'Рахунок', 'InvoiceDoc'], ['act', 'Акт робіт', 'CompletionActDoc'], ['recon', 'Акт звірки', 'ReconciliationActDoc'], ['spec', 'Специфікація', 'SpecificationDoc'], ['contract', 'Договір', 'ContractDoc']];
const EU_TYPES = [['invoice', 'Invoice'], ['advance', 'Advance · Proforma'], ['act', 'Service Act'], ['statement', 'Statement of Account'], ['sow', 'Statement of Work'], ['agreement', 'Service Agreement'], ['credit', 'Credit Note']];
const DOC_STATES = [['generated', 'фінал'], ['draft', 'чернетка'], ['signed', 'підписано'], ['superseded', 'замінено'], ['gate', 'гейт-блок']];

// State layer over any wfd-page: watermark / stamp / banner. Gate handled separately.
function DocStateLayer({ state }) {
  if (state === 'draft') return <div className="wfd-state-wm" data-s="draft">ЧЕРНЕТКА · DRAFT</div>;
  if (state === 'signed') return (
    <React.Fragment>
      <div className="wfd-state-stamp"><div className="wfd-state-stamp-t">ПІДПИСАНО</div><div className="wfd-state-stamp-s">SIGNED · workflo.space</div><div className="wfd-state-stamp-d">24.05.2026</div></div>
      <div className="wfd-state-audit">// e-sign · Ілля Васюленко · 24.05.2026 11:08 · IP 194.45.123.x · SHA-256 a3f1…e9c2</div>
    </React.Fragment>
  );
  if (state === 'superseded') return <div className="wfd-state-sup-wm">ЗАМІНЕНО</div>;
  return null;
}

function DocKitViewer() {
  const [kit, setKit] = _de('ua');
  const [ua, setUa] = _de('invoice');
  const [eu, setEu] = _de('invoice');
  const [docState, setDocState] = _de('generated');
  const [pub, setPub] = _de(false);

  if (pub) return <PublicInvoicePage kit={kit} onBack={() => setPub(false)} />;

  const renderUA = () => {
    const t = UA_TYPES.find((x) => x[0] === ua);
    const C = window[t[2]];
    return C ? React.createElement(C) : <div className="wfd-page">UA {ua}</div>;
  };
  const renderEU = () => {
    if (eu === 'agreement') return <EuServiceAgreementDoc />;
    if (eu === 'act') return <EuServiceActDoc />;
    if (eu === 'statement') return <EuStatementDoc />;
    if (eu === 'sow') return <EuSowDoc />;
    return <EuInvoiceDoc data={EU_DATA[eu]} kind={eu} />;
  };

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Бланки документів</h1><div className="wfp-ph-sub">// два комплекти: 🇺🇦 UA та 🇪🇺 EU · різні формати, не переклад (06-Е)</div></div>
        <div className="wfp-ph-r">
          <button className="wfp-btn" onClick={() => setPub(true)}><Icon name="external" size={14} />Публічна сторінка рахунку</button>
          <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Експорт PDF · демо', 'ok')}><Icon name="download" size={14} />Експорт PDF</button>
        </div>
      </div>

      <div className="wfdk-toolbar">
        <div className="wfdk-seg">
          <div className="wfdk-seg-opt" data-on={kit === 'ua' || undefined} onClick={() => setKit('ua')}>🇺🇦 UA-комплект</div>
          <div className="wfdk-seg-opt" data-on={kit === 'eu' || undefined} onClick={() => setKit('eu')}>🇪🇺 EU-комплект</div>
        </div>
        <div className="wfdk-types">
          {kit === 'ua'
            ? UA_TYPES.map(([id, l]) => <button key={id} className="wfp-pill" data-on={ua === id || undefined} onClick={() => setUa(id)}>{l}</button>)
            : EU_TYPES.map(([id, l]) => <button key={id} className="wfp-pill" data-on={eu === id || undefined} onClick={() => setEu(id)}>{l}</button>)}
        </div>
      </div>

      <div className="wfdk-statebar">
        <span className="wfdk-statebar-l">// стан документа:</span>
        {DOC_STATES.map(([id, l]) => (
          <button key={id} className="wfdk-state-opt" data-on={docState === id || undefined} data-s={id} onClick={() => setDocState(id)}>{l}</button>
        ))}
      </div>

      {docState === 'gate'
        ? <div className="wfd-gate-block">
            <Icon name="alert" size={30} color="var(--wf-warning)" />
            <div className="wfd-gate-block-t">PDF не рендериться</div>
            <div className="wfd-gate-block-s">Юр-особа агенції <strong>Workflo OÜ</strong> неповна (бракує IBAN). Документи заблоковані, поки реквізити не заповнені.</div>
            <button className="wfp-btn wfp-btn--primary wfp-btn--sm" style={{ marginTop: 14 }} onClick={() => window.__wsNav && window.__wsNav('legal')}><Icon name="building" size={13} />До юр-осіб</button>
          </div>
        : <div className="wfdk-canvas" data-state={docState}>
            {docState === 'superseded' && <div className="wfd-state-banner"><Icon name="alert" size={14} />Цей документ замінено новішою версією — <strong>{kit === 'eu' ? '2026-0398' : 'INV-2025-0398'}</strong>. Не чинний для оплати.</div>}
            {docState === 'draft' && <div className="wfd-state-draftnote">// номер не зафіксовано · чернетка не має юридичної сили</div>}
            <div className="wfd-state-wrap">
              {kit === 'ua' ? renderUA() : renderEU()}
              <DocStateLayer state={docState} />
            </div>
          </div>}
    </React.Fragment>
  );
}

Object.assign(window, { EuInvoiceDoc, EuServiceAgreementDoc, EuServiceActDoc, EuStatementDoc, EuSowDoc, PublicInvoicePage, DocKitViewer, EU_DATA });
