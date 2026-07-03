// documents-screens.jsx — full document set for workflo.space
// PDFs: invoice / completion_act / reconciliation_act / specification / contract
// UI:   Portal /documents index page

// ─── Shared building blocks ─────────────────────────────────────────────

// Workflo ASCII brand mark — cat (matches landing brand)
const WFD_ASCII = ` /\\_/\\
( o.o)
 > ^ <`;

function DocBrand({ subtitle }) {
  return (
    <div className="wfd-brand">
      <div className="wfd-brand-mark wfd-brand-mark--ascii">{WFD_ASCII}</div>
      <div className="wfd-brand-meta">
        <div className="wfd-brand-name">workflo<span className="wfd-dot">.</span>space</div>
        <div className="wfd-brand-sub">{subtitle || 'цифровий офіс команди автоматизаторів'}</div>
        <div className="wfd-brand-sub">illia@workflo.space · workflo.space</div>
      </div>
    </div>
  );
}

// "Doc number" header on the right side — type label + number + key dates
function DocTypeBlock({ type, num, rows }) {
  return (
    <div className="wfd-doctype">
      <div className="wfd-doctype-l">{type}</div>
      <div className="wfd-doctype-n">{num}</div>
      <div className="wfd-doctype-d">
        {rows.map((r, i) => (
          <div key={i} className="wfd-doctype-d-row">
            <div className="wfd-doctype-d-k">{r.k}</div>
            <div className="wfd-doctype-d-v">{r.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Two parties block (sender + receiver)
function DocParties({ from, to, fromLabel = '// Виконавець · From', toLabel = '// Замовник · To' }) {
  return (
    <div className="wfd-parties">
      <div className="wfd-party">
        <div className="wfd-party-l">{fromLabel}</div>
        <div className="wfd-party-name">{from.name}</div>
        {from.tin && <div className="wfd-party-row"><div className="wfd-party-k">ІПН</div><div className="wfd-party-v">{from.tin}</div></div>}
        {from.addr && <div className="wfd-party-row"><div className="wfd-party-k">адреса</div><div className="wfd-party-v">{from.addr}</div></div>}
        {from.iban && <div className="wfd-party-row"><div className="wfd-party-k">IBAN</div><div className="wfd-party-v">{from.iban}</div></div>}
        {from.bank && <div className="wfd-party-row"><div className="wfd-party-k">банк</div><div className="wfd-party-v">{from.bank}</div></div>}
        {from.email && <div className="wfd-party-row"><div className="wfd-party-k">email</div><div className="wfd-party-v">{from.email}</div></div>}
      </div>
      <div className="wfd-party">
        <div className="wfd-party-l">{toLabel}</div>
        <div className="wfd-party-name">{to.name}</div>
        {to.tin && <div className="wfd-party-row"><div className="wfd-party-k">ЄДРПОУ</div><div className="wfd-party-v">{to.tin}</div></div>}
        {to.addr && <div className="wfd-party-row"><div className="wfd-party-k">адреса</div><div className="wfd-party-v">{to.addr}</div></div>}
        {to.contact && <div className="wfd-party-row"><div className="wfd-party-k">контакт</div><div className="wfd-party-v">{to.contact}</div></div>}
        {to.email && !to.contact && <div className="wfd-party-row"><div className="wfd-party-k">email</div><div className="wfd-party-v">{to.email}</div></div>}
      </div>
    </div>
  );
}

// Synthetic QR (deterministic-pseudo random pattern)
function FakeQR({ seed = 13 }) {
  // 11×11 grid, deterministic on/off
  const cells = [];
  for (let i = 0; i < 121; i++) {
    // include the 3 corner finder patterns
    const r = Math.floor(i / 11);
    const c = i % 11;
    const corner =
      (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
    const cornerEdge =
      (r === 0 || r === 2 || c === 0 || c === 2) ||
      (r === 0 || r === 2 || c === 8 || c === 10) ||
      (r === 8 || r === 10 || c === 0 || c === 2);
    let on;
    if (corner) on = cornerEdge || (r === 1 && c === 1) || (r === 1 && c === 9) || (r === 9 && c === 1);
    else on = ((i * seed) % 11 < 5) && !((i + 3) % 7 === 0);
    cells.push(on);
  }
  return (
    <div className="wfd-qr">
      {cells.map((on, i) => <span key={i} className={on ? 'on' : ''} />)}
    </div>
  );
}

// Two signature blocks
function DocSigs({ left, right, date }) {
  return (
    <div className="wfd-sigs">
      <div>
        <div className="wfd-sig-l">// {left.role}</div>
        <div className="wfd-sig-line">
          {left.signed && <div className="wfd-sig-stamp">{left.signature}</div>}
        </div>
        <div className="wfd-sig-meta">
          <strong>{left.name}</strong><br />
          {left.title}
        </div>
        <div className="wfd-sig-date">{left.signed ? `підписано · ${date}` : `дата підпису: ____________`}</div>
      </div>
      <div>
        <div className="wfd-sig-l">// {right.role}</div>
        <div className="wfd-sig-line">
          {right.signed && <div className="wfd-sig-stamp">{right.signature}</div>}
        </div>
        <div className="wfd-sig-meta">
          <strong>{right.name}</strong><br />
          {right.title}
        </div>
        <div className="wfd-sig-date">{right.signed ? `підписано · ${date}` : `дата підпису: ____________`}</div>
      </div>
    </div>
  );
}

// Footer line
function DocFoot({ num, page = '1', of = '1', extra }) {
  return (
    <div className="wfd-foot">
      <span>workflo<span style={{ color: '#A3D90D' }}>.</span>space · {num} · сторінка {page} з {of}</span>
      <span>{extra || 'згенеровано · workflo-app/v0.6.2'}</span>
    </div>
  );
}

// ─── 1) INVOICE (рахунок) ─────────────────────────────────────────────
function InvoiceDoc() {
  const inv = window.WFP_DATA.invoice_full;
  return (
    <div className="wfd-page">
      <div className="wfd-page-head">
        <DocBrand subtitle="ФОП Васюленко І.С. · Луцьк, Україна" />
        <DocTypeBlock
          type="Рахунок-фактура · Invoice"
          num={inv.num}
          rows={[
            { k: 'дата',      v: inv.date },
            { k: 'до оплати', v: inv.due },
          ]}
        />
      </div>

      <DocParties from={inv.from} to={inv.to} />

      <div className="wfd-project">
        <div className="wfd-project-k">проєкт</div>
        <div className="wfd-project-v"><strong>{inv.project}</strong><span className="wfd-ord">{inv.order}</span></div>
        <div className="wfd-project-k">умови</div>
        <div className="wfd-project-v">розробка ПЗ · fixed price · згідно зі specifications-ord-2412.pdf від 23.05.2026</div>
      </div>

      <table className="wfd-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>#</th>
            <th>Опис робіт</th>
            <th className="wfd-num" style={{ width: 50 }}>К-сть</th>
            <th style={{ width: 50 }}>Од.</th>
            <th className="wfd-num" style={{ width: 80 }}>Ціна</th>
            <th className="wfd-num" style={{ width: 90 }}>Сума, $</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it) => (
            <tr key={it.n}>
              <td className="wfd-row-n">{String(it.n).padStart(2, '0')}</td>
              <td>{it.desc}</td>
              <td className="wfd-num">{it.qty}</td>
              <td>{it.unit}</td>
              <td className="wfd-num">${it.price.toLocaleString('uk-UA')}</td>
              <td className="wfd-num"><strong>${it.sum.toLocaleString('uk-UA')}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="wfd-totals">
        <div className="wfd-totals-box">
          <div className="wfd-totals-row"><div className="wfd-totals-k">subtotal</div><div className="wfd-totals-v">${inv.subtotal.toLocaleString('uk-UA')}</div></div>
          <div className="wfd-totals-row"><div className="wfd-totals-k">знижка</div><div className="wfd-totals-v">— $0</div></div>
          <div className="wfd-totals-row"><div className="wfd-totals-k">ПДВ</div><div className="wfd-totals-v">— ФОП 3 гр.</div></div>
          <div className="wfd-totals-row wfd-totals-row--grand">
            <div className="wfd-totals-k">до сплати</div>
            <div className="wfd-totals-v wfd-totals-v--accent">${inv.total.toLocaleString('uk-UA')}</div>
          </div>
          <div className="wfd-totals-row"><div className="wfd-totals-k">в гривні</div><div className="wfd-totals-v">₴{inv.uah_total.toLocaleString('uk-UA')}</div></div>
          <div style={{ fontSize: 9.5, color: '#78716C', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', marginTop: 4 }}>
            {inv.rate_note}
          </div>
        </div>
      </div>

      <div className="wfd-note">
        <span className="wfd-note-l">// payment_purpose</span>
        {inv.note}
      </div>

      {/* QR + alt-payment */}
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 20, alignItems: 'center', marginTop: 18, padding: '14px 0', borderTop: '1px dashed #E7E5E4' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <FakeQR seed={11} />
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8.5, color: '#78716C' }}>scan to pay</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: '10px 14px', border: '1px solid #E7E5E4', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5 }}>
            <div style={{ color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 9, marginBottom: 6 }}>USDT · TRC20</div>
            <div style={{ wordBreak: 'break-all', color: '#0C0A09' }}>TXyZ8fQ3rN9pW2vK4mB7sH1jR5cE6dA0xN</div>
          </div>
          <div style={{ padding: '10px 14px', border: '1px solid #E7E5E4', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5 }}>
            <div style={{ color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 9, marginBottom: 6 }}>Контакт / питання</div>
            <div>@workflospace · illia@workflo.space</div>
          </div>
        </div>
      </div>

      <DocFoot num={inv.num} extra="згенеровано: 24.05.2026 11:08" />
    </div>
  );
}

// ─── 2) COMPLETION ACT (акт виконаних робіт) ─────────────────────────
function CompletionActDoc() {
  const a = window.WFP_DATA.act_full;
  const inv = window.WFP_DATA.invoice_full;
  return (
    <div className="wfd-page" style={{ position: 'relative' }}>
      <div className="wfd-stamp" style={{ right: 64, top: 96 }}>
        ПІДПИСАНО<br />24.05.2026<br />workflo.space
      </div>

      <div className="wfd-page-head">
        <DocBrand />
        <DocTypeBlock
          type="Акт виконаних робіт · Act"
          num={a.num}
          rows={[
            { k: 'дата',   v: a.date },
            { k: 'період', v: `${a.period_from} – ${a.period_to}` },
          ]}
        />
      </div>

      <DocParties from={inv.from} to={inv.to} fromLabel="// Виконавець" toLabel="// Замовник" />

      <div className="wfd-project">
        <div className="wfd-project-k">проєкт</div>
        <div className="wfd-project-v"><strong>{a.project}</strong><span className="wfd-ord">{a.order}</span></div>
        <div className="wfd-project-k">підстава</div>
        <div className="wfd-project-v">Рахунок-фактура <strong>{a.invoice_ref}</strong> · Договір <strong>CTR-2025-0004</strong> від 22.04.2025</div>
      </div>

      <h2 className="wfd-h2">Перелік виконаних робіт</h2>

      <table className="wfd-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>#</th>
            <th>Найменування робіт</th>
            <th className="wfd-num" style={{ width: 50 }}>К-сть</th>
            <th style={{ width: 50 }}>Од.</th>
            <th className="wfd-num" style={{ width: 80 }}>Ціна</th>
            <th className="wfd-num" style={{ width: 90 }}>Сума, $</th>
          </tr>
        </thead>
        <tbody>
          {a.items.map((it) => (
            <tr key={it.n}>
              <td className="wfd-row-n">{String(it.n).padStart(2, '0')}</td>
              <td>{it.desc}</td>
              <td className="wfd-num">{it.qty}</td>
              <td>{it.unit}</td>
              <td className="wfd-num">${it.price.toLocaleString('uk-UA')}</td>
              <td className="wfd-num"><strong>${it.sum.toLocaleString('uk-UA')}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="wfd-totals">
        <div className="wfd-totals-box">
          <div className="wfd-totals-row"><div className="wfd-totals-k">всього робіт</div><div className="wfd-totals-v">{a.items.length} поз.</div></div>
          <div className="wfd-totals-row wfd-totals-row--grand">
            <div className="wfd-totals-k">сума за актом</div>
            <div className="wfd-totals-v wfd-totals-v--accent">${a.total.toLocaleString('uk-UA')}</div>
          </div>
          <div className="wfd-totals-row"><div className="wfd-totals-k">в гривні</div><div className="wfd-totals-v">₴{a.uah_total.toLocaleString('uk-UA')}</div></div>
        </div>
      </div>

      <h2 className="wfd-h2">Прийняття-передача</h2>
      <p className="wfd-p">{a.acceptance_text}</p>
      <p className="wfd-p">
        <strong>Якість робіт відповідає вимогам Замовника.</strong> Розрахунок між Сторонами по даному акту проводиться відповідно до Договору № <strong>CTR-2025-0004</strong> від 22.04.2025.
      </p>

      <DocSigs
        date={a.date}
        left={{ role: 'Виконавець · Sender', name: 'Васюленко І. С.', title: 'ФОП · ІПН 3456789012', signed: true, signature: 'Васюленко' }}
        right={{ role: 'Замовник · Recipient', name: 'Іваненко О. П.', title: 'Директор ТОВ «Брунки»', signed: true, signature: 'Іваненко' }}
      />

      <DocFoot num={a.num} />
    </div>
  );
}

// ─── 3) RECONCILIATION ACT (акт звірки) ─────────────────────────────
function ReconciliationActDoc() {
  const r = window.WFP_DATA.reconciliation_full;
  const inv = window.WFP_DATA.invoice_full;

  const totalDebit  = r.rows.reduce((s, x) => s + x.debit,  0);
  const totalCredit = r.rows.reduce((s, x) => s + x.credit, 0);
  const closing = r.opening_balance + totalDebit - totalCredit;

  return (
    <div className="wfd-page" style={{ position: 'relative' }}>
      <div className="wfd-stamp wfd-stamp--draft" style={{ right: 64, top: 96 }}>
        DRAFT<br />не підписано<br />24.05.2026
      </div>

      <div className="wfd-page-head">
        <DocBrand />
        <DocTypeBlock
          type="Акт звірки · Reconciliation"
          num={r.num}
          rows={[
            { k: 'станом на', v: r.date },
            { k: 'період',    v: `${r.period_from} – ${r.period_to}` },
          ]}
        />
      </div>

      <DocParties from={inv.from} to={inv.to} fromLabel="// Виконавець" toLabel="// Замовник" />

      <p className="wfd-p" style={{ marginTop: 8 }}>
        Цей акт складено для звірки взаєморозрахунків між Сторонами за період <strong>{r.period_from} – {r.period_to}</strong>. Усі суми наведено у доларах США (USD); еквівалент у гривні розраховано за курсом НБУ на дату відповідної операції.
      </p>

      <div className="wfd-rec-summary">
        <div className="wfd-rec-cell">
          <div className="wfd-rec-cell-l">сальдо на початок</div>
          <div className="wfd-rec-cell-v">${r.opening_balance.toLocaleString('uk-UA')}</div>
        </div>
        <div className="wfd-rec-cell">
          <div className="wfd-rec-cell-l">обороти · дебет / кредит</div>
          <div className="wfd-rec-cell-v">
            <span className="wfd-rec-cell-v--debit">${totalDebit.toLocaleString('uk-UA')}</span>
            <span style={{ color: '#78716C', fontWeight: 400, margin: '0 8px' }}>·</span>
            <span className="wfd-rec-cell-v--credit">${totalCredit.toLocaleString('uk-UA')}</span>
          </div>
        </div>
        <div className="wfd-rec-cell">
          <div className="wfd-rec-cell-l">сальдо на кінець</div>
          <div className="wfd-rec-cell-v" style={{ color: '#C5F82A', background: '#0C0A09', padding: '2px 8px', borderRadius: 3, display: 'inline-block' }}>
            ${closing.toLocaleString('uk-UA')}
          </div>
        </div>
      </div>

      <h2 className="wfd-h2">Деталізація операцій</h2>

      <table className="wfd-table">
        <thead>
          <tr>
            <th style={{ width: 70 }}>Дата</th>
            <th style={{ width: 110 }}>Документ</th>
            <th>Опис</th>
            <th className="wfd-num" style={{ width: 90 }}>Дебет · нарах.</th>
            <th className="wfd-num" style={{ width: 90 }}>Кредит · оплат.</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((x, i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{x.date}</td>
              <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#0C0A09', fontWeight: 500 }}>{x.doc}</td>
              <td style={{ fontSize: 10.5 }}>{x.desc}</td>
              <td className="wfd-num" style={{ color: x.debit ? '#B91C1C' : '#A8A29E' }}>{x.debit ? `$${x.debit.toLocaleString('uk-UA')}` : '—'}</td>
              <td className="wfd-num" style={{ color: x.credit ? '#15803D' : '#A8A29E' }}>{x.credit ? `$${x.credit.toLocaleString('uk-UA')}` : '—'}</td>
            </tr>
          ))}
          <tr style={{ background: '#FAFAF9', fontWeight: 600 }}>
            <td colSpan={3} style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: '#0C0A09' }}>РАЗОМ ОБОРОТИ:</td>
            <td className="wfd-num" style={{ color: '#B91C1C' }}><strong>${totalDebit.toLocaleString('uk-UA')}</strong></td>
            <td className="wfd-num" style={{ color: '#15803D' }}><strong>${totalCredit.toLocaleString('uk-UA')}</strong></td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 16, padding: '12px 16px', border: '2px solid #0C0A09', borderRadius: 6, display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center', background: '#FAFAF9' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>// підсумок</div>
          <div style={{ fontSize: 12, color: '#0C0A09' }}>{r.closing_balance_label}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#78716C', marginTop: 4 }}>≈ ₴{Math.round(closing * 41.2857).toLocaleString('uk-UA')} за курсом НБУ на 24.05.2026</div>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 600, color: '#0C0A09', fontFeatureSettings: '"tnum"' }}>
          ${closing.toLocaleString('uk-UA')}
        </div>
      </div>

      <p className="wfd-p" style={{ marginTop: 16, fontSize: 10 }}>
        Сторони підтверджують правильність взаєморозрахунків, наведених у цьому Акті. У разі наявності розбіжностей — Сторони зобов’язуються повідомити одна одну протягом 10 (десяти) календарних днів з моменту отримання цього Акту.
      </p>

      <DocSigs
        date={r.date}
        left={{ role: 'Виконавець', name: 'Васюленко І. С.', title: 'ФОП · ІПН 3456789012', signed: false }}
        right={{ role: 'Замовник',   name: 'Іваненко О. П.', title: 'Директор ТОВ «Брунки»', signed: false }}
      />

      <DocFoot num={r.num} />
    </div>
  );
}

// ─── 4) SPECIFICATION (специфікація) ─────────────────────────────────
function SpecificationDoc() {
  const s = window.WFP_DATA.spec_full;
  const inv = window.WFP_DATA.invoice_full;
  return (
    <div className="wfd-page">
      <div className="wfd-page-head">
        <DocBrand />
        <DocTypeBlock
          type="Специфікація проєкту · Specification"
          num={s.num}
          rows={[
            { k: 'дата',  v: s.date },
            { k: 'order', v: s.order },
          ]}
        />
      </div>

      <div className="wfd-project">
        <div className="wfd-project-k">проєкт</div>
        <div className="wfd-project-v"><strong>{s.project}</strong><span className="wfd-ord">{s.order}</span></div>
        <div className="wfd-project-k">замовник</div>
        <div className="wfd-project-v">{inv.to.name} · {inv.to.contact}</div>
        <div className="wfd-project-k">тривалість</div>
        <div className="wfd-project-v"><strong>{s.duration_weeks} тижнів</strong> · {s.payment_terms}</div>
      </div>

      <h2 className="wfd-h2">Контекст</h2>
      <p className="wfd-p">{s.summary}</p>

      <h2 className="wfd-h2">Цілі</h2>
      <ol className="wfd-ol">
        {s.goals.map((g, i) => <li key={i}>{g}</li>)}
      </ol>

      <h2 className="wfd-h2">Скоуп робіт</h2>
      <div className="wfd-scope">
        {s.scope.map((b, i) => (
          <div className="wfd-scope-block" key={i}>
            <div className="wfd-scope-l">{b.l}</div>
            <ul className="wfd-scope-i">
              {b.i.map((x, j) => <li key={j}>{x}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="wfd-h2">Що передаємо · Deliverables</h2>
      <table className="wfd-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>#</th>
            <th>Артефакт</th>
            <th>Формат / стек</th>
            <th>Примітки</th>
          </tr>
        </thead>
        <tbody>
          {s.deliverables.map((d) => (
            <tr key={d.n}>
              <td className="wfd-row-n">{String(d.n).padStart(2, '0')}</td>
              <td><strong>{d.name}</strong></td>
              <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{d.format}</td>
              <td style={{ fontSize: 10.5, color: '#44403C' }}>{d.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="wfd-h2">Етапи</h2>
      <div style={{ border: '1px solid #E7E5E4', borderRadius: 6, overflow: 'hidden' }}>
        {s.milestones.map((m, i) => (
          <div className="wfd-ms-row" key={i}>
            <div><span className="wfd-ms-week">w {m.week}</span></div>
            <div className="wfd-ms-name">{m.name}</div>
            <div className="wfd-ms-deliv">{m.deliverables}</div>
          </div>
        ))}
      </div>

      <h2 className="wfd-h2">Критерії приймання</h2>
      <ul className="wfd-ul">
        {s.acceptance.map((a, i) => <li key={i}>{a}</li>)}
      </ul>

      <h2 className="wfd-h2">Поза скоупом</h2>
      <ul className="wfd-ul" style={{ opacity: 0.85 }}>
        {s.out_of_scope.map((o, i) => <li key={i} style={{ color: '#78716C' }}>{o}</li>)}
      </ul>

      <h2 className="wfd-h2">Бюджет</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 4 }}>
        <div style={{ padding: '14px 16px', border: '1px solid #E7E5E4', borderRadius: 6, background: '#FAFAF9' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>fixed price</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 600, color: '#0C0A09', fontFeatureSettings: '"tnum"' }}>${s.price.fixed.toLocaleString('uk-UA')}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#78716C', marginTop: 4 }}>≈ ₴{(s.price.fixed * 41.2857).toLocaleString('uk-UA', { maximumFractionDigits: 0 })}</div>
        </div>
        <div style={{ padding: '14px 16px', border: '1px solid #E7E5E4', borderRadius: 6, background: '#FAFAF9' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>overage / hour</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 600, color: '#0C0A09', fontFeatureSettings: '"tnum"' }}>${s.price.hourly_overage}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#78716C', marginTop: 4 }}>якщо скоуп розширюється</div>
        </div>
        <div style={{ padding: '14px 16px', border: '1px solid #0C0A09', borderRadius: 6, background: '#0C0A09', color: '#FAFAF9' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>гарантія</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 600, color: '#C5F82A', lineHeight: 1.1 }}>30 днів</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#A8A29E', marginTop: 4 }}>багфікси після здачі</div>
        </div>
      </div>

      <DocSigs
        date="—"
        left={{ role: 'Виконавець', name: 'Васюленко І. С.', title: 'ФОП · ІПН 3456789012', signed: false }}
        right={{ role: 'Замовник',   name: 'Іваненко О. П.', title: 'Директор ТОВ «Брунки»', signed: false }}
      />

      <DocFoot num={s.num} />
    </div>
  );
}

// ─── 5) CONTRACT (договір) ─────────────────────────────────────────
function ContractDoc() {
  const c = window.WFP_DATA.contract_full;
  return (
    <div className="wfd-page wfd-page--contract">
      <div className="wfd-page-head">
        <DocBrand />
        <DocTypeBlock
          type="Договір про надання послуг · Service Agreement"
          num={c.num}
          rows={[
            { k: 'дата',  v: c.date },
            { k: 'місце', v: c.place },
          ]}
        />
      </div>

      {/* Parties intro */}
      <p className="wfd-p" style={{ fontSize: 10.5, lineHeight: 1.7 }}>
        Цей договір про надання послуг з розробки програмного забезпечення (далі — «<strong>Договір</strong>») укладено <strong>{c.date}</strong> у <strong>{c.place}</strong> між:
      </p>

      <div className="wfd-contract-parties">
        <div className="wfd-contract-party">
          <div className="wfd-contract-party-l">// {c.parties.executor.title}</div>
          <div className="wfd-contract-party-name">{c.parties.executor.name}</div>
          <div style={{ fontSize: 9.5, color: '#44403C', fontStyle: 'italic', marginBottom: 6 }}>{c.parties.executor.basis}</div>
          <div className="wfd-contract-party-row"><div className="wfd-contract-party-k">ІПН</div><div>{c.parties.executor.tin}</div></div>
          <div className="wfd-contract-party-row"><div className="wfd-contract-party-k">адреса</div><div>{c.parties.executor.addr}</div></div>
          <div className="wfd-contract-party-row"><div className="wfd-contract-party-k">IBAN</div><div style={{ wordBreak: 'break-all' }}>{c.parties.executor.iban}</div></div>
          <div className="wfd-contract-party-row"><div className="wfd-contract-party-k">банк</div><div>{c.parties.executor.bank}</div></div>
        </div>
        <div className="wfd-contract-party">
          <div className="wfd-contract-party-l">// {c.parties.client.title}</div>
          <div className="wfd-contract-party-name">{c.parties.client.name}</div>
          <div style={{ fontSize: 9.5, color: '#44403C', fontStyle: 'italic', marginBottom: 6 }}>{c.parties.client.basis}</div>
          <div className="wfd-contract-party-row"><div className="wfd-contract-party-k">ЄДРПОУ</div><div>{c.parties.client.tin}</div></div>
          <div className="wfd-contract-party-row"><div className="wfd-contract-party-k">адреса</div><div>{c.parties.client.addr}</div></div>
          <div className="wfd-contract-party-row"><div className="wfd-contract-party-k">email</div><div>{c.parties.client.email}</div></div>
        </div>
      </div>

      <p className="wfd-p" style={{ fontSize: 10, marginBottom: 8 }}>
        разом іменовані «<strong>Сторони</strong>», а кожна окремо — «<strong>Сторона</strong>», уклали цей Договір про наступне:
      </p>

      {/* Clauses in 2-column layout */}
      <div className="wfd-clauses">
        {c.sections.map((sec, i) => (
          <div className="wfd-clause" key={i}>
            <div className="wfd-clause-h">{sec.h}</div>
            {sec.p.map((p, j) => <p className="wfd-clause-p" key={j}>{p}</p>)}
          </div>
        ))}
      </div>

      <DocSigs
        date={c.date}
        left={{ role: c.parties.executor.title, name: c.parties.executor.short, title: 'ІПН ' + c.parties.executor.tin, signed: true, signature: 'Васюленко' }}
        right={{ role: c.parties.client.title,   name: 'Іваненко О. П.', title: 'Директор ' + c.parties.client.short, signed: true, signature: 'Іваненко' }}
      />

      <DocFoot num={c.num} page="1" of="1" extra="Договір підписано електронно через workflo.space" />
    </div>
  );
}

// ─── DOCUMENTS INDEX (Portal /documents UI page) ─────────────────────
function DocumentsIndex() {
  const docs = window.WFP_DATA.documents_list;
  const types = window.WFP_DATA.doc_types;
  const total = docs.length;
  const counts = {};
  docs.forEach((d) => { counts[d.type] = (counts[d.type] || 0) + 1; });

  const DOC_STATUS = {
    draft:      { label: 'чернетка',  cls: 'soft' },
    generated:  { label: 'згенеровано', cls: 'partial' },
    sent:       { label: 'надіслано', cls: 'partial' },
    signed:     { label: 'підписано', cls: 'paid' },
    superseded: { label: 'замінено',  cls: 'unpaid' },
    paid:       { label: 'оплачено',  cls: 'paid' },
  };
  const DELIVERY = {
    sent:      { label: 'надіслано',  tone: 'muted' },
    delivered: { label: 'доставлено', tone: 'ok' },
    opened:    { label: 'відкрито',   tone: 'accent' },
    error:     { label: 'помилка',    tone: 'bad' },
  };

  const [bulk, setBulk] = React.useState(false);
  const [sel, setSel] = React.useState([]);
  const toggle = (num) => setSel((s) => s.includes(num) ? s.filter((x) => x !== num) : [...s, num]);
  const allSel = sel.length === docs.length;

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Документи</h1>
          <div className="wfp-ph-sub">// {total} документів · 1 чернетка · {docs.filter((d) => d.status === 'signed').length} підписаних · {docs.filter((d) => d.status === 'sent').length} надіслано</div>
        </div>
        <div className="wfp-ph-r">
          <button className="wfp-btn" data-on={bulk || undefined} onClick={() => { setBulk(!bulk); setSel([]); }}><Icon name="check" size={14} />{bulk ? 'Готово' : 'Вибір'}</button>
          <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт ZIP · демо', 'ok')}>Експорт ZIP</button>
          <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Завантажити все · PDF · демо', 'ok')}><Icon name="download" size={14} />Завантажити все · PDF</button>
        </div>
      </div>

      <div className="wfp-stats">
        {Object.entries(types).map(([k, t]) => (
          <div className="wfp-stat" key={k}>
            <div className="wfp-stat-k">{t.label.toLowerCase()}</div>
            <div className="wfp-stat-v" style={{ color: t.color }}>{counts[k] || 0}</div>
            <div className="wfp-stat-sub">{t.code}-...</div>
          </div>
        ))}
      </div>

      {bulk && (
        <div className="wfd-bulkbar">
          <label className="wfd-bulk-all">
            <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? [] : docs.map((d) => d.num))} />
            обрати всі
          </label>
          <span className="wfd-bulk-cnt">{sel.length} обрано</span>
          <div style={{ flex: 1 }} />
          <button className="wfp-btn wfp-btn--sm" disabled={!sel.length} onClick={() => window.wfToast && window.wfToast('Експорт ZIP · демо', 'ok')}><Icon name="download" size={12} />Експорт ZIP</button>
          <button className="wfp-btn wfp-btn--sm" disabled={!sel.length} onClick={() => window.wfToast && window.wfToast('Надіслати повторно · демо', 'ok')}><Icon name="send" size={12} />Надіслати повторно</button>
          <button className="wfp-btn wfp-btn--sm wfp-btn--primary" disabled={!sel.length} onClick={() => window.wfToast && window.wfToast('Згенерувати акти звірки · демо', 'ok')}><Icon name="receipt" size={12} />Згенерувати акти звірки</button>
        </div>
      )}

      <div className="wfp-filters">
        <div className="wfp-search">
          <Icon name="search" size={14} color="var(--wf-fg-muted)" />
          <input placeholder="Шукати за номером, замовленням, типом…" />
          <span className="wfp-search-kbd">⌘K</span>
        </div>
        <button className="wfp-pill" data-on="true">всі типи</button>
        <button className="wfp-pill">invoice</button>
        <button className="wfp-pill">acts</button>
        <button className="wfp-pill">spec + contract</button>
        <span style={{ width: 1, height: 24, background: 'var(--wf-border)', margin: '0 4px' }} />
        <button className="wfp-pill">2026</button>
      </div>

      <table className="wfp-table">
        <thead>
          <tr>
            {bulk && <th style={{ width: 36 }}></th>}
            <th style={{ width: 130 }}>№</th>
            <th>Тип / документ</th>
            <th>Замовлення</th>
            <th>Дата</th>
            <th className="wfp-num">Сума</th>
            <th>Статус</th>
            <th>Доставка</th>
            <th style={{ width: 80 }}>Розмір</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const t = types[d.type];
            const st = DOC_STATUS[d.status] || { label: d.status, cls: 'soft' };
            const dl = d.delivery ? DELIVERY[d.delivery] : null;
            return (
              <tr key={d.num} data-sel={bulk && sel.includes(d.num) || undefined}>
                {bulk && <td><input type="checkbox" checked={sel.includes(d.num)} onChange={() => toggle(d.num)} /></td>}
                <td className="wfp-mono"><span className="wfp-link" style={{ fontWeight: 500 }}>{d.num}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="wfp-doc-type-pill" data-t={d.type}>{t.code}</span>
                    <span>{t.label}</span>
                    {d.status === 'superseded' && d.supersededBy && <span className="wfd-superseded-ref" title={`замінено документом ${d.supersededBy}`}>→ {d.supersededBy}</span>}
                  </div>
                </td>
                <td className="wfp-mono"><span className="wfp-link">{d.order}</span></td>
                <td className="wfp-mono">{d.date}</td>
                <td className="wfp-num">{d.amount ? `$${d.amount.toLocaleString('uk-UA')}` : '—'}</td>
                <td><span className={`wfp-badge wfp-badge--${st.cls}`}>{st.label}</span></td>
                <td>
                  {dl
                    ? <span className="wfd-delivery" data-tone={dl.tone}>
                        <Icon name={d.channel === 'telegram' ? 'send' : 'mail'} size={11} />
                        <span className="wfd-delivery-dot" />{dl.label}
                      </span>
                    : <span className="wfd-delivery wfd-delivery--none">— не надсилалось</span>}
                </td>
                <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{d.size}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Open · демо', 'ok')}><Icon name="external" size={11} />Open</button>
                    {d.delivery === 'error'
                      ? <button className="wfp-btn wfp-btn--ghost wfp-btn--sm wfp-btn--danger" onClick={() => window.wfToast && window.wfToast('Повторити · демо', 'ok')}><Icon name="send" size={11} />Повторити</button>
                      : <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('PDF · демо', 'ok')}><Icon name="download" size={11} />PDF</button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </React.Fragment>
  );
}

Object.assign(window, {
  InvoiceDoc,
  CompletionActDoc,
  ReconciliationActDoc,
  SpecificationDoc,
  ContractDoc,
  DocumentsIndex,
});
