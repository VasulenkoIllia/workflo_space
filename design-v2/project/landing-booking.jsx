// landing-booking.jsx — Phase-2 (from G7): public booking link /book/:userSlug.
// A cal.com-style availability page in the terminal aesthetic. Two states:
// slot-picking (default) and a confirmed view. Renders inside TermPageShell.

const WFBK = {
  host: { name: 'Ілля Васюленко', slug: 'illia', role: { ua: 'Засновник · fullstack', en: 'Founder · fullstack' }, avatar: 'developer' },
  types: [
    { id: 'discovery', dur: 30, label: { ua: 'Discovery-дзвінок', en: 'Discovery call' }, note: { ua: 'познайомитись, зрозуміти задачу', en: 'intro + scope your task' }, on: true },
    { id: 'tech', dur: 45, label: { ua: 'Технічний дзвінок', en: 'Technical call' }, note: { ua: 'архітектура, інтеграції, оцінка', en: 'architecture, integrations, estimate' } },
    { id: 'demo', dur: 30, label: { ua: 'Демо результату', en: 'Result demo' }, note: { ua: 'для активних проєктів', en: 'for active projects' } },
  ],
  month: { ua: 'Травень 2026', en: 'May 2026' },
  today: 29,
  // available weekday numbers (May 2026)
  avail: [1, 4, 5, 6, 7, 8, 12, 13, 14, 15, 19, 20, 21, 22, 26, 27, 28, 29],
  selectedDay: 29,
  selectedDayLabel: { ua: 'пʼятниця, 29 травня', en: 'Friday, May 29' },
  slots: [
    { t: '10:00', free: true }, { t: '10:30', free: false }, { t: '11:00', free: true, sel: true },
    { t: '11:30', free: true }, { t: '12:00', free: false }, { t: '14:00', free: true },
    { t: '14:30', free: true }, { t: '15:00', free: false }, { t: '16:00', free: true }, { t: '16:30', free: true },
  ],
  tz: 'Europe/Kyiv (EET, UTC+2)',
};

function wfbkCells() {
  const cells = [];
  for (let d = 27; d <= 30; d++) cells.push({ n: d, out: true });
  for (let d = 1; d <= 31; d++) cells.push({ n: d, out: false });
  return cells;
}

// local icon set (landing has no global <Icon>)
const WFBK_ICON = {
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></>),
  check: <path d="M20 6L9 17l-5-5" />,
  chev_l: <path d="M15 6l-6 6 6 6" />,
  chev_r: <path d="M9 6l6 6-6 6" />,
  download: (<><path d="M12 3v12" /><path d="M7 11l5 4 5-4" /><path d="M5 21h14" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
};
function BkIcon({ name, size = 14, color }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {WFBK_ICON[name]}
    </svg>
  );
}

function BookingPage({ initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false, confirmed = false }) {
  const ua = initLang === 'ua';
  const L = (o) => (o && (o[initLang] || o.ua)) || '';
  const d = WFBK;
  const cells = wfbkCells();
  const dow = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const activeType = d.types.find((t) => t.on) || d.types[0];

  return (
    <TermPageShell
      cwd={`~/illia/workflo/book/${d.host.slug}`}
      crumbs={[{ label: '~', href: '#top' }, { label: 'book' }, { label: d.host.slug }]}
      cmd={`cal open --with ${d.host.slug}`}
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> book/{d.host.slug}</span><span className="wf-tm-sb-sep">·</span><span>{d.tz}</span></>}
    >
      {/* host header */}
      <div className="wfbk-host">
        <div className="wfbk-host-av"><WfAvatar kind={d.host.avatar} size="lg" fill="solid" bracket /></div>
        <div className="wfbk-host-main">
          <h1 className="wfbk-host-name">{d.host.name}</h1>
          <div className="wfbk-host-role">// {L(d.host.role)}</div>
        </div>
        <div className="wfbk-host-meta">
          <span className="wfbk-host-meta-row"><BkIcon name="clock" size={13} />{activeType.dur} {ua ? 'хв' : 'min'}</span>
          <span className="wfbk-host-meta-row"><BkIcon name="globe" size={13} />Google Meet</span>
        </div>
      </div>

      {confirmed ? (
        /* ── confirmed state ── */
        <div className="wfbk-confirmed">
          <div className="wfbk-confirmed-badge"><BkIcon name="check" size={22} /></div>
          <h2 className="wfbk-confirmed-t">{ua ? 'Зустріч заплановано ✓' : 'Meeting booked ✓'}</h2>
          <div className="wfbk-confirmed-card">
            <div className="wfbk-cc-row"><span className="k">{ua ? 'що' : 'what'}</span><span>{L(activeType.label)} · {activeType.dur} {ua ? 'хв' : 'min'}</span></div>
            <div className="wfbk-cc-row"><span className="k">{ua ? 'коли' : 'when'}</span><span>{L(d.selectedDayLabel)} · 11:00–11:30</span></div>
            <div className="wfbk-cc-row"><span className="k">{ua ? 'де' : 'where'}</span><span className="wfbk-link">meet.google.com/abc-defg-hij</span></div>
            <div className="wfbk-cc-row"><span className="k">{ua ? 'таймзона' : 'tz'}</span><span>{d.tz}</span></div>
          </div>
          <div className="wfbk-confirmed-actions">
            <a className="wf-tm-btn" href="#book"><BkIcon name="download" size={13} />.ics</a>
            <a className="wf-tm-btn" href="#book">{ua ? 'інший час' : 'reschedule'}</a>
            <a className="wf-tm-btn wf-tm-btn--primary" href="#top">[ {ua ? 'на головну' : 'home'} → ]</a>
          </div>
          <div className="wfbk-confirmed-foot">// {ua ? 'запрошення надіслано на пошту, нагадування за годину' : 'invite sent to your email, reminder 1h before'}</div>
        </div>
      ) : (
        /* ── slot-picking state ── */
        <React.Fragment>
          {/* meeting type */}
          <div className="wfbk-types">
            {d.types.map((t) => (
              <button key={t.id} className="wfbk-type" data-on={t.on || undefined}>
                <span className="wfbk-type-dur">{t.dur}<small>{ua ? 'хв' : 'm'}</small></span>
                <span className="wfbk-type-main">
                  <span className="wfbk-type-label">{L(t.label)}</span>
                  <span className="wfbk-type-note">{L(t.note)}</span>
                </span>
                {t.on && <BkIcon name="check" size={15} color="var(--wf-accent)" />}
              </button>
            ))}
          </div>

          <div className="wfbk-grid">
            {/* calendar */}
            <div className="wfbk-cal">
              <div className="wfbk-cal-head">
                <span className="wfbk-cal-month">{L(d.month)}</span>
                <span className="wfbk-cal-nav">
                  <span className="wfbk-cal-navbtn"><BkIcon name="chev_l" size={15} /></span>
                  <span className="wfbk-cal-navbtn"><BkIcon name="chev_r" size={15} /></span>
                </span>
              </div>
              <div className="wfbk-cal-dow">{dow.map((w) => <span key={w}>{w}</span>)}</div>
              <div className="wfbk-cal-grid">
                {cells.map((c, i) => {
                  const avail = !c.out && d.avail.includes(c.n);
                  const sel = !c.out && c.n === d.selectedDay;
                  const today = !c.out && c.n === d.today;
                  return (
                    <button key={i} className={`wfbk-day${c.out ? ' is-out' : ''}${avail ? ' is-avail' : ''}${sel ? ' is-sel' : ''}${today ? ' is-today' : ''}`} disabled={!avail}>
                      {c.n}
                      {avail && !sel && <span className="wfbk-day-dot" />}
                    </button>
                  );
                })}
              </div>
              <div className="wfbk-cal-legend">
                <span><span className="wfbk-lg-dot is-avail" /> {ua ? 'вільно' : 'available'}</span>
                <span><span className="wfbk-lg-dot is-sel" /> {ua ? 'обрано' : 'selected'}</span>
              </div>
            </div>

            {/* slots */}
            <div className="wfbk-slots">
              <div className="wfbk-slots-head">
                <span className="wfbk-slots-day">{L(d.selectedDayLabel)}</span>
                <span className="wfbk-slots-tz">{d.tz}</span>
              </div>
              <div className="wfbk-slots-list">
                {d.slots.map((s, i) => (
                  <button key={i} className="wfbk-slot" data-sel={s.sel || undefined} disabled={!s.free}>
                    <span className="wfbk-slot-t">{s.t}</span>
                    {s.sel
                      ? <span className="wfbk-slot-cta">{ua ? 'обрати →' : 'pick →'}</span>
                      : !s.free && <span className="wfbk-slot-busy">{ua ? 'зайнято' : 'busy'}</span>}
                  </button>
                ))}
              </div>
              <div className="wfbk-slots-foot">// {ua ? 'усі часи у вашій таймзоні' : 'all times in your timezone'}</div>
            </div>
          </div>
        </React.Fragment>
      )}
    </TermPageShell>
  );
}

Object.assign(window, { BookingPage });
