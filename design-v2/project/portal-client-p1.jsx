// portal-client-p1.jsx — Portal П1 screens:
// PortalCompany (06-Б юр-онбординг + реквізити, клієнт заводить сам) ·
// PortalBillingProjects (05-ПРОЕКТИ розрізи + 05-А «Оплатити» + стани) ·
// PortalDocsHub (self-service генерація + підписані договори, 06-Б) ·
// PortalEstimate (кошторис із каталогу послуг, 02-Б).

const _pp = React.useState;

// ════════════════ Моя компанія / юр-онбординг (06-Б) ════════════════
function PortalCompany() {
  const REQUIRED = ['legalName', 'taxId', 'address', 'iban', 'docEmail', 'signer'];
  const LABELS = {
    legalName: 'Юридична назва', kind: 'Форма власності', taxId: 'ЄДРПОУ', vat: 'Платник ПДВ',
    address: 'Юридична адреса', bank: 'Банк', iban: 'IBAN', docEmail: 'Email для документів',
    signer: 'Підписант', signerRole: 'Посада підписанта',
  };
  const ORDER = ['legalName', 'kind', 'taxId', 'vat', 'address', 'bank', 'iban', 'docEmail', 'signer', 'signerRole'];
  const [created, setCreated] = _pp(true); // demo: company already created
  const [edit, setEdit] = _pp(false);
  // IBAN порожній — демо неповних реквізитів (гейт до документів).
  const [vals, setVals] = _pp({
    legalName: 'ТОВ «Бранкі Фуд»', kind: 'ТОВ', taxId: '41255890', vat: 'Ні',
    address: 'м. Київ, вул. Велика Васильківська 100, 03150',
    bank: 'АТ КБ «ПриватБанк»', iban: '', docEmail: 'finance@brunky.com',
    signer: 'Ткач Анна Петрівна', signerRole: 'Директор',
  });
  const u = (k, v) => setVals((s) => ({ ...s, [k]: v }));
  const missing = REQUIRED.filter((k) => !vals[k] || String(vals[k]).trim() === '').map((k) => LABELS[k]);
  const complete = missing.length === 0;

  if (!created) {
    return (
      <React.Fragment>
        <PageHeader title="Моя компанія" subtitle="// реквізити для документів і рахунків" />
        <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center', padding: 40, border: '1px dashed var(--wf-border)', borderRadius: 16 }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: 'var(--wf-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Icon name="building" size={26} color="var(--wf-fg-muted)" /></div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Створіть компанію</div>
          <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)', margin: '8px 0 20px', lineHeight: 1.6 }}>Щоб ми могли формувати договори, рахунки й акти — заповніть юридичні реквізити вашої компанії.</div>
          <button className="wfp-btn wfp-btn--primary" onClick={() => { setCreated(true); setEdit(true); }}><Icon name="plus" size={14} />Створити компанію</button>
        </div>
      </React.Fragment>
    );
  }
  return (
    <React.Fragment>
      <PageHeader title="Моя компанія" subtitle="// на ці реквізити агенція виставляє рахунки й формує документи">
        <button className="wfp-btn wfp-btn--primary" onClick={() => setEdit(!edit)}><Icon name={edit ? 'check' : 'edit'} size={14} />{edit ? 'Зберегти' : 'Редагувати'}</button>
      </PageHeader>

      {/* isComplete gate (06-Б) — гейт готовності до документів */}
      <div className={`wfl-gate${complete ? ' wfl-gate--ok' : ''}`} style={{ margin: '0 0 18px', maxWidth: 720 }}>
        <Icon name={complete ? 'check' : 'alert'} size={16} />
        <div style={{ flex: 1 }}>
          <div className="wfl-gate-t">{complete ? 'Реквізити готові' : 'Реквізити неповні'}</div>
          <div className="wfl-gate-s">{complete
            ? 'усі обовʼязкові поля заповнені — агенція може формувати договори, рахунки й акти'
            : `бракує: ${missing.join(' · ')} — документи не формуються, поки не заповните`}</div>
        </div>
        {!complete && !edit && <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => setEdit(true)}>Заповнити</button>}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <span className="wfg-pill2" data-tone={complete ? 'ok' : 'warn'}><span className="wfg-pill2-dot" />{complete ? 'готово до документів' : 'потрібно дозаповнити'}</span>
        <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />заповнив: клієнт</span>
      </div>

      <div className="wfl-panel" style={{ maxWidth: 720 }}>
        <div className="wfl-panel-h"><span>// юридичні реквізити</span></div>
        <div className="wfl-panel-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {ORDER.map((k) => {
            const req = REQUIRED.includes(k);
            const isMissing = req && (!vals[k] || String(vals[k]).trim() === '');
            return (
            <div key={k} className="wfp-field" style={k === 'address' ? { gridColumn: '1 / -1' } : undefined}>
              <label>{LABELS[k]}{isMissing && <span className="wfl-req"> · обовʼязкове</span>}</label>
              {edit
                ? <input value={vals[k]} placeholder={isMissing ? 'заповніть…' : ''} data-missing={isMissing || undefined} onChange={(e) => u(k, e.target.value)} />
                : <div style={{ fontSize: 13.5, padding: '2px 0', color: isMissing ? 'var(--wf-destructive)' : undefined }}>{vals[k] || '— не заповнено'}</div>}
            </div>
            );
          })}
          {edit && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 9, alignItems: 'center', padding: '11px 13px', borderRadius: 9, background: 'var(--wf-subtle)', fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
              <Icon name="shield" size={14} color="var(--wf-accent)" />Ці дані бачить ваша команда та агенція. Агенція може заповнити їх за вас, якщо попросите.
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}

// ════════════════ Білінг по проєктах + Оплатити (05-ПРОЕКТИ + 05-А) ════════════════
const PORTAL_INVOICES = [
  { num: 'INV-2025-0418', project: 'PRJ-118', date: '28.05.2026', due: '11.06.2026', amount: 3200, paid: 1400, cur: '$', status: 'overdue' },
  { num: 'INV-2025-0402', project: 'PRJ-121', date: '01.05.2026', due: '31.05.2026', amount: 1260, paid: 1260, cur: '€', status: 'paid' },
  { num: 'INV-2025-0388', project: 'PRJ-118', date: '01.05.2026', due: '15.05.2026', amount: 3200, paid: 3200, cur: '$', status: 'paid' },
];

// ════ Сервісні контракти / абонплати (05-ПРОЕКТИ) ════
// Лише обслуговування / погодинні абонплати: що входить + погоджена вартість.
// БЕЗ рахунків і оплат — фінанси живуть у «Рахунки й борг».
// 3 моделі: retainer (абонплата з годинами) · hourly (T&M без годин) · fixed (разовий)
const PORTAL_SERVICE_PROJECTS = [
  {
    id: 'p1', name: 'Підтримка та обслуговування платформи', code: 'PRJ-118',
    type: 'retainer', model: 'Абонплата', cur: '$', per: '/міс', amount: 3200, entity: 'ФОП Васюленко',
    started: '01.01.2025', renews: '01.07.2026', status: 'active', hoursIncluded: 40, hoursUsed: 27,
    desc: 'Щомісячна підтримка платформи з пулом годин на розробку та правки.',
    includes: [
      'Моніторинг 24/7 + реагування на інциденти',
      'До 40 год розробки / правок на місяць',
      'Оновлення залежностей і безпеки',
      'Щомісячний звіт + дзвінок',
      'SLA: відповідь до 4 год у робочі дні',
    ],
  },
  {
    id: 'p2', name: 'Інтеграція 1С ↔ Telegram (підтримка)', code: 'PRJ-121',
    type: 'hourly', model: 'Погодинно', cur: '€', per: '/год', amount: 45, entity: 'Workflo OÜ',
    started: '15.03.2026', renews: null, status: 'active', hoursIncluded: null, hoursUsed: 12,
    desc: 'Доопрацювання за запитом за фактично витрачені години (T&M). Без фіксованого мінімуму.',
    includes: [
      'Доопрацювання за запитом (T&M)',
      'Ставка €45/год, погодинна тарифікація',
      'Звіт по витрачених годинах раз на 2 тижні',
      'Без фіксованого місячного мінімуму',
    ],
  },
  {
    id: 'p3', name: 'Лендінг + інтеграція оплат', code: 'PRJ-130',
    type: 'fixed', model: 'Fixed-price', cur: '$', per: null, amount: 4200, entity: 'ФОП Васюленко',
    started: '20.05.2026', renews: null, status: 'active', hoursIncluded: null, hoursUsed: null,
    desc: 'Разовий проєкт із фіксованою вартістю за погодженим обсягом. Без пулу годин.',
    includes: [
      'Лендінг (5 секцій) + адаптив',
      'Інтеграція платіжного провайдера',
      'Базове SEO + аналітика',
      'Гарантія 30 днів після здачі',
    ],
  },
];
const PROJ_TYPE_META = {
  retainer: { tone: 'accent', hint: 'фікс/міс + пул годин' },
  hourly:   { tone: 'neutral', hint: 'оплата за фактом' },
  fixed:    { tone: 'muted', hint: 'разово за обсяг' },
};
function projPrice(p) {
  if (p.type === 'fixed') return { big: p.cur + p.amount.toLocaleString('en-US'), small: 'фікс. вартість' };
  if (p.type === 'hourly') return { big: p.cur + p.amount, small: 'за годину' };
  return { big: p.cur + p.amount.toLocaleString('en-US'), small: 'на місяць' };
}

function PortalServiceProjects() {
  const [open, setOpen] = _pp(null);
  const monthlyRetainer = PORTAL_SERVICE_PROJECTS.filter((p) => p.type === 'retainer').reduce((s, p) => s + p.amount, 0);
  return (
    <React.Fragment>
      <PageHeader title="Проєкти" subtitle="// сервісні контракти й проєкти · натисніть картку для деталей" />
      <StatsRow>
        <Stat k="активні проєкти" v={PORTAL_SERVICE_PROJECTS.length} sub="абонплата · погодинно · fixed" />
        <Stat k="місячна абонплата" v={`$${monthlyRetainer.toLocaleString('en-US')}`} sub="з пулом годин" kind="accent" />
        <Stat k="годин цього місяця" v="27 / 40" sub="PRJ-118 · лишилось 13" />
        <Stat k="наступне продовження" v="01.07" sub="PRJ-118 · абонплата" />
      </StatsRow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginTop: 8 }}>
        {PORTAL_SERVICE_PROJECTS.map((p) => {
          const meta = PROJ_TYPE_META[p.type];
          const pr = projPrice(p);
          const pct = p.hoursIncluded ? Math.round((p.hoursUsed / p.hoursIncluded) * 100) : null;
          return (
            <button key={p.id} className="wfsp-card" onClick={() => setOpen(p)}>
              <div className="wfsp-card-top">
                <span className="wfg-pill2" data-tone={meta.tone}><span className="wfg-pill2-dot" />{p.model}</span>
                <Icon name="chevron" size={13} color="var(--wf-fg-subtle)" />
              </div>
              <div className="wfsp-card-name">{p.name}</div>
              <div className="wf-mono wfsp-card-code">{p.code}</div>
              <div className="wfsp-card-price">
                <span className="wfsp-card-price-v">{pr.big}</span>
                <span className="wfsp-card-price-s">{pr.small}</span>
              </div>
              {pct != null ? (
                <div className="wfsp-card-foot">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 4 }}>
                    <span>години цього місяця</span><span className="wf-mono">{p.hoursUsed}/{p.hoursIncluded}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--wf-border)', overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: pct > 85 ? 'var(--wf-warning)' : 'var(--wf-accent)' }} />
                  </div>
                </div>
              ) : (
                <div className="wfsp-card-foot wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-subtle)' }}>{meta.hint}</div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--wf-fg-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon name="receipt" size={13} color="var(--wf-fg-subtle)" />
        Рахунки, борг та оплати — у розділі <button className="wfp-link" style={{ border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--wf-accent)', padding: 0 }} onClick={() => window.__portalNav && window.__portalNav('billing')}>«Рахунки й борг»</button>.
      </div>

      {open && <ProjectDetailModal p={open} onClose={() => setOpen(null)} />}
    </React.Fragment>
  );
}

function ProjectDetailModal({ p, onClose }) {
  const meta = PROJ_TYPE_META[p.type];
  const pr = projPrice(p);
  const pct = p.hoursIncluded ? Math.round((p.hoursUsed / p.hoursIncluded) * 100) : null;
  const KV = ({ k, v }) => (
    <div className="wfsp-kv"><span className="wfsp-kv-k">{k}</span><span className="wfsp-kv-v">{v}</span></div>
  );
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 560, margin: 0, maxHeight: '88vh', overflow: 'auto' }}>
        <div className="wfp-modal-h">
          <Icon name="kanban" size={18} color="var(--wf-accent)" />
          <div style={{ flex: 1 }}>
            <div className="wfp-modal-h-t">{p.name}</div>
            <div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>{p.code} · від {p.entity}</div>
          </div>
          <span className="wfp-modal-h-close" onClick={onClose} style={{ cursor: 'pointer' }}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span>
        </div>
        <div className="wfp-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="wfg-pill2" data-tone={meta.tone}><span className="wfg-pill2-dot" />{p.model}</span>
            <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активний</span>
          </div>

          <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>{p.desc}</div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '14px 0', borderTop: '1px solid var(--wf-border)', borderBottom: '1px solid var(--wf-border)' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 30, fontWeight: 700 }}>{pr.big}</span>
            <span style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>{pr.small}</span>
          </div>

          {pct != null && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--wf-fg-muted)', marginBottom: 6 }}>
                <span>години цього місяця</span><span className="wf-mono">{p.hoursUsed} / {p.hoursIncluded} год · лишилось {p.hoursIncluded - p.hoursUsed}</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--wf-border)', overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: pct > 85 ? 'var(--wf-warning)' : 'var(--wf-accent)' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
            <KV k="модель" v={p.model} />
            <KV k="юр-особа" v={p.entity} />
            <KV k="початок" v={p.started} />
            <KV k="продовження" v={p.renews || 'без строку'} />
            {p.type === 'retainer' && <KV k="пул годин" v={`${p.hoursIncluded} год / міс`} />}
            {p.type === 'hourly' && <KV k="ставка" v={`${p.cur}${p.amount}/год`} />}
            {p.type === 'fixed' && <KV k="тип" v="разовий проєкт" />}
          </div>

          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--wf-fg-muted)', marginBottom: 9 }}>що входить</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {p.includes.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.45 }}>
                  <Icon name="check" size={13} color="var(--wf-success)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{it}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// {p.code}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(p.type === 'retainer' || p.type === 'hourly') && <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Історія годин · демо', 'ok')}>Історія годин</button>}
            <button className="wfp-btn wfp-btn--primary" onClick={() => { onClose(); window.__portalNav && window.__portalNav('billing'); }}><Icon name="receipt" size={13} />Рахунки по проєкту</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortalBillingProjects() {
  const [pay, setPay] = _pp(null);
  return (
    <React.Fragment>
      <PageHeader title="Рахунки й борг" subtitle="// рахунки, борг та оплати · різні валюти й моделі" />
      <StatsRow>
        <Stat k="до оплати" v="$1 800" sub="1 рахунок прострочено" kind="warn" />
        <Stat k="сплачено за весь час" v="$22 380" sub="12 рахунків" />
        <Stat k="активні проєкти" v="2" sub="$ та €" />
        <Stat k="бонусний баланс" v="$340" sub="loyalty + referral" kind="accent" />
      </StatsRow>

      <table className="wfp-table">
        <thead><tr><th>№</th><th>Проєкт</th><th>Дата</th><th>Строк</th><th>Статус</th><th className="wfp-num">Сума</th><th></th></tr></thead>
        <tbody>
          {PORTAL_INVOICES.map((iv) => (
            <tr key={iv.num}>
              <td className="wfp-mono"><span className="wfp-link">{iv.num}</span></td>
              <td className="wfp-mono">{iv.project}</td>
              <td className="wfp-mono">{iv.date}</td>
              <td className="wfp-mono" style={{ color: iv.status === 'overdue' ? 'var(--wf-destructive)' : 'var(--wf-fg-muted)' }}>{iv.due}</td>
              <td>{iv.status === 'paid' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />оплачено</span> : <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />не оплачено</span>}</td>
              <td className="wfp-num">{iv.cur}{iv.amount.toLocaleString('en-US')}{iv.paid > 0 && iv.paid < iv.amount && <div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>сплачено {iv.cur}{iv.paid.toLocaleString('en-US')}</div>}</td>
              <td style={{ textAlign: 'right' }}>
                {iv.status === 'paid'
                  ? <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('PDF · демо', 'ok')}><Icon name="download" size={12} />PDF</button>
                  : <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => setPay({ num: iv.num, amount: iv.amount - iv.paid, cur: iv.cur })}><Icon name="lock" size={12} />Оплатити</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pay && <PortalPayModal inv={pay} onClose={() => setPay(null)} />}
    </React.Fragment>
  );
}

function PortalPayModal({ inv, onClose }) {
  const [status, setStatus] = _pp('choose');
  const [method, setMethod] = _pp('card');
  const pay = () => { setStatus('processing'); setTimeout(() => setStatus('paid'), 1600); };
  const amt = inv.cur + inv.amount.toLocaleString('en-US');
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 440, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="lock" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Оплата {inv.num}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div style={{ textAlign: 'center', marginBottom: 16 }}><div style={{ fontSize: 32, fontWeight: 700 }}>{amt}</div><div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>до сплати</div></div>
          {status === 'paid' ? (
            <div style={{ textAlign: 'center', padding: '14px 0' }}>
              <Icon name="check" size={34} color="var(--wf-success)" />
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>Оплачено</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-subtle)', marginTop: 8, lineHeight: 1.6 }}>→ webhook: payment.succeeded<br />→ рахунок позначено оплаченим<br />→ акт згенеровано автоматично</div>
            </div>
          ) : (
            <React.Fragment>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['card', 'Картка · Visa / Mastercard'], ['bank', 'Банківський переказ'], ['crypto', 'USDT · TRC20']].map(([id, l]) => (
                  <div key={id} className="wfpi-method" data-on={method === id || undefined} onClick={() => setMethod(id)}><Icon name={id === 'bank' ? 'building' : id === 'crypto' ? 'coins' : 'receipt'} size={15} color="var(--wf-fg-muted)" />{l}</div>
                ))}
              </div>
              <button className="wfpi-paybtn" style={{ marginTop: 14 }} onClick={pay} disabled={status === 'processing'}>{status === 'processing' ? <React.Fragment><span className="wfpi-spin" />Обробка…</React.Fragment> : <React.Fragment><Icon name="lock" size={15} />Оплатити {amt}</React.Fragment>}</button>
              <div style={{ fontSize: 11, color: 'var(--wf-fg-subtle)', textAlign: 'center', marginTop: 8 }}>// провайдер ще не підключено · стани лінка + webhook (05-А)</div>
            </React.Fragment>
          )}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 05-А</span><button className="wfp-btn wfp-btn--primary" onClick={onClose}>{status === 'paid' ? 'Готово' : 'Закрити'}</button></div>
      </div>
    </div>
  );
}

// ════════════════ Документи self-service (06-Б) ════════════════
const PORTAL_CONTRACTS = [
  { name: 'Договір №118/2025', kind: 'Договір', date: '14.04.2025', status: 'signed' },
  { name: 'NDA — угода про конфіденційність', kind: 'NDA', date: '20.04.2025', status: 'signed' },
  { name: 'Додаткова угода №1', kind: 'Угода', date: '02.06.2026', status: 'awaiting' },
];
// Фактичні документи згруповані по замовленнях (дублює таб «Документи» всередині замовлення)
const PORTAL_ORDER_DOCS = [
  { order: 'ORD-2412', title: 'Інтеграція 1С ↔ Telegram-бот', state: 'в роботі', tone: 'warn', docs: [
    { kind: 'Специфікація', num: 'SPC-2025-0418', date: '01.06.2026', status: 'signed' },
    { kind: 'Рахунок', num: 'INV-2025-0418', date: '04.07.2026', status: 'overdue', amount: '$4 200' },
    { kind: 'Акт', num: 'ACT-2025-0418', date: '04.07.2026', status: 'awaiting' },
  ] },
  { order: 'ORD-2390', title: 'Звіт по SLA · квітень', state: 'завершено', tone: 'ok', docs: [
    { kind: 'Специфікація', num: 'SPC-2025-0390', date: '02.05.2026', status: 'signed' },
    { kind: 'Рахунок', num: 'INV-2025-0390', date: '10.05.2026', status: 'paid', amount: '$1 200' },
    { kind: 'Акт', num: 'ACT-2025-0390', date: '12.05.2026', status: 'signed' },
  ] },
];
function PortalDocsHub() {
  const [gen, setGen] = _pp(false);
  const [view, setView] = _pp('orders');
  const DocActions = ({ d }) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {d.status === 'signed' && <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />підписано</span>}
      {d.status === 'paid' && <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />оплачено</span>}
      {d.status === 'overdue' && <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />до оплати</span>}
      {d.status === 'awaiting' && <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />на підпис</span>}
      <button className="wfp-iconbtn" title="Переглянути" onClick={() => window.wfToast && window.wfToast((d.kind || d.name) + ' · перегляд (демо)', 'ok')}><Icon name="eye" size={14} /></button>
      <button className="wfp-iconbtn" title="Завантажити" onClick={() => window.wfToast && window.wfToast('PDF · демо', 'ok')}><Icon name="download" size={14} /></button>
    </div>
  );
  const Row = ({ d }) => (
    <div className="wfc-doc-row">
      <span className="wfc-doc-ico"><Icon name={d.kind === 'Рахунок' ? 'receipt' : d.kind === 'Акт' ? 'check' : d.kind === 'NDA' ? 'shield' : 'file'} size={16} /></span>
      <div><div className="wfc-doc-name">{d.name}</div><div className="wfc-doc-meta">{d.kind} · {d.date}</div></div>
      <span />
      <DocActions d={d} />
    </div>
  );
  return (
    <React.Fragment>
      <PageHeader title="Документи" subtitle="// всі документи, що надсилаються клієнту — в одному місці">
        <button className="wfp-btn wfp-btn--primary" onClick={() => setGen(true)}><Icon name="plus" size={14} />Сформувати документ</button>
      </PageHeader>

      <div className="wff-seg" style={{ marginBottom: 20 }}>
        <button className="wff-seg-opt" data-on={view === 'orders' || undefined} onClick={() => setView('orders')}>По замовленнях</button>
        <button className="wff-seg-opt" data-on={view === 'contracts' || undefined} onClick={() => setView('contracts')}>Договори</button>
      </div>

      {view === 'contracts' && (
        <React.Fragment>
          <div className="wfc-sec-h"><span className="wfc-sec-h-t" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="file" size={15} color="var(--wf-fg-muted)" />Договори та угоди</span><span className="wfc-sec-h-s">// рамкові · діють на всі замовлення</span></div>
          {PORTAL_CONTRACTS.map((d, i) => <Row key={i} d={d} />)}
        </React.Fragment>
      )}

      {view === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {PORTAL_ORDER_DOCS.map((o) => (
            <div key={o.order} className="wfl-panel">
              <div className="wfl-panel-b" style={{ gap: 4, padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--wf-border)' }}>
                  <Icon name="kanban" size={15} color="var(--wf-fg-muted)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{o.title}</div>
                    <div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>{o.order}</div>
                  </div>
                  <span className="wfg-pill2" data-tone={o.tone}><span className="wfg-pill2-dot" />{o.state}</span>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.__portalNav && window.__portalNav('orders')}>Відкрити замовлення <Icon name="chevron" size={11} /></button>
                </div>
                {o.docs.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < o.docs.length - 1 ? '1px solid var(--wf-border)' : 'none' }}>
                    <span className="wfc-doc-ico"><Icon name={d.kind === 'Рахунок' ? 'receipt' : d.kind === 'Акт' ? 'check' : 'file'} size={15} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>{d.kind}<span className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-accent)', fontWeight: 400 }}>{d.num}</span>{d.amount && <span className="wf-mono" style={{ fontSize: 11.5, fontWeight: 600 }}>{d.amount}</span>}</div>
                      <div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{d.date}</div>
                    </div>
                    {d.status === 'overdue' && <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.__portalNav && window.__portalNav('billing')}><Icon name="lock" size={11} />Оплатити</button>}
                    {d.status === 'awaiting' && <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfConfirm && window.wfConfirm({ title: 'Підписати ' + d.num + '?', message: 'Підписанням ви підтверджуєте прийом робіт.', confirmLabel: 'Підписати', successToast: 'Акт підписано' })}><Icon name="check" size={11} />Підписати</button>}
                    <DocActions d={d} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {gen && <SelfServiceModal onClose={() => setGen(false)} />}
    </React.Fragment>
  );
}
function SelfServiceModal({ onClose }) {
  const [type, setType] = _pp('recon');
  const [phase, setPhase] = _pp('idle'); // idle | generating | done
  const TYPES = [['recon', 'Акт звірки', 'За обраний період звіримо взаєморозрахунки'], ['statement', 'Виписка по балансу', 'Усі нарахування та оплати'], ['invoice_copy', 'Копія рахунку', 'Дублікат раніше виставленого рахунку']];
  const gen = () => { setPhase('generating'); setTimeout(() => setPhase('done'), 1400); };
  const done = phase === 'done';
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 480, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="file" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Сформувати документ</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          {phase === 'generating' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
              <span className="wfpi-spin" style={{ width: 26, height: 26, borderWidth: 3 }} />
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--wf-fg-secondary)' }}>формуємо PDF…</div>
            </div>
          ) : !done ? (
            <React.Fragment>
              <div className="wfc-opts">
                {TYPES.map(([id, t, d]) => (
                  <div key={id} className="wfc-opt" data-on={type === id || undefined} onClick={() => setType(id)}>
                    <span className="wfc-opt-radio" /><div style={{ flex: 1 }}><div className="wfc-opt-t">{t}</div><div className="wfc-opt-d">{d}</div></div>
                  </div>
                ))}
              </div>
              {type === 'recon' && <div className="wfc-grid2" style={{ marginTop: 14 }}><div className="wfp-field"><label>З</label><input defaultValue="01.04.2026" /></div><div className="wfp-field"><label>По</label><input defaultValue="30.06.2026" /></div></div>}
            </React.Fragment>
          ) : <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)' }}>✓ документ сформовано · надіслано на finance@brunky.com</div>}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 06-Б self-service</span><div style={{ display: 'flex', gap: 8 }}>{!done ? <React.Fragment><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={gen} disabled={phase === 'generating'}><Icon name="check" size={14} />Сформувати</button></React.Fragment> : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}</div></div>
      </div>
    </div>
  );
}

// ════════════════ Кошторис із каталогу послуг (02-Б) ════════════════
const ESTIMATE = [
  { cat: 'Discovery', name: 'Аналіз вимог · архітектурна нотатка', qty: 1, unit: 'роб.', price: 420 },
  { cat: 'Розробка', name: 'Telegram-бот для водіїв (54 flow + admin)', qty: 1, unit: 'роб.', price: 1680 },
  { cat: 'Інтеграція', name: '1С 8.3 ↔ middleware (REST → queue)', qty: 1, unit: 'роб.', price: 1260 },
  { cat: 'AI', name: 'AI-валідація накладних · vision', qty: 1, unit: 'роб.', price: 540 },
  { cat: 'QA', name: 'Тестування, документація, передача', qty: 1, unit: 'роб.', price: 300 },
];
function PortalEstimate() {
  const [state, setState] = _pp('pending'); // pending | approved | rejected
  const [model, setModel] = _pp('fixed'); // fixed | hourly
  const total = ESTIMATE.reduce((a, e) => a + e.qty * e.price, 0);
  const RATE = 45, hoursLow = 78, hoursHigh = 104;
  const estLow = hoursLow * RATE, estHigh = hoursHigh * RATE;
  return (
    <React.Fragment>
      <PageHeader title="Кошторис" subtitle={`// ORD-2412 · Інтеграція 1С ↔ Telegram-бот · ${model === 'fixed' ? 'fixed price' : 'hourly · оцінка діапазоном'}`}>
        <div className="wff-seg" style={{ marginRight: 4 }}>
          <button className="wff-seg-opt" data-on={model === 'fixed' || undefined} onClick={() => { setModel('fixed'); setState('pending'); }}>fixed</button>
          <button className="wff-seg-opt" data-on={model === 'hourly' || undefined} onClick={() => { setModel('hourly'); setState('pending'); }}>hourly</button>
        </div>
        {state === 'pending' && <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />чекає погодження</span>}
        {state === 'approved' && <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />погоджено</span>}
        {state === 'rejected' && <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />відхилено</span>}
      </PageHeader>

      <div style={{ maxWidth: 760 }}>
        <table className="wfp-table">
          <thead><tr><th>Категорія</th><th>Позиція</th><th className="wfp-num">К-сть</th><th>Од.</th><th className="wfp-num">Ціна</th><th className="wfp-num">Сума</th></tr></thead>
          <tbody>
            {ESTIMATE.map((e, i) => (
              <tr key={i}>
                <td><span className="wfl-card-chip">{e.cat}</span></td>
                <td>{e.name}</td>
                <td className="wfp-num">{e.qty}</td>
                <td>{e.unit}</td>
                <td className="wfp-num">${e.price.toLocaleString('en-US')}</td>
                <td className="wfp-num" style={{ fontWeight: 600 }}>${(e.qty * e.price).toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <div style={{ width: 280, border: '1px solid var(--wf-border)', borderRadius: 10, padding: '14px 16px', background: 'var(--wf-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--wf-fg-muted)' }}><span>позицій</span><span>{ESTIMATE.length}</span></div>
            {model === 'hourly' && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--wf-fg-muted)', marginTop: 6 }}><span>оцінка годин</span><span>{hoursLow}–{hoursHigh} × ${RATE}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, paddingTop: 10, borderTop: '1.5px solid var(--wf-fg)' }}><span style={{ fontWeight: 600 }}>{model === 'fixed' ? 'до сплати' : 'орієнтовно'}</span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: model === 'fixed' ? 20 : 15, fontWeight: 700 }}>{model === 'fixed' ? `$${total.toLocaleString('en-US')}` : `$${estLow.toLocaleString('en-US')}–${estHigh.toLocaleString('en-US')}`}</span></div>
            {model === 'hourly' && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-subtle)', marginTop: 6 }}>// фінальна сума — за фактом годин</div>}
          </div>
        </div>

        {state === 'pending' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 18, padding: '14px 16px', border: '1px solid var(--wf-accent)', borderRadius: 12, background: 'var(--wf-accent-soft)', alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--wf-fg-secondary)' }}>{model === 'fixed' ? 'Погодьте кошторис, щоб ми почали роботу. Сума фіксована.' : `Це погодинна оцінка діапазоном (${hoursLow}–${hoursHigh} год). Погодження = згода на ставку $${RATE}/год; фінальна сума — за фактом.`}</div>
            <button className="wfp-btn" onClick={() => setState('rejected')}>Відхилити з коментарем</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => setState('approved')}><Icon name="check" size={14} />{model === 'fixed' ? 'Погодити' : 'Погодити ставку'}</button>
          </div>
        )}
        {state === 'approved' && <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 12, background: 'color-mix(in oklab, var(--wf-success) 10%, transparent)', fontSize: 13, color: 'var(--wf-fg-secondary)', display: 'flex', alignItems: 'center', gap: 9 }}><Icon name="check" size={16} color="var(--wf-success)" />Кошторис погоджено — створено рахунок на основі позицій. Роботи розпочато.</div>}
        {state === 'rejected' && <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 12, background: 'var(--wf-subtle)', fontSize: 13, color: 'var(--wf-fg-secondary)' }}>Кошторис відхилено — менеджер звʼяжеться з вами для уточнення.</div>}
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { PortalCompany, PortalServiceProjects, PortalBillingProjects, PortalPayModal, PortalDocsHub, PortalEstimate });
