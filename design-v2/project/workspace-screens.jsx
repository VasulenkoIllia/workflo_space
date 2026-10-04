// workspace-screens.jsx — Workspace: dashboard (3 kanban variants),
// order detail (3-col internal), debtors, company page.

// ─── Workspace Dashboard — owner overview (NOT a kanban; that lives in /board) ───
function WorkspaceDashboard() {
  const B = window.WF_BOARD || {};
  const tasks = B.TASKS || [];
  const role = window.__wsRole || 'owner';
  const go = (id) => window.__wsNav && window.__wsNav(id);
  const statusOf = B.statusOf || (() => 'wip');
  const overdue = tasks.filter((t) => statusOf(t) === 'overdue');
  const inReview = tasks.filter((t) => { const bd = (B.TEAMS || []).find((b) => b.id === t.team); const col = bd && bd.columns.find((c) => c.id === t.col); return col && col.kind === 'review' && !t.done; });
  const unassigned = tasks.filter((t) => !t.done && (!t.assignees || t.assignees.length === 0));
  const autoSub = tasks.filter((t) => (t.type === 'auto' || t.type === 'subscription') && !t.done);
  const ty = (t) => (B.TYPES && B.TYPES[t.type]) || { short: t.type };

  const MiniRow = ({ t }) => {
    const st = statusOf(t);
    return (
      <div className="wfd-mini-row" data-status={st} onClick={() => go('board')}>
        <span className="wfd-mini-id">{t.id}</span>
        <span className="wfd-mini-title">{t.title}</span>
        <span className="wfd-mini-client">{t.client || 'внутр'}</span>
        <span className="wfd-mini-due" data-status={st}>{t.done ? '✓' : (st === 'overdue' ? '⚠ ' : '') + t.due}</span>
        {t.assignees && t.assignees.length > 0
          ? <BoardAvatars ids={t.assignees} />
          : <span className="wfd-mini-noone">?</span>}
      </div>
    );
  };

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Огляд</h1>
          <div className="wfp-ph-sub">// зведення по агенції · {tasks.length} задач у роботі · 7 замовлень · виручка $4 200 за травень</div>
        </div>
        <div className="wfp-ph-r">
          <button className="wfp-btn" onClick={() => go('orders')}><Icon name="kanban" size={14} />Замовлення</button>
          <button className="wfp-btn wfp-btn--primary" onClick={() => go('board')}><Icon name="kanban" size={14} />Дошка задач</button>
        </div>
      </div>

      <div className="wfp-stats">
        <div className="wfp-stat" style={{ cursor: 'pointer' }} onClick={() => go('board')}>
          <div className="wfp-stat-k">задач у роботі</div>
          <div className="wfp-stat-v wfp-stat-v--accent">{tasks.filter((t) => { const s = statusOf(t); return s === 'wip' || s === 'soon'; }).length}</div>
          <div className="wfp-stat-sub">по всіх командах</div>
        </div>
        <div className="wfp-stat" style={{ cursor: 'pointer' }} onClick={() => go('board')}>
          <div className="wfp-stat-k">прострочено</div>
          <div className={`wfp-stat-v${overdue.length ? ' wfp-stat-v--warn' : ''}`}>{overdue.length}</div>
          <div className="wfp-stat-sub">потребують уваги</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">очікують клієнта</div>
          <div className="wfp-stat-v">1</div>
          <div className="wfp-stat-sub">ORD-2410 · Tably</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">виручка · травень</div>
          <div className="wfp-stat-v">$4 200</div>
          <div className="wfp-stat-sub">+18% до квітня</div>
        </div>
      </div>

      {/* task board slices — the dashboard is a window INTO the board, not a second board */}
      <div className="wfd-grid">
        <div className="wfd-panel">
          <div className="wfd-panel-h">
            <span className="wfd-panel-t"><Icon name="alert" size={14} color="var(--wf-destructive)" />Прострочені задачі</span>
            <button className="wfd-panel-link" onClick={() => go('board')}>відкрити дошку →</button>
          </div>
          {overdue.length ? overdue.map((t) => <MiniRow key={t.id} t={t} />) : <div className="wfd-empty">— все вчасно —</div>}
        </div>

        <div className="wfd-panel">
          <div className="wfd-panel-h">
            <span className="wfd-panel-t"><Icon name="check" size={14} color="var(--wf-warning)" />На перевірці / здача</span>
            <button className="wfd-panel-link" onClick={() => go('board')}>відкрити дошку →</button>
          </div>
          {inReview.length ? inReview.map((t) => <MiniRow key={t.id} t={t} />) : <div className="wfd-empty">— порожньо —</div>}
        </div>

        <div className="wfd-panel">
          <div className="wfd-panel-h">
            <span className="wfd-panel-t"><Icon name="users" size={14} color="var(--wf-fg-muted)" />Без виконавця</span>
            <button className="wfd-panel-link" onClick={() => go('board')}>розподілити →</button>
          </div>
          {unassigned.length ? unassigned.map((t) => <MiniRow key={t.id} t={t} />) : <div className="wfd-empty">— всі розподілені —</div>}
        </div>

        <div className="wfd-panel">
          <div className="wfd-panel-h">
            <span className="wfd-panel-t"><Icon name="bell" size={14} color="#A78BFA" />Абонплата · авто</span>
            <button className="wfd-panel-link" onClick={() => go('board')}>відкрити дошку →</button>
          </div>
          {autoSub.length ? autoSub.map((t) => <MiniRow key={t.id} t={t} />) : <div className="wfd-empty">— немає —</div>}
        </div>
      </div>

      {role === 'owner' && (
        <div style={{ marginTop: 24 }}>
          <div className="wfp-card-h">
            <div className="wfp-card-h-t">Фінанси та клієнти</div>
            <div className="wfp-card-h-aux">// action items для owner</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ActionItem icon="receipt" color="var(--wf-warning)" t="Очікують підтвердження оплати" v="2" tag="INV-2025-0418, INV-2025-0414" />
            <ActionItem icon="alert" color="var(--wf-warning)" t="Дебіторів понад 7 днів" v="3" tag="NordStream + Brunky + Tably" />
            <ActionItem icon="building" color="var(--wf-accent)" t="Нових лідів за тиждень" v="6" tag="2 кваліфіковані · 4 в обробці" />
            <ActionItem icon="coins" color="var(--wf-fg-muted)" t="Виплати виконавцям · червень" v="$3.1k" tag="нараховано, очікує підтвердження" />
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

function ActionItem({ icon, color, t, v, tag }) {
  return (
    <div className="wfp-card" style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
      <span style={{ width: 32, height: 32, borderRadius: 6, background: `color-mix(in oklab, ${color} 12%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} />
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{t}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>{tag}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 600, color, fontFeatureSettings: '"tnum"' }}>{v}</span>
        <Icon name="chev_r" size={14} color="var(--wf-fg-muted)" />
      </div>
    </div>
  );
}

// ─── Kanban variant 1: Board ───
function KanbanBoard({ data }) {
  const byCol = {};
  data.cards.forEach((c) => { (byCol[c.col] = byCol[c.col] || []).push(c); });
  return (
    <div className="wfp-kanban">
      {data.columns.map((col) => (
        <div className="wfp-kanban-col" key={col.id}>
          <div className="wfp-kanban-col-h">
            <span className="wfp-kanban-col-t">{col.title}</span>
            <span className="wfp-kanban-col-count">{(byCol[col.id] || []).length}</span>
          </div>
          <div className="wfp-kanban-col-hint">{col.hint}</div>
          {(byCol[col.id] || []).map((card) => (
            <div className="wfp-kc" data-priority={card.priority} key={card.id}>
              <div className="wfp-kc-head">
                <span className="wfp-kc-num">{card.id}</span>
                <span className="wfp-kc-client">{card.client}</span>
              </div>
              <div className="wfp-kc-title">{card.title}</div>
              <div className="wfp-kc-foot">
                <span><AvatarsStack ids={card.assignees} /></span>
                <span className="wfp-kc-meta">
                  <span className={`wfp-kc-deadline${card.overdue ? ' wfp-kc-deadline--over' : ''}`}>{card.overdue ? '⚠ ' : ''}{card.deadline}</span>
                  {card.comments > 0 && <span className="wfp-kc-meta-i">💬 {card.comments}</span>}
                  {card.files > 0 && <span className="wfp-kc-meta-i">📎 {card.files}</span>}
                </span>
              </div>
            </div>
          ))}
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ marginTop: 4, justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Додати · демо', 'ok')}><Icon name="plus" size={12} />Додати</button>
        </div>
      ))}
      <div className="wfp-kanban-done">
        <div className="wfp-kanban-done-k">// готово</div>
        <div className="wfp-kanban-done-v">{data.done_count}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>за весь час</div>
      </div>
    </div>
  );
}

// ─── Kanban variant 2: List (terminal git-log) ───
function KanbanList({ data }) {
  const byCol = {};
  data.cards.forEach((c) => { (byCol[c.col] = byCol[c.col] || []).push(c); });
  const glyph = { high: '●', normal: '◆', low: '○' };
  return (
    <div className="wfp-klist">
      {data.columns.map((col) => {
        const cards = byCol[col.id] || [];
        return (
          <div className="wfp-klist-col" key={col.id}>
            <div className="wfp-klist-col-h">
              <span><span className="wfp-klist-col-h-name">{col.title.toLowerCase()}</span> <span style={{ color: 'var(--wf-fg-subtle)' }}>· {cards.length}</span></span>
              <span>{col.hint}</span>
            </div>
            {cards.length === 0 ? (
              <div style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-subtle)' }}>$ // нічого</div>
            ) : cards.map((c) => (
              <div className="wfp-klist-row" data-priority={c.priority} key={c.id}>
                <span className="wfp-klist-glyph">{glyph[c.priority]}</span>
                <span className="wfp-klist-id">{c.id}</span>
                <span className="wfp-klist-client">{c.client}</span>
                <span className="wfp-klist-title">{c.title}</span>
                <span className={`wfp-klist-deadline${c.overdue ? ' wfp-klist-deadline--over' : ''}`}>{c.overdue ? '⚠ ' : ''}{c.deadline}</span>
                <span className="wfp-klist-meta">
                  <AvatarsStack ids={c.assignees} />
                  {c.comments > 0 && <span>💬{c.comments}</span>}
                </span>
              </div>
            ))}
          </div>
        );
      })}
      <div style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', borderTop: '1px solid var(--wf-border)' }}>
        <span style={{ color: 'var(--wf-accent)' }}>$</span> closed: <strong style={{ color: 'var(--wf-fg)' }}>{data.done_count}</strong> · revenue: <strong style={{ color: 'var(--wf-fg)' }}>$4 200</strong> · avg cycle: <strong style={{ color: 'var(--wf-fg)' }}>11.2 days</strong>
      </div>
    </div>
  );
}

// ─── Kanban variant 3: Timeline / Gantt ───
function KanbanTimeline({ data }) {
  // Lay 28 days starting May 22 → June 18
  const today = 5; // day index for today (~May 27)
  const days = Array.from({ length: 28 }, (_, i) => i);
  const bars = data.cards.map((c, i) => {
    // assign synthetic start/end based on deadline
    const dlMap = { '02.06': 11, '08.06': 17, '12.06': 21, '15.06': 24, '20.06': 28, '28.05': 6, '30.05': 8 };
    const end = dlMap[c.deadline] || (10 + i);
    const start = Math.max(0, end - (4 + (i % 5)));
    const variant = c.col === 'review' ? 'review' : c.col === 'estimating' ? 'est' : c.col === 'inbox' ? 'inbox' : '';
    return { ...c, start, end, variant };
  });
  return (
    <div className="wfp-ktime">
      <div className="wfp-ktime-head">
        <div className="wfp-ktime-head-l">order · client</div>
        <div className="wfp-ktime-head-r">
          {days.map((d) => {
            const day = 22 + d;
            const month = day > 31 ? 6 : 5;
            const dn = day > 31 ? day - 31 : day;
            const isWeekend = ((d + 3) % 7 === 0) || ((d + 3) % 7 === 6); // May 22 = Friday
            const isToday = d === today;
            return (
              <div key={d} className={`wfp-ktime-head-day${isWeekend ? ' wfp-ktime-head-day--week' : ''}${isToday ? ' wfp-ktime-head-day--today' : ''}`}>
                {dn}{dn === 1 ? `/${month}` : ''}
              </div>
            );
          })}
        </div>
      </div>
      {bars.map((b) => (
        <div className="wfp-ktime-row" key={b.id}>
          <div className="wfp-ktime-row-l">
            <div className="wfp-ktime-row-id">{b.id} · <span style={{ color: 'var(--wf-fg)' }}>{b.client}</span></div>
            <div className="wfp-ktime-row-title">{b.title}</div>
          </div>
          <div className="wfp-ktime-bar-track">
            {days.map((d) => <div key={d} />)}
            <div
              className={`wfp-ktime-bar${b.variant ? ' wfp-ktime-bar--' + b.variant : ''}`}
              style={{ left: `${(b.start / 28) * 100}%`, width: `${((b.end - b.start) / 28) * 100}%` }}
            >
              {b.title.slice(0, 30)}{b.assignees.length ? ` · ${b.assignees[0]}` : ''}
            </div>
            <div className="wfp-ktime-today" style={{ left: `${((today + 0.5) / 28) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Workspace /orders/:id — 3-column internal view ───
function WorkspaceOrderDetail() {
  const o = window.WFP_DATA.orders[0];
  const tl = window.WFP_DATA.timelog;
  const al = window.WFP_DATA.activity;
  const chat = window.WFP_DATA.chat;

  // Add a hypothetical internal note for variety
  const chatWithInternal = [
    ...chat.slice(0, 5),
    { ts: '23.05 09:00', who: 'illia', name: 'Ілля', text: '@oleh глянь чи їхня версія 1С 8.3 БП підтримує REST через ВЕБ-сервіси. Якщо ні — пропоную проксі через 1С:Підприємство EDT.', internal: true },
    { ts: '23.05 09:08', who: 'oleh',  name: 'Олег', text: 'Підтримує. У них вже стоїть БСП. Можна одразу REST.', internal: true },
    ...chat.slice(5),
  ];

  return (
    <React.Fragment>
      <div className="wfp-od-header">
        <div>
          <div className="wfp-order-num" style={{ marginBottom: 6 }}>
            {o.num} · <a className="wfp-link" style={{ color: 'var(--wf-fg-secondary)' }}>Brunky</a> · створено 22.05.2026
          </div>
          <h1 className="wfp-od-h1">{o.title}</h1>
          <div className="wfp-od-meta">
            <StatusDot status={o.status} />
            <span>·</span>
            <span>дедлайн: <span style={{ color: 'var(--wf-fg)' }}>08.06</span></span>
            <span>·</span>
            <span>оцінка: <span style={{ color: 'var(--wf-fg)' }}>$4 200</span></span>
            <span>·</span>
            <span>лог: 8.5 год</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Дії · демо', 'ok')}>Дії</button>
          <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Згенерувати документ · демо', 'ok')}>Згенерувати документ</button>
          <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Змінити статус · демо', 'ok')}>Змінити статус</button>
        </div>
      </div>

      <div className="wfp-wod">
        {/* Left — Details + Actions + Timelog */}
        <aside>
          <div className="wfp-wod-sec">
            <div className="wfp-wod-sec-h">// клієнт</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
              <WfAvatar kind="food" size="sm" shape="circle" />
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>Brunky</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>tier: partner · 8 orders</div>
              </div>
            </div>
          </div>

          <div className="wfp-wod-sec">
            <div className="wfp-wod-sec-h">// фінанси</div>
            <div className="wfp-side-row"><div className="wfp-side-k">оцінка</div>     <div className="wfp-side-v wfp-side-v-em">$4 200</div></div>
            <div className="wfp-side-row"><div className="wfp-side-k">оплачено</div>   <div className="wfp-side-v">$0</div></div>
            <div className="wfp-side-row"><div className="wfp-side-k">залишок</div>    <div className="wfp-side-v" style={{ color: 'var(--wf-warning)' }}>$4 200</div></div>
            <div className="wfp-side-row"><div className="wfp-side-k">тип</div>        <div className="wfp-side-v">fixed</div></div>
          </div>

          <div className="wfp-wod-sec">
            <div className="wfp-wod-sec-h">// виконавці</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid var(--wf-border)', borderRadius: 999, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}><span className="wfp-av wfp-av--illia" style={{ width: 16, height: 16, fontSize: 9 }}>ІВ</span>Ілля</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid var(--wf-border)', borderRadius: 999, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}><span className="wfp-av wfp-av--oleh" style={{ width: 16, height: 16, fontSize: 9 }}>ОШ</span>Олег</span>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Додати · демо', 'ok')}><Icon name="plus" size={11} />Додати</button>
            </div>
          </div>

          <div className="wfp-wod-sec">
            <div className="wfp-wod-sec-h">// тайм-лог · 8.5 год</div>
            {tl.map((t, i) => (
              <div key={i} className="wfp-timelog-row">
                <span className="wfp-timelog-date">{t.date}</span>
                <span className={`wfp-av wfp-av--${t.who}`} style={{ width: 18, height: 18, fontSize: 9 }}>{t.who === 'illia' ? 'ІВ' : t.who === 'oleh' ? 'ОШ' : t.who[0].toUpperCase()}</span>
                <span className="wfp-timelog-hrs">{t.hours}h</span>
                <span className="wfp-timelog-desc">{t.desc}</span>
              </div>
            ))}
            <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ marginTop: 8 }} onClick={() => window.wfToast && window.wfToast('Додати час · демо', 'ok')}><Icon name="plus" size={11} />Додати час</button>
          </div>

          <div className="wfp-wod-sec">
            <div className="wfp-wod-sec-h">// активність</div>
            {al.slice(0, 5).map((a, i) => (
              <div key={i} className="wfp-activity-row">
                <span className="wfp-activity-ts">{a.ts}</span>
                <span><span className="wfp-activity-actor">{a.actor}</span> · <span className="wfp-activity-what">{a.what}</span></span>
              </div>
            ))}
          </div>
        </aside>

        {/* Center — chat with internal notes */}
        <div>
          <div className="wfp-od-tabs">
            <div className="wfp-od-tab" data-on="true">Усі повідомлення</div>
            <div className="wfp-od-tab">Тільки внутрішні <span className="wfp-od-tab-badge">2</span></div>
            <div className="wfp-od-tab" style={{ marginLeft: 'auto' }}><label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" /> mention all</label></div>
          </div>
          <div className="wfp-chat" style={{ maxHeight: 620 }}>
            {chatWithInternal.map((m, i) => (
              <div key={i} className={`wfp-chat-row${m.who === 'system' ? ' wfp-chat-row--system' : ''}${m.internal ? ' wfp-chat-row--internal' : ''}`}>
                <span className="wfp-chat-ts">{m.ts}</span>
                <ChatWho who={m.who} label={m.who === 'system' ? 'system' : (m.who === 'client' ? 'client' : m.who)} />
                <div className="wfp-chat-text">
                  {m.text}
                  {m.attach && (
                    <div className="wfp-chat-attach">
                      <Icon name="paperclip" size={12} />
                      <span>{m.attach.name}</span>
                      <span className="wfp-chat-attach-size">· {m.attach.size}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="wfp-chat-input">
              <span className="wfp-chat-input-ts">24.05 17:42</span>
              <span className="wfp-chat-input-who">illia</span>
              <input className="wfp-chat-input-field" placeholder="@mention підтримується... markdown ok" />
              <div className="wfp-chat-input-actions">
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--wf-warning)', fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer' }}>
                  <input type="checkbox" /> 🔒 internal
                </label>
                <button className="wfp-iconbtn" title="Файл"><Icon name="paperclip" size={14} /></button>
                <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Send · демо', 'ok')}><Icon name="send" size={12} />Send</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Files + Documents */}
        <aside>
          <div className="wfp-wod-sec">
            <div className="wfp-wod-sec-h">// файли · 4</div>
            <div className="wfp-docs">
              <DocRow ext="PDF" name="brief-questions.pdf" sub="24 КБ · illia · 22.05" />
              <DocRow ext="PDF" name="answers-2025-05-22.pdf" sub="88 КБ · client · 22.05" />
              <DocRow ext="XLS" name="drivers-list-v2.xlsx" sub="36 КБ · client · 23.05" />
              <DocRow ext="PNG" name="1c-schema-sketch.png" sub="184 КБ · illia · 24.05" />
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ marginTop: 4, justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Завантажити · демо', 'ok')}><Icon name="plus" size={11} />Завантажити</button>
            </div>
          </div>

          <div className="wfp-wod-sec">
            <div className="wfp-wod-sec-h">// документи · 1</div>
            <div className="wfp-docs">
              <DocRow ext="DOC" name="spec-ord-2412.pdf" sub="specification · sent · 23.05" />
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ marginTop: 4, justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Згенерувати · демо', 'ok')}><Icon name="plus" size={11} />Згенерувати</button>
            </div>
            <div style={{ marginTop: 14, padding: '8px 10px', background: 'color-mix(in oklab, var(--wf-accent) 8%, transparent)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-secondary)' }}>
              // після клієнтського approval auto-create invoice
            </div>
          </div>
        </aside>
      </div>
    </React.Fragment>
  );
}

function DocRow({ ext, name, sub }) {
  return (
    <div className="wfp-doc-row">
      <div className="wfp-doc-icon">{ext}</div>
      <div className="wfp-doc-meta">
        <div className="wfp-doc-name">{name}</div>
        <div className="wfp-doc-sub">{sub}</div>
      </div>
      <Icon name="download" size={14} color="var(--wf-fg-muted)" />
    </div>
  );
}

// ─── Workspace /billing/debtors ───
function WorkspaceDebtors() {
  const debtors = window.WFP_DATA.debtors;
  const total_usd = debtors.reduce((s, d) => s + d.debt_usd, 0);
  const total_uah = debtors.reduce((s, d) => s + d.debt_uah, 0);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Дебітори</h1>
          <div className="wfp-ph-sub">// компанії з непогашеним боргом · {debtors.length} активних</div>
        </div>
        <div className="wfp-ph-r">
          <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт CSV · демо', 'ok')}>Експорт CSV</button>
          <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Масове нагадування · демо', 'ok')}>Масове нагадування</button>
        </div>
      </div>

      <div className="wfp-stats">
        <div className="wfp-stat">
          <div className="wfp-stat-k">загальний борг</div>
          <div className="wfp-stat-v wfp-stat-v--warn">${total_usd.toLocaleString('uk-UA')}</div>
          <div className="wfp-stat-sub">≈ ₴{total_uah.toLocaleString('uk-UA')}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">прострочено > 30 дн</div>
          <div className="wfp-stat-v wfp-stat-v--danger">$2 200</div>
          <div className="wfp-stat-sub">1 компанія</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">avg age</div>
          <div className="wfp-stat-v">15 дн</div>
          <div className="wfp-stat-sub">медіана: 11</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">collected this month</div>
          <div className="wfp-stat-v wfp-stat-v--accent">$8 700</div>
          <div className="wfp-stat-sub">5 платежів</div>
        </div>
      </div>

      <div className="wfp-filters">
        <div className="wfp-search">
          <Icon name="search" size={14} color="var(--wf-fg-muted)" />
          <input placeholder="Шукати компанію…" />
        </div>
        <button className="wfp-pill" data-on="true">всі</button>
        <button className="wfp-pill">свіжі</button>
        <button className="wfp-pill">нагадування</button>
        <button className="wfp-pill">прострочено</button>
      </div>

      <table className="wfp-table">
        <thead>
          <tr>
            <th>Компанія</th>
            <th>Статус</th>
            <th className="wfp-num">Борг $</th>
            <th className="wfp-num">Борг ₴</th>
            <th>Найстаріший</th>
            <th className="wfp-num">Вік</th>
            <th className="wfp-num">Прострочено</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {debtors.map((d) => (
            <tr key={d.company}>
              <td><span className="wfp-link" style={{ fontWeight: 500 }}>{d.company}</span></td>
              <td>
                <span className={`wfp-debt-pill wfp-debt-pill--${d.status}`}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                  {d.status === 'fresh' ? 'свіжий' : d.status === 'warning' ? 'нагадування' : 'прострочено'}
                </span>
              </td>
              <td className="wfp-num">${d.debt_usd.toLocaleString('uk-UA')}</td>
              <td className="wfp-num" style={{ color: 'var(--wf-fg-muted)' }}>₴{d.debt_uah.toLocaleString('uk-UA')}</td>
              <td className="wfp-mono"><span className="wfp-link">{d.oldest_inv}</span></td>
              <td className="wfp-num">{d.age_days} дн</td>
              <td className="wfp-num">{d.overdue_count}</td>
              <td>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Профіль · демо', 'ok')}>Профіль</button>
                  <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Нагадати · демо', 'ok')}>Нагадати</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ─── Workspace /companies/:id ───
function WorkspaceCompany() {
  const co = window.WFP_DATA.companies[0]; // Brunky
  const orders = window.WFP_DATA.orders.slice(0, 4);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">// клієнти / Brunky</div>
        </div>
      </div>

      <div className="wfp-co-hero">
        <div>
          <h1 className="wfp-co-name">{co.name}</h1>
          <span className="wfp-co-tier"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> tier · {co.tier}</span>
          <div className="wfp-co-meta">{co.industry} · клієнт з квітня 2025 · 3 учасники</div>
          <div className="wfp-co-actions">
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Створити замовлення · демо', 'ok')}><Icon name="plus" size={14} />Створити замовлення</button>
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Згенерувати акт звірки · демо', 'ok')}>Згенерувати акт звірки</button>
            <button className="wfp-btn wfp-btn--ghost" onClick={() => window.wfToast && window.wfToast('Контакти · демо', 'ok')}>Контакти</button>
          </div>
        </div>
        <div className="wfp-co-stats">
          <div className="wfp-co-stat"><div className="wfp-co-stat-k">всього замовлень</div><div className="wfp-co-stat-v">{co.orders}</div></div>
          <div className="wfp-co-stat"><div className="wfp-co-stat-k">виручка</div><div className="wfp-co-stat-v">${co.revenue_usd.toLocaleString('uk-UA')}</div></div>
          <div className="wfp-co-stat"><div className="wfp-co-stat-k">активних</div><div className="wfp-co-stat-v" style={{ color: 'var(--wf-accent)' }}>{co.active}</div></div>
          <div className="wfp-co-stat"><div className="wfp-co-stat-k">борг</div><div className="wfp-co-stat-v" style={{ color: 'var(--wf-warning)' }}>${co.debt}</div></div>
        </div>
      </div>

      <div className="wfp-od-tabs">
        <div className="wfp-od-tab" data-on="true">Замовлення <span className="wfp-od-tab-badge">{co.orders}</span></div>
        <div className="wfp-od-tab">Платежі <span className="wfp-od-tab-badge">14</span></div>
        <div className="wfp-od-tab">Документи <span className="wfp-od-tab-badge">22</span></div>
        <div className="wfp-od-tab">Лояльність</div>
        <div className="wfp-od-tab">Реферали</div>
        <div className="wfp-od-tab">Члени</div>
        <div className="wfp-od-tab">Нотатки</div>
      </div>

      <table className="wfp-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Назва</th>
            <th>Статус</th>
            <th>Виконавці</th>
            <th>Дедлайн</th>
            <th className="wfp-num">Сума</th>
            <th className="wfp-num">Оплачено</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.num}>
              <td className="wfp-mono"><span className="wfp-link">{o.num}</span></td>
              <td>{o.title}</td>
              <td><StatusDot status={o.status} /></td>
              <td><AvatarsStack ids={o.assignees} /></td>
              <td className="wfp-mono">{o.deadline.split('-').reverse().join('.')}</td>
              <td className="wfp-num">${o.total.toLocaleString('uk-UA')}</td>
              <td className="wfp-num" style={{ color: o.paid === o.total ? 'var(--wf-success)' : 'var(--wf-fg-muted)' }}>${o.paid.toLocaleString('uk-UA')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

Object.assign(window, { WorkspaceDashboard, WorkspaceOrderDetail, WorkspaceDebtors, WorkspaceCompany, KanbanBoard, KanbanList, KanbanTimeline });
