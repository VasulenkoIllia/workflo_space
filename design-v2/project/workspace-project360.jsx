// workspace-project360.jsx — Project Card 360° (05-ПРОЄКТИ deep).
// Opened from the Projects list. Mirrors Client 360° depth, with an
// Agency ⇄ Client view toggle and full retainer (абонплата) breakdown:
// what's included + recurring tasks + when they drop to the executor.

const _p3 = React.useState;

function pPerson(key) { return window.WF_PROJ.person(key); }

// role avatar chip (reuses WFA glyphs via WfRoleIcon if present, else Icon)
function PjAvatar({ who, size = 30 }) {
  const init = (who.name || '?').split(' ').map((x) => x[0]).slice(0, 2).join('');
  return (
    <span className="wpj-av" style={{ width: size, height: size, fontSize: size * 0.36 }} title={who.role}>{init}</span>
  );
}

function PjBillingPill({ billing }) {
  const b = window.WF_PROJ.BILLING_TONE[billing] || window.WF_PROJ.BILLING_TONE.separate;
  return <span className="wfg-pill2" data-tone={b.tone} title={b.hint}><span className="wfg-pill2-dot" />{b.label}</span>;
}
function PjStatusPill({ status }) {
  const s = window.WF_PROJ.STATUS_TONE[status] || window.WF_PROJ.STATUS_TONE.todo;
  return <span className="wfg-pill2" data-tone={s.tone}><span className="wfg-pill2-dot" />{s.label}</span>;
}

function PjHoursBar({ used, cap, label }) {
  const pct = cap ? Math.round((used / cap) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>
        <span>{label}</span><span>{used} / {cap} год · {pct}%</span>
      </div>
      <div className="wfc-bar"><div className="wfc-bar-fill" data-tone={pct > 90 ? 'bad' : pct > 80 ? 'warn' : undefined} style={{ width: Math.min(pct, 100) + '%' }} /></div>
    </div>
  );
}

// ════════════════════════ CARD SHELL ════════════════════════
function Project360Card({ project, onBack }) {
  const D = window.WF_PROJ;
  const C = window.WF_C360;
  const role = window.__wsRole || 'owner';
  const isManager = role === 'manager';
  const p = project;
  const internal = p.kind === 'internal';
  const [view, setView] = _p3('agency'); // 'agency' | 'client'
  const clientView = !internal && view === 'client';
  const [tab, setTab] = _p3('overview');
  const [edit, setEdit] = _p3(false);
  const m = (n) => D.money(n, p.currency || 'USD');
  const mdl = !internal && C ? C.BILLING_MODELS.find((b) => b.id === p.model) : null;
  const retainer = p.model === 'fixed_monthly_advance';
  // owner sees finance/margin; manager + client view do not
  const seesMoney = !isManager && !clientView;

  const tabs = internal
    ? [['overview', 'Огляд'], ['team', 'Команда'], ['tasks', 'Задачі'], ['rhythm', 'Ритм']]
    : [
        ['overview', 'Огляд'], ['team', 'Команда'], ['contract', 'Договір'],
        ['billing', retainer ? 'Абонплата' : 'Білінг'], ['orders', 'Замовлення'],
        ['tasks', 'Задачі'], ['docs', 'Документи'],
        ...(seesMoney ? [['finance', 'Фінанси']] : []),
      ];
  const safeTab = tabs.some((t) => t[0] === tab) ? tab : 'overview';

  const team = D.TEAMS.find((t) => t.id === p.team_id);

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />проєкти</button>
          <h1 className="wfp-ph-h1" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {p.name}
            {internal
              ? <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />внутрішній</span>
              : <span className="wfg-pill2" data-tone={retainer ? 'accent' : 'muted'}><span className="wfg-pill2-dot" />{retainer ? 'абонплата' : 'погодинно'}</span>}
            {p.status === 'active'
              ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активний</span>
              : p.status === 'paused'
              ? <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />пауза</span>
              : <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />закрито</span>}
          </h1>
          <div className="wfp-ph-sub">
            // {p.code} · {internal ? `${p.purpose} · команда: ${team ? team.name : '—'}` : `клієнт: ${p.client} · ${mdl ? mdl.short : ''}`} · з {p.since}
          </div>
        </div>
        <div className="wfp-ph-r" style={{ alignItems: 'center', gap: 10 }}>
          {!internal && (
            <div className="wpj-viewseg" title="Перемкнути перспективу">
              <button data-on={view === 'agency' || undefined} onClick={() => setView('agency')}><Icon name="building" size={12} />Агенція</button>
              <button data-on={view === 'client' || undefined} onClick={() => setView('client')}><Icon name="users" size={12} />Клієнт</button>
            </div>
          )}
          {!clientView && <button className="wfp-btn" onClick={() => setEdit(true)}><Icon name="edit" size={14} />Редагувати</button>}
        </div>
      </div>

      {clientView && (
        <div className="wpj-clientbanner">
          <Icon name="eye" size={15} color="var(--wf-accent)" />
          <div>Перегляд <strong>очима клієнта</strong> — так проєкт виглядає в порталі. Сховано: маржа, собівартість, ставки команди, внутрішні нотатки.</div>
        </div>
      )}

      <div className="wfg-tabs">
        {tabs.map(([id, label]) => (
          <div key={id} className="wfg-tab" data-on={safeTab === id || undefined} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>

      <div key={safeTab + view}>
        {safeTab === 'overview' && <PjOverview p={p} m={m} mdl={mdl} retainer={retainer} internal={internal} clientView={clientView} seesMoney={seesMoney} team={team} onTab={setTab} />}
        {safeTab === 'team' && <PjTeam p={p} m={m} internal={internal} clientView={clientView} seesMoney={seesMoney} team={team} />}
        {safeTab === 'contract' && <PjContract p={p} clientView={clientView} />}
        {safeTab === 'billing' && <PjBilling p={p} m={m} mdl={mdl} retainer={retainer} clientView={clientView} />}
        {safeTab === 'orders' && <PjOrders p={p} m={m} seesMoney={seesMoney} />}
        {safeTab === 'tasks' && <PjTasks p={p} internal={internal} />}
        {safeTab === 'rhythm' && <PjRhythm p={p} internal />}
        {safeTab === 'docs' && <PjDocs p={p} />}
        {safeTab === 'finance' && seesMoney && <PjFinance p={p} m={m} />}
      </div>

      {edit && window.ProjectEditModal && <ProjectEditModal project={p} onClose={() => setEdit(false)} />}
    </React.Fragment>
  );
}

// ─── Огляд ──────────────────────────────────────────────────────────
function PjOverview({ p, m, mdl, retainer, internal, clientView, seesMoney, team, onTab }) {
  const D = window.WF_PROJ;
  const C = window.WF_C360;
  const cap = retainer ? p.hoursIncluded : p.hoursPrepaid;
  const ent = !internal && C ? C.LEGAL_ENTITIES.find((e) => e.id === p.entity) : null;
  const cycle = !internal && C ? C.BILLING_CYCLES.find((c) => c.id === p.cycle) : null;
  const terms = !internal && C ? C.PAYMENT_TERMS.find((t) => t.id === p.terms) : null;
  const openOrders = (p.orders || []).filter((o) => o.status !== 'done').length;
  return (
    <div className="wfc-hero">
      <div>
        <div className="wfc-kpis">
          {internal ? (
            <React.Fragment>
              <div className="wfc-kpi"><div className="wfc-kpi-k">Тип</div><div className="wfc-kpi-v" style={{ fontSize: 19 }}>{p.purpose}</div><div className="wfc-kpi-sub">внутрішній проєкт</div></div>
              <div className="wfc-kpi"><div className="wfc-kpi-k">Команда</div><div className="wfc-kpi-v" style={{ fontSize: 19 }}>{team ? team.name : '—'}</div><div className="wfc-kpi-sub">{p.team.length} учасників</div></div>
              <div className="wfc-kpi"><div className="wfc-kpi-k">Години (план)</div><div className="wfc-kpi-v">{p.hoursUsed}<span style={{ fontSize: 14, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}> / {p.hoursPlanned}</span></div><div className="wfc-bar"><div className="wfc-bar-fill" style={{ width: Math.min(Math.round(p.hoursUsed / p.hoursPlanned * 100), 100) + '%' }} /></div></div>
              <div className="wfc-kpi"><div className="wfc-kpi-k">Відкриті задачі</div><div className="wfc-kpi-v">{(p.tasks || []).filter((t) => t.status !== 'done').length}</div><div className="wfc-kpi-sub">в роботі</div></div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="wfc-kpi">
                <div className="wfc-kpi-k">{retainer ? 'Абонплата' : 'Ставка'}</div>
                <div className="wfc-kpi-v wfc-kpi-v--accent">{m(retainer ? p.amount : p.rate)}<span style={{ fontSize: 13, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}>{retainer ? '/міс' : '/год'}</span></div>
                <div className="wfc-kpi-sub">{mdl ? mdl.short : ''}</div>
              </div>
              {cap ? (
                <div className="wfc-kpi">
                  <div className="wfc-kpi-k">{retainer ? 'Години циклу' : 'Передплата'}</div>
                  <div className="wfc-kpi-v">{p.hoursUsed}<span style={{ fontSize: 14, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}> / {cap}</span></div>
                  <div className="wfc-bar"><div className="wfc-bar-fill" data-tone={p.hoursUsed / cap > 0.9 ? 'bad' : p.hoursUsed / cap > 0.8 ? 'warn' : undefined} style={{ width: Math.min(Math.round(p.hoursUsed / cap * 100), 100) + '%' }} /></div>
                </div>
              ) : (
                <div className="wfc-kpi"><div className="wfc-kpi-k">Відпрацьовано</div><div className="wfc-kpi-v">{p.hoursUsed}<span style={{ fontSize: 13, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}> год</span></div><div className="wfc-kpi-sub">до рахунку</div></div>
              )}
              {seesMoney && <div className="wfc-kpi"><div className="wfc-kpi-k">Маржа</div><div className="wfc-kpi-v">{p.margin}%</div><div className="wfc-kpi-sub">собівартість {m(p.cost)}/міс</div></div>}
              <div className="wfc-kpi"><div className="wfc-kpi-k">Наступний білінг</div><div className="wfc-kpi-v" style={{ fontSize: 19 }}>{p.next}</div><div className="wfc-kpi-sub">{cycle ? cycle.label : ''}</div></div>
              <div className="wfc-kpi"><div className="wfc-kpi-k">Договір</div><div className="wfc-kpi-v" style={{ fontSize: 19 }}>{p.contract ? (p.contract.status === 'signed' ? '✓ підписано' : p.contract.status === 'draft' ? 'чернетка' : '—') : '—'}</div><div className="wfc-kpi-sub" style={{ cursor: 'pointer', color: 'var(--wf-accent)' }} onClick={() => onTab('contract')}>відкрити →</div></div>
              <div className="wfc-kpi"><div className="wfc-kpi-k">Відкриті замовлення</div><div className="wfc-kpi-v">{openOrders}</div><div className="wfc-kpi-sub" style={{ cursor: 'pointer', color: 'var(--wf-accent)' }} onClick={() => onTab('orders')}>усі замовлення →</div></div>
            </React.Fragment>
          )}
        </div>

        <div style={{ marginTop: 22 }}>
          <div className="wfc-sec-h"><span className="wfc-sec-h-t">Про проєкт</span></div>
          <div className="wfl-panel"><div className="wfl-panel-b" style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--wf-fg-secondary)' }}>{p.desc}</div></div>
        </div>

        {retainer && p.retainer && (
          <div style={{ marginTop: 22 }}>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t">Що входить в абонплату</span><span className="wfc-sec-h-s" style={{ cursor: 'pointer', color: 'var(--wf-accent)' }} onClick={() => onTab('billing')}>деталі та регулярні задачі →</span></div>
            <div className="wpj-includes">
              {p.retainer.includes.map((inc) => (
                <div key={inc.label} className="wpj-inc">
                  <span className="wpj-inc-ck"><Icon name="check" size={12} /></span>
                  <div><div className="wpj-inc-t">{inc.label}</div><div className="wpj-inc-d">{inc.detail}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="wfc-sec-h"><span className="wfc-sec-h-t">Ключові дані</span></div>
          <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 12 }}>
            {!internal && <div className="wfl-kv"><span className="wfl-kv-k">Клієнт</span><span className="wfl-kv-v">{p.client}</span></div>}
            {internal && <div className="wfl-kv"><span className="wfl-kv-k">Команда</span><span className="wfl-kv-v">{team ? team.name : '—'}</span></div>}
            {!internal && cycle && <div className="wfl-kv"><span className="wfl-kv-k">Білінг-цикл</span><span className="wfl-kv-v">{cycle.label}{p.cycleDay ? ` · ${p.cycleDay}-е` : ''}</span></div>}
            {!internal && terms && <div className="wfl-kv"><span className="wfl-kv-k">Payment terms</span><span className="wfl-kv-v">{terms.label}</span></div>}
            {!internal && !clientView && ent && <div className="wfl-kv"><span className="wfl-kv-k">Юр-особа агенції</span><span className="wfl-kv-v">{ent.name}</span></div>}
            <div className="wfl-kv"><span className="wfl-kv-k">Старт</span><span className="wfl-kv-v">{p.since}</span></div>
          </div></div>
        </div>

        <div>
          <div className="wfc-sec-h"><span className="wfc-sec-h-t">Команда проєкту</span><span className="wfc-sec-h-s">// {p.team.length}</span></div>
          <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 10 }}>
            {p.team.slice(0, 4).map((u) => (
              <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PjAvatar who={u} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}{u.lead && <span className="wfc-opt-tag" style={{ marginLeft: 6 }}>lead</span>}</div><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{u.role} · {u.alloc}%</div></div>
              </div>
            ))}
            <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => onTab('team')}>Уся команда →</button>
          </div></div>
        </div>
      </div>
    </div>
  );
}

// ─── Команда ────────────────────────────────────────────────────────
function PjTeam({ p, m, internal, clientView, seesMoney, team }) {
  return (
    <React.Fragment>
      <div className="wfc-sec-h">
        <span className="wfc-sec-h-t">{internal ? 'Команда' : 'Команда на проєкті'} <span className="wfc-sec-h-s" style={{ marginLeft: 6 }}>// {p.team.length} учасників{internal && team ? ` · ${team.name}` : ''}</span></span>
        {!clientView && <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Призначити учасника · демо', 'ok')}><Icon name="plus" size={13} />Додати</button>}
      </div>
      {clientView && <div className="wpj-note"><Icon name="users" size={14} color="var(--wf-accent)" />Клієнт бачить хто працює над проєктом і їхні ролі — без внутрішніх ставок.</div>}
      <table className="wfp-table">
        <thead><tr><th>Учасник</th><th>Роль</th><th style={{ width: 180 }}>Завантаження</th>{seesMoney && <th className="wfp-num">Ставка</th>}{seesMoney && <th className="wfp-num">Комісія</th>}</tr></thead>
        <tbody>
          {p.team.map((u) => (
            <tr key={u.name}>
              <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><PjAvatar who={u} size={28} /><span style={{ fontWeight: 500 }}>{u.name}{u.lead && <span className="wfc-opt-tag" style={{ marginLeft: 6 }}>lead</span>}</span></span></td>
              <td>{u.role}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="wfc-bar" style={{ flex: 1, marginTop: 0 }}><div className="wfc-bar-fill" style={{ width: u.alloc + '%' }} /></div>
                  <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', width: 34, textAlign: 'right' }}>{u.alloc}%</span>
                </div>
              </td>
              {seesMoney && <td className="wfp-num" style={{ fontWeight: 600 }}>{u.zeroCost ? <span className="wfg-pill2" data-tone="accent" style={{ display: 'inline-flex' }}><span className="wfg-pill2-dot" />без с/в</span> : (u.rate ? '$' + u.rate + '/год' : '—')}</td>}
              {seesMoney && <td className="wfp-num">{u.commission ? '+' + u.commission + '%' : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {seesMoney && !internal && <div className="wpj-note" style={{ marginTop: 16 }}><Icon name="shield" size={14} color="var(--wf-accent)" />Ставки та комісії — внутрішні (з 12-Компенсації). Override ставки на проєкті задається в картці учасника. Видно лише овнеру.</div>}
    </React.Fragment>
  );
}

// ─── Договір ────────────────────────────────────────────────────────
function PjContract({ p, clientView }) {
  const c = p.contract;
  if (!c) {
    return (
      <div className="wfl-empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <Icon name="file" size={26} color="var(--wf-fg-subtle)" /><br />
        Для цього проєкту договір не обовʼязковий і не створений.<br />
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" style={{ marginTop: 14 }} onClick={() => window.wfToast && window.wfToast('Згенерувати договір · демо', 'ok')}><Icon name="plus" size={13} />Згенерувати договір</button>
      </div>
    );
  }
  const signed = c.status === 'signed';
  return (
    <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}>
      <div>
        <div className={`wfl-gate${signed ? ' wfl-gate--ok' : ''}`}>
          <Icon name={signed ? 'check' : 'alert'} size={16} />
          <div style={{ flex: 1 }}>
            <div className="wfl-gate-t">{signed ? 'Договір підписано' : 'Договір — чернетка, не підписано'}</div>
            <div className="wfl-gate-s">{signed ? `підписав ${c.signedBy} · ${c.signedDate}${c.renews ? ` · автопродовження до ${c.renews}` : ''}` : 'надішліть на підпис, щоб розблокувати рахунки за договором'}</div>
          </div>
        </div>
        <div className="wfl-panel" style={{ marginTop: 16 }}>
          <div className="wfl-panel-h"><span>// {c.name}</span><span className="wfg-pill2" data-tone={c.format === 'EU' ? 'accent' : 'muted'}><span className="wfg-pill2-dot" />{c.format}</span></div>
          <div className="wfl-panel-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="wfl-kv"><span className="wfl-kv-k">Номер</span><span className="wfl-kv-v wf-mono">{c.number}</span></div>
            <div className="wfl-kv"><span className="wfl-kv-k">Шаблон</span><span className="wfl-kv-v">{c.template}</span></div>
            <div className="wfl-kv"><span className="wfl-kv-k">Статус</span><span className="wfl-kv-v">{signed ? 'підписано' : 'чернетка'}</span></div>
            <div className="wfl-kv"><span className="wfl-kv-k">Підписант</span><span className="wfl-kv-v">{c.signedBy || '—'}</span></div>
            {c.signedDate && <div className="wfl-kv"><span className="wfl-kv-k">Дата підпису</span><span className="wfl-kv-v">{c.signedDate}</span></div>}
            {c.renews && <div className="wfl-kv"><span className="wfl-kv-k">Продовження</span><span className="wfl-kv-v">{c.renews}</span></div>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="wfp-btn" style={{ justifyContent: 'flex-start' }} onClick={() => window.wfToast && window.wfToast('Переглянути PDF · демо', 'ok')}><Icon name="eye" size={14} />Переглянути PDF</button>
        <button className="wfp-btn" style={{ justifyContent: 'flex-start' }} onClick={() => window.wfToast && window.wfToast('Завантажити · демо', 'ok')}><Icon name="download" size={14} />Завантажити</button>
        {!clientView && !signed && <button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'flex-start' }} onClick={() => window.wfToast && window.wfToast('Надіслати на підпис · демо', 'ok')}><Icon name="send" size={14} />Надіслати на підпис</button>}
        {!clientView && <button className="wfp-btn" style={{ justifyContent: 'flex-start' }} onClick={() => window.wfToast && window.wfToast('Перегенерувати зі змінних · демо', 'ok')}><Icon name="edit" size={14} />Перегенерувати</button>}
      </div>
    </div>
  );
}

// ─── Білінг / Абонплата ─────────────────────────────────────────────
function PjBilling({ p, m, mdl, retainer, clientView }) {
  const D = window.WF_PROJ;
  const C = window.WF_C360;
  const cap = retainer ? p.hoursIncluded : p.hoursPrepaid;
  const cycle = C ? C.BILLING_CYCLES.find((c) => c.id === p.cycle) : null;
  const terms = C ? C.PAYMENT_TERMS.find((t) => t.id === p.terms) : null;
  return (
    <React.Fragment>
      <div className="wfl-panel" style={{ marginBottom: 20 }}>
        <div className="wfl-panel-h"><span>// модель білінгу</span><span className="wfg-pill2" data-tone={retainer ? 'accent' : 'muted'}><span className="wfg-pill2-dot" />{mdl ? mdl.label : (retainer ? 'абонплата' : 'погодинно')}</span></div>
        <div className="wfl-panel-b" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div className="wfl-kv"><span className="wfl-kv-k">{retainer ? 'Абонплата' : 'Ставка'}</span><span className="wfl-kv-v" style={{ fontWeight: 600 }}>{m(retainer ? p.amount : p.rate)}{retainer ? '/міс' : '/год'}</span></div>
          <div className="wfl-kv"><span className="wfl-kv-k">Валюта</span><span className="wfl-kv-v">{p.currency}</span></div>
          <div className="wfl-kv"><span className="wfl-kv-k">Цикл</span><span className="wfl-kv-v">{cycle ? cycle.label : '—'}{p.cycleDay ? ` · ${p.cycleDay}-е` : ''}</span></div>
          <div className="wfl-kv"><span className="wfl-kv-k">Terms</span><span className="wfl-kv-v">{terms ? terms.label : '—'}</span></div>
        </div>
      </div>

      {cap && (
        <div className="wfl-panel" style={{ marginBottom: 20 }}>
          <div className="wfl-panel-h"><span>// {retainer ? 'включені години' : 'баланс передплати'}</span></div>
          <div className="wfl-panel-b">
            <PjHoursBar used={p.hoursUsed} cap={cap} label={retainer ? 'витрачено цього циклу' : 'списано з передплати'} />
            {retainer && <div className="wpj-note" style={{ marginTop: 14 }}><Icon name="clock" size={14} color="var(--wf-accent)" />Понад {cap} год — доплата {m(p.overageRate)}/год окремим рахунком. Зараз залишилось {Math.max(cap - p.hoursUsed, 0)} год.</div>}
          </div>
        </div>
      )}

      {retainer && p.retainer && (
        <React.Fragment>
          <div className="wfc-sec-h"><span className="wfc-sec-h-t">Що входить в абонплату</span><span className="wfc-sec-h-s">// з каталогу послуг{!clientView ? ' · з економікою' : ' · видно клієнту'}</span></div>
          <div className="wpj-includes" style={{ marginBottom: 22 }}>
            {p.retainer.includes.map((inc) => {
              const sv = (window.WF_SVC && inc.serviceId) ? window.WF_SVC.CATALOG.find((x) => x.id === inc.serviceId) : null;
              const k = sv ? window.WF_SVC.KIND[sv.kind] : null;
              return (
                <div key={inc.label} className="wpj-inc">
                  <span className="wpj-inc-ck"><Icon name="check" size={12} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="wpj-inc-t">{inc.label}{k && <span className="wfg-pill2" data-tone={k.tone} style={{ marginLeft: 7 }}><span className="wfg-pill2-dot" />{k.label}</span>}</div>
                    <div className="wpj-inc-d">{inc.detail}</div>
                    {sv && (
                      <div className="wpj-inc-econ">
                        {!clientView && sv.cost.mode !== 'none' && <span className="wpj-econ-chip">с/в {sv.cost.mode === 'money' ? C.money(sv.cost.money) + '/міс' : (sv.variable ? '~год' : sv.cost.hours + ' год')}</span>}
                        <span className="wpj-econ-chip" data-tone="accent">клієнту {sv.bill.mode === 'money' ? C.money(sv.bill.price) + '/міс' : (sv.variable ? 'по факту' : sv.bill.hours + ' год')}</span>
                        {!clientView && window.WF_SVC.svcMargin(sv) != null && <span className="wpj-econ-chip" data-tone="accent">маржа {window.WF_SVC.svcMargin(sv)}%</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="wfc-sec-h">
            <span className="wfc-sec-h-t">Регулярні задачі абонплати</span>
            <span className="wfc-sec-h-s">// авто-падають виконавцю за розкладом</span>
          </div>
          {!clientView && <div className="wpj-note" style={{ marginBottom: 14 }}><Icon name="kanban" size={14} color="var(--wf-accent)" />Ці задачі система автоматично створює в дошці й призначає виконавцю на вказаний день — як zero-billed (входять в абонплату). Ручні створюються кнопкою.</div>}
          <div className="wpj-recur">
            {p.retainer.recurring.map((r) => <PjRecurRow key={r.title} r={r} clientView={clientView} />)}
          </div>
        </React.Fragment>
      )}

      {!retainer && (
        <div className="wpj-note"><Icon name="clock" size={14} color="var(--wf-accent)" />Погодинна модель: задачі білуються за фактичними годинами. Регулярних zero-billed задач немає — кожна задача йде в рахунок.</div>
      )}
    </React.Fragment>
  );
}

function PjRecurRow({ r, clientView }) {
  const D = window.WF_PROJ;
  const PEOPLE = window.WF_SVC ? window.WF_SVC.A : {};
  const [auto, setAuto] = _p3(r.auto);
  const [assignee, setAssignee] = _p3(r.assignee || '');
  const [cadence, setCadence] = _p3(r.cadence);
  const [team, setTeam] = _p3(r.team || 't-dev');
  const cad = D.CADENCE[cadence] || { label: cadence };
  const teamObj = D.TEAMS.find((t) => t.id === team) || D.TEAMS[0];
  const who = assignee ? pPerson(assignee) : null;
  return (
    <div className="wpj-recur-row">
      <span className="wpj-recur-ico"><Icon name="calendar" size={15} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="wpj-recur-t">{r.title}</div>
        <div className="wpj-recur-m">{cad.label} · {r.day} · {teamObj ? teamObj.name : ''}</div>
      </div>
      <div className="wpj-recur-drop">
        <span className="wpj-recur-k">падає {who ? 'виконавцю' : 'на команду'}</span>
        {clientView ? (
          who
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><PjAvatar who={who} size={22} /><span style={{ fontSize: 12.5, fontWeight: 500 }}>{who.name}</span></span>
            : <span style={{ fontSize: 12.5, fontWeight: 500 }}>{teamObj ? teamObj.name : 'Команда'}</span>
        ) : (
          <select className="wfl-select wpj-recur-sel" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{teamObj ? teamObj.name : 'Команда'} (без виконавця)</option>
            {Object.keys(PEOPLE).map((k) => <option key={k} value={k}>{PEOPLE[k]}</option>)}
          </select>
        )}
      </div>
      <div className="wpj-recur-next">
        <span className="wpj-recur-k">{clientView ? 'наступна' : 'регулярність'}</span>
        {clientView
          ? <span className="wf-mono" style={{ fontSize: 12.5 }}>{r.next}</span>
          : <select className="wfl-select wpj-recur-sel" value={cadence} onChange={(e) => setCadence(e.target.value)}>{Object.keys(D.CADENCE).map((c) => <option key={c} value={c}>{D.CADENCE[c].label}</option>)}</select>}
      </div>
      {clientView ? (
        <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />у абонплаті</span>
      ) : (
        <button className={`wpj-toggle${auto ? ' wpj-toggle--on' : ''}`} onClick={() => setAuto(!auto)} title={auto ? 'авто-створення увімкнено' : 'створювати вручну'}>
          <span className="wpj-toggle-dot" />{auto ? 'авто' : 'вручну'}
        </button>
      )}
    </div>
  );
}

// ─── Ритм (internal recurring) ───────────────────────────────────────
function PjRhythm({ p }) {
  const rec = p.recurringInternal || [];
  return (
    <React.Fragment>
      <div className="wfc-sec-h"><span className="wfc-sec-h-t">Регулярні ритуали команди</span><span className="wfc-sec-h-s">// авто-падають за розкладом</span></div>
      {rec.length ? (
        <div className="wpj-recur">{rec.map((r) => <PjRecurRow key={r.title} r={r} clientView={false} />)}</div>
      ) : <div className="wfl-empty">регулярних задач немає</div>}
    </React.Fragment>
  );
}

// ─── Замовлення ──────────────────────────────────────────────────────
function PjOrders({ p, m, seesMoney }) {
  const orders = p.orders || [];
  return (
    <React.Fragment>
      <div className="wfc-sec-h">
        <span className="wfc-sec-h-t">Замовлення проєкту <span className="wfc-sec-h-s" style={{ marginLeft: 6 }}>// {orders.length}</span></span>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Нове замовлення · демо', 'ok')}><Icon name="plus" size={13} />Замовлення</button>
      </div>
      {orders.length ? (
        <table className="wfp-table">
          <thead><tr><th>№</th><th>Назва</th><th>Статус</th><th className="wfp-num">Год</th><th>Білінг</th>{seesMoney && <th className="wfp-num">Сума</th>}</tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.num}>
                <td className="wfp-mono"><span className="wfp-link">{o.num}</span></td>
                <td>{o.title}</td>
                <td><PjStatusPill status={o.status} /></td>
                <td className="wfp-num">{o.hours}</td>
                <td><PjBillingPill billing={o.billing} /></td>
                {seesMoney && <td className="wfp-num" style={{ fontWeight: 600 }}>{o.billing === 'included' ? <span style={{ color: 'var(--wf-fg-subtle)' }}>—</span> : m(o.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="wfl-empty">замовлень ще немає</div>}
      <div className="wpj-note" style={{ marginTop: 16 }}><Icon name="copy" size={14} color="var(--wf-accent)" />Кожне замовлення живе всередині проєкту. <strong>«у абонплаті»</strong> — zero-billed, входить у місячну суму. <strong>«окремо»</strong> — поверх абонплати, окремий рахунок.</div>
    </React.Fragment>
  );
}

// ─── Задачі ──────────────────────────────────────────────────────────
function PjTasks({ p, internal }) {
  const tasks = p.tasks || [];
  return (
    <React.Fragment>
      <div className="wfc-sec-h">
        <span className="wfc-sec-h-t">Задачі <span className="wfc-sec-h-s" style={{ marginLeft: 6 }}>// {tasks.length}</span></span>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Нова задача · демо', 'ok')}><Icon name="plus" size={13} />Задача</button>
      </div>
      {tasks.length ? (
        <table className="wfp-table">
          <thead><tr><th>Задача</th><th>Виконавець</th><th>Статус</th><th className="wfp-num">Год</th><th>{internal ? 'Тип' : 'Білінг'}</th></tr></thead>
          <tbody>
            {tasks.map((t, i) => {
              const who = pPerson(t.assignee);
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{t.title}</td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><PjAvatar who={who} size={24} /><span style={{ fontSize: 12.5 }}>{who.name}</span></span></td>
                  <td><PjStatusPill status={t.status} /></td>
                  <td className="wfp-num">{t.hours}</td>
                  <td><PjBillingPill billing={t.billing} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <div className="wfl-empty">задач ще немає</div>}
      {!internal && <div className="wpj-note" style={{ marginTop: 16 }}><Icon name="kanban" size={14} color="var(--wf-accent)" />Усі задачі проєкту йдуть у єдину дошку. Білінг задачі визначає, чи списується вона з абонплати (zero-billed), білиться окремо, чи безоплатна.</div>}
    </React.Fragment>
  );
}

// ─── Документи ───────────────────────────────────────────────────────
const PJ_DOC_KIND = { contract: { ic: 'file', l: 'Договір' }, invoice: { ic: 'receipt', l: 'Рахунок' }, act: { ic: 'check', l: 'Акт' }, nda: { ic: 'shield', l: 'NDA' } };
function PjDocs({ p }) {
  const docs = p.docs || [];
  return (
    <React.Fragment>
      <div className="wfc-sec-h">
        <span className="wfc-sec-h-t">Документи проєкту <span className="wfc-sec-h-s" style={{ marginLeft: 6 }}>// {docs.length}</span></span>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Згенерувати · демо', 'ok')}><Icon name="plus" size={13} />Згенерувати</button>
      </div>
      {docs.length ? docs.map((d, i) => {
        const k = PJ_DOC_KIND[d.kind] || PJ_DOC_KIND.contract;
        return (
          <div key={i} className="wfc-doc-row">
            <span className="wfc-doc-ico" data-fmt={d.format}><Icon name={k.ic} size={16} /></span>
            <div><div className="wfc-doc-name">{d.name}</div><div className="wfc-doc-meta">{k.l} · {d.format} · {d.date}</div></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {d.status === 'signed' && <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />підписано</span>}
              {d.status === 'overdue' && <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />овердʼю</span>}
              {d.status === 'awaiting' && <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />очікує</span>}
              {d.status === 'draft' && <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />чернетка</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="wfp-iconbtn" title="Переглянути" onClick={() => window.wfToast && window.wfToast('Переглянути · демо', 'ok')}><Icon name="eye" size={14} /></button>
              <button className="wfp-iconbtn" title="Завантажити" onClick={() => window.wfToast && window.wfToast('Завантажити · демо', 'ok')}><Icon name="download" size={14} /></button>
            </div>
          </div>
        );
      }) : <div className="wfl-empty">документів ще немає</div>}
    </React.Fragment>
  );
}

// ─── Фінанси ─────────────────────────────────────────────────────────
function PjFinance({ p, m }) {
  const inv = p.invoices || [];
  const rev = p.model === 'fixed_monthly_advance' ? p.amount : (p.rate * (p.hoursUsed || 0));
  const debt = inv.filter((i) => i.status === 'overdue' || i.status === 'awaiting').reduce((a, i) => a + (i.amount - i.paid), 0);
  return (
    <React.Fragment>
      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">{p.model === 'fixed_monthly_advance' ? 'дохід / міс' : 'нараховано'}</div><div className="wfp-stat-v wfp-stat-v--accent">{m(rev)}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">собівартість / міс</div><div className="wfp-stat-v">{m(p.cost)}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">маржа</div><div className="wfp-stat-v">{p.margin}%</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">борг по проєкту</div><div className={`wfp-stat-v${debt > 0 ? ' wfp-stat-v--warn' : ''}`}>{debt > 0 ? m(debt) : '—'}</div></div>
      </div>
      <div className="wfc-sec-h"><span className="wfc-sec-h-t">Рахунки</span></div>
      <table className="wfp-table">
        <thead><tr><th>Рахунок</th><th>Виставлено</th><th>Термін</th><th className="wfp-num">Сума</th><th>Статус</th></tr></thead>
        <tbody>
          {inv.map((iv) => (
            <tr key={iv.id}>
              <td className="wfp-mono"><span className="wfp-link">{iv.id}</span></td>
              <td className="wfp-mono">{iv.date}</td>
              <td className="wfp-mono" style={{ color: iv.status === 'overdue' ? 'var(--wf-destructive)' : 'var(--wf-fg-muted)' }}>{iv.due}</td>
              <td className="wfp-num">{m(iv.amount)}{iv.paid > 0 && iv.paid < iv.amount && <div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>сплачено {m(iv.paid)}</div>}</td>
              <td>{iv.status === 'paid' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />сплачено</span> : iv.status === 'overdue' ? <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />овердʼю {iv.overdueDays}д</span> : <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />очікує</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

Object.assign(window, { Project360Card });
