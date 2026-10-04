// workspace-clients.jsx — G22 · Client Management (module 28)
// /clients list · /clients/:id 6-tab card · admin reset-password (2 modes) · deactivate + GDPR.

const _c = React.useState;

const TIERS = {
  partner: { label: 'partner', tone: 'accent' },
  pro:     { label: 'pro',     tone: 'ok' },
  base:    { label: 'base',    tone: 'muted' },
};

const CLIENTS = [
  { id: 'brunky',    name: 'Brunky',      tier: 'partner', ltv: 28400, orders: 8, status: 'active', last: '2 год тому',  lastDays: 0, industry: 'Food delivery', email: 'anna@brunky.com',   members: 3, debt: 0,    src: 'referral', conv: '12.04.2025' },
  { id: 'eduforge',  name: 'EduForge',    tier: 'pro',     ltv: 19200, orders: 6, status: 'active', last: 'вчора',       lastDays: 1, industry: 'EdTech',        email: 'm.kovach@eduforge.io', members: 5, debt: 1800, src: 'whatsapp', conv: '03.05.2025' },
  { id: 'tably',     name: 'Tably',       tier: 'pro',     ltv: 16800, orders: 5, status: 'active', last: '3 дні тому',  lastDays: 3, industry: 'SaaS',          email: 'sofia@tably.app',   members: 2, debt: 2200, src: 'form',     conv: '21.05.2025' },
  { id: 'nordstream',name: 'NordStream',  tier: 'base',    ltv: 8800,  orders: 2, status: 'active', last: 'тиждень',     lastDays: 9, industry: 'Logistics',     email: 'ihor@nordstream.io', members: 1, debt: 880,  src: 'referral', conv: '18.05.2025' },
  { id: 'floreal',   name: 'Florèal',     tier: 'base',    ltv: 4200,  orders: 1, status: 'active', last: '5 днів тому', lastDays: 5, industry: 'Retail',        email: 'k@floreal.kyiv',    members: 1, debt: 0,    src: 'tiktok',   conv: '28.05.2025' },
  { id: 'quickship', name: 'QuickShip',   tier: 'base',    ltv: 1800,  orders: 1, status: 'deactivated', last: '3 тижні', lastDays: 21, industry: 'Logistics',    email: 'pavlo@quickship.ua', members: 0, debt: 0,    src: 'email',    conv: '02.04.2025' },
];

// risk flags (28-Г) — computed from debt / staleness / engagement
function clientRisks(c) {
  const r = [];
  if (c.status !== 'deactivated') {
    if (c.debt >= 2000) r.push({ id: 'debt', tone: 'bad', label: 'борг ' + m(c.debt), hint: 'прострочений платіж' });
    else if (c.debt > 0) r.push({ id: 'debt', tone: 'warn', label: 'борг ' + m(c.debt), hint: 'неоплачений рахунок' });
    if (c.lastDays >= 7) r.push({ id: 'stale', tone: 'warn', label: 'тиша ' + c.lastDays + 'д', hint: 'давно не було контакту' });
    if (c.orders <= 1 && c.tier === 'base') r.push({ id: 'churn', tone: 'muted', label: 'ризик відтоку', hint: 'низька активність' });
  }
  return r;
}

const m = (n) => '$' + n.toLocaleString('uk-UA');

// ── C1 · /clients list ──────────────────────────────────────────────
function ClientsList({ onOpen }) {
  const [q, setQ] = _c('');
  const [filter, setFilter] = _c('all');
  let rows = CLIENTS.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  if (filter === 'active') rows = rows.filter((c) => c.status === 'active');
  if (filter === 'debt') rows = rows.filter((c) => c.debt > 0);
  if (filter === 'attention') rows = rows.filter((c) => clientRisks(c).length > 0);
  if (filter === 'deactivated') rows = rows.filter((c) => c.status === 'deactivated');
  const totalLtv = CLIENTS.reduce((s, c) => s + c.ltv, 0);
  const attention = CLIENTS.filter((c) => clientRisks(c).length > 0);

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Клієнти</h1>
          <div className="wfp-ph-sub">// {CLIENTS.filter((c) => c.status === 'active').length} активних · LTV разом {m(totalLtv)}</div>
        </div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary"><Icon name="plus" size={14} />Клієнт</button></div>
      </div>

      {/* attention dashboard (28-Г) */}
      {attention.length > 0 && (
        <div className="wfc-attention">
          <div className="wfc-attention-h">
            <span className="wfc-attention-t"><Icon name="alert" size={15} color="var(--wf-warning)" />Потребують уваги</span>
            <span className="wfc-attention-cnt">{attention.length} клієнтів</span>
          </div>
          <div className="wfc-attention-grid">
            {attention.map((c) => {
              const risks = clientRisks(c);
              const worst = risks.some((r) => r.tone === 'bad') ? 'bad' : 'warn';
              return (
                <div key={c.id} className="wfc-attention-card" data-tone={worst} onClick={() => onOpen(c.id)}>
                  <div className="wfc-attention-card-h"><span className="wfc-attention-name">{c.name}</span><Icon name="chevron" size={12} color="var(--wf-fg-muted)" /></div>
                  <div className="wfc-attention-risks">
                    {risks.map((r) => <span key={r.id} className="wfc-risk" data-tone={r.tone} title={r.hint}>{r.label}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="wfp-filters">
        <div className="wfp-search">
          <Icon name="search" size={14} color="var(--wf-fg-muted)" />
          <input placeholder="Шукати клієнта…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="wfp-pill" data-on={filter === 'all' || undefined} onClick={() => setFilter('all')}>усі</button>
        <button className="wfp-pill" data-on={filter === 'attention' || undefined} onClick={() => setFilter('attention')}>⚠ потребують уваги · {attention.length}</button>
        <button className="wfp-pill" data-on={filter === 'active' || undefined} onClick={() => setFilter('active')}>активні</button>
        <button className="wfp-pill" data-on={filter === 'debt' || undefined} onClick={() => setFilter('debt')}>з боргом</button>
        <button className="wfp-pill" data-on={filter === 'deactivated' || undefined} onClick={() => setFilter('deactivated')}>деактивовані</button>
      </div>

      <table className="wfp-table">
        <thead><tr><th>Клієнт</th><th>Тір</th><th className="wfp-num">LTV</th><th className="wfp-num">Замовлень</th><th className="wfp-num">Борг</th><th>Статус</th><th>Останній контакт</th><th></th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} style={c.status === 'deactivated' ? { opacity: 0.5 } : undefined}>
              <td>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <WfSource id={c.src} size="sm" />
                  <span><span className="wfp-link" style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => onOpen(c.id)}>{c.name}</span>
                  <div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>{c.industry}</div></span>
                  {clientRisks(c).slice(0, 2).map((r) => <span key={r.id} className="wfc-risk" data-tone={r.tone} title={r.hint} style={{ marginLeft: 4 }}>{r.label}</span>)}
                </span>
              </td>
              <td><span className="wfg-pill2" data-tone={TIERS[c.tier].tone}><span className="wfg-pill2-dot" />{TIERS[c.tier].label}</span></td>
              <td className="wfp-num" style={{ fontWeight: 600 }}>{m(c.ltv)}</td>
              <td className="wfp-num">{c.orders}</td>
              <td className="wfp-num" style={{ color: c.debt > 0 ? 'var(--wf-warning)' : 'var(--wf-fg-subtle)' }}>{c.debt > 0 ? m(c.debt) : '—'}</td>
              <td>{c.status === 'active' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активний</span> : <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />деактивовано</span>}</td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{c.last}</td>
              <td style={{ textAlign: 'right' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => onOpen(c.id)}>Профіль →</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ── C2 · /clients/:id ───────────────────────────────────────────────
const CLIENT_TABS = [
  { id: 'info',    label: 'Інфо' },
  { id: 'team',    label: 'Команда' },
  { id: 'orders',  label: 'Замовлення' },
  { id: 'billing', label: 'Білінг' },
  { id: 'creds',   label: 'Credentials' },
  { id: 'source',  label: 'Джерело' },
];
const CLIENT_TEAM = [
  { name: 'Анна Ткач',     email: 'anna@brunky.com',    role: 'owner',  last: 'сьогодні 09:12' },
  { name: 'Сергій Лозовий', email: 'sergiy@brunky.com',  role: 'member', last: 'вчора 18:40' },
  { name: 'Ірина Гай',     email: 'iryna@brunky.com',   role: 'member', last: '4 дні тому' },
];

function ClientCard({ clientId, onBack }) {
  const cl = CLIENTS.find((c) => c.id === clientId) || CLIENTS[0];
  const [tab, setTab] = _c('info');
  const [reset, setReset] = _c(null);
  const [deact, setDeact] = _c(false);
  const [status, setStatus] = _c(cl.status);

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />клієнти</button>
          <h1 className="wfp-ph-h1" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            {cl.name}
            <span className="wfg-pill2" data-tone={TIERS[cl.tier].tone}><span className="wfg-pill2-dot" />{TIERS[cl.tier].label}</span>
            {status === 'deactivated' && <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />деактивовано</span>}
          </h1>
          <div className="wfp-ph-sub">// {cl.industry} · {cl.orders} замовлень · LTV {m(cl.ltv)} · клієнт з {cl.conv}</div>
        </div>
        <div className="wfp-ph-r">
          <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Редагувати · демо', 'ok')}><Icon name="edit" size={14} />Редагувати</button>
          {status === 'active'
            ? <button className="wfp-btn" style={{ color: 'var(--wf-destructive)' }} onClick={() => setDeact(true)}>Деактивувати</button>
            : <button className="wfp-btn wfp-btn--primary" onClick={() => setStatus('active')}>Активувати</button>}
        </div>
      </div>

      <div className="wfg-tabs">
        {CLIENT_TABS.map((t) => <div key={t.id} className="wfg-tab" data-on={tab === t.id || undefined} onClick={() => setTab(t.id)}>{t.label}{t.id === 'team' && <span className="wfg-tab-badge">{cl.members}</span>}</div>)}
      </div>

      {tab === 'info' && <ClientInfo cl={cl} />}
      {tab === 'team' && <ClientTeam onReset={(member) => setReset(member)} />}
      {tab === 'orders' && <ClientOrders cl={cl} />}
      {tab === 'billing' && <ClientBilling cl={cl} />}
      {tab === 'creds' && <ClientCreds />}
      {tab === 'source' && <ClientSource cl={cl} />}

      {reset && <ResetPasswordModal member={reset} onClose={() => setReset(null)} />}
      {deact && <DeactivateModal cl={cl} onClose={() => setDeact(false)} onConfirm={() => { setStatus('deactivated'); setDeact(false); }} />}
    </React.Fragment>
  );
}

function ClientInfo({ cl }) {
  return (
    <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
      <div className="wfl-panel">
        <div className="wfl-panel-h">// реквізити (редаговані)</div>
        <div className="wfl-panel-b" style={{ gap: 16 }}>
          <div className="wfp-field"><label>Назва</label><input defaultValue={cl.name} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="wfp-field"><label>Валюта</label><select className="wfl-select"><option>USD</option><option>UAH</option><option>EUR</option></select></div>
            <div className="wfp-field"><label>Мова</label><select className="wfl-select"><option>Українська</option><option>English</option></select></div>
          </div>
          <div className="wfp-field"><label>Tier override</label><select className="wfl-select"><option>авто ({TIERS[cl.tier].label})</option><option>partner</option><option>pro</option><option>base</option></select></div>
          <div className="wfp-field"><label>Нотатки</label><textarea className="wfl-select" style={{ height: 76, padding: '8px 10px', resize: 'vertical' }} defaultValue="VIP — швидко реагувати. Платять вчасно, люблять детальні специфікації." /></div>
          <button className="wfp-btn wfp-btn--primary" style={{ alignSelf: 'flex-start' }} onClick={() => window.wfToast && window.wfToast('Зберегти зміни · демо', 'ok')}><Icon name="check" size={14} />Зберегти зміни</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="wfp-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="wfp-stat"><div className="wfp-stat-k">LTV</div><div className="wfp-stat-v">{m(cl.ltv)}</div></div>
          <div className="wfp-stat"><div className="wfp-stat-k">замовлень</div><div className="wfp-stat-v">{cl.orders}</div></div>
          <div className="wfp-stat"><div className="wfp-stat-k">борг</div><div className={`wfp-stat-v${cl.debt > 0 ? ' wfp-stat-v--warn' : ''}`}>{cl.debt > 0 ? m(cl.debt) : '$0'}</div></div>
          <div className="wfp-stat"><div className="wfp-stat-k">учасників</div><div className="wfp-stat-v">{cl.members}</div></div>
        </div>
      </div>
    </div>
  );
}

function ClientTeam({ onReset }) {
  return (
    <React.Fragment>
      <div className="wfp-card-h" style={{ marginBottom: 14 }}>
        <div className="wfp-card-h-t">Команда клієнта</div>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Запросити · демо', 'ok')}><Icon name="plus" size={13} />Запросити</button>
      </div>
      <table className="wfp-table">
        <thead><tr><th>Учасник</th><th>Email</th><th>Роль</th><th>Останній вхід</th><th></th></tr></thead>
        <tbody>
          {CLIENT_TEAM.map((u) => (
            <tr key={u.email}>
              <td style={{ fontWeight: 500 }}>{u.name}</td>
              <td className="wfp-mono">{u.email}</td>
              <td><span className="wfg-pill2" data-tone={u.role === 'owner' ? 'accent' : 'muted'}><span className="wfg-pill2-dot" />{u.role}</span></td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{u.last}</td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => onReset(u)}><Icon name="key" size={12} />Скинути пароль</button>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Роль</button>
                  {u.role !== 'owner' && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ color: 'var(--wf-destructive)' }}>Зняти</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

function ClientOrders({ cl }) {
  const orders = [
    { num: 'ORD-2412', title: 'Інтеграція 1С ↔ Telegram-бот', status: 'in_progress', total: 4200, paid: 0 },
    { num: 'ORD-2388', title: 'API синхронізації складу', status: 'done', total: 6800, paid: 6800 },
    { num: 'ORD-2350', title: 'Лендинг + CMS', status: 'done', total: 3400, paid: 3400 },
  ];
  return (
    <table className="wfp-table">
      <thead><tr><th>№</th><th>Назва</th><th>Статус</th><th className="wfp-num">Сума</th><th className="wfp-num">Оплачено</th></tr></thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.num}>
            <td className="wfp-mono"><span className="wfp-link">{o.num}</span></td>
            <td>{o.title}</td>
            <td>{o.status === 'done' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />завершено</span> : <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />в роботі</span>}</td>
            <td className="wfp-num">{m(o.total)}</td>
            <td className="wfp-num" style={{ color: o.paid === o.total ? 'var(--wf-success)' : 'var(--wf-fg-muted)' }}>{m(o.paid)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ClientBilling({ cl }) {
  return (
    <React.Fragment>
      <div className="wfp-stats" style={{ marginBottom: 18 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">сплачено разом</div><div className="wfp-stat-v wfp-stat-v--accent">{m(cl.ltv)}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">поточний борг</div><div className={`wfp-stat-v${cl.debt > 0 ? ' wfp-stat-v--warn' : ''}`}>{cl.debt > 0 ? m(cl.debt) : '$0'}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">рахунків</div><div className="wfp-stat-v">14</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">avg оплата</div><div className="wfp-stat-v">6 дн</div></div>
      </div>
      <table className="wfp-table">
        <thead><tr><th>Рахунок</th><th>Дата</th><th className="wfp-num">Сума</th><th>Статус</th></tr></thead>
        <tbody>
          <tr><td className="wfp-mono"><span className="wfp-link">INV-2025-0418</span></td><td className="wfp-mono">28.05.2025</td><td className="wfp-num">{m(4200)}</td><td><span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />очікує</span></td></tr>
          <tr><td className="wfp-mono"><span className="wfp-link">INV-2025-0388</span></td><td className="wfp-mono">12.05.2025</td><td className="wfp-num">{m(6800)}</td><td><span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />сплачено</span></td></tr>
        </tbody>
      </table>
    </React.Fragment>
  );
}

function ClientCreds() {
  const creds = [
    { name: '1С сервер · RDP', login: 'wf_integrator', kind: 'rdp' },
    { name: 'Хостинг cPanel', login: 'brunky_admin', kind: 'web' },
    { name: 'Telegram Bot API', login: '@brunky_bot', kind: 'api' },
  ];
  return (
    <React.Fragment>
      <div className="wfp-card-h" style={{ marginBottom: 14 }}><div className="wfp-card-h-t">Сейф доступів</div><div className="wfp-card-h-aux"><Icon name="lock" size={11} /> зашифровано · reuse vault (G4)</div></div>
      <div className="r4-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {creds.map((c) => (
          <div key={c.name} className="r4-card">
            <div className="r4-card-top"><span className="wfg-src wfg-src--lg" style={{ background: 'var(--wf-fg)' }}><Icon name="lock" size={15} /></span><div style={{ flex: 1 }}><div className="r4-card-name" style={{ fontSize: 13.5 }}>{c.name}</div><div className="r4-card-meta">{c.login}</div></div></div>
            <div className="r4-copyfield" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--wf-border)', borderRadius: 8, background: 'var(--wf-subtle)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}><input readOnly value="••••••••••••" style={{ flex: 1, border: 0, background: 'none', font: 'inherit', color: 'inherit' }} /><button style={{ border: 0, background: 'none', color: 'var(--wf-fg-muted)', cursor: 'pointer', display: 'flex' }}><Icon name="eye" size={14} /></button><button style={{ border: 0, background: 'none', color: 'var(--wf-fg-muted)', cursor: 'pointer', display: 'flex' }}><Icon name="copy" size={14} /></button></div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

function ClientSource({ cl }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      <div className="wfl-panel">
        <div className="wfl-panel-h">// атрибуція ліда</div>
        <div className="wfl-panel-b">
          <div className="wfl-kv"><span className="wfl-kv-k">Перший дотик</span><span className="wfl-kv-v" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><WfSource id={cl.src} size="sm" />{window.LEAD_SRC[cl.src] ? window.LEAD_SRC[cl.src].label : cl.src}</span></div>
          <div className="wfl-kv"><span className="wfl-kv-k">Дата конверсії</span><span className="wfl-kv-v">{cl.conv}</span></div>
          <div className="wfl-kv"><span className="wfl-kv-k">UTM</span><span className="wfl-kv-v wf-mono" style={{ fontSize: 12 }}>utm_source=blog · utm_campaign=cta</span></div>
          <div className="wfl-kv"><span className="wfl-kv-k">Початковий лід</span><span className="wfl-kv-v"><span className="wfp-link">LD-289 →</span></span></div>
        </div>
      </div>
      <div className="wfl-panel">
        <div className="wfl-panel-h">// шлях</div>
        <div className="wfl-panel-b">
          <div className="wfl-tl">
            <div className="wfl-tl-row"><span className="wfl-tl-dot" data-kind="inbound"><Icon name="mail" size={11} /></span><div className="wfl-tl-body"><div className="wfl-tl-txt">Лід створено</div><div className="wfl-tl-meta">{cl.conv}</div></div></div>
            <div className="wfl-tl-row"><span className="wfl-tl-dot" data-kind="stage"><Icon name="kanban" size={11} /></span><div className="wfl-tl-body"><div className="wfl-tl-txt">Пройшов воронку → Виграно</div><div className="wfl-tl-meta">за 9 днів</div></div></div>
            <div className="wfl-tl-row"><span className="wfl-tl-dot" data-kind="note"><Icon name="building" size={11} /></span><div className="wfl-tl-body"><div className="wfl-tl-txt">Конвертовано у клієнта</div><div className="wfl-tl-meta">{cl.conv}</div></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── C3 · admin reset-password (2 modes) ─────────────────────────────
function ResetPasswordModal({ member, onClose }) {
  const [mode, setMode] = _c('link');
  const [done, setDone] = _c(false);
  const [copied, setCopied] = _c(false);
  const [cd, setCd] = _c(30);
  React.useEffect(() => {
    if (done && mode === 'temp' && cd > 0) { const t = setTimeout(() => setCd(cd - 1), 1000); return () => clearTimeout(t); }
  }, [done, mode, cd]);
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 480, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="key" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Скинути пароль</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', marginBottom: 16 }}>Для <strong>{member.name}</strong> · <span className="wf-mono">{member.email}</span></div>
          {!done ? (
            <React.Fragment>
              <div className="r4-seg" style={{ display: 'flex', border: '1px solid var(--wf-border)', borderRadius: 9, padding: 3, gap: 3, marginBottom: 16 }}>
                <div className="r4-seg-opt" data-on={mode === 'link' || undefined} onClick={() => setMode('link')} style={{ flex: 1, textAlign: 'center', padding: '8px 13px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, background: mode === 'link' ? 'var(--wf-fg)' : 'transparent', color: mode === 'link' ? 'var(--wf-bg)' : 'var(--wf-fg-secondary)' }}>Надіслати лінк</div>
                <div className="r4-seg-opt" data-on={mode === 'temp' || undefined} onClick={() => setMode('temp')} style={{ flex: 1, textAlign: 'center', padding: '8px 13px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, background: mode === 'temp' ? 'var(--wf-fg)' : 'transparent', color: mode === 'temp' ? 'var(--wf-bg)' : 'var(--wf-fg-secondary)' }}>Тимчасовий пароль</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                {mode === 'link'
                  ? 'Користувач отримає лист із посиланням на встановлення нового пароля. Лінк діє 1 годину.'
                  : 'Згенерується тимчасовий пароль — він покажеться вам рівно раз. Користувач буде змушений змінити його при наступному вході.'}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--wf-warning) 10%, transparent)', border: '1px solid color-mix(in oklab, var(--wf-warning) 30%, var(--wf-border))' }}>
                <Icon name="alert" size={14} color="var(--wf-warning)" />
                <span style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>Усі активні сесії користувача завершаться.</span>
              </div>
            </React.Fragment>
          ) : mode === 'link' ? (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)', lineHeight: 1.8 }}>✓ лист надіслано на {member.email}<br /><span style={{ color: 'var(--wf-fg-muted)' }}>· сесії завершено</span></div>
          ) : (
            <React.Fragment>
              <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', marginBottom: 12 }}>Тимчасовий пароль — <strong>покажеться лише раз</strong>:</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600, background: 'var(--wf-fg)', color: 'var(--wf-accent)', padding: '14px 16px', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '0.04em' }}>
                {cd > 0 ? 'Tz7$mK9pQx2v' : '•••••••••••'}
                <button onClick={() => setCopied(true)} disabled={cd === 0} style={{ border: 0, background: 'none', padding: 0, color: 'var(--wf-accent)', cursor: cd ? 'pointer' : 'default', display: 'flex', opacity: cd ? 1 : 0.4 }}><Icon name={copied ? 'check' : 'copy'} size={16} /></button>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: cd > 0 ? 'var(--wf-fg-muted)' : 'var(--wf-destructive)', marginTop: 8 }}>{cd > 0 ? `· зникне через ${cd}s` : '· пароль приховано — згенеруйте новий за потреби'}</div>
            </React.Fragment>
          )}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// {done ? mode : 'admin reset'}</span><div style={{ display: 'flex', gap: 8 }}>{!done ? <React.Fragment><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={() => setDone(true)}>{mode === 'link' ? 'Надіслати лінк' : 'Згенерувати пароль'}</button></React.Fragment> : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}</div></div>
      </div>
    </div>
  );
}

// ── C4 · deactivate + GDPR ──────────────────────────────────────────
function DeactivateModal({ cl, onClose, onConfirm }) {
  const [exporting, setExporting] = _c(false);
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 480, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="alert" size={18} color="var(--wf-destructive)" /><span className="wfp-modal-h-t">Деактивувати {cl.name}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.6, marginBottom: 14 }}>Що станеться після деактивації:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {['Користувачі бачать логін, але всі дії заблоковано', 'Активні replays архівуються', 'Замовлення та рахунки лишаються в системі (read-only)', 'Клієнта можна реактивувати будь-коли'].map((t) => (
              <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--wf-fg-secondary)' }}><Icon name="chev_r" size={12} color="var(--wf-fg-subtle)" style={{ marginTop: 2 }} />{t}</div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 9, border: '1px solid var(--wf-border)', background: 'var(--wf-subtle)' }}>
            <div><div style={{ fontSize: 12.5, fontWeight: 500 }}>Експорт даних клієнта (GDPR)</div><div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>ZIP · замовлення, чати, документи, рахунки</div></div>
            <button className="wfp-btn wfp-btn--sm" onClick={() => setExporting(true)} disabled={exporting}><Icon name="download" size={12} />{exporting ? 'Готується…' : 'Експорт'}</button>
          </div>
          {exporting && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-warning)', marginTop: 8 }}>⟳ архів збирається · надішлемо лінк на пошту owner'а</div>}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// деструктивна дія</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" style={{ background: 'var(--wf-destructive)', borderColor: 'var(--wf-destructive)', color: '#fff' }} onClick={onConfirm}>Деактивувати</button></div></div>
      </div>
    </div>
  );
}

// ── router ──────────────────────────────────────────────────────────
function WorkspaceClients() {
  const [view, setView] = _c({ name: 'list', id: null });
  if (view.name === 'card') {
    // Brunky opens the full 360° card (28-Б); others fall back to the legacy card.
    if (view.id === 'brunky' && window.Client360Card) return <Client360Card onBack={() => setView({ name: 'list' })} />;
    return <ClientCard clientId={view.id} onBack={() => setView({ name: 'list' })} />;
  }
  return <ClientsList onOpen={(id) => setView({ name: 'card', id })} />;
}

Object.assign(window, { WorkspaceClients, ClientsList, ClientCard });
