// workspace-svccatalog.jsx — Каталог послуг (WsServiceCatalog).
// Library of billable services with flexible cost/bill economics. Owner builds
// services here, then picks them when composing a retainer (абонплата).

const _sc = React.useState;

function SvcCostCell({ s }) {
  const D = window.WF_SVC;
  if (s.cost.mode === 'none') return <span style={{ color: 'var(--wf-fg-subtle)' }}>—</span>;
  if (s.cost.mode === 'money') return <span style={{ fontWeight: 600 }}>{D.money(s.cost.money)}<span style={{ fontSize: 10, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}>/міс</span></span>;
  return <span style={{ fontWeight: 600 }}>{s.variable ? '~' : ''}{s.cost.hours} <span style={{ fontSize: 10, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}>год</span></span>;
}
function SvcBillCell({ s }) {
  const D = window.WF_SVC;
  if (s.bill.mode === 'money') return <span style={{ fontWeight: 600 }}>{D.money(s.bill.price)}<span style={{ fontSize: 10, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}>/міс</span></span>;
  return <span style={{ fontWeight: 600 }}>{s.variable ? 'по факту' : `${s.bill.hours} год`}<div className="wf-mono" style={{ fontSize: 9.5, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}>з включених</div></span>;
}

// ════════════════════ CATALOG SCREEN ════════════════════
function WsServiceCatalog() {
  const D = window.WF_SVC;
  const role = window.__wsRole || 'owner';
  const seesMoney = role !== 'manager';
  const [q, setQ] = _sc('');
  const [cat, setCat] = _sc('all');
  const [edit, setEdit] = _sc(null); // service obj or 'new'
  const [list] = _sc(D.CATALOG);

  let rows = list.filter((s) => (s.name + s.code + s.category).toLowerCase().includes(q.toLowerCase()));
  if (cat !== 'all') rows = rows.filter((s) => s.category === cat);

  const works = list.filter((s) => s.kind === 'work').length;
  const resources = list.filter((s) => s.kind === 'resource').length;
  const recurringCount = list.filter((s) => s.makesTask).length;
  const resMonthly = list.filter((s) => s.kind === 'resource').reduce((a, s) => a + (s.bill.price - s.cost.money), 0);

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Каталог послуг</h1>
          <div className="wfp-ph-sub">// довідник білінгових послуг · з них збираються абонплати й авто-задачі виконавцям</div>
        </div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => setEdit('new')}><Icon name="plus" size={14} />Нова послуга</button></div>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 18 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">послуг у каталозі</div><div className="wfp-stat-v">{list.length}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">робота · ресурси</div><div className="wfp-stat-v">{works} · {resources}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">генерують задачі</div><div className="wfp-stat-v">{recurringCount}</div></div>
        {seesMoney && <div className="wfp-stat"><div className="wfp-stat-k">маржа з ресурсів / міс</div><div className="wfp-stat-v wfp-stat-v--accent">{D.money(resMonthly)}</div></div>}
      </div>

      <div className="wfp-filters">
        <div className="wfp-search"><Icon name="search" size={14} color="var(--wf-fg-muted)" /><input placeholder="Шукати послугу…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="wfp-pill" data-on={cat === 'all' || undefined} onClick={() => setCat('all')}>усі</button>
        {D.CATEGORIES.map((c) => <button key={c} className="wfp-pill" data-on={cat === c || undefined} onClick={() => setCat(c)}>{c}</button>)}
      </div>

      <table className="wfp-table">
        <thead><tr>
          <th>Послуга</th><th>Тип</th>
          {seesMoney && <th className="wfp-num">Собівартість</th>}
          <th className="wfp-num">Клієнту</th>
          {seesMoney && <th className="wfp-num">Маржа</th>}
          <th>Генерує задачу</th>
        </tr></thead>
        <tbody>
          {rows.map((s) => {
            const k = D.KIND[s.kind];
            const cad = s.recurring ? D.CADENCE[s.recurring] : null;
            const margin = D.svcMargin(s);
            return (
              <tr key={s.id} onClick={() => setEdit(s)} style={{ cursor: 'pointer' }}>
                <td><span className="wfp-link" style={{ fontWeight: 600 }}>{s.name}</span><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{s.code} · {s.category}</div></td>
                <td><span className="wfg-pill2" data-tone={k.tone}><span className="wfg-pill2-dot" />{k.label}</span></td>
                {seesMoney && <td className="wfp-num"><SvcCostCell s={s} /></td>}
                <td className="wfp-num"><SvcBillCell s={s} /></td>
                {seesMoney && <td className="wfp-num">{margin != null ? <span style={{ fontWeight: 600, color: 'var(--wf-accent)' }}>{margin}%</span> : <span style={{ color: 'var(--wf-fg-subtle)' }}>—</span>}</td>}
                <td>{s.makesTask ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />так</span> : <span style={{ color: 'var(--wf-fg-subtle)', fontSize: 12 }}>—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="wpj-note" style={{ marginTop: 18 }}>
        <Icon name="copy" size={14} color="var(--wf-accent)" />
        <span>Кожна послуга має <strong>дві незалежні осі</strong>: собівартість (години / гроші / немає) і що виставляється клієнту (години зі включених / гроші в сумі). <strong>Робота</strong> з регулярністю автоматично створює задачу виконавцю; <strong>ресурс</strong> (сервер, домен) лише білиться з націнкою.</span>
      </div>

      {edit && <ServiceEditModal service={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </React.Fragment>
  );
}

// ════════════════════ SERVICE EDITOR ════════════════════
function ServiceEditModal({ service, onClose }) {
  const D = window.WF_SVC;
  const p = service;
  const isNew = !p;
  const [s, set] = _sc({
    name: p ? p.name : '', category: p ? p.category : D.CATEGORIES[0], kind: p ? p.kind : 'work',
    costMode: p ? p.cost.mode : 'hours', costHours: String(p ? p.cost.hours : 2), costMoney: String(p ? p.cost.money : 10),
    billMode: p ? p.bill.mode : 'hours', billHours: String(p ? p.bill.hours : 2), billPrice: String(p ? p.bill.price : 20),
    recurring: p ? (p.recurring || 'none') : 'monthly', makesTask: p ? p.makesTask : true,
    assignee: p ? p.assignee : 'igor', desc: p ? p.desc : '',
  });
  const u = (k, v) => set({ ...s, [k]: v });
  const KINDS = [['work', 'Робота'], ['resource', 'Ресурс'], ['fixed', 'Фікс']];

  // live margin preview
  const margin = (s.billMode === 'money' && s.costMode === 'money' && +s.billPrice > 0)
    ? Math.round(((+s.billPrice - +s.costMoney) / +s.billPrice) * 100) : null;

  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ margin: 0, maxWidth: 560 }}>
        <div className="wfp-modal-h"><Icon name={isNew ? 'plus' : 'edit'} size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">{isNew ? 'Нова послуга' : s.name}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-b" style={{ maxHeight: '64vh', overflowY: 'auto' }}>
          <div className="wfp-field"><label>Назва послуги</label><input placeholder="напр. Оренда сервера (prod)" value={s.name} onChange={(e) => u('name', e.target.value)} /></div>
          <div className="wfc-grid2">
            <div className="wfp-field"><label>Категорія</label><select className="wfl-select" value={s.category} onChange={(e) => u('category', e.target.value)}>{D.CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="wfp-field"><label>Тип</label>
              <div className="wfc-seg">{KINDS.map(([id, l]) => <div key={id} className="wfc-seg-opt" data-on={s.kind === id || undefined} onClick={() => u('kind', id)}>{l}</div>)}</div>
            </div>
          </div>
          <div className="wfc-wiz-hint" style={{ marginTop: -4 }}>// {D.KIND[s.kind].desc}</div>

          {/* COST axis */}
          <div className="wpj-axis">
            <div className="wpj-axis-h"><Icon name="coins" size={14} color="var(--wf-fg-muted)" />Собівартість <span className="wpj-axis-sub">скільки коштує НАМ</span></div>
            <div className="wfc-seg" style={{ marginBottom: 10 }}>
              <div className="wfc-seg-opt" data-on={s.costMode === 'hours' || undefined} onClick={() => u('costMode', 'hours')}>Години</div>
              <div className="wfc-seg-opt" data-on={s.costMode === 'money' || undefined} onClick={() => u('costMode', 'money')}>Гроші</div>
              <div className="wfc-seg-opt" data-on={s.costMode === 'none' || undefined} onClick={() => u('costMode', 'none')}>Немає</div>
            </div>
            {s.costMode === 'hours' && <div className="wfp-field" style={{ marginBottom: 0 }}><label>Фактичні години / міс</label><input value={s.costHours} onChange={(e) => u('costHours', e.target.value)} style={{ width: 140 }} /></div>}
            {s.costMode === 'money' && <div className="wfp-field" style={{ marginBottom: 0 }}><label>Наша вартість $ / міс</label><input value={s.costMoney} onChange={(e) => u('costMoney', e.target.value)} style={{ width: 140 }} /></div>}
            {s.costMode === 'none' && <div className="wfc-wiz-hint" style={{ marginTop: 0 }}>// собівартість не вираховуємо — у звітах маржа не рахується.</div>}
          </div>

          {/* BILL axis */}
          <div className="wpj-axis">
            <div className="wpj-axis-h"><Icon name="receipt" size={14} color="var(--wf-fg-muted)" />Клієнту <span className="wpj-axis-sub">як заходить в абонплату</span></div>
            <div className="wfc-seg" style={{ marginBottom: 10 }}>
              <div className="wfc-seg-opt" data-on={s.billMode === 'hours' || undefined} onClick={() => u('billMode', 'hours')}>Години (зі включених)</div>
              <div className="wfc-seg-opt" data-on={s.billMode === 'money' || undefined} onClick={() => u('billMode', 'money')}>Гроші (в сумі)</div>
            </div>
            {s.billMode === 'hours'
              ? <div className="wfp-field" style={{ marginBottom: 0 }}><label>Години клієнту / міс</label><input value={s.billHours} onChange={(e) => u('billHours', e.target.value)} style={{ width: 140 }} /><div className="wfc-wiz-hint" style={{ marginTop: 8 }}>// списуються з включених годин абонплати.</div></div>
              : <div className="wfp-field" style={{ marginBottom: 0 }}><label>Ціна клієнту $ / міс</label><input value={s.billPrice} onChange={(e) => u('billPrice', e.target.value)} style={{ width: 140 }} /><div className="wfc-wiz-hint" style={{ marginTop: 8 }}>// додається до місячної суми абонплати.</div></div>}
            {margin != null && <div className="wpj-margin-preview"><Icon name="check" size={13} color="var(--wf-accent)" />Маржа <strong>{margin}%</strong> · {D.money(+s.billPrice - +s.costMoney)} з послуги на місяць</div>}
          </div>

          {/* task generation — only WHETHER it makes a task; who/when set per-project */}
          <div className="wpj-axis">
            <div className="wpj-axis-h"><Icon name="kanban" size={14} color="var(--wf-fg-muted)" />Задача</div>
            <label className="wpj-checkrow" data-on={s.makesTask || undefined} onClick={() => u('makesTask', !s.makesTask)} style={{ marginBottom: 10 }}>
              <span className="wpj-checkrow-box">{s.makesTask && <Icon name="check" size={11} />}</span>Ця послуга створює задачу виконавцю
            </label>
            <div className="wfc-wiz-hint" style={{ marginTop: 0 }}>// команду, виконавця та регулярність ви оберете, коли додасте послугу в проєкт / абонплату — тут лише вмикаємо саму генерацію.</div>
          </div>

          <div className="wfp-field"><label>Опис</label><textarea className="wfl-select" style={{ height: 56, padding: '8px 10px', resize: 'vertical' }} value={s.desc} onChange={(e) => u('desc', e.target.value)} /></div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// {isNew ? 'нова послуга в каталозі' : (p ? `використовується у ${p.usedIn} абонплатах` : '')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={onClose}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => { window.wfToast && window.wfToast(isNew ? 'Послугу додано · демо' : 'Збережено · демо', 'ok'); onClose(); }}><Icon name="check" size={14} />Зберегти</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WsServiceCatalog, ServiceEditModal });
