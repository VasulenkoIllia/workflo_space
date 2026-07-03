// workspace-support.jsx — G23 · Support (module 29)
// Portal: /support list · /support/new · /support/:id thread.
// Workspace: /support queue · /support/:id with internal notes + actions.

const _s = React.useState;

const TICKETS = [
  { id: 'TK-1042', subject: 'Не приходить рахунок на пошту', client: 'Brunky',     priority: 'high',   status: 'open',     cat: 'Білінг',      assignee: 'illia', sla: 'lt2h',  unread: 2, updated: '14 хв тому', order: null },
  { id: 'TK-1041', subject: 'Як підключити Telegram-сповіщення?', client: 'EduForge', priority: 'normal', status: 'pending', cat: 'Питання',     assignee: 'oleh',  sla: 'ok',    unread: 0, updated: '2 год тому', order: null },
  { id: 'TK-1039', subject: 'Помилка 500 при завантаженні документа', client: 'Tably', priority: 'urgent', status: 'open',    cat: 'Технічне',    assignee: 'illia', sla: 'over',  unread: 1, updated: '40 хв тому', order: 'ORD-2412' },
  { id: 'TK-1036', subject: 'Хочемо додати ще одного користувача',  client: 'NordStream', priority: 'low',  status: 'pending', cat: 'Акаунт',      assignee: null,    sla: 'ok',    unread: 0, updated: 'вчора',     order: null },
  { id: 'TK-1030', subject: 'Дякую за швидку інтеграцію!',          client: 'Florèal',  priority: 'low',    status: 'resolved', cat: 'Інше',       assignee: 'oleh',  sla: 'done',  unread: 0, updated: '3 дні тому', order: null },
  { id: 'TK-1021', subject: 'Повернення коштів за скасоване замовлення', client: 'QuickShip', priority: 'normal', status: 'closed', cat: 'Білінг',  assignee: 'illia', sla: 'done',  unread: 0, updated: 'тиждень',   order: 'ORD-2390' },
];

const TK_STATUS = {
  open:     { label: 'відкрито',  tone: 'bad' },
  pending:  { label: 'чекає клієнта', tone: 'warn' },
  resolved: { label: 'вирішено',  tone: 'ok' },
  closed:   { label: 'закрито',   tone: 'muted' },
};
const TK_PRIO = { urgent: { l: 'терміново', c: 'var(--wf-destructive)' }, high: { l: 'високий', c: 'var(--wf-warning)' }, normal: { l: 'звичайний', c: 'var(--wf-fg-subtle)' }, low: { l: 'низький', c: 'var(--wf-border-strong)' } };
const SLA = {
  over: { label: 'прострочено', tone: 'bad' },
  lt2h: { label: '< 2 год', tone: 'warn' },
  ok:   { label: 'у нормі', tone: 'ok' },
  done: { label: '—', tone: 'muted' },
};

const TK_THREAD = [
  { who: 'client', name: 'Анна (Brunky)', ts: '09:12', text: 'Доброго дня! Замовлення ORD-2412 закрите, а рахунок так і не прийшов на пошту. Можете перевірити?' },
  { who: 'team',   name: 'Ілля',          ts: '09:40', text: 'Вітаю, Анно! Дивлюсь — лист пішов на стару адресу. Зараз перевідправлю на anna@brunky.com.' },
  { who: 'team',   name: 'Олег',          ts: '09:42', text: 'У них в білінгу стоїть billing@brunky.com як отримувач рахунків — треба оновити в картці клієнта.', internal: true },
  { who: 'client', name: 'Анна (Brunky)', ts: '10:05', text: 'Дякую, отримала! Все вірно.' },
];

// ── D1 · Portal support ─────────────────────────────────────────────
function PortalSupport() {
  const [view, setView] = _s({ name: 'list', id: null });
  if (view.name === 'new') return <PortalSupportNew onBack={() => setView({ name: 'list' })} onSent={() => setView({ name: 'thread', id: 'TK-1042' })} />;
  if (view.name === 'thread') return <SupportThread ticketId={view.id} portal onBack={() => setView({ name: 'list' })} />;
  const my = TICKETS.filter((t) => t.client === 'Brunky' || t.status === 'open').slice(0, 4);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Підтримка</h1><div className="wfp-ph-sub">// мої звернення</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => setView({ name: 'new' })}><Icon name="plus" size={14} />Нове звернення</button></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
        {my.map((t) => (
          <div key={t.id} className="wfp-card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', cursor: 'pointer' }} onClick={() => setView({ name: 'thread', id: t.id })}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-subtle)' }}>{t.id}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t.subject}</span>
                {t.unread > 0 && <span className="wfp-sb-item-badge wfp-sb-item-badge--accent" style={{ fontSize: 10 }}>{t.unread}</span>}
              </div>
              <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>{t.cat} · оновлено {t.updated}</div>
            </div>
            <span className="wfg-pill2" data-tone={TK_STATUS[t.status].tone}><span className="wfg-pill2-dot" />{TK_STATUS[t.status].label}</span>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

function PortalSupportNew({ onBack, onSent }) {
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />підтримка</button><h1 className="wfp-ph-h1" style={{ marginTop: 6 }}>Нове звернення</h1></div>
      </div>
      <div className="wfl-panel" style={{ maxWidth: 640 }}>
        <div className="wfl-panel-b" style={{ gap: 16 }}>
          <div className="wfp-field"><label>Тема</label><input placeholder="Коротко опишіть питання" /></div>
          <div className="wfp-field"><label>Категорія</label><select className="wfl-select"><option>Питання</option><option>Технічне</option><option>Білінг</option><option>Акаунт</option><option>Інше</option></select></div>
          <div className="wfp-field"><label>Повідомлення</label><textarea className="wfl-select" style={{ height: 120, padding: '10px 12px', resize: 'vertical' }} placeholder="Опишіть детальніше…" /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="wfp-btn wfp-btn--ghost"><Icon name="paperclip" size={14} />Прикріпити файл</button>
            <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-subtle)' }}>до 10 МБ</span>
          </div>
          <button className="wfp-btn wfp-btn--primary" style={{ alignSelf: 'flex-start' }} onClick={onSent}><Icon name="send" size={14} />Надіслати звернення</button>
        </div>
      </div>
    </React.Fragment>
  );
}

// ── shared thread (portal + workspace) ──────────────────────────────
function SupportThread({ ticketId, portal, onBack }) {
  const tk = TICKETS.find((t) => t.id === ticketId) || TICKETS[0];
  const [status, setStatus] = _s(tk.status);
  const [internal, setInternal] = _s(false);
  const [msgs, setMsgs] = _s(TK_THREAD);
  const [text, setText] = _s('');
  const visible = portal ? msgs.filter((m) => !m.internal) : msgs;

  const send = () => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { who: portal ? 'client' : 'team', name: portal ? 'Анна (Brunky)' : 'Ілля', ts: 'щойно', text: text.trim(), internal: !portal && internal }]);
    setText('');
  };

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />{portal ? 'підтримка' : 'черга'}</button>
          <h1 className="wfp-ph-h1" style={{ marginTop: 6 }}>{tk.subject}</h1>
          <div className="wfp-ph-sub">// {tk.id} · {tk.cat}{tk.order ? ' · ' + tk.order : ''}{!portal ? ' · ' + tk.client : ''}</div>
        </div>
        <div className="wfp-ph-r">
          {!portal && tk.order == null && <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Створити замовлення · демо', 'ok')}><Icon name="kanban" size={14} />Створити замовлення</button>}
          {!portal && tk.order && <button className="wfp-btn"><Icon name="external" size={13} />{tk.order}</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: portal ? '1fr' : '1fr 280px', gap: 24, alignItems: 'start', maxWidth: portal ? 820 : 'none' }}>
        <div>
          {/* status banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, marginBottom: 18, border: '1px solid var(--wf-border)', background: 'var(--wf-subtle)' }}>
            <span className="wfg-pill2" data-tone={TK_STATUS[status].tone}><span className="wfg-pill2-dot" />{TK_STATUS[status].label}</span>
            <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', flex: 1 }}>{portal ? 'команда відповідає зазвичай протягом 2 годин' : 'SLA: ' + SLA[tk.sla].label}</span>
          </div>

          <div className="wfp-chat" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {visible.map((mm, i) => (
              <div key={i} className={`wfp-chat-row${mm.internal ? ' wfp-chat-row--internal' : ''}`} style={mm.internal ? { background: 'color-mix(in oklab, var(--wf-warning) 9%, transparent)', borderLeft: '2px solid var(--wf-warning)', padding: '10px 12px', borderRadius: 8, margin: '4px 0' } : { padding: '10px 0' }}>
                <span className="wfp-chat-ts" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>{mm.ts}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12.5, color: mm.who === 'client' ? 'var(--wf-fg)' : 'var(--wf-accent)' }}>
                  {mm.internal && <Icon name="lock" size={11} color="var(--wf-warning)" />}
                  {mm.name}{mm.internal && <span className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-warning)', fontWeight: 400 }}>· internal</span>}
                </span>
                <div className="wfp-chat-text" style={{ fontSize: 13.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.55, marginTop: 3 }}>{mm.text}</div>
              </div>
            ))}
          </div>

          {/* reply input */}
          <div style={{ marginTop: 16, border: '1px solid var(--wf-border)', borderRadius: 10, padding: 12, background: internal ? 'color-mix(in oklab, var(--wf-warning) 7%, var(--wf-surface))' : 'var(--wf-surface)' }}>
            <textarea className="wfl-select" style={{ height: 64, padding: '8px 10px', resize: 'vertical', marginBottom: 10 }} placeholder={internal ? 'Внутрішня нотатка (клієнт не побачить)…' : 'Відповідь клієнту…'} value={text} onChange={(e) => setText(e.target.value)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!portal && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: internal ? 'var(--wf-warning)' : 'var(--wf-fg-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /><Icon name="lock" size={11} />internal note
                </label>
              )}
              <button className="wfp-iconbtn" title="Файл" style={{ marginLeft: portal ? 0 : 'auto' }}><Icon name="paperclip" size={14} /></button>
              <button className="wfp-btn wfp-btn--primary wfp-btn--sm" style={portal ? { marginLeft: 'auto' } : undefined} onClick={send}><Icon name="send" size={12} />Надіслати</button>
            </div>
          </div>
        </div>

        {/* workspace action panel */}
        {!portal && (
          <div className="wfl-panel">
            <div className="wfl-panel-h">// дії</div>
            <div className="wfl-panel-b">
              <div className="wfl-kv"><span className="wfl-kv-k">Статус</span>
                <select className="wfl-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {Object.keys(TK_STATUS).map((s) => <option key={s} value={s}>{TK_STATUS[s].label}</option>)}
                </select></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Пріоритет</span>
                <select className="wfl-select" defaultValue={tk.priority}>{Object.keys(TK_PRIO).map((p) => <option key={p} value={p}>{TK_PRIO[p].l}</option>)}</select></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Призначено</span>
                <select className="wfl-select" defaultValue={tk.assignee || ''}><option value="">— не призначено —</option><option value="illia">Ілля</option><option value="oleh">Олег</option></select></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Категорія</span>
                <select className="wfl-select" defaultValue={tk.cat}><option>Питання</option><option>Технічне</option><option>Білінг</option><option>Акаунт</option><option>Інше</option></select></div>
              <div className="wfl-kv"><span className="wfl-kv-k">SLA</span><span className="wfg-pill2" data-tone={SLA[tk.sla].tone} style={{ alignSelf: 'flex-start' }}><span className="wfg-pill2-dot" />{SLA[tk.sla].label}</span></div>
              <button className="wfp-btn" style={{ justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Створити замовлення з тікета · демо', 'ok')}><Icon name="kanban" size={13} />Створити замовлення з тікета</button>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

// ── D2 · Workspace queue ────────────────────────────────────────────
function WorkspaceSupport() {
  const [view, setView] = _s({ name: 'queue', id: null });
  const [filter, setFilter] = _s('all');
  if (view.name === 'thread') return <SupportThread ticketId={view.id} onBack={() => setView({ name: 'queue' })} />;

  let rows = TICKETS;
  if (filter === 'open') rows = rows.filter((t) => t.status === 'open');
  if (filter === 'pending') rows = rows.filter((t) => t.status === 'pending');
  if (filter === 'mine') rows = rows.filter((t) => t.assignee === 'illia');
  const openCount = TICKETS.filter((t) => t.status === 'open').length;

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Підтримка</h1><div className="wfp-ph-sub">// черга тікетів · {openCount} відкритих · 1 прострочено SLA</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn"><Icon name="inbox" size={14} />У chat-hub</button><button className="wfp-btn wfp-btn--primary"><Icon name="plus" size={14} />Тікет</button></div>
      </div>

      <div className="wfp-stats">
        <div className="wfp-stat"><div className="wfp-stat-k">відкритих</div><div className="wfp-stat-v wfp-stat-v--danger">{openCount}</div><div className="wfp-stat-sub">потребують відповіді</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">чекають клієнта</div><div className="wfp-stat-v wfp-stat-v--warn">2</div><div className="wfp-stat-sub">pending</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">прострочено SLA</div><div className="wfp-stat-v wfp-stat-v--danger">1</div><div className="wfp-stat-sub">TK-1039</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">avg відповідь</div><div className="wfp-stat-v">1.4 год</div><div className="wfp-stat-sub">за 7 днів</div></div>
      </div>

      <div className="wfp-filters">
        <div className="wfp-search"><Icon name="search" size={14} color="var(--wf-fg-muted)" /><input placeholder="Шукати тікет, клієнта…" /></div>
        <button className="wfp-pill" data-on={filter === 'all' || undefined} onClick={() => setFilter('all')}>усі</button>
        <button className="wfp-pill" data-on={filter === 'open' || undefined} onClick={() => setFilter('open')}>відкриті</button>
        <button className="wfp-pill" data-on={filter === 'pending' || undefined} onClick={() => setFilter('pending')}>чекають</button>
        <button className="wfp-pill" data-on={filter === 'mine' || undefined} onClick={() => setFilter('mine')}>мої</button>
      </div>

      <table className="wfp-table">
        <thead><tr><th></th><th>Тема</th><th>Клієнт</th><th>Категорія</th><th>Пріоритет</th><th>Статус</th><th>SLA</th><th>Призначено</th><th></th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setView({ name: 'thread', id: t.id })}>
              <td><span className="wfg-prio" data-p={t.priority} title={TK_PRIO[t.priority].l} /></td>
              <td><span className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>{t.id}</span><div style={{ fontWeight: 500, marginTop: 2 }}>{t.subject}{t.unread > 0 && <span className="wfp-sb-item-badge wfp-sb-item-badge--accent" style={{ fontSize: 9, marginLeft: 6 }}>{t.unread}</span>}</div></td>
              <td>{t.client}</td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{t.cat}</td>
              <td style={{ color: TK_PRIO[t.priority].c, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }}>{TK_PRIO[t.priority].l}</td>
              <td><span className="wfg-pill2" data-tone={TK_STATUS[t.status].tone}><span className="wfg-pill2-dot" />{TK_STATUS[t.status].label}</span></td>
              <td><span className="wfg-pill2" data-tone={SLA[t.sla].tone}><span className="wfg-pill2-dot" />{SLA[t.sla].label}</span></td>
              <td>{t.assignee ? <AvatarsStack ids={[t.assignee]} /> : <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-subtle)' }}>—</span>}</td>
              <td style={{ textAlign: 'right' }}><Icon name="chev_r" size={14} color="var(--wf-fg-muted)" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

Object.assign(window, { WorkspaceSupport, PortalSupport, SupportThread });
