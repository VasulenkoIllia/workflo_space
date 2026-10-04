// workspace-orders-list.jsx — cross-order filtered list (module 02, §02.1 gap).
// `/orders` = повний фільтрований реєстр замовлень агенції (НЕ канбан — той у /board).
// Рядок → деталь (WorkspaceOrderDetailV2). Статуси: 9 internal → бейдж; теги; SLA.

const _ol = React.useState;

// 9 internal статусів (канон ТЗ) з тонами
const ORD_STATUS = {
  new:          { label: 'Нове',         tone: 'accent' },
  clarification:{ label: 'Уточнення',    tone: 'warn' },
  estimating:   { label: 'Оцінка',       tone: 'accent' },
  in_progress:  { label: 'В роботі',     tone: 'info' },
  on_hold:      { label: 'Призупинено',  tone: 'muted' },
  review:       { label: 'На перевірці', tone: 'warn' },
  revision:     { label: 'Правки',       tone: 'warn' },
  done:         { label: 'Завершено',    tone: 'ok' },
  cancelled:    { label: 'Скасовано',    tone: 'muted' },
};
// канбан-колонка → канонічний статус
const COL_TO_STATUS = { inbox: 'new', estimating: 'estimating', doing: 'in_progress', review: 'review' };
const WFO_SLA = {
  breached: { label: 'SLA breached', tone: 'danger' },
  warn:     { label: 'SLA warn',     tone: 'warn' },
  normal:   { label: 'SLA ok',       tone: 'ok' },
};
// синтетичні теги по замовленнях (демо)
const ORD_TAGS = {
  'ORD-2412': ['integration', 'priority'],
  'ORD-2415': ['backend'],
  'ORD-2414': ['parser'],
  'ORD-2411': ['parser'],
  'ORD-2413': ['automation'],
  'ORD-2410': ['crm', 'overdue'],
  'ORD-2409': ['ai', 'priority'],
};

function ordersModel() {
  const k = window.WFP_DATA.kanban;
  return k.cards.map((c) => {
    const status = COL_TO_STATUS[c.col] || 'in_progress';
    const sla = c.overdue ? 'breached' : (c.priority === 'high' && c.assignees.length === 0 ? 'warn' : 'normal');
    return {
      id: c.id, title: c.title, client: c.client, status,
      assignees: c.assignees, deadline: c.deadline, overdue: !!c.overdue,
      priority: c.priority, comments: c.comments, files: c.files,
      tags: ORD_TAGS[c.id] || [], sla,
    };
  });
}

function WorkspaceOrders() {
  const [sel, setSel] = _ol(null);
  if (sel) return <WorkspaceOrderDetailV2 initialTab="overview" onBack={() => setSel(null)} />;
  return <WorkspaceOrdersList onOpen={(id) => setSel(id)} />;
}

function WorkspaceOrdersList({ onOpen }) {
  const role = window.__wsRole || 'owner';
  const orders = ordersModel();
  const people = window.WFP_DATA.team || [];
  const [status, setStatus] = _ol('all');
  const [client, setClient] = _ol('all');
  const [exec, setExec] = _ol('all');
  const [q, setQ] = _ol('');
  const [bulk, setBulk] = _ol(false);
  const [sel, setSel] = _ol([]);
  const toggle = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const clients = [...new Set(orders.map((o) => o.client))];
  const pass = (o) =>
    (status === 'all' || o.status === status) &&
    (client === 'all' || o.client === client) &&
    (exec === 'all' || (exec === '__none' ? o.assignees.length === 0 : o.assignees.includes(exec))) &&
    (q === '' || (o.id + ' ' + o.title + ' ' + o.client).toLowerCase().includes(q.toLowerCase()));
  const rows = orders.filter(pass);

  const cnt = (s) => orders.filter((o) => o.status === s).length;
  const overdue = orders.filter((o) => o.overdue).length;
  const unassigned = orders.filter((o) => o.assignees.length === 0).length;

  const avatarName = (id) => (people.find((p) => p.id === id) || {}).name || id;

  return (
    <React.Fragment>
      <PageHeader title="Замовлення" subtitle="// повний реєстр замовлень агенції · фільтри по статусу, клієнту, виконавцю">
        <button className="wfp-btn" data-on={bulk || undefined} onClick={() => { setBulk(!bulk); setSel([]); }}><Icon name="check" size={13} />{bulk ? 'Готово' : 'Вибір'}</button>
        <button className="wfp-btn" onClick={() => window.__wsNav && window.__wsNav('board')}><Icon name="kanban" size={13} />На дошку</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Нове замовлення · демо', 'ok')}><Icon name="plus" size={13} />Нове замовлення</button>
      </PageHeader>

      <StatsRow>
        <Stat k="всього замовлень" v={orders.length} sub="активних" />
        <Stat k="в роботі" v={cnt('in_progress')} sub="виконується" kind="accent" />
        <Stat k="прострочено" v={overdue} sub={overdue ? 'SLA breached' : 'усе вчасно'} kind={overdue ? 'danger' : undefined} />
        <Stat k="без виконавця" v={unassigned} sub="потребують розподілу" kind="warn" />
      </StatsRow>

      {/* filters */}
      <div className="wfo-filters">
        <div className="wfo-search">
          <Icon name="search" size={14} color="var(--wf-fg-muted)" />
          <input placeholder="Шукати: номер, назва, клієнт…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="wfb-sel"><span>статус</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">усі</option>
            {Object.entries(ORD_STATUS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
        </label>
        <label className="wfb-sel"><span>клієнт</span>
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="all">усі</option>
            {clients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="wfb-sel"><span>виконавець</span>
          <select value={exec} onChange={(e) => setExec(e.target.value)}>
            <option value="all">усі</option>
            <option value="__none">без виконавця</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name.split(' ')[0]}</option>)}
          </select>
        </label>
      </div>

      {bulk && (
        <div className="wfd-bulkbar">
          <label className="wfd-bulk-all">
            <input type="checkbox" checked={sel.length === rows.length && rows.length > 0} onChange={() => setSel(sel.length === rows.length ? [] : rows.map((o) => o.id))} />
            обрати всі ({rows.length})
          </label>
          <span className="wfd-bulk-cnt">{sel.length} обрано</span>
          <div style={{ flex: 1 }} />
          <button className="wfp-btn wfp-btn--sm" disabled={!sel.length} onClick={() => window.wfToast && window.wfToast('Призначити · демо', 'ok')}><Icon name="users" size={12} />Призначити</button>
          <button className="wfp-btn wfp-btn--sm" disabled={!sel.length} onClick={() => window.wfToast && window.wfToast('Змінити статус · демо', 'ok')}><Icon name="chevron" size={12} />Змінити статус</button>
          <button className="wfp-btn wfp-btn--sm" disabled={!sel.length} onClick={() => window.wfToast && window.wfToast('Експорт CSV · демо', 'ok')}><Icon name="download" size={12} />Експорт CSV</button>
        </div>
      )}

      <table className="wfp-table wfo-table">
        <thead>
          <tr>
            {bulk && <th style={{ width: 36 }}></th>}
            <th>Замовлення</th><th>Клієнт</th><th>Статус</th><th>Теги</th><th>SLA</th><th>Виконавці</th><th>Дедлайн</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const st = ORD_STATUS[o.status] || { label: o.status, tone: 'muted' };
            const sla = WFO_SLA[o.sla] || WFO_SLA.normal;
            return (
              <tr key={o.id} className="wfo-row" data-sel={bulk && sel.includes(o.id) || undefined} onClick={() => bulk ? toggle(o.id) : onOpen(o.id)}>
                {bulk && <td><input type="checkbox" checked={sel.includes(o.id)} onChange={() => toggle(o.id)} onClick={(e) => e.stopPropagation()} /></td>}
                <td>
                  <div className="wfo-id">{o.id}{o.priority === 'high' && <span className="wfo-prio" title="високий пріоритет" />}</div>
                  <div className="wfo-title">{o.title}</div>
                </td>
                <td><span className="wfo-client">{o.client}</span></td>
                <td><span className="wfg-pill2" data-tone={st.tone}><span className="wfg-pill2-dot" />{st.label}</span></td>
                <td>
                  <span className="wfo-tags">
                    {o.tags.length ? o.tags.map((t) => <span key={t} className="wfo-tag">{t}</span>) : <span className="wfo-tag-empty">—</span>}
                  </span>
                </td>
                <td><span className="wfg-pill2" data-tone={sla.tone}><span className="wfg-pill2-dot" />{sla.label}</span></td>
                <td>{o.assignees.length ? <AvatarsStack ids={o.assignees} /> : <span className="wfo-noone">не призначено</span>}</td>
                <td><span className={`wfo-due${o.overdue ? ' wfo-due--over' : ''}`}>{o.overdue ? '⚠ ' : ''}{o.deadline}</span></td>
                <td><Icon name="chevron" size={14} color="var(--wf-fg-muted)" /></td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={bulk ? 9 : 8} className="wfo-empty">// нічого не знайдено за фільтрами</td></tr>
          )}
        </tbody>
      </table>
      <div className="wfo-foot">// {rows.length} з {orders.length} замовлень · клік по рядку → деталь замовлення</div>
    </React.Fragment>
  );
}

Object.assign(window, { WorkspaceOrders, WorkspaceOrdersList });
