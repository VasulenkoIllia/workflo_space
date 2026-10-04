// round4-misc.jsx — Round 4 minors.
// M6 R4ExecSettings · M7 R4Export · M8 R4Onboarding · M9 R4Forbidden · M10 R4Diff

const _mx = React.useState;

// ─────────────── M6 · Executor personal settings ───────────────
function R4Sw({ on, onToggle }) { return <span className="r4-sw" data-on={on || undefined} onClick={onToggle} />; }

function R4ExecSettings() {
  const [tab, setTab] = _mx('profile');
  const [notif, setNotif] = _mx({
    assigned: { in_app: true, email: true, tg: true },
    mention: { in_app: true, email: false, tg: true },
    deadline: { in_app: true, email: true, tg: false },
    payout: { in_app: true, email: true, tg: false },
  });
  const flip = (row, ch) => setNotif((n) => ({ ...n, [row]: { ...n[row], [ch]: !n[row][ch] } }));
  const NROWS = [['assigned', 'Нові призначення'], ['mention', '@згадки в чаті'], ['deadline', 'Нагадування про дедлайн'], ['payout', 'Виплати']];

  return (
    <React.Fragment>
      <div className="wfp-ph"><div className="wfp-ph-l"><h1 className="wfp-ph-h1">Мої налаштування</h1><div className="wfp-ph-sub">// особисті налаштування виконавця</div></div></div>
      <div className="r4-tabs">
        {[['profile', 'Профіль'], ['security', 'Безпека'], ['notifications', 'Сповіщення']].map(([id, l]) => <div key={id} className="r4-tab" data-on={tab === id || undefined} onClick={() => setTab(id)}>{l}</div>)}
      </div>

      {tab === 'profile' && (
        <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--wf-accent-bg)', color: 'var(--wf-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 20 }}>ОД</div>
            <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Змінити аватар · демо', 'ok')}>Змінити аватар</button>
          </div>
          <div className="wfp-field"><label>Імʼя</label><input defaultValue="Олег Демченко" /></div>
          <div className="wfp-field"><label>Email</label><input defaultValue="oleg@workflo.space" /></div>
          <div className="r4-subhead" style={{ margin: '6px 0 0' }}><span className="r4-subhead-t">уподобання</span></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--wf-border)' }}><span style={{ fontSize: 13.5 }}>Показувати суми у ₴ (mono-prefer)</span><R4Sw on onToggle={() => {}} /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--wf-border)' }}><span style={{ fontSize: 13.5 }}>Естетика за замовчуванням · Terminal A</span><R4Sw on onToggle={() => {}} /></div>
          <div><button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зберегти · демо', 'ok')}>Зберегти</button></div>
        </div>
      )}

      {tab === 'security' && (
        <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="wfp-field"><label>Поточний пароль</label><input type="password" defaultValue="········" /></div>
          <div className="wfp-field"><label>Новий пароль</label><input type="password" placeholder="мінімум 10 символів" /></div>
          <div className="r4-subhead" style={{ margin: '6px 0 0' }}><span className="r4-subhead-t">двофакторна автентифікація</span></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, border: '1px solid var(--wf-border)', borderRadius: 10 }}><div><div style={{ fontSize: 14, fontWeight: 500 }}>2FA через додаток</div><div className="r4-note">увімкнено · TOTP</div></div><R4Sw on onToggle={() => {}} /></div>
          <div className="r4-subhead" style={{ margin: '6px 0 0' }}><span className="r4-subhead-t">активні сесії</span></div>
          {[['MacBook · Safari · Луцьк', 'поточна', true], ['iPhone · workflo app', '2 год тому', false]].map(([d, t, cur], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: '1px solid var(--wf-border)' }}><div><div style={{ fontSize: 13.5 }}>{d}</div><div className="r4-note">{t}</div></div>{!cur && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm wfp-btn--danger" onClick={() => window.wfToast && window.wfToast('Завершити · демо', 'ok')}>Завершити</button>}{cur && <span className="r4-conn" data-s="connected"><span className="r4-conn-dot" />ця</span>}</div>
          ))}
        </div>
      )}

      {tab === 'notifications' && (
        <div style={{ maxWidth: 560 }}>
          <div className="r4-note" style={{ marginBottom: 12 }}>// канали для подій, що стосуються виконавця (без billing / loyalty / referral)</div>
          <table className="r4-matrix">
            <thead><tr><th>Подія</th><th className="r4-mx-ch">in-app</th><th className="r4-mx-ch">email</th><th className="r4-mx-ch">telegram</th></tr></thead>
            <tbody>{NROWS.map(([k, l]) => (
              <tr key={k}><td>{l}</td>{['in_app', 'email', 'tg'].map((ch) => <td key={ch} className="r4-mx-ch"><R4Sw on={notif[k][ch]} onToggle={() => flip(k, ch)} /></td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </React.Fragment>
  );
}

// ─────────────── M7 · CSV export modal + print view ───────────────
function R4Export() {
  const [show, setShow] = _mx(false);
  const [cols, setCols] = _mx(['num', 'client', 'sum', 'status', 'date']);
  const [fmt, setFmt] = _mx('csv');
  const [enc, setEnc] = _mx('utf8');
  const ALL = [['num', '№ замовлення'], ['client', 'Клієнт'], ['sum', 'Сума'], ['status', 'Статус'], ['date', 'Дата'], ['executor', 'Виконавець'], ['tracked', 'Відстежено'], ['margin', 'Маржа']];
  const tog = (c) => setCols((x) => x.includes(c) ? x.filter((y) => y !== c) : [...x, c]);
  return (
    <React.Fragment>
      <div className="wfp-ph"><div className="wfp-ph-l"><h1 className="wfp-ph-h1">Експорт і друк</h1><div className="wfp-ph-sub">// вибір колонок · період · формат · print-friendly</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn"><Icon name="file" size={13} />Версія для друку</button><button className="wfp-btn wfp-btn--primary" onClick={() => setShow(true)}><Icon name="download" size={13} />Експорт</button></div></div>

      <div className="r4-note" style={{ marginBottom: 12 }}>// приклад: print-friendly документ — без sidebar/topbar, оптимізовано під A4</div>
      <div style={{ border: '1px solid var(--wf-border)', borderRadius: 12, padding: 32, background: '#fff', maxWidth: 620, margin: '0 auto', color: '#0C0A09' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #0C0A09', paddingBottom: 14, marginBottom: 16 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>workflo<span style={{ color: '#A3D90D' }}>.</span>space</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#78716C' }}>Звіт по замовленнях · 05.2026</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ borderBottom: '1px solid #E7E5E4' }}><th style={{ textAlign: 'left', padding: 6 }}>№</th><th style={{ textAlign: 'left', padding: 6 }}>Клієнт</th><th style={{ textAlign: 'right', padding: 6 }}>Сума</th><th style={{ textAlign: 'left', padding: 6 }}>Статус</th></tr></thead>
          <tbody>{[['ORD-2412', 'Брунки', '$4 200', 'в роботі'], ['ORD-2419', 'EduForge', '$3 600', 'рев’ю'], ['ORD-2390', 'EduForge', '$900', 'готово']].map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F5F5F4' }}>{r.map((c, j) => <td key={j} style={{ padding: 6, textAlign: j === 2 ? 'right' : 'left', fontFamily: j === 0 || j === 2 ? 'JetBrains Mono, monospace' : 'inherit' }}>{c}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>

      {show && (
        <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) setShow(false); }}>
          <div className="wfp-modal wfp-modal--lg" style={{ width: 520, margin: 0 }}>
            <div className="wfp-modal-h"><Icon name="download" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Експорт замовлень</span><span className="wfp-modal-h-close" onClick={() => setShow(false)}><Icon name="alert" size={14} /></span></div>
            <div className="wfp-modal-body">
              <div className="r4-note" style={{ marginBottom: 8 }}>// колонки</div>
              <div className="r4-cols" style={{ marginBottom: 18 }}>{ALL.map(([c, l]) => <div key={c} className="r4-col" data-on={cols.includes(c) || undefined} onClick={() => tog(c)}><span className="r4-checkbox" data-on={cols.includes(c) || undefined}><Icon name="check" size={11} /></span>{l}</div>)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><div className="r4-note" style={{ marginBottom: 8 }}>// період</div><div className="r4-copyfield"><input defaultValue="05.2026" /></div></div>
                <div><div className="r4-note" style={{ marginBottom: 8 }}>// формат</div><div className="r4-seg" style={{ display: 'flex' }}><div className="r4-seg-opt" data-on={fmt === 'csv' || undefined} onClick={() => setFmt('csv')} style={{ flex: 1, textAlign: 'center' }}>CSV</div><div className="r4-seg-opt" data-on={fmt === 'xlsx' || undefined} onClick={() => setFmt('xlsx')} style={{ flex: 1, textAlign: 'center' }}>XLSX</div></div></div>
                <div><div className="r4-note" style={{ marginBottom: 8 }}>// кодування</div><div className="r4-seg" style={{ display: 'flex' }}><div className="r4-seg-opt" data-on={enc === 'utf8' || undefined} onClick={() => setEnc('utf8')} style={{ flex: 1, textAlign: 'center' }}>UTF-8</div><div className="r4-seg-opt" data-on={enc === 'cp1251' || undefined} onClick={() => setEnc('cp1251')} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>CP1251</div></div></div>
              </div>
            </div>
            <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// {cols.length} колонок · {fmt.toUpperCase()}</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={() => setShow(false)}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={() => setShow(false)}><Icon name="download" size={13} />Завантажити</button></div></div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

// ─────────────── M8 · Company-member onboarding tour ───────────────
const OB_STEPS = [
  { top: 90, left: 250, title: 'Це твої замовлення', t: 'Тут усі проєкти твоєї компанії — статуси, дедлайни й оплати.', spot: { top: 64, left: 0, w: 220, h: 44 } },
  { top: 150, left: 250, title: 'Чат з виконавцем', t: 'Питання по проєкту — прямо тут, у гілці замовлення.', spot: { top: 110, left: 0, w: 220, h: 44 } },
  { top: 240, left: 250, title: 'Документи', t: 'Рахунки, акти, специфікації — на погодження й підпис.', spot: { top: 200, left: 0, w: 220, h: 44 } },
  { top: 24, left: 250, title: 'Вибір компанії', t: 'Якщо ти у кількох компаніях — перемикайся тут.', spot: { top: 8, left: 0, w: 230, h: 56 } },
];
function R4Onboarding() {
  const [active, setActive] = _mx(true);
  const [i, setI] = _mx(0);
  const s = OB_STEPS[i];
  return (
    <React.Fragment>
      <div className="wfp-ph"><div className="wfp-ph-l"><h1 className="wfp-ph-h1">Onboarding нового учасника</h1><div className="wfp-ph-sub">// welcome-тур для company member (не owner)</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn" onClick={() => { setActive(true); setI(0); }}><Icon name="star" size={13} />Показати тур заново</button></div></div>

      <div style={{ position: 'relative', border: '1px solid var(--wf-border)', borderRadius: 12, overflow: 'hidden', height: 380, background: 'var(--wf-subtle)' }}>
        {/* faux portal frame */}
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '230px 1fr' }}>
          <div style={{ borderRight: '1px solid var(--wf-border)', background: 'var(--wf-surface)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13, padding: '4px 8px' }}>workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space</div>
            {['Замовлення', 'Чат', 'Фінанси', 'Документи'].map((l, k) => <div key={l} style={{ padding: '11px 10px', borderRadius: 8, fontSize: 13, background: (k === 0 && i === 0) || (k === 1 && i === 1) || (k === 3 && i === 2) ? 'var(--wf-accent-soft)' : 'transparent', color: 'var(--wf-fg-secondary)' }}>{l}</div>)}
          </div>
          <div style={{ padding: 18 }}><div style={{ height: 40, background: 'var(--wf-surface)', borderRadius: 8, marginBottom: 12, border: '1px solid var(--wf-border)' }} />{[0, 1, 2].map((k) => <div key={k} style={{ height: 56, background: 'var(--wf-surface)', borderRadius: 8, marginBottom: 10, border: '1px solid var(--wf-border)' }} />)}</div>
        </div>

        {active && (
          <React.Fragment>
            <div className="r4-ob-scrim" />
            <div className="r4-spot" style={{ top: s.spot.top, left: s.spot.left + 12, width: s.spot.w, height: s.spot.h }} />
            <div className="r4-ob-card" style={{ top: s.top, left: s.left }}>
              <div className="r4-ob-step">крок {i + 1} з {OB_STEPS.length}</div>
              <div className="r4-ob-h">{s.title}</div>
              <div className="r4-ob-t">{s.t}</div>
              <div className="r4-ob-nav">
                <div className="r4-ob-dots">{OB_STEPS.map((_, k) => <span key={k} className="r4-ob-dot" data-on={k === i || undefined} />)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setActive(false)}>Пропустити</button>
                  <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => (i < OB_STEPS.length - 1 ? setI(i + 1) : setActive(false))}>{i < OB_STEPS.length - 1 ? 'Далі' : 'Готово'}</button>
                </div>
              </div>
            </div>
          </React.Fragment>
        )}
      </div>
    </React.Fragment>
  );
}

// ─────────────── M9 · Workspace 403 ───────────────
function R4Forbidden() {
  return (
    <div className="r4-403">
      <div className="r4-403-mark">{`  ╳╳╳\n ( -_- )\n  /403\\`}</div>
      <div className="r4-403-h">Доступ обмежено</div>
      <div className="r4-403-t">Розділ <strong>/admin/templates</strong> доступний лише користувачам із роллю <strong>superadmin</strong>. Твоя поточна роль — <strong>виконавець</strong>.</div>
      <div className="r4-403-code">403 · forbidden · потрібен superadmin</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="wfp-btn"><Icon name="home" size={13} />На дашборд</button>
        <button className="wfp-btn wfp-btn--primary"><Icon name="mail" size={13} />Попросити доступ у власника</button>
      </div>
    </div>
  );
}

// ─────────────── M10 · Document version diff ───────────────
const DIFF_SECS = [
  { id: 'goals', label: 'Цілі', changed: false },
  { id: 'scope', label: 'Скоуп', changed: true },
  { id: 'deliv', label: 'Deliverables', changed: true },
  { id: 'budget', label: 'Бюджет', changed: true },
  { id: 'accept', label: 'Приймання', changed: false },
];
function R4Diff({ embedded = false }) {
  const [sec, setSec] = _mx('scope');
  const DIFF = {
    scope: { v1: ['Інтеграція бота у режимі polling', 'Мапінг 8 команд', 'Логування у файл'], v2: [['Інтеграція бота у режимі ', 'webhook', ' (було polling)'], 'Мапінг 8 команд', ['Логування у ', 'Sentry + файл']] },
    deliv: { v1: ['Бот + інструкція', 'Доступ до staging'], v2: ['Бот + інструкція', 'Доступ до staging', ['+ ', 'Postman-колекція API']] },
    budget: { v1: ['Fixed price: $3 800', 'Гарантія: 14 днів'], v2: [['Fixed price: ', '$4 200', ' (було $3 800)'], ['Гарантія: ', '30 днів']] },
    goals: { v1: ['Прибрати ручне зведення', 'Звіти в реальному часі'], v2: ['Прибрати ручне зведення', 'Звіти в реальному часі'] },
    accept: { v1: ['Демо на staging', 'Підпис акту'], v2: ['Демо на staging', 'Підпис акту'] },
  };
  const d = DIFF[sec];
  const renderLine = (line, kind) => {
    if (Array.isArray(line)) {
      return <span>{line.map((p, i) => i === 1 ? <span key={i} className={kind === 'add' ? 'r4-ins' : 'r4-del'}>{p}</span> : p)}</span>;
    }
    return line;
  };
  return (
    <React.Fragment>
      {!embedded && <div className="wfp-ph"><div className="wfp-ph-l"><h1 className="wfp-ph-h1">Зміни в угоді</h1><div className="wfp-ph-sub">// SPC-2025-0418 · v1 → v2 · перед підписанням</div></div></div>}
      {embedded && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><span style={{ fontSize: 14, fontWeight: 600 }}>Зміни в угоді <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', fontWeight: 400 }}>// SPC-2025-0418 · v1 → v2 · перед підписанням</span></span></div>}
      <div className="r4-diff">
        <div className="r4-diff-secs">
          {DIFF_SECS.map((x) => <div key={x.id} className="r4-diff-sec" data-on={sec === x.id || undefined} onClick={() => setSec(x.id)}>{x.label}<span className="r4-diff-flag" data-k={x.changed ? 'changed' : 'same'}>{x.changed ? 'змінено' : 'без змін'}</span></div>)}
        </div>
        <div>
          <div className="r4-diff-panes">
            <div className="r4-diff-pane"><div className="r4-diff-pane-h"><span>v1 · 23.05.2026</span><span>стара</span></div><div className="r4-diff-body">{d.v1.map((l, i) => <div key={i} className="r4-diff-line" data-k={Array.isArray(d.v2[i]) ? 'del' : undefined}>{renderLine(l, 'del')}</div>)}</div></div>
            <div className="r4-diff-pane"><div className="r4-diff-pane-h"><span>v2 · 01.06.2026</span><span style={{ color: 'var(--wf-accent)' }}>нова</span></div><div className="r4-diff-body">{d.v2.map((l, i) => <div key={i} className="r4-diff-line" data-k={Array.isArray(l) ? 'add' : undefined}>{renderLine(l, 'add')}</div>)}</div></div>
          </div>
          <div className="r4-diff-foot">
            <button className="wfp-btn wfp-btn--ghost"><Icon name="inbox" size={13} />Обговорити</button>
            <button className="wfp-btn wfp-btn--danger-soft" onClick={() => window.wfToast && window.wfToast('Відхилити зміни · демо', 'ok')}>Відхилити зміни</button>
            <button className="wfp-btn wfp-btn--sign"><Icon name="check" size={13} />Підписати v2</button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { R4ExecSettings, R4Export, R4Onboarding, R4Forbidden, R4Diff });
