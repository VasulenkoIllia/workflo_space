// round4-billing.jsx — G13 · Refund / credit-note flow (admin).
// Initiate refund → preview allocations → confirm (3s countdown) → post-state,
// plus the CRN credit-note PDF and a "refund issued" email template.

const _rb = React.useState;
const _rbe = React.useEffect;

const RB_INV = { num: 'INV-2025-0414', order: 'ORD-2412', client: 'ТОВ «Брунки»', total: 4200, paid: 4200, date: '14.05.2026' };
const RB_ALLOC = (amount) => ([
  { k: 'Повернення клієнту', v: amount, neg: true, ic: 'coins' },
  { k: 'Баланс компанії (moneyBalance)', v: -amount, sub: 'буде зменшено на суму', ic: 'building' },
  { k: 'Лояльність · totalSpent', v: -amount, sub: 'оборот зменшиться → перевірка рівня', ic: 'star' },
  { k: 'Реферальний clawback', v: -210, sub: 'бонус рефереру EduForge буде відкликано', ic: 'gift' },
]);

function RbStepper({ value, onChange, max }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input className="wfs-textarea" style={{ minHeight: 0, height: 42, width: 140, fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }}
        value={value} onChange={(e) => { const n = Math.max(0, Math.min(max, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))); onChange(n); }} />
      <span className="r4-note">/ макс ${max.toLocaleString('uk-UA')}</span>
    </div>
  );
}

function R4RefundModal({ onClose, onDone }) {
  const [step, setStep] = _rb(1);
  const [mode, setMode] = _rb('full');
  const [amount, setAmount] = _rb(RB_INV.paid);
  const [method, setMethod] = _rb('card');
  const [reason, setReason] = _rb('');
  const [cd, setCd] = _rb(3);

  _rbe(() => { if (mode === 'full') setAmount(RB_INV.paid); }, [mode]);
  _rbe(() => {
    if (step !== 3) return;
    setCd(3);
    const id = setInterval(() => setCd((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; }), 1000);
    return () => clearInterval(id);
  }, [step]);

  const methods = [{ id: 'card', l: 'на картку' }, { id: 'iban', l: 'на IBAN' }, { id: 'credit', l: 'кредит-нота (CRN)' }];
  const alloc = RB_ALLOC(amount);

  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal wfp-modal--lg" style={{ width: 560, margin: 0 }}>
        <div className="wfp-modal-h">
          <Icon name="coins" size={18} color="var(--wf-destructive)" />
          <span className="wfp-modal-h-t">{step === 3 ? 'Підтвердіть повернення' : 'Ініціювати повернення'}</span>
          <span className="wfp-modal-h-aux">// {RB_INV.num} · крок {step} з 3</span>
          <span className="wfp-modal-h-close" onClick={onClose}><Icon name="alert" size={14} /></span>
        </div>
        <div className="wfp-modal-body">
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="r4-alloc"><div className="r4-alloc-row"><span className="r4-alloc-k">{RB_INV.num} · {RB_INV.client}</span><span className="r4-alloc-v">${RB_INV.paid.toLocaleString('uk-UA')} сплачено</span></div></div>
              <div>
                <div className="r4-subhead" style={{ margin: '0 0 8px' }}><span className="r4-subhead-t">сума</span></div>
                <div className="r4-seg" style={{ marginBottom: 12 }}>
                  <div className="r4-seg-opt" data-on={mode === 'full' || undefined} onClick={() => setMode('full')}>Повна</div>
                  <div className="r4-seg-opt" data-on={mode === 'partial' || undefined} onClick={() => setMode('partial')}>Часткова</div>
                </div>
                {mode === 'partial' && <RbStepper value={amount} onChange={setAmount} max={RB_INV.paid} />}
              </div>
              <div>
                <div className="r4-subhead" style={{ margin: '0 0 8px' }}><span className="r4-subhead-t">метод</span></div>
                <div className="r4-seg">{methods.map((m) => <div key={m.id} className="r4-seg-opt" data-on={method === m.id || undefined} onClick={() => setMethod(m.id)}>{m.l}</div>)}</div>
              </div>
              <div>
                <div className="r4-subhead" style={{ margin: '0 0 8px' }}><span className="r4-subhead-t">причина (обовʼязково)</span></div>
                <textarea className="wfs-textarea" placeholder="Напр.: клієнт відмовився від частини скоупу за домовленістю…" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <div className="wfs-modal-lead">Перевірте, на що вплине повернення <strong>${amount.toLocaleString('uk-UA')}</strong> ({method === 'credit' ? 'кредит-нота' : method === 'iban' ? 'IBAN' : 'картка'}):</div>
              <div className="r4-alloc">
                {alloc.map((a, i) => (
                  <div key={i} className="r4-alloc-row">
                    <span className="r4-alloc-k"><Icon name={a.ic} size={14} />{a.k}{a.sub && <span className="r4-note" style={{ marginLeft: 6 }}>· {a.sub}</span>}</span>
                    <span className="r4-alloc-v" data-neg={a.v < 0 || a.neg || undefined}>{a.v < 0 ? '−' : ''}${Math.abs(a.v).toLocaleString('uk-UA')}</span>
                  </div>
                ))}
                <div className="r4-alloc-row" data-grand="true"><span className="r4-alloc-k">Підсумок повернення</span><span className="r4-alloc-v" data-neg="true">−${amount.toLocaleString('uk-UA')}</span></div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="wfs-modal-lead" style={{ marginBottom: 0 }}>
              Ви повертаєте <strong>${amount.toLocaleString('uk-UA')}</strong> клієнту <strong>{RB_INV.client}</strong> ({method === 'credit' ? 'кредит-нота CRN' : method === 'iban' ? 'на IBAN' : 'на картку'}).
              Дію <strong>не можна скасувати</strong>. {method === 'credit' && 'Буде згенеровано документ CRN.'}
            </div>
          )}
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// впливає на debt · loyalty · referral</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>{step === 1 ? 'Скасувати' : 'Назад'}</button>
            {step < 3
              ? <button className="wfp-btn wfp-btn--primary" disabled={step === 1 && !reason.trim()} style={{ opacity: step === 1 && !reason.trim() ? 0.5 : 1 }} onClick={() => (step === 1 && !reason.trim() ? null : setStep(step + 1))}>Далі</button>
              : <button className="wfp-btn wfp-btn--primary wfp-confirm-cd" disabled={cd > 0} style={{ opacity: cd > 0 ? 0.6 : 1, background: 'var(--wf-destructive)', borderColor: 'var(--wf-destructive)', color: '#fff' }} onClick={cd > 0 ? undefined : onDone}>{cd > 0 ? `Підтвердити (${cd})` : 'Повернути кошти'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function R4Refund() {
  const [tab, setTab] = _rb('flow');
  const [modal, setModal] = _rb(false);
  const [done, setDone] = _rb(false);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Повернення коштів</h1><div className="wfp-ph-sub">// refund · credit-note · вплив на баланс і лояльність</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => setModal(true)}><Icon name="coins" size={14} />Ініціювати повернення</button></div>
      </div>

      <div className="r4-tabs">
        {[['flow', 'Flow + стани'], ['crn', 'Кредит-нота · CRN'], ['email', 'Email клієнту']].map(([id, l]) => (
          <div key={id} className="r4-tab" data-on={tab === id || undefined} onClick={() => setTab(id)}>{l}</div>
        ))}
      </div>

      {tab === 'flow' && (
        <React.Fragment>
          {done && (
            <div className="wfs-signed-banner" style={{ borderColor: 'color-mix(in oklab, var(--wf-destructive) 35%, var(--wf-border))', background: 'color-mix(in oklab, var(--wf-destructive) 8%, var(--wf-surface))' }}>
              <div className="wfs-signed-ic" style={{ background: 'var(--wf-destructive)' }}><Icon name="check" size={22} /></div>
              <div><div className="wfs-signed-t">Повернення проведено · $4 200</div><div className="wfs-signed-s">INV-2025-0414 → статус «refunded» · ledger-рядок kind=refund · клієнта повідомлено</div></div>
              <div className="wfs-signed-actions"><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setTab('crn')}><Icon name="file" size={12} />CRN</button></div>
            </div>
          )}
          <div className="r4-subhead"><span className="r4-subhead-t">оплати, доступні до повернення</span></div>
          <table className="wfp-table">
            <thead><tr><th>Рахунок</th><th>Замовлення</th><th>Клієнт</th><th>Дата</th><th className="wfp-num">Сплачено</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              <tr>
                <td className="wfp-mono"><span className="wfp-link" style={{ fontWeight: 500 }}>{RB_INV.num}</span></td>
                <td className="wfp-mono"><span className="wfp-link">{RB_INV.order}</span></td>
                <td>{RB_INV.client}</td>
                <td className="wfp-mono">{RB_INV.date}</td>
                <td className="wfp-num">${RB_INV.paid.toLocaleString('uk-UA')}</td>
                <td><span className={`wfp-badge wfp-badge--${done ? 'unpaid' : 'paid'}`}>{done ? 'refunded' : 'оплачено'}</span></td>
                <td><div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" disabled={done} onClick={() => setModal(true)}>{done ? 'повернуто' : 'Повернути'}</button></div></td>
              </tr>
            </tbody>
          </table>

          <div className="r4-subhead"><span className="r4-subhead-t">ledger · companies/брунки</span></div>
          <table className="wfp-table">
            <thead><tr><th>Дата</th><th>Тип</th><th>Опис</th><th className="wfp-num">Сума</th></tr></thead>
            <tbody>
              {done && <tr><td className="wfp-mono">01.06.2026</td><td><span className="wfp-badge wfp-badge--unpaid">refund</span></td><td>Повернення по {RB_INV.num} · clawback реферала</td><td className="wfp-num" style={{ color: 'var(--wf-destructive)' }}>−$4 200</td></tr>}
              <tr><td className="wfp-mono">14.05.2026</td><td><span className="wfp-badge wfp-badge--paid">payment</span></td><td>Оплата {RB_INV.num}</td><td className="wfp-num" style={{ color: 'var(--wf-success)' }}>+$4 200</td></tr>
            </tbody>
          </table>
        </React.Fragment>
      )}

      {tab === 'crn' && <div className="wfs-doc-pane"><R4CreditNoteDoc /></div>}
      {tab === 'email' && <R4RefundEmail />}

      {modal && <R4RefundModal onClose={() => setModal(false)} onDone={() => { setModal(false); setDone(true); setTab('flow'); }} />}
    </React.Fragment>
  );
}

// ── CRN · credit-note PDF (wfd- document language) ──
function R4CreditNoteDoc() {
  const inv = (window.WFP_DATA && window.WFP_DATA.invoice_full) || { from: { name: 'ФОП Васюленко І.С.' }, to: { name: 'ТОВ «Брунки»' } };
  return (
    <div className="wfd-page" style={{ position: 'relative' }}>
      <div className="wfd-stamp wfd-stamp--draft" style={{ right: 64, top: 96, color: '#B91C1C', borderColor: '#B91C1C' }}>CREDIT<br />NOTE<br />01.06.2026</div>
      <div className="wfd-page-head">
        <div className="wfd-brand"><div className="wfd-brand-mark wfd-brand-mark--ascii">{` /\\_/\\\n( o.o)\n > ^ <`}</div>
          <div className="wfd-brand-meta"><div className="wfd-brand-name">workflo<span className="wfd-dot">.</span>space</div><div className="wfd-brand-sub">ФОП Васюленко І.С. · Луцьк</div></div></div>
        <div className="wfd-doctype"><div className="wfd-doctype-l">Кредит-нота · Credit note</div><div className="wfd-doctype-n">CRN-2025-0007</div>
          <div className="wfd-doctype-d"><div className="wfd-doctype-d-row"><div className="wfd-doctype-d-k">дата</div><div className="wfd-doctype-d-v">01.06.2026</div></div><div className="wfd-doctype-d-row"><div className="wfd-doctype-d-k">до</div><div className="wfd-doctype-d-v">INV-2025-0414</div></div></div></div>
      </div>
      <div className="wfd-parties">
        <div className="wfd-party"><div className="wfd-party-l">// Виконавець</div><div className="wfd-party-name">{inv.from.name}</div><div className="wfd-party-row"><div className="wfd-party-k">ІПН</div><div className="wfd-party-v">3456789012</div></div></div>
        <div className="wfd-party"><div className="wfd-party-l">// Замовник</div><div className="wfd-party-name">{inv.to.name}</div><div className="wfd-party-row"><div className="wfd-party-k">підстава</div><div className="wfd-party-v">часткова відмова від скоупу</div></div></div>
      </div>
      <p className="wfd-p" style={{ marginTop: 8 }}>Цією кредит-нотою Виконавець зменшує суму до сплати / повертає кошти Замовнику за рахунком <strong>INV-2025-0414</strong> від 14.05.2026 на підставі домовленості сторін.</p>
      <table className="wfd-table">
        <thead><tr><th style={{ width: 32 }}>#</th><th>Опис</th><th className="wfd-num" style={{ width: 110 }}>Сума, $</th></tr></thead>
        <tbody>
          <tr><td className="wfd-row-n">01</td><td>Повернення за INV-2025-0414 (повне)</td><td className="wfd-num"><strong>−$4 200</strong></td></tr>
        </tbody>
      </table>
      <div className="wfd-totals"><div className="wfd-totals-box">
        <div className="wfd-totals-row wfd-totals-row--grand"><div className="wfd-totals-k">до повернення</div><div className="wfd-totals-v wfd-totals-v--accent" style={{ color: '#B91C1C' }}>−$4 200</div></div>
        <div className="wfd-totals-row"><div className="wfd-totals-k">метод</div><div className="wfd-totals-v">на картку •••• 4192</div></div>
      </div></div>
      <div className="wfd-foot"><span>workflo<span style={{ color: '#A3D90D' }}>.</span>space · CRN-2025-0007 · сторінка 1 з 1</span><span>згенеровано · workflo-app/v0.6.2</span></div>
    </div>
  );
}

// ── "refund issued" email ──
function R4RefundEmail() {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', border: '1px solid var(--wf-border)', borderRadius: 14, overflow: 'hidden', background: 'var(--wf-surface)' }}>
      <div style={{ background: 'var(--wf-fg)', color: 'var(--wf-bg)', padding: '20px 24px' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600 }}>workflo<span style={{ color: 'var(--wf-accent-bg)' }}>.</span>space</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, opacity: 0.7, marginTop: 4 }}>// повернення коштів · refund issued</div>
      </div>
      <div style={{ padding: '24px', fontSize: 14, lineHeight: 1.6, color: 'var(--wf-fg-secondary)' }}>
        <p style={{ marginBottom: 14 }}>Вітаємо, <strong style={{ color: 'var(--wf-fg)' }}>ТОВ «Брунки»</strong>!</p>
        <p style={{ marginBottom: 14 }}>Ми оформили повернення коштів за рахунком <strong style={{ color: 'var(--wf-fg)' }}>INV-2025-0414</strong>.</p>
        <div style={{ border: '1px solid var(--wf-border)', borderRadius: 10, padding: 16, margin: '0 0 16px', background: 'var(--wf-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span className="r4-note">сума</span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 18 }}>$4 200</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="r4-note">метод</span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>картка •••• 4192 · 1–3 дні</span></div>
        </div>
        <p style={{ marginBottom: 18 }}>Документ <strong style={{ color: 'var(--wf-fg)' }}>CRN-2025-0007</strong> (кредит-нота) додано до ваших документів.</p>
        <a className="wfp-btn wfp-btn--primary" style={{ textDecoration: 'none' }}><Icon name="download" size={14} />Переглянути кредит-ноту</a>
      </div>
    </div>
  );
}

Object.assign(window, { R4Refund, R4CreditNoteDoc, R4RefundEmail, R4RefundModal });
