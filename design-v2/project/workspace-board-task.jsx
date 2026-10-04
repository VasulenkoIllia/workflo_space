// workspace-board-task.jsx — деталь задачі дошки (відкривається з картки/рядка).
// Ключове: ЧАС логується на ЗАДАЧУ (таймер + сесії + estimate vs actual),
// а нагорі — rollup у замовлення (Σ годин разової роботи) або в підписку
// (Σ → місячний пул годин, zero-billed). Лагодить «картка не відкривається»
// і виправляє модель часу (раніше таймер жив на замовленні).

const _td = React.useState;
const _tdE = React.useEffect;
const _tdR = React.useRef;
const ME = 'oleh'; // демо «я» (виконавець)

// демо time-entries по задачі: розкидаємо залоговані хв по виконавцях
function buildTaskEntries(t) {
  const B = window.WF_BOARD;
  if (!t.assignees || !t.assignees.length) return [];
  const total = Math.round(B.estHours(t) * 60 * B.progressFraction(t));
  if (total <= 0) return [];
  const comments = {
    client:       ['Розбір вимог + макет рішення', 'Реалізація основного флоу', 'Інтеграційні тести', ''],
    subscription: ['Планове обслуговування', 'Перевірка та оновлення', ''],
    internal:     ['Налаштування пайплайну', 'Рефактор + перевірка', ''],
    auto:         ['Запуск за розкладом', ''],
  };
  const pool = comments[t.type] || comments.client;
  const per = Math.floor(total / t.assignees.length);
  const out = [];
  let n = 21;
  t.assignees.forEach((a, ai) => {
    const day = String(12 + ai).padStart(2, '0') + '.06';
    const s1 = Math.round(per * 0.6);
    const s2 = per - s1;
    out.push({ id: 'TE-' + (n++), executor: a, date: day, start: '10:00', end: mmEnd('10:00', s1), minutes: s1, comment: pool[ai % pool.length], status: 'done' });
    if (s2 > 20) out.push({ id: 'TE-' + (n++), executor: a, date: day, start: '14:30', end: mmEnd('14:30', s2), minutes: s2, comment: pool[(ai + 1) % pool.length], status: 'done' });
  });
  return out;
}
function mmEnd(start, mins) {
  const [h, m] = start.split(':').map(Number);
  const tot = h * 60 + m + mins;
  return String(Math.floor(tot / 60) % 24).padStart(2, '0') + ':' + String(tot % 60).padStart(2, '0');
}
function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function TaskDetailModal({ task, boards, onClose, onChangeCol, onAssign }) {
  const B = window.WF_BOARD;
  const ty = B.TYPES[task.type];
  const bd = (boards || B.TEAMS).find((b) => b.id === task.team) || B.TEAMS[1];
  const curCol = bd.columns.find((c) => c.id === task.col) || bd.columns[0];

  const [tab, setTab] = _td('overview');
  const [colMenu, setColMenu] = _td(false);
  const [assignMenu, setAssignMenu] = _td(false);
  const [entries, setEntries] = _td(() => buildTaskEntries(task));
  const [running, setRunning] = _td(false);
  const [elapsed, setElapsed] = _td(0);
  const tick = _tdR(null);

  _tdE(() => {
    if (running) {
      tick.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(tick.current);
    }
  }, [running]);

  const loggedMin = entries.filter((e) => e.status === 'done').reduce((s, e) => s + e.minutes, 0);
  const loggedH = loggedMin / 60;
  const estH = B.estHours(task);
  const pct = Math.min(100, (loggedH / estH) * 100);
  const isOver = loggedH > estH;

  const stopTimer = () => {
    const mins = Math.max(1, Math.round(elapsed / 60));
    setEntries((es) => [...es, { id: 'TE-' + Math.floor(100 + Math.random() * 899), executor: task.assignees[0] || 'oleh', date: '16.06', start: '—', end: 'now', minutes: mins, comment: 'нова сесія (таймер)', status: 'done' }]);
    setRunning(false); setElapsed(0);
    window.wfToast && window.wfToast(`Сесію збережено · +${mins}m`, 'ok');
  };

  // ── rollup: замовлення · підписка · проект ──
  const proj = task.project ? B.projectById(task.project) : null;
  const sub = task.type === 'subscription' && task.client ? B.SUBS[task.client] : null;
  let rollup = null;
  if (task.order) {
    const sibs = B.TASKS.filter((x) => x.order === task.order);
    const oEst = sibs.reduce((s, x) => s + B.estHours(x), 0);
    const oLog = sibs.reduce((s, x) => s + B.estHours(x) * B.progressFraction(x), 0);
    rollup = { kind: 'order', code: task.order, tasks: sibs.length, estH: oEst, logH: oLog, label: proj ? B.BILLING[proj.billing].label : 'разове замовлення', hint: 'Σ годин усіх задач = фактичні години замовлення · білиться окремо' };
  } else if (sub) {
    const sibs = B.TASKS.filter((x) => x.type === 'subscription' && x.client === task.client);
    const used = sibs.reduce((s, x) => s + B.estHours(x) * B.progressFraction(x), 0);
    rollup = { kind: 'sub', code: (proj && proj.id) || sub.code, name: sub.name, tasks: sibs.length, used, pool: sub.hoursIncluded, amount: sub.amount, cur: sub.cur, label: 'підписка · пул годин', hint: 'задачі zero-billed — години списуються з місячного пулу' };
  } else if (proj) {
    const sibs = B.TASKS.filter((x) => x.project === proj.id);
    const oEst = (sibs.length ? sibs : [task]).reduce((s, x) => s + B.estHours(x), 0);
    const oLog = (sibs.length ? sibs : [task]).reduce((s, x) => s + B.estHours(x) * B.progressFraction(x), 0);
    rollup = { kind: 'order', code: proj.id, tasks: Math.max(1, sibs.length), estH: oEst, logH: oLog, label: B.BILLING[proj.billing].label + ' · ' + B.rateLabel(proj), hint: proj.billing === 'hourly' ? 'час білиться за ставкою ' + B.rateLabel(proj) : 'у межах проекту ' + proj.id };
  }

  const st = B.statusOf(task);
  const dueTone = st === 'overdue' ? 'var(--wf-destructive)' : st === 'soon' ? 'var(--wf-warning)' : 'var(--wf-fg)';

  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 760, margin: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* header */}
        <div className="wfp-modal-h">
          <span className="wfb-type" data-type={task.type}><span className="wfb-type-dot" />{ty.label}</span>
          <span className="wfp-modal-h-t" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-fg-muted)' }}>{task.id}</span>
          {task.auto && <span className="wfb-auto" title="авто-задача"><Icon name="bell" size={12} /></span>}
          <span className="wfp-modal-h-close" onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer' }}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span>
        </div>

        <div className="wfp-modal-body" style={{ overflowY: 'auto' }}>
          <h2 style={{ margin: '2px 0 12px', fontSize: 21, fontWeight: 600, lineHeight: 1.25, color: 'var(--wf-fg)', textWrap: 'pretty' }}>{task.title}</h2>

          {/* meta */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 12.5, color: 'var(--wf-fg-secondary)', marginBottom: 16 }}>
            <span className="wfb-tm-pill" style={{ background: 'var(--wf-accent-soft)', color: 'var(--wf-accent)' }}>{bd.name} · {curCol.title}</span>
            {task.client
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="building" size={12} />{task.client}</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--wf-fg-muted)' }}><Icon name="home" size={12} />внутрішня</span>}
            <span style={{ color: 'var(--wf-fg-subtle)' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: dueTone }}><Icon name="calendar" size={12} />{task.done ? 'здано' : 'до ' + task.due}</span>
            <span style={{ color: 'var(--wf-fg-subtle)' }}>·</span>
            <span>пріоритет: <strong style={{ color: task.prio === 'high' ? 'var(--wf-destructive)' : 'var(--wf-fg)' }}>{task.prio === 'high' ? 'високий' : task.prio === 'low' ? 'низький' : 'звичайний'}</strong></span>
            {task.recur && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#A78BFA' }}><Icon name="bell" size={11} />{task.recur}</span>}
          </div>

          {/* action strip */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <button className={`wfp-btn ${running ? '' : 'wfp-btn--primary'}`} onClick={() => running ? stopTimer() : setRunning(true)}>
              <Icon name={running ? 'alert' : 'clock'} size={13} />{running ? `Стоп · ${fmtClock(elapsed)}` : 'Старт таймера'}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="wfp-btn" onClick={() => setColMenu((v) => !v)}>Перемістити: {curCol.title} ▾</button>
              {colMenu && (
                <React.Fragment>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setColMenu(false)} />
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 41, marginTop: 4, minWidth: 190, background: 'var(--wf-surface)', border: '1px solid var(--wf-border)', borderRadius: 9, padding: 5, boxShadow: '0 12px 32px -10px rgba(0,0,0,.35)' }}>
                    {bd.columns.map((c) => (
                      <button key={c.id} onClick={() => { onChangeCol && onChangeCol(task.id, c.id); setColMenu(false); window.wfToast && window.wfToast('Переміщено → ' + c.title, 'ok'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: 0, background: c.id === task.col ? 'var(--wf-accent-soft)' : 'none', color: 'var(--wf-fg)', font: 'inherit', fontSize: 13, borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                        {c.title}{c.id === task.col && <Icon name="check" size={12} style={{ marginLeft: 'auto' }} />}
                      </button>
                    ))}
                  </div>
                </React.Fragment>
              )}
            </div>
            {rollup && (
              <button className="wfp-btn" style={{ marginLeft: 'auto' }} onClick={() => { onClose(); window.__wsNav && window.__wsNav(rollup.kind === 'order' ? 'orders' : 'services'); }}>
                <Icon name="external" size={13} />{rollup.kind === 'order' ? 'Відкрити замовлення' : 'Відкрити підписку'}
              </button>
            )}
          </div>

          {/* claim / assign — коли без виконавця */}
          {(!task.assignees || !task.assignees.length) && (
            <div className="wfb-tm-claim">
              <span className="wfb-tm-claim-l"><Icon name="users" size={13} />Без виконавця — впала на команду <strong style={{ color: 'var(--wf-fg)' }}>{bd.name}</strong> у «{curCol.title}»</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, position: 'relative' }}>
                <button className="wfp-btn wfp-btn--sm wfp-btn--primary" onClick={() => onAssign && onAssign(task.id, [ME])}><Icon name="check" size={12} />Взяти собі</button>
                <button className="wfp-btn wfp-btn--sm" onClick={() => setAssignMenu((v) => !v)}>Призначити ▾</button>
                {assignMenu && (
                  <React.Fragment>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setAssignMenu(false)} />
                    <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 41, marginTop: 4, minWidth: 180, background: 'var(--wf-surface)', border: '1px solid var(--wf-border)', borderRadius: 9, padding: 5, boxShadow: '0 12px 32px -10px rgba(0,0,0,.35)' }}>
                      {Object.entries(B.PEOPLE).map(([id, p]) => (
                        <button key={id} onClick={() => { onAssign && onAssign(task.id, [id]); setAssignMenu(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 9px', border: 0, background: 'none', color: 'var(--wf-fg)', font: 'inherit', fontSize: 13, borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                          <BoardAvatar id={id} size={20} />{p.short}
                        </button>
                      ))}
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>
          )}

          {/* estimate vs actual — задача */}
          <div className="wfp-card" style={{ padding: 16, marginBottom: 14 }}>
            <div className="wfp-est-bar-wrap">
              <div className="wfp-est-bar-meta">
                <span className="wfp-est-bar-l">час задачі · estimate vs actual</span>
                <span className="wfp-est-bar-v"><strong>{loggedH.toFixed(1)}h</strong> / <span style={{ color: 'var(--wf-fg-muted)' }}>{estH}h</span><span style={{ color: 'var(--wf-fg-muted)', marginLeft: 8 }}>· {Math.round(pct)}%</span></span>
              </div>
              <div className="wfp-est-bar">
                <div className={`wfp-est-bar-fill${isOver ? ' wfp-est-bar-fill--over' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
                <div className="wfp-est-bar-tick" style={{ left: '80%' }} />
              </div>
              <div className="wfp-est-bar-meta">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>// час тече на цю задачу · {entries.length} сесій</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>залишок: {(estH - loggedH).toFixed(1)}h</span>
              </div>
            </div>
          </div>

          {/* rollup callout */}
          {rollup && (
            <div className="wfb-tm-rollup" data-kind={rollup.kind}>
              <div className="wfb-tm-rollup-top">
                <Icon name={rollup.kind === 'order' ? 'receipt' : 'bell'} size={14} />
                <span className="wfb-tm-rollup-code">{rollup.code}</span>
                <span className="wfb-tm-rollup-label">{rollup.label}</span>
                <span className="wfb-tm-rollup-cnt">{rollup.tasks} задач{rollup.tasks === 1 ? 'а' : ''}</span>
              </div>
              {rollup.kind === 'order' ? (
                <div className="wfb-tm-rollup-bar-wrap">
                  <div className="wfb-tm-rollup-nums"><span>залоговано по всіх задачах</span><span><strong>{rollup.logH.toFixed(1)}h</strong> / {rollup.estH}h</span></div>
                  <div className="wfb-tm-rollup-bar"><div className="wfb-tm-rollup-fill" style={{ width: Math.min(100, rollup.logH / rollup.estH * 100) + '%' }} /></div>
                </div>
              ) : (
                <div className="wfb-tm-rollup-bar-wrap">
                  <div className="wfb-tm-rollup-nums"><span>пул годин цього місяця · {rollup.cur}{rollup.amount}/міс</span><span><strong>{rollup.used.toFixed(1)}h</strong> / {rollup.pool}h</span></div>
                  <div className="wfb-tm-rollup-bar"><div className="wfb-tm-rollup-fill" data-tone={rollup.used / rollup.pool > 0.85 ? 'warn' : undefined} style={{ width: Math.min(100, rollup.used / rollup.pool * 100) + '%' }} /></div>
                </div>
              )}
              <div className="wfb-tm-rollup-hint">// {rollup.hint}</div>
            </div>
          )}

          {/* tabs */}
          <div style={{ marginTop: 4 }}>
            <Tabs value={tab} onChange={setTab} items={[
              { id: 'overview', label: 'Огляд' },
              { id: 'time', label: 'Час', badge: entries.length },
              { id: 'check', label: 'Чек-лист' },
              { id: 'activity', label: 'Activity' },
            ]} />
          </div>

          <div style={{ marginTop: 8 }}>
            {tab === 'overview' && <TaskMOverview task={task} entries={entries} rollup={rollup} proj={proj} onAssign={onAssign} />}
            {tab === 'time' && <TaskMTime task={task} entries={entries} running={running} elapsed={elapsed} onStart={() => setRunning(true)} onStop={stopTimer} />}
            {tab === 'check' && <TaskMCheck task={task} />}
            {tab === 'activity' && <TaskMActivity task={task} entries={entries} curCol={curCol} />}
          </div>
        </div>

        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// час → задача · агрегується в {rollup ? rollup.code : 'замовлення/підписку'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={onClose}>Закрити</button>
            {!task.done && <button className="wfp-btn wfp-btn--primary" onClick={() => { onChangeCol && onChangeCol(task.id, 'review'); onClose(); window.wfToast && window.wfToast('Задача → На перевірці', 'ok'); }}><Icon name="check" size={13} />Здати на перевірку</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Огляд ──
function TaskMOverview({ task, entries, rollup, proj, onAssign }) {
  const B = window.WF_BOARD;
  const [edit, setEdit] = _td(false);
  const togA = (id) => {
    const a = task.assignees || [];
    onAssign && onAssign(task.id, a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  };
  const desc = {
    client: 'Клієнтська робота в межах замовлення. Реалізація, тестування і здача на перевірку перед передачею клієнту.',
    subscription: 'Планова робота в межах абонплати. Години списуються з місячного пулу — окремо клієнту не виставляються.',
    internal: 'Внутрішня задача команди. Не білиться клієнту, але час обліковується для аналітики завантаження.',
    auto: 'Авто-задача, створена системою за розкладом. Виконується й закривається в межах регулярного обслуговування.',
  }[task.type];
  const perPerson = {};
  entries.forEach((e) => { perPerson[e.executor] = (perPerson[e.executor] || 0) + e.minutes; });
  return (
    <div style={{ padding: '14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div className="wfp-card" style={{ gridColumn: '1 / -1' }}>
        <div className="wfp-card-h"><div className="wfp-card-h-t">Опис</div><div className="wfp-card-h-aux">// {task.type}</div></div>
        <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>{desc}</div>
      </div>
      <div className="wfp-card">
        <div className="wfp-card-h"><div className="wfp-card-h-t">Виконавці</div><button className="wfp-card-h-aux" onClick={() => setEdit((v) => !v)} style={{ background: 'none', border: 0, color: 'var(--wf-accent)', font: 'inherit', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{edit ? 'готово' : '// редагувати'}</button></div>
        {task.assignees.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {task.assignees.map((a) => {
              const p = B.PEOPLE[a];
              return (
                <div key={a} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center' }}>
                  <BoardAvatar id={a} size={26} />
                  <div style={{ fontSize: 13 }}>{p ? p.name : a}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 600, color: 'var(--wf-accent)' }}>{((perPerson[a] || 0) / 60).toFixed(1)}h</div>
                </div>
              );
            })}
          </div>
        ) : <div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)' }}>не призначено — у колонці «Вхідні» для розподілу</div>}
        {(edit || !task.assignees.length) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--wf-border)' }}>
            {Object.entries(B.PEOPLE).map(([id, p]) => (
              <button key={id} className="wfb-asgn" data-on={task.assignees.includes(id) || undefined} onClick={() => togA(id)}>
                <BoardAvatar id={id} size={18} />{p.short}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="wfp-card">
        <div className="wfp-card-h"><div className="wfp-card-h-t">Належність</div><div className="wfp-card-h-aux">// {proj ? proj.id : 'rollup'}</div></div>
        {proj ? (
          <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--wf-accent)', fontSize: 13, marginBottom: 4 }}>{proj.id} · {proj.name}</div>
            Команда <strong style={{ color: 'var(--wf-fg)' }}>{proj.team}</strong> · {B.BILLING[proj.billing].label} · <strong style={{ color: 'var(--wf-fg)' }}>{B.rateLabel(proj)}</strong>.
            {proj.billing === 'retainer' ? ' Години — з пулу, zero-billed.' : proj.billing === 'hourly' ? ' Час білиться за ставкою.' : ' У межах фіксованого обсягу.'}
          </div>
        ) : rollup ? (
          <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--wf-accent)', fontSize: 13, marginBottom: 4 }}>{rollup.code}</div>
            {rollup.kind === 'order'
              ? <React.Fragment>Частина замовлення з {rollup.tasks} задач. Години цієї задачі додаються до фактичних годин замовлення.</React.Fragment>
              : <React.Fragment>Списується з місячного пулу <strong style={{ color: 'var(--wf-fg)' }}>{rollup.pool}h</strong> ({rollup.cur}{rollup.amount}/міс). Окремо не білиться.</React.Fragment>}
          </div>
        ) : <div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)' }}>{task.type === 'internal' ? 'внутрішня — без проекту' : 'без привʼязки'}</div>}
      </div>
    </div>
  );
}

// ── Час ──
function TaskMTime({ task, entries, running, elapsed, onStart, onStop }) {
  const B = window.WF_BOARD;
  const total = entries.filter((e) => e.status === 'done').reduce((s, e) => s + e.minutes, 0);
  return (
    <div style={{ padding: '14px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}><span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{(total / 60).toFixed(1)}h</span><span style={{ color: 'var(--wf-fg-muted)', fontSize: 12.5, fontWeight: 400, marginLeft: 8 }}>· залоговано на задачу</span></div>
        <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Додати запис вручну · демо', 'ok')}><Icon name="plus" size={11} />Запис вручну</button>
      </div>
      {running && (
        <div className="wfb-tm-running"><span className="wfb-tm-running-dot" /><span style={{ flex: 1, fontSize: 12.5 }}>активна сесія</span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 600, color: 'var(--wf-accent)' }}>{fmtClock(elapsed)}</span><button className="wfp-btn wfp-btn--sm" onClick={onStop}><Icon name="check" size={11} />Стоп</button></div>
      )}
      <div className="wfp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="wfb-tm-te-row wfb-tm-te-head">
          <span>дата</span><span>хто</span><span>сесія</span><span style={{ textAlign: 'right' }}>хв</span><span>коментар</span>
        </div>
        {entries.length === 0 && <div style={{ padding: '22px 14px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)' }}>$ // ще не залоговано — стартуй таймер</div>}
        {entries.map((e) => (
          <div className="wfb-tm-te-row" key={e.id}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-muted)' }}>{e.date}</span>
            <BoardAvatar id={e.executor} size={20} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-secondary)' }}>{e.start} → {e.end}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{e.minutes}m</span>
            <span style={{ fontSize: 12.5, color: e.comment ? 'var(--wf-fg-secondary)' : 'var(--wf-fg-subtle)' }}>{e.comment || 'без коментаря'}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, padding: '9px 13px', background: 'color-mix(in oklab, var(--wf-accent) 6%, transparent)', border: '1px dashed color-mix(in oklab, var(--wf-accent) 30%, var(--wf-border))', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--wf-fg)' }}>// модель часу</strong><br />Час логується тут, на задачі. Сума годин усіх задач {task.order ? 'замовлення' : task.type === 'subscription' ? 'підписки' : 'проєкту'} зводиться нагорі — у замовленні чи в пулі абонплати.
      </div>
    </div>
  );
}

// ── Чек-лист ──
function TaskMCheck({ task }) {
  const seed = {
    client: [['Узгодити вимоги', true], ['Реалізувати', false], ['Тести', false], ['Здати на перевірку', false]],
    subscription: [['Перевірити поточний стан', true], ['Виконати планову роботу', false], ['Звіт у портал', false]],
    internal: [['Підготувати', true], ['Виконати', false], ['Перевірити', false]],
    auto: [['Запуск', true], ['Перевірка результату', false]],
  }[task.type] || [];
  const [items, setItems] = _td(() => seed.map(([t, d]) => ({ t, d })));
  const done = items.filter((i) => i.d).length;
  return (
    <div style={{ padding: '14px 0', maxWidth: 520 }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 10 }}>// {done} / {items.length} виконано</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', background: it.d ? 'color-mix(in oklab, var(--wf-success) 7%, transparent)' : 'transparent' }}>
            <input type="checkbox" checked={it.d} onChange={() => setItems((xs) => xs.map((x, j) => j === i ? { ...x, d: !x.d } : x))} style={{ accentColor: 'var(--wf-accent-bg, var(--wf-accent))', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: it.d ? 'var(--wf-fg-muted)' : 'var(--wf-fg)', textDecoration: it.d ? 'line-through' : 'none' }}>{it.t}</span>
          </label>
        ))}
      </div>
      <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ marginTop: 10 }} onClick={() => setItems((xs) => [...xs, { t: 'Новий пункт', d: false }])}><Icon name="plus" size={11} />Додати пункт</button>
    </div>
  );
}

// ── Activity ──
function TaskMActivity({ task, entries, curCol }) {
  const B = window.WF_BOARD;
  const who = (id) => (B.PEOPLE[id] || {}).short || id;
  const rows = [
    { ts: '16.06 · 11:20', txt: `переміщено → ${curCol.title}`, actor: who(task.assignees[0] || 'oleh') },
    ...entries.slice(0, 3).map((e) => ({ ts: `${e.date} · ${e.start}`, txt: `залоговано ${e.minutes}m${e.comment ? ' · ' + e.comment : ''}`, actor: who(e.executor) })),
    task.assignees.length ? { ts: '12.06 · 09:40', txt: `призначено: ${task.assignees.map(who).join(', ')}`, actor: 'менеджер' } : null,
    { ts: '12.06 · 09:30', txt: `задачу створено${task.order ? ' · з ' + task.order : ''}`, actor: 'система' },
  ].filter(Boolean);
  return (
    <div style={{ padding: '14px 0', maxWidth: 580 }}>
      <div className="wfl-tl">
        {rows.map((a, i) => (
          <div key={i} className="wfl-tl-row">
            <span className="wfl-tl-dot" data-kind="stage"><Icon name="chevron" size={10} /></span>
            <div className="wfl-tl-body"><div className="wfl-tl-txt">{a.txt}</div><div className="wfl-tl-meta">{a.ts} · {a.actor}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { TaskDetailModal });
