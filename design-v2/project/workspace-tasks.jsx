// workspace-tasks.jsx — Block 3b: Workspace task evolution
// - WorkspaceOrderIntake — unassigned new orders (visible to all)
// - WorkspaceOrderDetailV2 — task card with department/estimate/time-entries/spec
// - FloatingTimerBar — overlay shown on every workspace screen when timer is active
// - StopTimerModal — popup on stop with optional comment
// - CloseTaskModal — generate final spec from time entries (with AI rewrite option)

// ──────────────────────────────────────────────────────────────────────
// Department badge
// ──────────────────────────────────────────────────────────────────────
function DeptBadge({ id, short }) {
  const dept = window.WFP_DATA.departments.find((d) => d.id === id);
  if (!dept) return null;
  return (
    <span className="wfp-dept-badge" style={{ '--dept-color': dept.color }}>
      {short ? dept.short : dept.label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Floating timer bar (overlay)
// ──────────────────────────────────────────────────────────────────────
function FloatingTimerBar({ timer }) {
  const t = timer || window.WFP_DATA.active_timer;
  const mins = Math.floor(t.elapsed_seconds / 60);
  const secs = String(t.elapsed_seconds % 60).padStart(2, '0');
  const elapsed = `${String(mins).padStart(2, '0')}:${secs}`;
  return (
    <div className="wfp-tmr-bar">
      <span className="wfp-tmr-pulse" />
      <div className="wfp-tmr-task">
        <span className="wfp-tmr-task-id">{t.task_id} · {t.client}</span>
        <span className="wfp-tmr-task-t">{t.task_title}</span>
      </div>
      <span className="wfp-tmr-elapsed">{elapsed}</span>
      <button className="wfp-tmr-btn" title="Пауза" onClick={() => window.wfToast && window.wfToast('Пауза · демо', 'ok')}><Icon name="bell" size={14} /></button>
      <button className="wfp-tmr-btn wfp-tmr-btn--stop" title="Зупинити" onClick={() => window.wfToast && window.wfToast('Зупинити · демо', 'ok')}><Icon name="check" size={14} /></button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Workspace /orders/:id — task card v2
// ──────────────────────────────────────────────────────────────────────
function WorkspaceOrderDetailV2({ initialTab = 'overview', onBack }) {
  const o = window.WFP_DATA.orders[0];
  const entries = window.WFP_DATA.time_entries_2412;
  const al = window.WFP_DATA.activity;
  const chat = window.WFP_DATA.chat;

  const [tab, setTab] = React.useState(initialTab);
  const [timer, setTimer] = React.useState(false);
  const [stopModal, setStopModal] = React.useState(false);
  const [closeModal, setCloseModal] = React.useState(false);
  const [statusMenu, setStatusMenu] = React.useState(false);
  const ORD_ST = [['estimating', 'Оцінка'], ['in_progress', 'В роботі'], ['review', 'На перевірці'], ['on_hold', 'Призупинено'], ['done', 'Завершено']];
  const [status, setStatus] = React.useState('in_progress');

  const estimatedHours = 56; // 6 weeks × ~9h
  const loggedMinutes = entries.reduce((s, e) => s + e.minutes, 0);
  const loggedHours = (loggedMinutes / 60).toFixed(1);
  const pct = Math.min(100, (loggedMinutes / 60 / estimatedHours) * 100);
  const isOver = pct > 100;

  return (
    <React.Fragment>
      {onBack && (
        <button className="wfp-backbar" onClick={onBack}>
          <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />Усі замовлення
        </button>
      )}
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div className="wfp-order-num" style={{ marginBottom: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{o.num}</span>
          <span style={{ color: 'var(--wf-fg-subtle)' }}>·</span>
          <a className="wfp-link" style={{ color: 'var(--wf-fg-secondary)' }}>Brunky</a>
          <span style={{ color: 'var(--wf-fg-subtle)' }}>·</span>
          <DeptBadge id="automation" />
          <span style={{ color: 'var(--wf-fg-subtle)' }}>·</span>
          <span>створено 22.05.2026</span>
        </div>
        <h1 className="wfp-od-h1">{o.title}</h1>
        <div className="wfp-od-meta">
          <StatusDot status={o.status} />
          <span>·</span>
          <span>дедлайн: <span style={{ color: 'var(--wf-fg)' }}>08.06</span></span>
          <span>·</span>
          <span>оцінка: <span style={{ color: 'var(--wf-fg)' }}>$4 200 · 56h</span></span>
          <span>·</span>
          <span>logged: <span style={{ color: 'var(--wf-accent)' }}>{loggedHours}h</span></span>
        </div>
      </div>

      {/* Top action strip */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`wfp-btn ${timer ? '' : 'wfp-btn--primary'}`} onClick={() => { if (timer) { setStopModal(true); setTimer(false); } else { setTimer(true); window.wfToast && window.wfToast('Таймер запущено', 'ok'); } }}>
          <Icon name={timer ? 'alert' : 'check'} size={13} />{timer ? 'Стоп таймера · 00:47' : 'Старт таймера'}
        </button>
        <button className="wfp-btn" onClick={() => setTab('docs')}>Згенерувати документ</button>
        <button className="wfp-btn" onClick={() => window.__wsNav && window.__wsNav('billing')}>Виставити рахунок</button>
        <div style={{ position: 'relative' }}>
          <button className="wfp-btn" onClick={() => setStatusMenu((v) => !v)}>Змінити статус ▾</button>
          {statusMenu && (
            <React.Fragment>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setStatusMenu(false)} />
              <div className="wfp-menu" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 41, marginTop: 4, minWidth: 180, background: 'var(--wf-surface)', border: '1px solid var(--wf-border)', borderRadius: 9, padding: 5, boxShadow: '0 12px 32px -10px rgba(0,0,0,.3)' }}>
                {ORD_ST.map(([id, l]) => (
                  <button key={id} className="wfp-menu-item" onClick={() => { setStatus(id); setStatusMenu(false); window.wfToast && window.wfToast('Статус → ' + l, 'ok'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: 0, background: status === id ? 'var(--wf-accent-soft)' : 'none', color: 'var(--wf-fg)', font: 'inherit', fontSize: 13, borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                    <StatusDot status={id} />{l}{status === id && <Icon name="check" size={12} style={{ marginLeft: 'auto' }} />}
                  </button>
                ))}
              </div>
            </React.Fragment>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Дії: дублювати · архів · видалити', 'info')}>Дії</button>
          <button className="wfp-btn wfp-btn--primary" onClick={() => setCloseModal(true)}><Icon name="check" size={13} />Закрити задачу</button>
        </div>
      </div>

      {/* Estimate vs Actual bar (always visible) */}
      <div className="wfp-card" style={{ marginBottom: 14, padding: 16 }}>
        <div className="wfp-est-bar-wrap">
          <div className="wfp-est-bar-meta">
            <span className="wfp-est-bar-l">progress · estimate vs actual</span>
            <span className="wfp-est-bar-v">
              <strong>{loggedHours}h</strong> / <span style={{ color: 'var(--wf-fg-muted)' }}>{estimatedHours}h</span>
              <span style={{ color: 'var(--wf-fg-muted)', marginLeft: 8 }}>· {Math.round(pct)}%</span>
            </span>
          </div>
          <div className="wfp-est-bar">
            <div className={`wfp-est-bar-fill${isOver ? ' wfp-est-bar-fill--over' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
            <div className="wfp-est-bar-tick" style={{ left: '80%' }} title="warning at 80%" />
          </div>
          <div className="wfp-est-bar-meta">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>
              // alert при перевищенні +20% (67h) · поточний rate burn: ~3h/день
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>
              залишок: {(estimatedHours - parseFloat(loggedHours)).toFixed(1)}h
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Огляд' },
          { id: 'chat',     label: 'Чат',       badge: chat.length },
          { id: 'time',     label: 'Час',       badge: entries.length },
          { id: 'spec',     label: 'Специфікація', badge: 'draft' },
          { id: 'files',    label: 'Файли',     badge: 4 },
          { id: 'docs',     label: 'Документи', badge: 2 },
          { id: 'activity', label: 'Activity',  badge: al.length },
        ]}
      />

      <div style={{ marginTop: 6 }}>
        {tab === 'overview' && <TaskOverview o={o} entries={entries} />}
        {tab === 'chat'     && <TaskChatTab chat={chat} />}
        {tab === 'time'     && <TaskTimeEntries entries={entries} />}
        {tab === 'spec'     && <TaskSpec />}
        {tab === 'files'    && <TaskFilesTab />}
        {tab === 'docs'     && <TaskDocsTab onNav={() => window.__wsNav && window.__wsNav('dockit')} />}
        {tab === 'activity' && <TaskActivityTab activity={al} />}
      </div>

      {stopModal && <StopTimerModalOverlay onClose={() => setStopModal(false)} />}
      {closeModal && <CloseTaskModalOverlay onClose={() => setCloseModal(false)} />}
    </React.Fragment>
  );
}

// ─── lightweight tab bodies (chat / files / docs / activity) ───
function TaskChatTab({ chat }) {
  return (
    <div style={{ padding: '18px 0', maxWidth: 720 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(chat || []).map((m, i) => {
          const team = m.who !== 'client' && m.who !== 'system';
          if (m.who === 'system') return <div key={i} style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>{m.text}</div>;
          return (
          <div key={i} style={{ display: 'flex', gap: 10, flexDirection: team ? 'row-reverse' : 'row' }}>
            <div style={{ maxWidth: '74%', padding: '10px 13px', borderRadius: 12, background: team ? 'var(--wf-accent-soft)' : 'var(--wf-surface)', border: '1px solid var(--wf-border)' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 3 }}>{m.name || (team ? 'команда' : 'клієнт')} · {m.ts || ''}</div>
              <div style={{ fontSize: 13, color: 'var(--wf-fg)', lineHeight: 1.5 }}>{m.text}</div>
            </div>
          </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input placeholder="Написати повідомлення…" style={{ flex: 1, height: 40, padding: '0 12px', border: '1px solid var(--wf-border)', borderRadius: 9, background: 'var(--wf-bg)', color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} />
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Повідомлення надіслано', 'ok')}><Icon name="send" size={14} />Надіслати</button>
      </div>
    </div>
  );
}
function TaskFilesTab() {
  const files = [
    { name: 'specifications-ord-2412.pdf', size: '198 КБ', kind: 'file' },
    { name: '1c-api-research.md', size: '12 КБ', kind: 'file' },
    { name: 'bot-flow-diagram.png', size: '340 КБ', kind: 'file' },
    { name: 'postman-collection.json', size: '24 КБ', kind: 'file' },
  ];
  return (
    <div style={{ padding: '18px 0', maxWidth: 720 }}>
      <div className="wfp-upload" style={{ marginBottom: 14, padding: '20px', border: '1.5px dashed var(--wf-border)', borderRadius: 11, textAlign: 'center', color: 'var(--wf-fg-muted)', fontSize: 13 }}>
        <Icon name="paperclip" size={18} /> Перетягніть файли сюди або <span className="wfp-link">оберіть з диску</span>
      </div>
      {files.map((f) => (
        <div key={f.name} className="wfp-file-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--wf-border)', borderRadius: 9, marginBottom: 7 }}>
          <Icon name="file" size={16} color="var(--wf-fg-muted)" />
          <span style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
          <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-subtle)' }}>{f.size}</span>
          <button className="wfp-iconbtn" onClick={() => window.wfToast && window.wfToast('Завантаження · демо', 'ok')}><Icon name="download" size={14} /></button>
        </div>
      ))}
    </div>
  );
}
function TaskDocsTab({ onNav }) {
  const docs = [
    { num: 'SPC-2025-0418', label: 'Специфікація', tone: 'ok', st: 'підписано' },
    { num: 'INV-2025-0418', label: 'Рахунок', tone: 'warn', st: 'надіслано' },
  ];
  return (
    <div style={{ padding: '18px 0', maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="wfp-btn wfp-btn--primary" onClick={onNav}><Icon name="plus" size={13} />Сформувати документ</button>
      </div>
      {docs.map((d) => (
        <div key={d.num} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', border: '1px solid var(--wf-border)', borderRadius: 9, marginBottom: 7 }}>
          <Icon name="receipt" size={16} color="var(--wf-fg-muted)" />
          <span className="wf-mono" style={{ fontSize: 12, color: 'var(--wf-accent)' }}>{d.num}</span>
          <span style={{ flex: 1, fontSize: 13 }}>{d.label}</span>
          <span className="wfg-pill2" data-tone={d.tone}><span className="wfg-pill2-dot" />{d.st}</span>
          <button className="wfp-iconbtn" onClick={onNav}><Icon name="external" size={14} /></button>
        </div>
      ))}
    </div>
  );
}
function TaskActivityTab({ activity }) {
  return (
    <div style={{ padding: '18px 0', maxWidth: 680 }}>
      <div className="wfl-tl">
        {(activity || []).map((a, i) => (
          <div key={i} className="wfl-tl-row">
            <span className="wfl-tl-dot" data-kind="stage"><Icon name="chevron" size={10} /></span>
            <div className="wfl-tl-body"><div className="wfl-tl-txt">{a.what}</div><div className="wfl-tl-meta">{a.ts || ''}{a.actor ? ' · ' + a.actor : ''}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Overview tab ───
function TaskOverview({ o, entries }) {
  const teamLogged = {
    illia: entries.filter((e) => e.executor === 'illia' && e.status === 'done').reduce((s, e) => s + e.minutes, 0),
    oleh:  entries.filter((e) => e.executor === 'oleh'  && e.status === 'done').reduce((s, e) => s + e.minutes, 0),
  };
  return (
    <div style={{ padding: '20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      <div className="wfp-card">
        <div className="wfp-card-h"><div className="wfp-card-h-t">Фінанси</div><div className="wfp-card-h-aux">// fixed-price</div></div>
        <div className="wfp-side">
          <div className="wfp-side-row"><div className="wfp-side-k">оцінка</div><div className="wfp-money-big">$4 200</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">оплачено</div><div className="wfp-side-v">$0</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">залишок</div><div className="wfp-side-v wfp-side-v-em">$4 200</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">profit margin</div><div className="wfp-side-v" style={{ color: 'var(--wf-success)' }}>~32%</div></div>
        </div>
      </div>

      <div className="wfp-card">
        <div className="wfp-card-h"><div className="wfp-card-h-t">Команда</div><div className="wfp-card-h-aux">// {Object.keys(teamLogged).length} в задачі</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10, alignItems: 'center' }}>
            <span className="wfp-av wfp-av--illia" style={{ width: 32, height: 32, fontSize: 11 }}>ІВ</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Ілля</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>superadmin · Auto · Dev</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--wf-accent)' }}>{(teamLogged.illia / 60).toFixed(1)}h</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10, alignItems: 'center' }}>
            <span className="wfp-av wfp-av--oleh" style={{ width: 32, height: 32, fontSize: 11 }}>ОШ</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Олег</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>executor · Auto · Dev</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600 }}>{(teamLogged.oleh / 60).toFixed(1)}h</div>
          </div>
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Додати виконавця · демо', 'ok')}><Icon name="plus" size={11} />Додати виконавця</button>
        </div>
      </div>

      <div className="wfp-card">
        <div className="wfp-card-h"><div className="wfp-card-h-t">Activity · топ-5</div><div className="wfp-card-h-aux">// remote → /activity</div></div>
        {window.WFP_DATA.activity.slice(0, 5).map((a, i) => (
          <div key={i} className="wfp-activity-row">
            <span className="wfp-activity-ts">{a.ts}</span>
            <span><span className="wfp-activity-actor">{a.actor}</span> · <span className="wfp-activity-what">{a.what}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Time entries tab ───
function TaskTimeEntries({ entries }) {
  const total = entries.filter((e) => e.status === 'done').reduce((s, e) => s + e.minutes, 0);
  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            // {entries.length} сесій · 1 активна
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            <span className="wfp-mono">{(total / 60).toFixed(1)}h</span>
            <span style={{ color: 'var(--wf-fg-muted)', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>· logged so far · billable</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Експорт CSV · демо', 'ok')}>Експорт CSV</button>
          <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Додати запис вручну · демо', 'ok')}><Icon name="plus" size={11} />Додати запис вручну</button>
        </div>
      </div>

      <div className="wfp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '60px 28px 90px 60px 1fr 28px', gap: 10, padding: '10px 12px', background: 'color-mix(in oklab, var(--wf-fg) 2.5%, transparent)', borderBottom: '1px solid var(--wf-border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>дата</span>
          <span>хто</span>
          <span>сесія</span>
          <span style={{ textAlign: 'right' }}>хв</span>
          <span>коментар · що робилося</span>
          <span></span>
        </div>
        {entries.map((e) => {
          const active = e.status === 'active';
          return (
            <div className="wfp-te-row" data-active={active || undefined} key={e.id}>
              <span className="wfp-te-date">{e.date}</span>
              <span className={`wfp-av wfp-av--${e.executor}`} style={{ width: 22, height: 22, fontSize: 9 }}>{e.executor === 'illia' ? 'ІВ' : 'ОШ'}</span>
              <span className="wfp-te-range" data-active={active || undefined}>{e.start} → {e.end || 'now'}</span>
              <span className="wfp-te-minutes">{e.minutes}m</span>
              <span className={`wfp-te-comment${!e.comment ? ' wfp-te-comment--empty' : ''}`}>
                {e.comment || 'без коментаря (можна додати)'}
              </span>
              <span className="wfp-te-edit"><Icon name="edit" size={12} /></span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, padding: '10px 14px', background: 'color-mix(in oklab, var(--wf-accent) 6%, transparent)', border: '1px dashed color-mix(in oklab, var(--wf-accent) 30%, var(--wf-border))', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--wf-fg)' }}>// чому коментарі важливі</strong><br />
        Записи з коментарями автоматично потраплять у фінальну специфікацію для клієнта (з AI-переписуванням). Сесії без коментарів — порахуються в годинах, але не покажуться у спеці.
      </div>
    </div>
  );
}

// ─── Spec tab — preview/editor of final specification ───
function TaskSpec({ mode = 'preview' }) {
  const spec = window.WFP_DATA.final_spec_2412;
  return (
    <div style={{ padding: '20px 0' }}>
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>// фінальна специфікація</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                v{spec.version} · {spec.status === 'draft' ? 'чернетка' : spec.status} {spec.ai_polished && <span style={{ color: 'var(--wf-accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>· AI ✓</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Редагувати · демо', 'ok')}><Icon name="edit" size={11} />Редагувати</button>
              <button className="wfp-btn wfp-btn--sm" style={{ borderColor: 'var(--wf-accent)', color: 'var(--wf-accent)' }}>
                <Icon name="check" size={11} />AI · переписати для клієнта
              </button>
            </div>
          </div>
          <div className="wfp-spec-md">{spec.content_md}</div>
        </div>

        <aside className="wfp-card" style={{ padding: 18, position: 'sticky', top: 80 }}>
          <div className="wfp-card-h" style={{ marginBottom: 10 }}>
            <div className="wfp-card-h-t">Джерела</div>
            <div className="wfp-card-h-aux">// auto-extracted</div>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
            Згенеровано з <strong style={{ color: 'var(--wf-fg)' }}>4 time-entries</strong> з коментарями.
            Сесії без коментарів пропущено.
            <div style={{ marginTop: 8, padding: 8, background: 'color-mix(in oklab, var(--wf-fg) 3%, transparent)', borderRadius: 4 }}>
              ✓ Discovery · 22.05<br />
              ✓ Розбір API 1С · 23.05<br />
              ✓ Бот MVP · 23.05<br />
              ✓ Архітектура · 24.05<br />
              ✗ 23.05 09:00-09:30 (без коментаря)
            </div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--wf-border)' }}>
            <button className="wfp-btn wfp-btn--primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Надіслати клієнту · демо', 'ok')}>
              <Icon name="send" size={13} />Надіслати клієнту
            </button>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 8, textAlign: 'center' }}>
              // після reviw superadmin → /portal/orders/:id
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Workspace /orders/intake — unassigned new orders queue
// ──────────────────────────────────────────────────────────────────────
function WorkspaceOrderIntake() {
  const intake = window.WFP_DATA.intake_orders;
  return (
    <React.Fragment>
      <PageHeader
        title="Вхідні замовлення"
        subtitle={`// ${intake.length} нових · потрібен assignment · бачать всі executors`}
      >
        <button className="wfp-btn"><Icon name="settings" size={13} />Правила auto-routing</button>
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Заархівувати старе · демо', 'ok')}>Заархівувати старе</button>
      </PageHeader>

      <StatsRow cols={4}>
        <Stat k="нових · 24 години"   v="2" sub="з них 1 high-prior" kind="accent" />
        <Stat k="без assignment"      v={intake.length}  sub="чекають вас" />
        <Stat k="AI вгадав підрозділ" v="4 з 4" sub="≥75% confidence" />
        <Stat k="середній час до старту" v="14 хв" sub="за останній тиждень" />
      </StatsRow>

      <FilterBar search searchPlaceholder="Шукати в інбоксі замовлень…">
        <button className="wfp-pill" data-on="true">всі підрозділи</button>
        <button className="wfp-pill"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0891B2', display: 'inline-block' }} />Dev</button>
        <button className="wfp-pill"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A3D90D', display: 'inline-block' }} />Automation</button>
        <button className="wfp-pill"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D946EF', display: 'inline-block' }} />Design</button>
        <button className="wfp-pill"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />Content</button>
        <span style={{ width: 1, height: 24, background: 'var(--wf-border)', margin: '0 4px' }} />
        <button className="wfp-pill">всі пріоритети</button>
      </FilterBar>

      <div>
        {intake.map((i) => (
          <IntakeRow key={i.num} i={i} />
        ))}
      </div>
    </React.Fragment>
  );
}

function IntakeRow({ i }) {
  const dept = window.WFP_DATA.departments.find((d) => d.id === i.suggested_dept);
  const priorityColors = { high: 'var(--wf-destructive)', normal: 'var(--wf-accent)', low: 'var(--wf-fg-subtle)' };
  return (
    <div className="wfp-intake-row">
      <div className="wfp-intake-num">{i.num}</div>
      <div className="wfp-intake-title">
        <div className="wfp-intake-title-t">{i.title}</div>
        <div className="wfp-intake-title-m">
          <span style={{ color: 'var(--wf-fg)', fontWeight: 500 }}>{i.client}</span>
          <span>·</span>
          <span>{i.created}</span>
          <span>·</span>
          <span style={{ color: priorityColors[i.priority] }}>{i.priority}</span>
          <span>·</span>
          <span>дедлайн {i.deadline}</span>
          <span>·</span>
          <span>~${i.budget.toLocaleString('uk-UA')}</span>
        </div>
        <div className="wfp-intake-title-preview">{i.preview}</div>
      </div>
      <div className="wfp-ai-suggest">
        <span className="wfp-ai-suggest-l">// AI propose</span>
        <span className="wfp-ai-suggest-v"><DeptBadge id={i.suggested_dept} /></span>
        <span className="wfp-ai-suggest-conf">{Math.round(i.ai_confidence * 100)}% confidence</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        <span>створив</span>
        <span style={{ color: 'var(--wf-fg)' }}>{i.created_by.split('@')[0]}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Прийняти в · демо', 'ok')}>Прийняти в {dept.short}</button>
        <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Інший підрозділ ▾</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Stop-timer modal — overlay shown when user stops the active timer
// ──────────────────────────────────────────────────────────────────────
function StopTimerModalOverlay({ onClose }) {
  const t = window.WFP_DATA.active_timer;
  const close = onClose || (() => {});
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) close(); }}>
      <div className="wfp-modal">
        <div className="wfp-modal-h">
          <Icon name="check" size={18} color="var(--wf-success)" />
          <div className="wfp-modal-h-t">Зупинити таймер?</div>
          <div className="wfp-modal-h-aux">{t.task_id} · {t.client}</div>
          <span className="wfp-modal-h-close" onClick={close} style={{ cursor: 'pointer' }}><Icon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} /></span>
        </div>
        <div className="wfp-modal-body">
          <div className="wfp-stop-stat">
            <div>
              <div className="wfp-stop-stat-k">тривалість</div>
              <div className="wfp-stop-stat-v" style={{ color: 'var(--wf-accent)' }}>47:12</div>
            </div>
            <div>
              <div className="wfp-stop-stat-k">старт</div>
              <div className="wfp-stop-stat-v">14:22</div>
            </div>
            <div>
              <div className="wfp-stop-stat-k">сесія</div>
              <div className="wfp-stop-stat-v">#23</div>
            </div>
          </div>
          <div className="wfp-field">
            <label>Що було зроблено · опційно</label>
            <textarea
              className="wfp-no-textarea"
              defaultValue="Розбір API 1С 8.3 БП — знайшов REST через ВЕБ-сервіси (БСП). Тест-запит з Postman пройшов. Завтра — пілотний конектор."
              style={{ minHeight: 90, fontSize: 13 }}
            />
            <div className="wfp-field-hint">
              <span style={{ color: 'var(--wf-accent)', fontFamily: 'JetBrains Mono, monospace' }}>// внутрішній коментар.</span>
              {' '}Йде у time-log, не в спеку клієнта. Спека генерується окремо з усіх коментарів.
            </div>
          </div>
          <div style={{ padding: '10px 14px', background: 'color-mix(in oklab, var(--wf-fg) 2.5%, transparent)', border: '1px solid var(--wf-border)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="alert" size={14} color="var(--wf-warning)" />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-secondary)' }}>
              Idle-detection: <strong style={{ color: 'var(--wf-fg)' }}>не виявлено</strong> · ваш час повний.
            </span>
          </div>
        </div>
        <div className="wfp-modal-foot">
          <div className="wfp-modal-foot-left">// Esc · скасувати · ⌘↵ · зберегти</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={close}>Зберегти без коментаря</button>
            <button className="wfp-btn wfp-btn--primary" onClick={close}><Icon name="check" size={13} />Зберегти з коментарем</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Close-task modal — generate final specification before closing
// ──────────────────────────────────────────────────────────────────────
function CloseTaskModalOverlay({ ai = false, onClose }) {
  const spec = window.WFP_DATA.final_spec_2412;
  const entries = window.WFP_DATA.time_entries_2412;
  const withComments = entries.filter((e) => e.comment && e.status === 'done');
  const without = entries.filter((e) => !e.comment && e.status === 'done');
  const close = onClose || (() => {});
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) close(); }}>
      <div className="wfp-modal wfp-modal--xl">
        <div className="wfp-modal-h">
          <Icon name="check" size={18} color="var(--wf-accent)" />
          <div>
            <div className="wfp-modal-h-t">Закрити задачу · ORD-2412</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>// згенеруйте специфікацію для клієнта</div>
          </div>
          <div className="wfp-modal-h-aux">крок 1 з 2</div>
          <span className="wfp-modal-h-close" onClick={close} style={{ cursor: 'pointer' }}><Icon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} /></span>
        </div>
        <div className="wfp-modal-body">
          {/* Source summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div className="wfp-stop-stat" style={{ display: 'block', padding: '12px 14px' }}>
              <div className="wfp-stop-stat-k">total time</div>
              <div className="wfp-stop-stat-v">{(entries.reduce((s, e) => s + e.minutes, 0) / 60).toFixed(1)}h</div>
            </div>
            <div className="wfp-stop-stat" style={{ display: 'block', padding: '12px 14px' }}>
              <div className="wfp-stop-stat-k">з коментарями</div>
              <div className="wfp-stop-stat-v" style={{ color: 'var(--wf-success)' }}>{withComments.length}</div>
            </div>
            <div className="wfp-stop-stat" style={{ display: 'block', padding: '12px 14px' }}>
              <div className="wfp-stop-stat-k">без коментаря</div>
              <div className="wfp-stop-stat-v" style={{ color: 'var(--wf-warning)' }}>{without.length}</div>
            </div>
            <div className="wfp-stop-stat" style={{ display: 'block', padding: '12px 14px' }}>
              <div className="wfp-stop-stat-k">виконавців</div>
              <div className="wfp-stop-stat-v">2</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)' }}>
              // згенерована специфікація v{spec.version} {ai && <span style={{ color: 'var(--wf-accent)' }}>· AI polished ✓</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!ai && (
                <button className="wfp-btn wfp-btn--sm" style={{ borderColor: 'var(--wf-accent)', color: 'var(--wf-accent)' }}>
                  <Icon name="check" size={11} />AI · переписати для клієнта
                </button>
              )}
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Markdown editor · демо', 'ok')}><Icon name="edit" size={11} />Markdown editor</button>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Регенерувати</button>
            </div>
          </div>

          {/* Spec preview */}
          <div className="wfp-spec-md">{ai ? aiPolished(spec.content_md) : spec.content_md}</div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', border: '1px solid var(--wf-border)', borderRadius: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--wf-fg-secondary)' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: 'var(--wf-accent-bg)' }} />
              <span>Прикріпити акт виконаних робіт (ACT-2025-XXXX, авто-згенерується)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--wf-fg-secondary)' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: 'var(--wf-accent-bg)' }} />
              <span>Запросити підпис клієнта (5 робочих днів на review)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--wf-fg-secondary)' }}>
              <input type="checkbox" style={{ accentColor: 'var(--wf-accent-bg)' }} />
              <span>Цій задачі специфікація не потрібна (маленька правка)</span>
            </label>
          </div>
        </div>
        <div className="wfp-modal-foot">
          <div className="wfp-modal-foot-left">// після відправки → статус задачі: done · review</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={close}>Зберегти як чернетку</button>
            <button className="wfp-btn wfp-btn--primary" onClick={close}><Icon name="send" size={13} />Надіслати клієнту →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stub for AI-polished version of spec
function aiPolished(md) {
  return `# Що ми зробили для вашого проєкту

## Discovery + архітектура
Провели discovery-сесію, щоб зрозуміти ваші процеси з 54 водіями та документообігом у 1С 8.3 БП. На основі цього розробили архітектурне рішення на базі Telegram-бота, проміжного шару (middleware) та конектора до 1С.

## Telegram-бот для водіїв
Створено MVP-версію бота на python-telegram-bot v21:
- реєстрація водія за номером телефону
- здача накладної у форматі "фото + ПІБ + сума"
- базовий admin-канал для перегляду

## Інтеграція з 1С
Налагодили підключення до 1С 8.3 БП через стандартні REST ВЕБ-сервіси (БСП). Реалізовано:
- автоматичне створення документа "Надходження товарів"
- надійна retry-логіка з ідемпотентністю

## Що залишається в наступному релізі
- AI-валідатор фото накладних (vision)
- Веб-адмінка з manual review queue
- Інтеграція ролей disp/accountant/admin`;
}

// ──────────────────────────────────────────────────────────────────────
// Wrapper that adds floating timer to any workspace screen
// ──────────────────────────────────────────────────────────────────────
function WithTimer({ children }) {
  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {children}
      <FloatingTimerBar />
    </div>
  );
}

Object.assign(window, {
  WorkspaceOrderDetailV2,
  WorkspaceOrderIntake,
  FloatingTimerBar,
  StopTimerModalOverlay,
  CloseTaskModalOverlay,
  WithTimer,
  DeptBadge,
});
