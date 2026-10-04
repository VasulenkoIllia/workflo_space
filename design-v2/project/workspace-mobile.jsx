// workspace-mobile.jsx — workflo.space WORKSPACE (executor) native-mobile app.
// Round 4 · G11. Dark-default. Self-contained interactive phone: login(OTP) →
// orders → order detail (start/stop timer) → chat / time-log, plus cross-client
// inbox, full-screen timer, calendar (month/agenda) and a "Ще" bottom-sheet.
// Reuses MPhone + the wfm-* vocabulary from portal-mobile; adds wfm-ws-*.
// Locale: UA only (per prototype).

const _wsm_s = React.useState;
const _wsm_e = React.useEffect;
const _wsm_r = React.useRef;

// ─────────────── Demo data (self-contained) ───────────────
const WSM = {
  me: { name: 'Олег Демченко', initials: 'ОД', role: 'виконавець · backend', phoneMask: '+380 67 ••• 21 04' },
  workspace: { name: 'workflo.space', role: 'виконавець · backend', team: 9 },
  statuses: {
    in_progress: { label: 'в роботі',     dot: 'var(--wf-accent)' },
    review:      { label: 'на рев’ю',     dot: 'var(--wf-warning)' },
    todo:        { label: 'у черзі',      dot: 'var(--wf-fg-subtle)' },
    blocked:     { label: 'заблоковано',  dot: 'var(--wf-destructive)' },
    done:        { label: 'готово',       dot: 'var(--wf-success)' },
  },
  orders: [
    { num: 'ORD-2412', title: 'Інтеграція 1С ↔ Telegram-бот', client: 'ТОВ «Брунки»', clientShort: 'Бр', status: 'in_progress', deadline: '2026-06-04', priority: 'high', progress: 0.62, unread: 3, tracked: 1485, estimate: 2400 },
    { num: 'ORD-2419', title: 'API синхронізації складу · фаза 2', client: 'EduForge', clientShort: 'EF', status: 'review', deadline: '2026-06-06', priority: 'mid', progress: 0.9, unread: 0, tracked: 920, estimate: 1080 },
    { num: 'ORD-2421', title: 'Міграція БД на Postgres 16', client: 'ТОВ «Брунки»', clientShort: 'Бр', status: 'todo', deadline: '2026-06-12', priority: 'mid', progress: 0, unread: 1, tracked: 0, estimate: 1440 },
    { num: 'ORD-2408', title: 'Фікс webhook-черги платежів', client: 'Mono Lab', clientShort: 'ML', status: 'blocked', deadline: '2026-06-02', priority: 'high', progress: 0.4, unread: 2, tracked: 360, estimate: 600 },
    { num: 'ORD-2390', title: 'Звіт по SLA · квітень', client: 'EduForge', clientShort: 'EF', status: 'done', deadline: '2026-05-28', priority: 'low', progress: 1, unread: 0, tracked: 240, estimate: 240 },
  ],
  chat: {
    'ORD-2412': [
      { who: 'sys', text: 'задачу призначено на Олега · 28.05' },
      { who: 'them', name: 'Ілля · PM', text: 'Олег, клієнт підтвердив спеку. Стартуй з вебхука бота — пріоритет.', ts: '09:12' },
      { who: 'me', name: 'ти', text: 'Прийняв. Підніму polling-режим спершу, далі переключу на webhook.', ts: '09:20' },
      { who: 'them', name: 'Ілля · PM', text: 'ок. токен у vault, ключ TG_BOT_2412.', ts: '09:21', attach: { name: 'tg-bot-setup.md', size: '4 КБ' } },
      { who: 'me', name: 'ти', text: 'Бачу. Тестую на staging, до обіду буде demo.', ts: '11:48' },
    ],
  },
  times: {
    'ORD-2412': [
      { date: '03.06', mins: 185, comment: 'Webhook handler + підпис запитів', manual: false },
      { date: '02.06', mins: 240, comment: 'Polling-режим, мапінг команд бота', manual: false },
      { date: '31.05', mins: 95, comment: 'Дослідження TG Bot API, ліміти', manual: true },
      { date: '30.05', mins: 210, comment: 'Каркас інтеграції + конфіг vault', manual: false },
    ],
  },
  inbox: [
    { id: 1, kind: 'mention', who: 'Ілля · PM', src: 'ORD-2412', preview: '@Олег глянь edge-case коли бот заблокований користувачем — треба graceful skip', ts: '14m', unread: true },
    { id: 2, kind: 'status', who: 'EduForge', src: 'ORD-2419', preview: 'Клієнт прийняв рев’ю — задачу переведено в «готово до здачі»', ts: '1г', unread: true },
    { id: 3, kind: 'payment', who: 'workflo.space', src: 'виплати', preview: 'Виплата за травень нарахована: $1 240 · надійде 05.06', ts: '3г', unread: true },
    { id: 4, kind: 'doc', who: 'ТОВ «Брунки»', src: 'ORD-2421', preview: 'Додано специфікацію SPC-2025-0421 — ознайомся перед стартом', ts: '5г', unread: false },
    { id: 5, kind: 'status', who: 'Mono Lab', src: 'ORD-2408', preview: 'Задачу заблоковано: очікуємо доступ до prod-черги від клієнта', ts: 'вчора', unread: false },
  ],
  cal: {
    // June 2026 — events keyed by day
    3:  [{ kind: 'event', time: '11:00', t: 'Demo бота · Брунки', s: 'ORD-2412 · zoom' }],
    4:  [{ kind: 'deadline', time: '18:00', t: 'Дедлайн ORD-2412', s: 'Інтеграція 1С ↔ бот' }],
    6:  [{ kind: 'deadline', time: '—', t: 'Дедлайн ORD-2419', s: 'API синхронізації складу' }],
    9:  [{ kind: 'event', time: '15:00', t: 'Sprint planning', s: 'команда · 1 год' }],
    10: [{ kind: 'leave', time: '—', t: 'Відгул', s: 'погоджено · Ілля' }],
    12: [{ kind: 'deadline', time: '—', t: 'Дедлайн ORD-2421', s: 'Міграція БД' }],
  },
};

function fmtClock(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}
function fmtMins(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h && m) return `${h}г ${m}хв`;
  if (h) return `${h}г`;
  return `${m}хв`;
}
function wsmDeadline(iso) {
  const today = new Date('2026-06-01');
  const days = Math.round((new Date(iso) - today) / 86400000);
  const [, m, d] = iso.split('-');
  return { label: `${d}.${m}`, cls: days < 0 ? 'over' : days <= 3 ? 'soon' : '', days };
}

// ─────────────── Top bar (executor) ───────────────
function WSMTop({ title, sub, back, onBack, running, onRunChip, bell = true, onBell }) {
  return (
    <div className="wfm-top">
      {back && <button className="wfm-top-back" onClick={onBack}><Icon name="chevron" size={18} style={{ transform: 'rotate(90deg)' }} /></button>}
      <div className="wfm-top-title">
        {!back && <div className="wfm-top-mark">workflo<span className="wfm-dot">.</span>space</div>}
        {title && <div className="wfm-top-h">{title}</div>}
        {sub && <div className="wfm-top-sub">{sub}</div>}
      </div>
      <div className="wfm-top-actions">
        {running != null && (
          <button className="wfm-runchip" onClick={onRunChip} title="активний таймер">
            <span className="wfm-runchip-pulse" />{fmtClock(running)}
          </button>
        )}
        {bell && <button className="wfm-iconbtn" onClick={onBell}><Icon name="bell" size={17} /><span className="wfm-iconbtn-dot" /></button>}
      </div>
    </div>
  );
}

// ─────────────── Bottom tab bar ───────────────
const WSM_TABS = [
  { id: 'orders',   label: 'Задачі',    icon: 'list' },
  { id: 'inbox',    label: 'Інбокс',    icon: 'inbox' },
  { id: 'timer',    label: 'Таймер',    icon: 'clock' },
  { id: 'calendar', label: 'Календар',  icon: 'calendar' },
  { id: 'more',     label: 'Ще',        icon: 'settings' },
];
function WSMTabbar({ active, running, unread, onNav }) {
  return (
    <div className="wfm-tabbar">
      {WSM_TABS.map((t) => {
        const on = active === t.id;
        const badge = t.id === 'inbox' && unread ? String(unread) : null;
        return (
          <button key={t.id} className="wfm-tab" data-on={on || undefined} onClick={() => onNav(t.id)}>
            {badge && !on && <span className="wfm-tab-badge">{badge}</span>}
            {t.id === 'timer' && running && <span className="wfm-tab-badge" style={{ background: 'var(--wf-accent-bg)' }}>●</span>}
            <span className="wfm-tab-icon"><Icon name={t.icon} size={21} /></span>
            <span className="wfm-tab-label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────── Orders (assignee = me) ───────────────
function WSMOrders({ running, onOpen, onRunChip, onBell }) {
  const [filter, setFilter] = _wsm_s('all');
  const chips = [
    { id: 'all', label: 'мої', count: WSM.orders.length },
    { id: 'in_progress', label: 'активні', count: WSM.orders.filter((o) => o.status === 'in_progress').length },
    { id: 'review', label: 'рев’ю', count: WSM.orders.filter((o) => o.status === 'review').length },
    { id: 'blocked', label: 'блок', count: WSM.orders.filter((o) => o.status === 'blocked').length },
    { id: 'archive', label: 'архів', count: 0 },
  ];
  const list = filter === 'all' ? WSM.orders : WSM.orders.filter((o) => o.status === filter);
  return (
    <div className="wfm">
      <WSMTop title="Мої задачі" sub={`${WSM.me.name} · ${WSM.me.role}`} running={running} onRunChip={onRunChip} onBell={onBell} />
      <div className="wfm-body">
        <div className="wfm-chips">
          {chips.map((c) => <div key={c.id} className="wfm-chip" data-on={filter === c.id || undefined} onClick={() => setFilter(c.id)}>{c.label}<span className="wfm-chip-count">{c.count}</span></div>)}
        </div>
        {list.length === 0 ? (
          <div className="wfm-empty" style={{ paddingTop: 72 }}>
            <div className="wfm-empty-mark">{`  ┌─────┐\n  │  ∅  │\n  └─────┘`}</div>
            <div className="wfm-empty-h">{filter === 'archive' ? 'Архів порожній' : 'Нічого немає'}</div>
            <div className="wfm-empty-t">{filter === 'archive' ? 'Завершені й заархівовані задачі зʼявляться тут.' : 'У цьому фільтрі поки немає задач.'}</div>
          </div>
        ) : (
        <div className="wfm-cards">
          {list.map((o) => {
            const s = WSM.statuses[o.status];
            const dl = wsmDeadline(o.deadline);
            return (
              <div key={o.num} className="wfm-ocard" onClick={() => onOpen(o.num)}>
                <div className="wfm-ocard-top">
                  <span className="wfm-ocard-num"><span className={`wfm-prio wfm-prio--${o.priority}`} style={{ display: 'inline-block', marginRight: 7 }} />{o.num}</span>
                  <span className="wfm-status"><span className="wfm-status-dot" style={{ background: s.dot }} />{s.label}</span>
                </div>
                <div className="wfm-ocard-title">{o.title}</div>
                {o.progress > 0 && o.status !== 'done' && (
                  <div className="wfm-mini-bar"><div className="wfm-mini-bar-fill" style={{ width: `${Math.round(o.progress * 100)}%` }} /></div>
                )}
                <div className="wfm-ocard-foot">
                  <span className="wfm-ocard-client"><span className="wfm-ocard-client-av">{o.clientShort}</span>{o.client}</span>
                  <div className="wfm-ocard-meta">
                    {o.unread > 0 && <span className="wfm-ocard-meta-i"><Icon name="inbox" size={13} />{o.unread}</span>}
                    <span className="wfm-ocard-meta-i"><Icon name="clock" size={13} />{fmtMins(o.tracked)}</span>
                    <span className={`wfm-deadline${dl.cls ? ' wfm-deadline--' + dl.cls : ''}`}>{dl.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}

// ─────────────── Order detail (+ timer control) ───────────────
function WSMOrderDetail({ orderId, running, isThis, paused, onBack, onToggleTimer, onOpenChat, onOpenTime, onOpenTimer }) {
  const o = WSM.orders.find((x) => x.num === orderId) || WSM.orders[0];
  const s = WSM.statuses[o.status];
  const dl = wsmDeadline(o.deadline);
  const chat = (WSM.chat[o.num] || []).filter((m) => m.who !== 'sys').slice(-2);
  const liveTracked = o.tracked + (isThis ? Math.floor((running || 0) / 60) : 0);
  return (
    <div className="wfm">
      <WSMTop back onBack={onBack} title={o.num} sub={o.client} bell={false} />
      <div className="wfm-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="wfm-od-hero">
          <div className="wfm-ocard-top">
            <span className="wfm-status"><span className="wfm-status-dot" style={{ background: s.dot }} />{s.label}</span>
            <span className={`wfm-deadline${dl.cls ? ' wfm-deadline--' + dl.cls : ''}`}>дедлайн {dl.label}{dl.days >= 0 ? ` · ${dl.days}д` : ' · протерміновано'}</span>
          </div>
          <div className="wfm-ocard-title" style={{ fontSize: 18 }}>{o.title}</div>
          <div className="wfm-mini-bar"><div className="wfm-mini-bar-fill" style={{ width: `${Math.round(o.progress * 100)}%` }} /></div>
        </div>

        <div className="wfm-od-meta">
          <div className="wfm-od-meta-cell"><span className="wfm-od-meta-k">відстежено</span><span className="wfm-od-meta-v">{fmtMins(liveTracked)}</span></div>
          <div className="wfm-od-meta-cell"><span className="wfm-od-meta-k">оцінка</span><span className="wfm-od-meta-v">{fmtMins(o.estimate)}</span></div>
          <div className="wfm-od-meta-cell"><span className="wfm-od-meta-k">пріоритет</span><span className="wfm-od-meta-v" style={{ textTransform: 'capitalize' }}>{o.priority === 'high' ? 'високий' : o.priority === 'mid' ? 'середній' : 'низький'}</span></div>
          <div className="wfm-od-meta-cell"><span className="wfm-od-meta-k">прогрес</span><span className="wfm-od-meta-v">{Math.round(o.progress * 100)}%</span></div>
        </div>

        <button className="wfm-linkrow" onClick={onOpenTime}>
          <span className="wfm-linkrow-l"><span className="wfm-linkrow-ic"><Icon name="clock" size={17} /></span><span><span className="wfm-linkrow-t">Мій тайм-лог</span><br /><span className="wfm-linkrow-s">{(WSM.times[o.num] || []).length} записів · {fmtMins(liveTracked)}</span></span></span>
          <span className="wfm-linkrow-r"><Icon name="chev_r" size={16} /></span>
        </button>

        <div>
          <div className="wfm-section-h"><span className="wfm-section-h-t">// чат із замовником</span></div>
          <div className="wfm-chatprev" style={{ marginBottom: 10 }}>
            {chat.map((m, i) => (
              <div key={i} className="wfm-chatprev-msg">
                <span className="wfm-chatprev-av" style={{ background: m.who === 'me' ? 'var(--wf-accent-bg)' : 'var(--wf-subtle)', color: m.who === 'me' ? 'var(--wf-on-accent, #0C0A09)' : 'var(--wf-fg-secondary)' }}>{m.who === 'me' ? 'Я' : 'І'}</span>
                <div className="wfm-chatprev-b"><div className="wfm-chatprev-who">{m.name} · {m.ts}</div><div className="wfm-chatprev-t">{m.text}</div></div>
              </div>
            ))}
          </div>
          <button className="wfm-openchat" onClick={onOpenChat}>
            <span className="wfm-openchat-l"><Icon name="inbox" size={16} />Відкрити чат</span>
            {o.unread > 0 && <span className="wfm-openchat-c">{o.unread} нових</span>}
          </button>
        </div>
      </div>

      {/* sticky timer control bar */}
      <div className="wfm-od-bar">
        <div className="wfm-od-bar-info" onClick={isThis ? onOpenTimer : undefined} style={{ cursor: isThis ? 'pointer' : 'default' }}>
          <span className="wfm-od-bar-k">{isThis ? (paused ? 'на паузі' : 'таймер активний') : 'таймер'}</span>
          <span className="wfm-od-bar-v" data-run={isThis && !paused || undefined}>{isThis ? fmtClock(running) : '00:00:00'}</span>
        </div>
        <button className={`wfm-btn wfm-btn--${isThis ? '' : 'primary'}`} style={{ minWidth: 132 }} onClick={() => onToggleTimer(o.num)}>
          {isThis ? <React.Fragment><span style={{ fontSize: 13 }}>■</span> стоп</React.Fragment> : <React.Fragment><span style={{ fontSize: 12 }}>▶</span> старт</React.Fragment>}
        </button>
      </div>
    </div>
  );
}

// ─────────────── Order chat ───────────────
function WSMChat({ orderId, onBack }) {
  const o = WSM.orders.find((x) => x.num === orderId) || WSM.orders[0];
  const chat = WSM.chat[o.num] || [];
  const bodyRef = _wsm_r(null);
  _wsm_e(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, []);
  return (
    <div className="wfm">
      <WSMTop back onBack={onBack} title={o.num} sub="чат · IRC-стиль" bell={false} />
      <div className="wfm-body wfm-body--flush" ref={bodyRef} style={{ paddingBottom: 8 }}>
        <div className="wfm-chat">
          {chat.map((m, i) => {
            if (m.who === 'sys') return <div key={i} className="wfm-sysline">{m.text}</div>;
            const me = m.who === 'me';
            return (
              <div key={i} className={`wfm-msg wfm-msg--${me ? 'me' : 'them'}`}>
                <div className={`wfm-msg-who${!me ? ' wfm-msg-who--illia' : ''}`}>{m.name}</div>
                <div className="wfm-bubble">{m.text}{m.attach && <div className="wfm-msg-attach"><Icon name="paperclip" size={12} />{m.attach.name} · {m.attach.size}</div>}</div>
                <div className="wfm-msg-ts">{m.ts}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="wfm-dock">
        <button className="wfm-iconbtn" style={{ borderRadius: '50%' }}><Icon name="paperclip" size={18} /></button>
        <div className="wfm-dock-field">Напишіть повідомлення…</div>
        <button className="wfm-dock-send"><Icon name="send" size={17} /></button>
      </div>
    </div>
  );
}

// ─────────────── Time-log ───────────────
function WSMTime({ orderId, onBack, isThis, running }) {
  const o = WSM.orders.find((x) => x.num === orderId) || WSM.orders[0];
  const [adding, setAdding] = _wsm_s(false);
  const [mins, setMins] = _wsm_s(60);
  const base = WSM.times[o.num] || [];
  const total = base.reduce((s, e) => s + e.mins, 0) + (isThis ? Math.floor((running || 0) / 60) : 0);
  return (
    <div className="wfm">
      <WSMTop back onBack={onBack} title="Тайм-лог" sub={o.num} bell={false} />
      <div className="wfm-body">
        <div className="wfm-tlog-sum">
          <div className="wfm-tlog-sum-cell"><span className="wfm-stat-k">усього</span><span className="wfm-stat-v">{fmtMins(total)}</span><span className="wfm-stat-sub">{base.length} записів</span></div>
          <div className="wfm-tlog-sum-cell"><span className="wfm-stat-k">оцінка</span><span className="wfm-stat-v">{fmtMins(o.estimate)}</span><span className="wfm-stat-sub">{Math.round((total / o.estimate) * 100)}% використано</span></div>
        </div>

        {!adding && <button className="wfm-btn wfm-btn--primary wfm-btn--block" onClick={() => setAdding(true)} style={{ marginBottom: 16 }}><Icon name="plus" size={16} />Додати запис вручну</button>}

        {adding && (
          <div className="wfm-od-hero" style={{ marginBottom: 16 }}>
            <div className="wfm-section-h" style={{ margin: 0 }}><span className="wfm-section-h-t">// ручний запис</span></div>
            <div className="wfm-form">
              <div className="wfm-field" style={{ marginBottom: 0 }}>
                <span className="wfm-label">Дата</span>
                <div className="wfm-input">01.06.2026</div>
              </div>
              <div className="wfm-field" style={{ marginBottom: 0 }}>
                <span className="wfm-label">Хвилини</span>
                <div className="wfm-stepper">
                  <button className="wfm-stepper-btn" onClick={() => setMins((m) => Math.max(5, m - 15))}>−</button>
                  <span className="wfm-stepper-val">{mins} хв · {fmtMins(mins)}</span>
                  <button className="wfm-stepper-btn" onClick={() => setMins((m) => m + 15)}>+</button>
                </div>
              </div>
              <div className="wfm-field" style={{ marginBottom: 0 }}>
                <span className="wfm-label">Коментар</span>
                <textarea className="wfm-textarea" placeholder="Що зроблено за цей час…" defaultValue="" />
              </div>
              <div className="wfm-form-row">
                <button className="wfm-btn" style={{ flex: 1 }} onClick={() => setAdding(false)}>Скасувати</button>
                <button className="wfm-btn wfm-btn--primary" style={{ flex: 1 }} onClick={() => setAdding(false)}><Icon name="check" size={15} />Зберегти</button>
              </div>
            </div>
          </div>
        )}

        <div className="wfm-section-h"><span className="wfm-section-h-t">// записи</span></div>
        {isThis && (
          <div className="wfm-tlog-row">
            <span className="wfm-tlog-date" style={{ color: 'var(--wf-accent)' }}>зараз</span>
            <div className="wfm-tlog-c"><div className="wfm-tlog-c-t">Активний таймер</div><div className="wfm-tlog-c-s">запис ще не збережено</div></div>
            <span className="wfm-tlog-dur" style={{ color: 'var(--wf-accent)' }}>{fmtClock(running)}</span>
          </div>
        )}
        {base.map((e, i) => (
          <div key={i} className="wfm-tlog-row">
            <span className="wfm-tlog-date">{e.date}</span>
            <div className="wfm-tlog-c"><div className="wfm-tlog-c-t">{e.comment}</div><div className="wfm-tlog-c-s">{e.manual ? 'внесено вручну' : 'з таймера'}</div></div>
            <span className={`wfm-tlog-dur${e.manual ? ' wfm-tlog-dur--manual' : ''}`}>{fmtMins(e.mins)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────── Cross-client inbox ───────────────
const WSM_IN_ICON = { mention: 'users', status: 'alert', payment: 'receipt', doc: 'file' };
function WSMInbox({ running, onRunChip, onBell }) {
  const [filter, setFilter] = _wsm_s('all');
  const chips = [
    { id: 'all', label: 'усі' },
    { id: 'unread', label: 'непрочитані', count: WSM.inbox.filter((i) => i.unread).length },
    { id: 'mention', label: '@згадки', count: WSM.inbox.filter((i) => i.kind === 'mention').length },
    { id: 'payment', label: 'виплати', count: WSM.inbox.filter((i) => i.kind === 'payment').length },
    { id: 'archived', label: 'архів', count: 0 },
  ];
  const list = filter === 'all' ? WSM.inbox : filter === 'unread' ? WSM.inbox.filter((i) => i.unread) : WSM.inbox.filter((i) => i.kind === filter);
  return (
    <div className="wfm">
      <WSMTop title="Інбокс" sub="усі клієнти" running={running} onRunChip={onRunChip} onBell={onBell} />
      <div className="wfm-body">
        <div className="wfm-chips">{chips.map((c) => <div key={c.id} className="wfm-chip" data-on={filter === c.id || undefined} onClick={() => setFilter(c.id)}>{c.label}{c.count != null && <span className="wfm-chip-count">{c.count}</span>}</div>)}</div>
        {list.length === 0 ? (
          <div className="wfm-empty" style={{ paddingTop: 64 }}>
            <div className="wfm-empty-mark">{`  ┌─────┐\n  │  ✓  │\n  └─────┘`}</div>
            <div className="wfm-empty-h">{filter === 'archived' ? 'Архів порожній' : 'Усе прочитано'}</div>
            <div className="wfm-empty-t">{filter === 'archived' ? 'Заархівовані сповіщення зʼявляться тут.' : 'Нових сповіщень у цьому фільтрі немає.'}</div>
          </div>
        ) : (
        <div className="wfm-inbox">
          {list.map((it) => (
            <div key={it.id} className="wfm-inrow">
              <span className="wfm-in-icon" data-kind={it.kind}><Icon name={WSM_IN_ICON[it.kind] || 'inbox'} size={17} /></span>
              <div className="wfm-in-main">
                <div className="wfm-in-titlerow"><span className="wfm-in-title">{it.who}</span><span className="wfm-in-src">{it.src}</span></div>
                <div className="wfm-in-preview">{it.preview}</div>
              </div>
              <div className="wfm-in-right"><span className="wfm-in-ts">{it.ts}</span>{it.unread && <span className="wfm-in-unread" />}</div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

// ─────────────── Full-screen timer ───────────────
const WSM_RING = 2 * Math.PI * 104;
function WSMTimer({ orderId, running, paused, onToggle, onPause, onBell }) {
  if (orderId == null) {
    return (
      <div className="wfm">
        <WSMTop title="Таймер" onBell={onBell} />
        <div className="wfm-empty" style={{ flex: 1 }}>
          <div className="wfm-empty-mark">{` ⏱\n[ -- : -- ]`}</div>
          <div className="wfm-empty-h">Таймер не запущено</div>
          <div className="wfm-empty-t">Відкрий задачу й натисни «старт», щоб почати відстеження часу.</div>
        </div>
      </div>
    );
  }
  const o = WSM.orders.find((x) => x.num === orderId) || WSM.orders[0];
  const frac = (running % 3600) / 3600; // ring fills each hour
  const dash = WSM_RING * (1 - frac);
  return (
    <div className="wfm">
      <WSMTop title="Активний таймер" sub={o.client} bell={false} />
      <div className="wfm-timer-body">
        <div className="wfm-timer-ctx">
          <div className="wfm-timer-ord">{o.num}</div>
          <div className="wfm-timer-task">{o.title}</div>
        </div>
        <div className="wfm-timer-ring">
          <svg width="230" height="230" viewBox="0 0 230 230">
            <circle cx="115" cy="115" r="104" fill="none" stroke="var(--wf-border)" strokeWidth="8" />
            <circle cx="115" cy="115" r="104" fill="none" stroke="var(--wf-accent)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={WSM_RING} strokeDashoffset={dash} style={{ transition: 'stroke-dashoffset 1s linear', opacity: paused ? 0.4 : 1 }} />
          </svg>
          <div>
            <div className="wfm-timer-big">{fmtClock(running)}</div>
            <div className="wfm-timer-state" data-run={!paused || undefined}>{!paused ? <React.Fragment><span className="wfm-runchip-pulse" style={{ background: 'currentColor' }} />йде відлік</React.Fragment> : 'на паузі'}</div>
          </div>
        </div>
        <textarea className="wfm-timer-comment" placeholder="// над чим працюєш зараз?" defaultValue="Webhook handler + підпис запитів" />
        <div className="wfm-timer-controls">
          <button className="wfm-timer-cta" onClick={onPause}>{paused ? <React.Fragment><span>▶</span> продовжити</React.Fragment> : <React.Fragment><span>❚❚</span> пауза</React.Fragment>}</button>
          <button className="wfm-timer-cta wfm-timer-cta--stop" onClick={() => onToggle(o.num)}><span style={{ fontSize: 14 }}>■</span> стоп</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────── Calendar ───────────────
function WSMCalendar({ running, onRunChip, onBell }) {
  const [mode, setMode] = _wsm_s('month');
  const [sel, setSel] = _wsm_s(4);
  // June 2026 starts on Monday. 30 days.
  const dow = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
  const cells = [];
  for (let i = 0; i < 30; i++) cells.push(i + 1);
  const selEvents = WSM.cal[sel] || [];
  const agenda = Object.keys(WSM.cal).map(Number).sort((a, b) => a - b);
  return (
    <div className="wfm">
      <WSMTop title="Календар" sub="червень 2026" running={running} onRunChip={onRunChip} onBell={onBell} />
      <div className="wfm-body">
        <div className="wfm-seg wfm-seg--inline">
          <div className="wfm-seg-opt" data-on={mode === 'month' || undefined} onClick={() => setMode('month')}>Місяць</div>
          <div className="wfm-seg-opt" data-on={mode === 'agenda' || undefined} onClick={() => setMode('agenda')}>Порядок денний</div>
        </div>

        {mode === 'month' ? (
          <React.Fragment>
            <div className="wfm-cal-head">
              <div className="wfm-cal-title">Червень 2026</div>
              <div className="wfm-cal-nav">
                <button className="wfm-cal-navbtn"><Icon name="chevron" size={16} style={{ transform: 'rotate(90deg)' }} /></button>
                <button className="wfm-cal-navbtn"><Icon name="chevron" size={16} style={{ transform: 'rotate(-90deg)' }} /></button>
              </div>
            </div>
            <div className="wfm-cal-grid">
              {dow.map((d) => <div key={d} className="wfm-cal-dow">{d}</div>)}
              {cells.map((d) => {
                const evs = WSM.cal[d] || [];
                return (
                  <div key={d} className="wfm-cal-cell" data-today={d === 1 || undefined} data-sel={d === sel || undefined} onClick={() => { setSel(d); }}>
                    <span>{d}</span>
                    <span className="wfm-cal-dots">{evs.slice(0, 3).map((e, i) => <span key={i} className={`wfm-cal-dot wfm-cal-dot--${e.kind}`} />)}</span>
                  </div>
                );
              })}
            </div>
            <div className="wfm-section-h"><span className="wfm-section-h-t">// {sel} червня</span></div>
            {selEvents.length === 0
              ? <div className="wfm-empty" style={{ padding: '24px 0' }}><div className="wfm-empty-t">Нічого не заплановано</div></div>
              : <div className="wfm-agenda">{selEvents.map((e, i) => (
                  <div key={i} className="wfm-ag-row"><span className={`wfm-ag-rail wfm-ag-rail--${e.kind}`} /><span className="wfm-ag-time">{e.time}</span><div><div className="wfm-ag-c-t">{e.t}</div><div className="wfm-ag-c-s">{e.s}</div></div></div>
                ))}</div>}
          </React.Fragment>
        ) : (
          <div className="wfm-agenda">
            {agenda.map((d) => (WSM.cal[d] || []).map((e, i) => (
              <div key={d + '-' + i} className="wfm-ag-row"><span className={`wfm-ag-rail wfm-ag-rail--${e.kind}`} /><span className="wfm-ag-time">{d}.06</span><div><div className="wfm-ag-c-t">{e.t}</div><div className="wfm-ag-c-s">{e.time !== '—' ? e.time + ' · ' : ''}{e.s}</div></div></div>
            )))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────── "Ще" bottom sheet ───────────────
function WSMMoreSheet({ theme, onTheme, onClose, onLogout }) {
  const items = [
    { id: 'profile', label: 'Профіль і налаштування', icon: 'settings' },
    { id: 'security', label: 'Безпека · 2FA', icon: 'shield' },
    { id: 'notif', label: 'Сповіщення', icon: 'bell' },
    { id: 'help', label: 'Довідка', icon: 'globe' },
  ];
  return (
    <div className="wfm-sheet-scrim" onClick={(e) => { if (e.target.classList.contains('wfm-sheet-scrim')) onClose(); }}>
      <div className="wfm-sheet">
        <div className="wfm-sheet-grip" />
        <div className="wfm-sheet-prof">
          <span className="wfm-sheet-prof-av">{WSM.me.initials}</span>
          <div><div className="wfm-sheet-prof-n">{WSM.me.name}</div><div className="wfm-sheet-prof-r">{WSM.me.role}</div></div>
        </div>

        <div className="wfm-sheet-sub" style={{ marginBottom: 8 }}>// робочий простір</div>
        <div className="wfm-sheet-list">
          <div className="wfm-sheet-row">
            <span className="wfm-sheet-av" style={{ background: 'var(--wf-fg)' }}>WO</span>
            <div><div className="wfm-sheet-row-name">{WSM.workspace.name}</div><div className="wfm-sheet-row-meta">{WSM.workspace.role} · команда {WSM.workspace.team}</div></div>
            <span className="wfm-sheet-tier">активний</span>
          </div>
        </div>

        <div className="wfm-sheet-sub" style={{ margin: '16px 0 8px' }}>// тема</div>
        <div className="wfm-themeswitch">
          <button data-on={theme === 'light' || undefined} onClick={() => onTheme('light')}>☀ світла</button>
          <button data-on={theme === 'dark' || undefined} onClick={() => onTheme('dark')}>☾ темна</button>
        </div>

        <div className="wfm-menu" style={{ marginTop: 14 }}>
          {items.map((m) => (
            <div key={m.id} className="wfm-menu-row"><span className="wfm-menu-icon"><Icon name={m.icon} size={18} /></span><span className="wfm-menu-label">{m.label}</span><span className="wfm-menu-chev"><Icon name="chev_r" size={15} /></span></div>
          ))}
          <div className="wfm-menu-row wfm-logout" onClick={onLogout}><span className="wfm-menu-icon"><Icon name="lock" size={18} /></span><span className="wfm-menu-label">Вийти</span><span /></div>
        </div>
      </div>
    </div>
  );
}

// ─────────────── Login (phone + OTP) ───────────────
const WSM_ASCII = " /\\_/\\\n( o.o )\n > ^ <";
function WSMLogin({ step, onNext, onAuth }) {
  return (
    <div className="wfm">
      <div className="wfm-auth">
        <span className="wfm-auth-mark"><span className="a">{WSM_ASCII}</span></span>
        {step === 1 ? (
          <React.Fragment>
            <div className="wfm-auth-h">workspace</div>
            <div className="wfm-auth-sub">Вхід для команди workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space</div>
            <div className="wfm-field">
              <span className="wfm-label">Номер телефону</span>
              <div className="wfm-input">{WSM.me.phoneMask}</div>
            </div>
            <button className="wfm-btn wfm-btn--primary wfm-btn--block" style={{ marginTop: 8 }} onClick={onNext}>Отримати код у SMS</button>
            <div className="wfm-auth-hint">Проблеми зі входом? <span className="wfm-link">Напишіть власнику</span></div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="wfm-auth-h">Введіть код</div>
            <div className="wfm-auth-sub">Надіслали SMS на {WSM.me.phoneMask}</div>
            <div className="wfm-otp">{['2', '0', '4', '', '', ''].map((d, i) => <div key={i} className="wfm-otp-cell" data-filled={d ? 'true' : undefined} data-active={i === 3 ? 'true' : undefined}>{d}</div>)}</div>
            <button className="wfm-btn wfm-btn--primary wfm-btn--block" style={{ marginTop: 18 }} onClick={onAuth}>Підтвердити</button>
            <div className="wfm-auth-hint">Не отримали код? <span className="wfm-link">Надіслати знову (0:38)</span></div>
          </React.Fragment>
        )}
        <div className="wfm-auth-foot">$ workspace.workflo.space — захищено · 2FA</div>
      </div>
    </div>
  );
}

// ─────────────── App (router + timer engine) ───────────────
function WorkspaceMobileApp({ initTheme = 'dark', accent = 'lime' }) {
  const [theme, setTheme] = _wsm_s(initTheme);
  const [authed, setAuthed] = _wsm_s(false);
  const [loginStep, setLoginStep] = _wsm_s(1);
  const [tab, setTab] = _wsm_s('orders');
  const [route, setRoute] = _wsm_s(null); // {name:'detail'|'chat'|'time', orderId}
  const [sheet, setSheet] = _wsm_s(false);

  // timer engine
  const [timerOrder, setTimerOrder] = _wsm_s(null);
  const [elapsed, setElapsed] = _wsm_s(0);
  const [paused, setPaused] = _wsm_s(false);
  _wsm_e(() => {
    if (timerOrder == null || paused) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [timerOrder, paused]);

  const scaleRef = _wsm_r(null);
  const [scale, setScale] = _wsm_s(1);
  _wsm_e(() => {
    const el = scaleRef.current; if (!el) return;
    const fit = () => { const h = el.clientHeight, w = el.clientWidth; if (h && w) setScale(Math.min(1, (h - 4) / 844, (w - 4) / 392)); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  const running = timerOrder != null ? elapsed : null;
  const toggleTimer = (orderId) => {
    if (timerOrder === orderId) { setTimerOrder(null); setElapsed(0); setPaused(false); }
    else { setTimerOrder(orderId); setElapsed(orderId === 'ORD-2412' ? 1485 : 0); setPaused(false); }
  };
  const goTimerTab = () => { setRoute(null); setTab('timer'); };
  const onBell = () => {};

  const wrap = (inner) => (
    <div ref={scaleRef} style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 390, height: 844, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: 'center' }}>{inner}</div>
    </div>
  );

  if (!authed) return wrap(
    <MPhone theme={theme} accent={accent}><WSMLogin step={loginStep} onNext={() => setLoginStep(2)} onAuth={() => setAuthed(true)} /></MPhone>
  );

  let screen;
  if (route && route.name === 'detail') {
    screen = <WSMOrderDetail orderId={route.orderId} running={running} isThis={timerOrder === route.orderId} paused={paused}
      onBack={() => setRoute(null)} onToggleTimer={toggleTimer}
      onOpenChat={() => setRoute({ name: 'chat', orderId: route.orderId })}
      onOpenTime={() => setRoute({ name: 'time', orderId: route.orderId })}
      onOpenTimer={goTimerTab} />;
  } else if (route && route.name === 'chat') {
    screen = <WSMChat orderId={route.orderId} onBack={() => setRoute({ name: 'detail', orderId: route.orderId })} />;
  } else if (route && route.name === 'time') {
    screen = <WSMTime orderId={route.orderId} isThis={timerOrder === route.orderId} running={running} onBack={() => setRoute({ name: 'detail', orderId: route.orderId })} />;
  } else if (tab === 'orders') {
    screen = <WSMOrders running={running} onRunChip={goTimerTab} onBell={onBell} onOpen={(id) => setRoute({ name: 'detail', orderId: id })} />;
  } else if (tab === 'inbox') {
    screen = <WSMInbox running={running} onRunChip={goTimerTab} onBell={onBell} />;
  } else if (tab === 'timer') {
    screen = <WSMTimer orderId={timerOrder} running={running || 0} paused={paused} onToggle={toggleTimer} onPause={() => setPaused((p) => !p)} onBell={onBell} />;
  } else if (tab === 'calendar') {
    screen = <WSMCalendar running={running} onRunChip={goTimerTab} onBell={onBell} />;
  } else {
    screen = <WSMOrders running={running} onRunChip={goTimerTab} onBell={onBell} onOpen={(id) => setRoute({ name: 'detail', orderId: id })} />;
  }

  const detailScreen = route != null;
  const unread = WSM.inbox.filter((i) => i.unread).length;

  return wrap(
    <MPhone theme={theme} accent={accent}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} key={(route && route.name + route.orderId) || tab}>{screen}</div>
        {!detailScreen && <WSMTabbar active={tab} running={timerOrder != null} unread={unread} onNav={(id) => { if (id === 'more') setSheet(true); else setTab(id); }} />}
      </div>
      {sheet && <WSMMoreSheet theme={theme} onTheme={setTheme} onClose={() => setSheet(false)} onLogout={() => { setSheet(false); setAuthed(false); setLoginStep(1); }} />}
    </MPhone>
  );
}

Object.assign(window, {
  WorkspaceMobileApp,
  WSMOrders, WSMOrderDetail, WSMChat, WSMTime, WSMInbox, WSMTimer, WSMCalendar, WSMLogin, WSMMoreSheet,
});
