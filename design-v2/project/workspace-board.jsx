// workspace-board.jsx — головна дошка задач команди (module 02/12).
// Єдиний потік: клієнтські · внутрішні · абонплата · авто. Командні дошки з
// власними статусами (перша = Вхідні/розподіл, остання = На перевірці/здача).
// Фільтри: команда(дошка) · виконавець · клієнт · тип. Рольові зрізи + DnD.

const _b = React.useState;
const CURRENT_EXEC = 'oleh'; // демо «я» для ролі executor

// ── міні-аватар виконавця ──
function BoardAvatar({ id, size = 22 }) {
  const p = (window.WF_BOARD.PEOPLE || {})[id];
  if (!p) return null;
  const init = p.short.split(' ').map((s) => s[0]).join('').slice(0, 2);
  return (
    <span title={p.name} style={{ width: size, height: size, borderRadius: '50%', background: p.color, color: '#0A0A0A', fontSize: Math.round(size * 0.42), fontWeight: 700, display: 'inline-grid', placeItems: 'center', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0, border: '1.5px solid var(--wf-surface)', marginLeft: -6 }}>{init}</span>
  );
}
function BoardAvatars({ ids }) {
  if (!ids || !ids.length) return <span className="wfb-unassigned" title="не призначено">?</span>;
  const top = ids.slice(0, 3);
  const more = ids.length - top.length;
  return (
    <span style={{ display: 'inline-flex', paddingLeft: 6 }}>
      {top.map((id) => <BoardAvatar key={id} id={id} />)}
      {more > 0 && <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--wf-subtle)', color: 'var(--wf-fg-muted)', fontSize: 9, fontWeight: 700, display: 'inline-grid', placeItems: 'center', marginLeft: -6, border: '1.5px solid var(--wf-surface)' }}>+{more}</span>}
    </span>
  );
}

// ── картка задачі ──
function BoardCard({ t, draggable, dragId, onDragStart, onDragEnd, onOpen }) {
  const B = window.WF_BOARD;
  const ty = B.TYPES[t.type];
  const st = B.statusOf(t);
  const dueLabel = t.done ? 'здано' : st === 'overdue' ? 'протерм · ' + t.due : t.due;
  return (
    <div className="wfb-card" data-status={st} data-dragging={dragId === t.id || undefined}
      draggable={draggable} onClick={() => onOpen && onOpen(t)}
      onDragStart={(e) => onDragStart && onDragStart(e, t)} onDragEnd={onDragEnd}>
      <div className="wfb-card-top">
        <span className="wfb-type" data-type={t.type}><span className="wfb-type-dot" />{ty.short}</span>
        {t.auto && <span className="wfb-auto" title="авто-задача"><Icon name="bell" size={11} /></span>}
        {t.prio === 'high' && <span className="wfb-prio" title="високий пріоритет" />}
        <span className="wfb-id">{t.id}</span>
      </div>
      <div className="wfb-card-title">{t.title}</div>
      <div className="wfb-card-meta">
        {t.client
          ? <span className="wfb-chip"><Icon name="building" size={10} />{t.client}</span>
          : <span className="wfb-chip wfb-chip--int"><Icon name="home" size={10} />внутрішня</span>}
        {t.order && <span className="wfb-order">{t.order}</span>}
        {t.recur && <span className="wfb-recur" title="повторювана"><Icon name="bell" size={10} />{t.recur}</span>}
      </div>
      <div className="wfb-card-foot">
        <span className="wfb-due" data-status={st}>
          {t.done ? <Icon name="check" size={11} /> : <Icon name="calendar" size={11} />}{dueLabel}
        </span>
        <BoardAvatars ids={t.assignees} />
      </div>
    </div>
  );
}

function WorkspaceBoard() {
  const B = window.WF_BOARD;
  const role = window.__wsRole || 'owner';
  const isExec = role === 'executor';
  const canConfig = role === 'owner' || role === 'manager';

  const [boards, setBoards] = _b(() => JSON.parse(JSON.stringify(B.TEAMS)));
  const [tasks, setTasks] = _b(() => JSON.parse(JSON.stringify(B.TASKS)));
  const [view, setView] = _b('board'); // board | list | time
  const [board, setBoard] = _b(isExec ? 'all' : 'dev');
  const [exec, setExec] = _b('all');
  const [client, setClient] = _b('all');
  const [type, setType] = _b('all');
  const [me, setMe] = _b(isExec);
  const [dragId, setDragId] = _b(null);
  const [settings, setSettings] = _b(false);
  const [add, setAdd] = _b(false);
  const [openTask, setOpenTask] = _b(null);

  const moveTask = (id, colId) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, col: colId, done: colId === 'review' ? true : t.done } : t));
  const assignTask = (id, assignees) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, assignees } : t));

  const activeBoard = boards.find((bd) => bd.id === board) || boards[0];
  const aggregate = !!activeBoard.aggregate;
  const effExec = me ? CURRENT_EXEC : exec;

  // kind of a task's own column (for the aggregate "Усі" view)
  const kindOfTask = (t) => {
    const bd = boards.find((b2) => b2.id === t.team);
    const col = bd && bd.columns.find((c) => c.id === t.col);
    return col ? col.kind : 'wip';
  };

  const passFilters = (t) =>
    (aggregate || t.team === board) &&
    (effExec === 'all' || (t.assignees || []).includes(effExec)) &&
    (client === 'all' || (client === '__internal' ? !t.client : t.client === client)) &&
    (type === 'all' || t.type === type);

  const visible = tasks.filter(passFilters);

  // summary
  const sCount = (fn) => visible.filter(fn).length;
  const overdue = sCount((t) => B.statusOf(t) === 'overdue');
  const inReview = sCount((t) => kindOfTask(t) === 'review' && !t.done);
  const delivered = sCount((t) => t.done);
  const autoCnt = sCount((t) => t.type === 'auto' || t.type === 'subscription');
  const wipCnt = sCount((t) => { const s = B.statusOf(t); return s === 'wip' || s === 'soon'; });

  // cards per column
  const cardsIn = (col) => visible.filter((t) => aggregate ? kindOfTask(t) === col.kind : t.col === col.id);

  // DnD (only within a concrete team board)
  const onDragStart = (e, t) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; };
  const onDrop = (colId) => {
    if (!dragId || aggregate) return;
    setTasks((ts) => ts.map((t) => t.id === dragId ? { ...t, col: colId, done: colId === 'review' ? t.done : t.done } : t));
    setDragId(null);
  };

  const colMeta = (kind) => kind === 'intake' ? 'розподіл' : kind === 'review' ? 'здача' : null;

  return (
    <React.Fragment>
      <PageHeader
        title="Дошка задач"
        subtitle="// єдиний потік команди: клієнтські · внутрішні · абонплата · авто-задачі"
      >
        <div className="wfb-viewtog">
          {[['board', 'Board'], ['list', 'List'], ['time', 'Timeline']].map(([id, lbl]) => (
            <button key={id} className="wfb-viewtog-b" data-on={view === id || undefined} onClick={() => setView(id)}>{lbl}</button>
          ))}
        </div>
        {canConfig && !aggregate && view === 'board' && <button className="wfp-btn" onClick={() => setSettings(true)}><Icon name="settings" size={13} />Налаштувати дошку</button>}
        <button className="wfp-btn wfp-btn--primary" onClick={() => setAdd(true)}><Icon name="plus" size={13} />Задача</button>
      </PageHeader>

      <StatsRow>
        <Stat k="всього у фокусі" v={visible.length} sub={aggregate ? 'усі команди' : activeBoard.name} />
        <Stat k="в роботі" v={wipCnt} sub="активні + скоро" kind="accent" />
        <Stat k="прострочено" v={overdue} sub={overdue ? 'потребують уваги' : 'усе вчасно'} kind={overdue ? 'danger' : undefined} />
        <Stat k="на перевірці" v={inReview} sub="здача / рев'ю" kind="warn" />
        <Stat k="абон · авто" v={autoCnt} sub={`${delivered} здано`} />
      </StatsRow>

      {/* board (team) tabs */}
      <div className="wfb-boards">
        {boards.map((bd) => (
          <button key={bd.id} className="wfb-board-tab" data-on={bd.id === board || undefined} onClick={() => { setBoard(bd.id); }}>
            <span className="wfb-board-dot" style={{ background: bd.color }} />
            {bd.name}
            <span className="wfb-board-cnt">{tasks.filter((t) => bd.aggregate ? true : t.team === bd.id).length}</span>
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="wfb-filters">
        <button className="wfb-me" data-on={me || undefined} onClick={() => setMe((v) => !v)}>
          <Icon name="users" size={13} />Мої задачі
        </button>
        <span className="wfb-fdiv" />
        <label className="wfb-sel">
          <span>виконавець</span>
          <select value={me ? CURRENT_EXEC : exec} disabled={me} onChange={(e) => setExec(e.target.value)}>
            <option value="all">усі</option>
            {Object.entries(B.PEOPLE).map(([id, p]) => <option key={id} value={id}>{p.short}</option>)}
          </select>
        </label>
        <label className="wfb-sel">
          <span>клієнт</span>
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="all">усі</option>
            <option value="__internal">внутрішні</option>
            {B.CLIENTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <span className="wfb-fdiv" />
        <div className="wfb-types">
          <button className="wfb-tchip" data-on={type === 'all' || undefined} onClick={() => setType('all')}>усі типи</button>
          {Object.entries(B.TYPES).map(([id, t]) => (
            <button key={id} className="wfb-tchip" data-type={id} data-on={type === id || undefined} onClick={() => setType(id)}>
              <span className="wfb-tchip-dot" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* kanban — board view */}
      {view === 'board' && (
      <div className="wfb-cols" style={{ gridTemplateColumns: `repeat(${activeBoard.columns.length}, minmax(248px, 1fr))` }}>
        {activeBoard.columns.map((col) => {
          const cards = cardsIn(col);
          return (
            <div key={col.id} className="wfb-col" data-kind={col.kind} data-drop={dragId && !aggregate || undefined}
              onDragOver={(e) => { if (dragId && !aggregate) e.preventDefault(); }}
              onDrop={() => onDrop(col.id)}>
              <div className="wfb-col-h">
                <span className="wfb-col-t">{col.title}</span>
                {colMeta(col.kind) && <span className="wfb-col-tag" data-kind={col.kind}>{colMeta(col.kind)}</span>}
                <span className="wfb-col-cnt">{cards.length}</span>
              </div>
              <div className="wfb-col-body">
                {cards.map((t) => (
                  <BoardCard key={t.id} t={t} draggable={!aggregate} dragId={dragId}
                    onOpen={setOpenTask}
                    onDragStart={onDragStart} onDragEnd={() => setDragId(null)} />
                ))}
                {cards.length === 0 && <div className="wfb-col-empty">— порожньо —</div>}
                {col.kind === 'intake' && <button className="wfb-col-add" onClick={() => setAdd(true)}><Icon name="plus" size={12} />задача</button>}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {view === 'list' && <BoardList tasks={visible} board={activeBoard} aggregate={aggregate} kindOfTask={kindOfTask} onOpen={setOpenTask} />}
      {view === 'time' && <BoardTimeline tasks={visible} />}

      {aggregate && view === 'board' && (
        <div className="wfb-hint"><Icon name="eye" size={13} />Огляд «Усі команди» — зведення по стадіях. Для перетягування та налаштування статусів оберіть конкретну команду-дошку.</div>
      )}

      {settings && <BoardSettingsModal board={activeBoard} onSave={(cols) => { setBoards((bs) => bs.map((b2) => b2.id === activeBoard.id ? { ...b2, columns: cols } : b2)); setSettings(false); }} onClose={() => setSettings(false)} />}
      {add && <AddTaskModal boards={boards} defaultBoard={aggregate ? 'dev' : board} onAdd={(t) => { setTasks((ts) => [...ts, t]); setAdd(false); }} onClose={() => setAdd(false)} />}
      {openTask && <TaskDetailModal task={tasks.find((t) => t.id === openTask.id) || openTask} boards={boards} onChangeCol={moveTask} onAssign={assignTask} onClose={() => setOpenTask(null)} />}
    </React.Fragment>
  );
}

// ── List view (terminal git-log), grouped by stage ──
function BoardList({ tasks, board, aggregate, kindOfTask, onOpen }) {
  const B = window.WF_BOARD;
  const glyph = { high: '●', normal: '◆', low: '○' };
  // group by column (concrete board) or by stage-kind (aggregate)
  const groups = aggregate
    ? [['intake', 'вхідні'], ['wip', 'в роботі'], ['review', 'на перевірці']].map(([kind, title]) => ({ title, tasks: tasks.filter((t) => kindOfTask(t) === kind) }))
    : board.columns.map((col) => ({ title: col.title.toLowerCase(), kind: col.kind, tasks: tasks.filter((t) => t.col === col.id) }));
  const closed = tasks.filter((t) => t.done).length;
  return (
    <div className="wfb-klist">
      {groups.map((g, gi) => (
        <div className="wfb-klist-col" key={gi}>
          <div className="wfb-klist-col-h">
            <span><span className="wfb-klist-col-name">{g.title}</span> <span style={{ color: 'var(--wf-fg-subtle)' }}>· {g.tasks.length}</span></span>
            {g.kind && <span style={{ color: 'var(--wf-fg-subtle)' }}>{g.kind === 'intake' ? 'розподіл' : g.kind === 'review' ? 'здача' : ''}</span>}
          </div>
          {g.tasks.length === 0
            ? <div className="wfb-klist-empty">$ // нічого</div>
            : g.tasks.map((t) => {
              const st = B.statusOf(t); const ty = B.TYPES[t.type];
              return (
                <div className="wfb-klist-row" data-status={st} key={t.id} onClick={() => onOpen && onOpen(t)}>
                  <span className="wfb-klist-glyph">{glyph[t.prio] || '◆'}</span>
                  <span className="wfb-klist-id">{t.id}</span>
                  <span className="wfb-klist-type" data-type={t.type}>{ty.short}</span>
                  <span className="wfb-klist-client">{t.client || 'внутр'}</span>
                  <span className="wfb-klist-title">{t.title}</span>
                  <span className="wfb-klist-due" data-status={st}>{t.done ? '✓ здано' : (st === 'overdue' ? '⚠ ' : '') + t.due}</span>
                  <span className="wfb-klist-meta"><BoardAvatars ids={t.assignees} /></span>
                </div>
              );
            })}
        </div>
      ))}
      <div className="wfb-klist-foot">
        <span style={{ color: 'var(--wf-accent)' }}>$</span> tasks: <strong>{tasks.length}</strong> · closed: <strong>{closed}</strong> · overdue: <strong>{tasks.filter((t) => B.statusOf(t) === 'overdue').length}</strong> · auto+sub: <strong>{tasks.filter((t) => t.type === 'auto' || t.type === 'subscription').length}</strong>
      </div>
    </div>
  );
}

// ── Timeline / Gantt over June ──
function BoardTimeline({ tasks }) {
  const B = window.WF_BOARD;
  // June 8 → July 5 (28 days). today = June 16 → index 8.
  const START = 8, DAYS = 28, today = 8;
  const parseDue = (d) => { const m = /^(\d{1,2})\.(\d{1,2})$/.exec(d || ''); if (!m) return null; const day = +m[1], mon = +m[2]; return mon === 6 ? day - START : mon === 7 ? (31 - START) + day : null; };
  const bars = tasks.map((t, i) => {
    const end = parseDue(t.due);
    const e = end == null ? today + 4 : Math.max(0, Math.min(DAYS - 1, end));
    const span = 2 + (i % 4);
    const s = Math.max(0, e - span);
    return { ...t, s, e, st: B.statusOf(t) };
  }).sort((a, b) => a.s - b.s);
  const days = Array.from({ length: DAYS }, (_, i) => i);
  return (
    <div className="wfb-ktime">
      <div className="wfb-ktime-head">
        <div className="wfb-ktime-head-l">задача · клієнт</div>
        <div className="wfb-ktime-grid" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}>
          {days.map((d) => {
            const day = START + d; const mon = day > 30 ? 7 : 6; const dn = day > 30 ? day - 30 : day;
            const dow = (d + 0) % 7; const weekend = dow === 5 || dow === 6;
            return <div key={d} className="wfb-ktime-day" data-weekend={weekend || undefined} data-today={d === today || undefined}>{dn === 1 || d === 0 ? <span className="wfb-ktime-mon">{mon}/</span> : null}{dn}</div>;
          })}
        </div>
      </div>
      <div className="wfb-ktime-body">
        {bars.map((b) => (
          <div className="wfb-ktime-row" key={b.id}>
            <div className="wfb-ktime-row-l">
              <span className="wfb-ktime-type" data-type={b.type} />
              <span className="wfb-ktime-id">{b.id}</span>
              <span className="wfb-ktime-title">{b.title}</span>
              <span className="wfb-ktime-client">{b.client || 'внутр'}</span>
            </div>
            <div className="wfb-ktime-grid wfb-ktime-track" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}>
              {days.map((d) => <div key={d} className="wfb-ktime-cell" data-today={d === today || undefined} />)}
              <div className="wfb-ktime-bar" data-status={b.st} style={{ gridColumn: `${b.s + 1} / ${b.e + 2}` }} title={`${b.title} · до ${b.due}`}>
                <BoardAvatars ids={b.assignees} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="wfb-ktime-legend">
        <span><i className="wfb-ktime-leg" data-status="wip" /> в роботі</span>
        <span><i className="wfb-ktime-leg" data-status="overdue" /> прострочено</span>
        <span><i className="wfb-ktime-leg" data-status="soon" /> скоро</span>
        <span><i className="wfb-ktime-leg" data-status="done" /> здано</span>
        <span className="wfb-ktime-legend-today">│ сьогодні · 16.06</span>
      </div>
    </div>
  );
}

Object.assign(window, { WorkspaceBoard, BoardCard, BoardAvatar, BoardAvatars, BoardList, BoardTimeline });
