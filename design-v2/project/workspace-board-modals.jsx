// workspace-board-modals.jsx — модалки дошки задач:
// BoardSettingsModal (налаштування колонок покомандно) · AddTaskModal.

const _bm = React.useState;

// ── Налаштування колонок дошки команди ──
// intake (перша) і review (остання) — локнуті; середні (wip) налаштовуються.
function BoardSettingsModal({ board, onSave, onClose }) {
  const [cols, setCols] = _bm(() => board.columns.map((c) => ({ ...c })));
  const wipIdx = cols.map((c, i) => c.kind === 'wip' ? i : -1).filter((i) => i >= 0);
  const firstWip = wipIdx[0], lastWip = wipIdx[wipIdx.length - 1];

  const rename = (i, v) => setCols(cols.map((c, j) => j === i ? { ...c, title: v } : c));
  const remove = (i) => setCols(cols.filter((_, j) => j !== i));
  const addCol = () => {
    const insertAt = cols.findIndex((c) => c.kind === 'review');
    const next = [...cols];
    next.splice(insertAt < 0 ? cols.length : insertAt, 0, { id: 'wip' + Date.now(), title: 'Нова стадія', kind: 'wip' });
    setCols(next);
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= cols.length || cols[j].kind !== 'wip') return;
    const next = [...cols];
    [next[i], next[j]] = [next[j], next[i]];
    setCols(next);
  };

  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 520, margin: 0 }}>
        <div className="wfp-modal-h">
          <Icon name="settings" size={18} color="var(--wf-accent)" />
          <span className="wfp-modal-h-t">Колонки дошки · {board.name}</span>
          <span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span>
        </div>
        <div className="wfp-modal-body">
          <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.55, marginBottom: 14 }}>
            Кожна команда має власні стадії. <strong style={{ color: 'var(--wf-fg)' }}>Вхідні</strong> (розподіл) і <strong style={{ color: 'var(--wf-fg)' }}>На перевірці</strong> (здача) — фіксовані. Проміжні стадії можна перейменовувати, додавати, прибирати й міняти місцями.
          </div>
          <div className="wfb-set-cols">
            {cols.map((c, i) => {
              const locked = c.kind !== 'wip';
              return (
                <div key={c.id} className="wfb-set-col" data-kind={c.kind}>
                  <span className="wfb-set-col-grip">{i + 1}</span>
                  {locked
                    ? <span className="wfb-set-col-locked"><Icon name="lock" size={12} />{c.title}<span className="wfb-set-col-tag">{c.kind === 'intake' ? 'розподіл · локнуто' : 'здача · локнуто'}</span></span>
                    : <input className="wfb-set-col-input" value={c.title} onChange={(e) => rename(i, e.target.value)} />}
                  {!locked && (
                    <span className="wfb-set-col-acts">
                      <button title="вгору" disabled={i === firstWip} onClick={() => move(i, -1)}><Icon name="chevron" size={13} style={{ transform: 'rotate(180deg)' }} /></button>
                      <button title="вниз" disabled={i === lastWip} onClick={() => move(i, 1)}><Icon name="chevron" size={13} /></button>
                      <button title="прибрати" className="wfb-set-col-del" onClick={() => remove(i)}><Icon name="plus" size={13} style={{ transform: 'rotate(45deg)' }} /></button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <button className="wfb-set-add" onClick={addCol}><Icon name="plus" size={13} />Додати стадію</button>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// {cols.length} колонок</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={onClose}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => onSave(cols)}>Зберегти дошку</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Додати задачу ──
// Проект — головний драйвер: визначає клієнта, команду, білінг і ставку.
// Задача успадковує їх і падає у «Вхідні» команди БЕЗ виконавця (поки хтось не забере).
function AddTaskModal({ boards, defaultBoard, onAdd, onClose }) {
  const B = window.WF_BOARD;
  const real = boards.filter((b) => !b.aggregate);
  const teamName = (id) => (real.find((b) => b.id === id) || {}).name || id;
  const teamColor = (id) => (real.find((b) => b.id === id) || {}).color || 'var(--wf-fg)';

  const [title, setTitle] = _bm('');
  const [project, setProject] = _bm(B.PROJECTS[0].id);  // '' = без проекту
  const [noProjType, setNoProjType] = _bm('internal');   // коли без проекту: internal | auto
  const [manualTeam, setManualTeam] = _bm(defaultBoard && defaultBoard !== 'all' ? defaultBoard : real[0].id);
  const [assignees, setAssignees] = _bm([]);
  const [due, setDue] = _bm('');
  const [prio, setPrio] = _bm('normal');

  const proj = project ? B.projectById(project) : null;
  const effType = proj ? B.BILLING[proj.billing].taskType : noProjType;
  const effTeam = proj ? proj.team : manualTeam;
  const togA = (id) => setAssignees((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);

  const submit = () => {
    const t = {
      id: 'T-' + Math.floor(1000 + Math.random() * 8999),
      team: effTeam, col: 'intake', type: effType,
      title: title.trim() || 'Нова задача',
      client: proj ? proj.client : null,
      project: proj ? proj.id : null,
      order: proj && proj.order ? proj.order : null,
      assignees, due: due || '—', prio,
      auto: effType === 'auto',
      recur: effType === 'auto' ? 'разово' : effType === 'subscription' ? 'щомісяця' : null,
    };
    onAdd(t);
  };

  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 580, margin: 0 }}>
        <div className="wfp-modal-h">
          <Icon name="plus" size={18} color="var(--wf-accent)" />
          <span className="wfp-modal-h-t">Нова задача</span>
          <span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span>
        </div>
        <div className="wfp-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="wfp-field"><label>Назва</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Оновити сертифікат · додати інтеграцію…" autoFocus /></div>

          {/* ── проект (драйвер) ── */}
          <div style={{ fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '16px 0 8px', fontFamily: 'JetBrains Mono, monospace' }}>// проект</div>
          <div className="wfp-field" style={{ marginBottom: 0 }}>
            <select className="wfl-select" value={project} onChange={(e) => setProject(e.target.value)}>
              {B.PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.client} — {p.name}</option>)}
              <option value="">— Без проекту (внутрішня / службова) —</option>
            </select>
          </div>

          {/* derived project card */}
          {proj ? (
            <div className="wfb-proj-card">
              <div className="wfb-proj-row">
                <span className="wfb-proj-k">клієнт</span>
                <span className="wfb-proj-v"><Icon name="building" size={12} />{proj.client}</span>
              </div>
              <div className="wfb-proj-row">
                <span className="wfb-proj-k">команда</span>
                <span className="wfb-proj-v"><span className="wfb-proj-dot" style={{ background: teamColor(proj.team) }} />{teamName(proj.team)} <span className="wfb-proj-lock"><Icon name="lock" size={10} />з проекту</span></span>
              </div>
              <div className="wfb-proj-row">
                <span className="wfb-proj-k">білінг</span>
                <span className="wfb-proj-v"><span className="wfg-pill2" data-tone={B.BILLING[proj.billing].tone}><span className="wfg-pill2-dot" />{B.BILLING[proj.billing].label}</span></span>
              </div>
              <div className="wfb-proj-row">
                <span className="wfb-proj-k">ставка</span>
                <span className="wfb-proj-v wfb-proj-rate">{B.rateLabel(proj)}</span>
              </div>
              <div className="wfb-proj-hint">// тип задачі — <strong>{B.TYPES[effType].label}</strong> · {proj.billing === 'retainer' ? 'години йдуть у пул, zero-billed' : proj.billing === 'hourly' ? 'час білиться за ставкою' : 'у межах фіксованого обсягу'}</div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="wfb-types" style={{ marginBottom: 10 }}>
                {['internal', 'auto'].map((id) => (
                  <button key={id} className="wfb-tchip" data-type={id} data-on={noProjType === id || undefined} onClick={() => setNoProjType(id)}>
                    <span className="wfb-tchip-dot" />{B.TYPES[id].label}
                  </button>
                ))}
              </div>
              <div className="wfp-field" style={{ marginBottom: 0 }}>
                <label>Команда / дошка</label>
                <select className="wfl-select" value={manualTeam} onChange={(e) => setManualTeam(e.target.value)}>
                  {real.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="wfb-proj-hint" style={{ marginTop: 8 }}>// без проекту — клієнту не білиться · {noProjType === 'auto' ? 'авто-задача (розклад)' : 'внутрішня робота команди'}</div>
            </div>
          )}

          <div className="wfc-grid2" style={{ marginTop: 16 }}>
            <div className="wfp-field"><label>Дедлайн</label><input value={due} onChange={(e) => setDue(e.target.value)} placeholder="ДД.ММ" /></div>
            <div className="wfp-field"><label>Пріоритет</label>
              <select className="wfl-select" value={prio} onChange={(e) => setPrio(e.target.value)}><option value="high">високий</option><option value="normal">звичайний</option><option value="low">низький</option></select>
            </div>
          </div>

          {/* виконавці — опційно */}
          <div style={{ fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '16px 0 8px', fontFamily: 'JetBrains Mono, monospace' }}>// виконавці <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--wf-fg-subtle)' }}>— опційно</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {Object.entries(B.PEOPLE).filter(([, p]) => !proj || p.team === effTeam || true).map(([id, p]) => (
              <button key={id} className="wfb-asgn" data-on={assignees.includes(id) || undefined} onClick={() => togA(id)}>
                <BoardAvatar id={id} size={18} />{p.short}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)', marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 7, lineHeight: 1.5 }}>
            <Icon name="users" size={13} style={{ marginTop: 1, flexShrink: 0 }} />
            {assignees.length
              ? <span>Призначено {assignees.length} — задача одразу в роботі команди <strong style={{ color: 'var(--wf-fg)' }}>{teamName(effTeam)}</strong>.</span>
              : <span>Без виконавця — задача впаде на команду <strong style={{ color: 'var(--wf-fg)' }}>{teamName(effTeam)}</strong> у «Вхідні». Будь-хто може <strong style={{ color: 'var(--wf-fg)' }}>забрати її собі</strong> або призначити виконавця пізніше.</span>}
          </div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// {proj ? proj.id : 'без проекту'} → {teamName(effTeam)} · Вхідні</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={onClose}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={submit}>Створити задачу</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BoardSettingsModal, AddTaskModal });
