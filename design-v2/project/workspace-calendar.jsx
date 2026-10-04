// workspace-calendar.jsx — G7 · Calendar / Meetings.
// CalendarMonth / Week / Day views + Event modal + RSVP modal + aggregated
// read-only + empty state + mobile (portal) calendar.

const WFCAL_DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

// May 2026 grid (Mon-start): starts Apr 27. 35 cells.
function wfcalMonthCells() {
  const cells = [];
  for (let d = 27; d <= 30; d++) cells.push({ n: d, out: true });
  for (let d = 1; d <= 31; d++) cells.push({ n: d, out: false });
  return cells;
}

function CalView({ active }) {
  return (
    <div className="wfcal-views">
      {['Місяць', 'Тиждень', 'День'].map((v, i) => (
        <span key={v} className="wfcal-view" data-on={i === active || undefined}>{v}</span>
      ))}
    </div>
  );
}

function CalLegend() {
  return (
    <div className="wfcal-legend">
      {window.WFP_CALENDAR.legend.map((l) => (
        <span className="wfcal-legend-item" data-type={l.type} key={l.type}><span className="wfcal-legend-dot" />{l.label}</span>
      ))}
    </div>
  );
}

function CalHeader({ view }) {
  const d = window.WFP_CALENDAR;
  return (
    <React.Fragment>
      <PageHeader title="Календар" subtitle="// зустрічі · дедлайни · відпустки — внутрішні та клієнтські">
        <button className="wfp-btn"><Icon name="download" size={13} />.ics</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Нова подія · демо', 'ok')}><Icon name="plus" size={13} />Нова подія</button>
      </PageHeader>
      <div className="wfcal-bar">
        <span className="wfcal-nav">
          <span className="wfcal-navbtn"><Icon name="chev_l" size={15} /></span>
          <span className="wfcal-navbtn"><Icon name="chev_r" size={15} /></span>
        </span>
        <span className="wfcal-month-label">{d.monthLabel}</span>
        <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Сьогодні</button>
        <CalView active={view} />
      </div>
      <CalLegend />
    </React.Fragment>
  );
}

// ── MONTH ──
function CalendarMonth() {
  const d = window.WFP_CALENDAR;
  const cells = wfcalMonthCells();
  return (
    <React.Fragment>
      <CalHeader view={0} />
      <div className="wfcal-month" style={{ marginTop: 14 }}>
        <div className="wfcal-month-head">
          {WFCAL_DOW.map((w) => <div className="wfcal-month-dow" key={w}>{w}</div>)}
        </div>
        <div className="wfcal-month-grid">
          {cells.map((c, i) => {
            const evts = (!c.out && d.events[c.n]) || [];
            const isToday = !c.out && c.n === d.today;
            return (
              <div className={`wfcal-day${c.out ? ' is-out' : ''}${isToday ? ' is-today' : ''}`} key={i}>
                <span className="wfcal-day-num">{c.n}</span>
                {evts.slice(0, 3).map((e, j) => (
                  <span className="wfcal-pill" data-type={e.type} key={j}>
                    {e.time && <span className="wfcal-pill-time">{e.time}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.t}</span>
                  </span>
                ))}
                {evts.length > 3 && <span className="wfcal-more">+{evts.length - 3} ще</span>}
              </div>
            );
          })}
        </div>
      </div>
    </React.Fragment>
  );
}

// ── WEEK ──
const WFCAL_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
function CalendarWeek() {
  const d = window.WFP_CALENDAR.week;
  const H = 46; const top0 = 8;
  return (
    <React.Fragment>
      <CalHeader view={1} />
      <div className="wfcal-week" style={{ marginTop: 14 }}>
        <div className="wfcal-week-times">
          <div style={{ height: 40 }} />
          {WFCAL_HOURS.map((h) => <div className="wfcal-week-time" key={h}>{h}:00</div>)}
        </div>
        <div className="wfcal-week-cols">
          {d.days.map((day, di) => (
            <div className="wfcal-week-col" key={di}>
              <div className={`wfcal-week-colhead${day.today ? ' is-today' : ''}`}>{day.label}</div>
              <div className="wfcal-week-body" style={{ height: WFCAL_HOURS.length * H }}>
                {WFCAL_HOURS.map((h) => <div className="wfcal-week-slot" key={h} style={{ height: H }} />)}
                {d.blocks.filter((b) => b.day === di).map((b, bi) => (
                  <div className="wfcal-block" data-type={b.type} key={bi}
                    style={{ top: (b.start - top0) * H, height: (b.end - b.start) * H - 4 }}>
                    <div className="wfcal-block-t">{b.title}</div>
                    <div className="wfcal-block-time">{Math.floor(b.start)}:{(b.start % 1) ? '30' : '00'}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

// ── DAY ──
function fmtH(x) { return `${Math.floor(x)}:${(x % 1) ? '30' : '00'}`; }
function CalendarDay() {
  const d = window.WFP_CALENDAR.day;
  const sel = d.items[d.selected];
  return (
    <React.Fragment>
      <CalHeader view={2} />
      <div className="wfcal-day-view" style={{ marginTop: 14 }}>
        <div className="wfcal-day-sched">
          {WFCAL_HOURS.map((h) => {
            const evts = d.items.filter((e) => Math.floor(e.start) === h);
            return (
              <div className="wfcal-day-hour" key={h}>
                <div className="wfcal-day-hr">{h}:00</div>
                <div className="wfcal-day-slot">
                  {evts.map((e, i) => (
                    <div className="wfcal-day-evt" data-type={e.type} data-sel={e === sel || undefined} key={i}>
                      <div className="wfcal-day-evt-t">{e.title}</div>
                      <div className="wfcal-day-evt-m">{fmtH(e.start)}–{fmtH(e.end)}{e.loc ? ` · ${e.loc}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {/* detail rail */}
        <div className="wfcal-detail" data-type={sel.type}>
          <span className="wfcal-detail-type">{sel.type === 'client' ? 'клієнтська' : 'внутрішня'}</span>
          <div className="wfcal-detail-t">{sel.title}</div>
          <div className="wfcal-detail-row"><span className="k">час</span><span>{fmtH(sel.start)}–{fmtH(sel.end)} · {d.label}</span></div>
          {sel.loc && <div className="wfcal-detail-row"><span className="k">де</span><span>{sel.loc}</span></div>}
          <div className="wfcal-detail-row"><span className="k">учасники</span>
            <span className="wfcal-detail-who">
              {sel.who.map((w) => <WfAvatar key={w} kind={(window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[w]) || 'developer'} size="xs" />)}
            </span>
          </div>
          <div className="wfcal-detail-actions">
            <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Редагувати · демо', 'ok')}><Icon name="edit" size={12} />Редагувати</button>
            <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">приєднатись →</button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ── Event create modal ──
function CalEventModal() {
  const f = window.WFP_CALENDAR.eventForm;
  const types = [{ id: 'internal', l: 'внутрішня' }, { id: 'client', l: 'клієнтська' }, { id: 'availability', l: 'доступність' }];
  return (
    <div className="wfp-modal-overlay" style={{ position: 'relative', padding: 0, background: 'transparent', display: 'block' }}>
      <div className="wfp-modal wfp-modal--lg" style={{ margin: 0 }}>
        <div className="wfp-modal-h"><span className="wfp-modal-h-t">Нова подія</span><span className="wfp-modal-h-aux">// calendar.create</span><span className="wfp-modal-h-close"><Icon name="close" size={15} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfcal-form">
            <div className="wfcal-field">
              <span className="wfcal-field-label">// назва</span>
              <input className="wfcal-input" defaultValue={f.title} />
            </div>
            <div className="wfcal-field">
              <span className="wfcal-field-label">// тип</span>
              <div className="wfcal-typeseg">
                {types.map((t) => <span key={t.id} className="wfcal-typeseg-opt" data-type={t.id} data-on={t.id === f.type || undefined}><span className="d" />{t.l}</span>)}
              </div>
            </div>
            <div className="wfcal-form-row">
              <div className="wfcal-field"><span className="wfcal-field-label">// дата</span><input className="wfcal-input" defaultValue={f.date} /></div>
              <div className="wfcal-field"><span className="wfcal-field-label">// timezone</span><input className="wfcal-input" defaultValue={f.tz} /></div>
            </div>
            <div className="wfcal-form-row">
              <div className="wfcal-field"><span className="wfcal-field-label">// початок</span><input className="wfcal-input" defaultValue={f.start} /></div>
              <div className="wfcal-field"><span className="wfcal-field-label">// кінець</span><input className="wfcal-input" defaultValue={f.end} /></div>
            </div>
            <div className="wfcal-form-row">
              <div className="wfcal-field"><span className="wfcal-field-label">// локація</span><input className="wfcal-input" defaultValue={f.location} /></div>
              <div className="wfcal-field"><span className="wfcal-field-label">// meeting URL</span><input className="wfcal-input" defaultValue={f.url} /></div>
            </div>
            <div className="wfcal-field">
              <span className="wfcal-field-label">// учасники</span>
              <div className="wfcal-att">
                {f.attendees.map((a) => (
                  <span className="wfcal-att-chip" key={a}><WfAvatar kind={(window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[a]) || 'developer'} size="xs" />{a}</span>
                ))}
                <span className="wfcal-att-chip"><WfAvatar kind="food" size="xs" shape="circle" />{f.extEmail}</span>
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"><Icon name="plus" size={11} /></button>
              </div>
            </div>
            <div className="wfcal-field">
              <span className="wfcal-field-label">// нагадування</span>
              <div className="wfcal-reminders">
                {f.reminders.map((r) => <span className="wfcal-rem-pill" key={r}>за {r}</span>)}
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"><Icon name="plus" size={11} /></button>
              </div>
            </div>
          </div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// надішле запрошення учасникам</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасувати · демо', 'ok')}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Створити · демо', 'ok')}><Icon name="check" size={13} />Створити</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RSVP modal ──
function CalRsvpModal() {
  const r = window.WFP_CALENDAR.rsvp;
  return (
    <div className="wfp-modal-overlay" style={{ position: 'relative', padding: 0, background: 'transparent', display: 'block' }}>
      <div className="wfp-modal" style={{ margin: 0, width: 460 }}>
        <div className="wfp-modal-h"><span className="wfp-modal-h-t">Запрошення на зустріч</span><span className="wfp-modal-h-aux">// rsvp</span><span className="wfp-modal-h-close"><Icon name="close" size={15} /></span></div>
        <div className="wfp-modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="wfcal-detail-type" data-type="client" style={{ '--tc': 'var(--wf-accent)' }}>клієнтська</div>
            <div className="wfcal-detail-t">{r.title}</div>
            <div className="wfcal-rsvp-when">{r.when} · {r.where}</div>
            <div>
              <div className="wfcal-field-label" style={{ marginBottom: 8 }}>// учасники</div>
              <div className="wfcal-rsvp-att">
                {r.attendees.map((a, i) => (
                  <div className="wfcal-rsvp-row" key={i}>
                    <WfAvatar kind={a.id === 'client' ? 'food' : ((window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[a.id]) || 'developer')} size="xs" shape={a.id === 'client' ? 'circle' : 'tile'} />
                    <span>{a.name || a.id}</span>
                    <span className="wfcal-rsvp-status" data-s={a.status}>{a.status === 'yes' ? '✓ буде' : 'очікує'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="wfcal-field-label" style={{ marginBottom: 8 }}>// ваша відповідь</div>
              <div className="wfcal-rsvp-choices">
                <button className="wfcal-rsvp-btn" data-v="yes" data-on="true">Буду</button>
                <button className="wfcal-rsvp-btn" data-v="maybe">Можливо</button>
                <button className="wfcal-rsvp-btn" data-v="no">Не зможу</button>
              </div>
            </div>
          </div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">+ у мій календар (.ics)</span>
          <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Підтвердити · демо', 'ok')}>Підтвердити</button>
        </div>
      </div>
    </div>
  );
}

// ── empty state ──
function CalendarEmpty() {
  return (
    <React.Fragment>
      <CalHeader view={0} />
      <div className="wfcal-empty">
        <pre>{`   ╭───────────╮
   │  ·  ·  ·  │
   │  ·     ·  │   нема подій
   │  ·  ·  ·  │
   ╰───────────╯`}</pre>
        <div className="wfcal-empty-t">Поки що порожньо</div>
        <div className="wfcal-empty-sub">// натисніть + щоб запланувати зустріч</div>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Нова подія · демо', 'ok')}><Icon name="plus" size={13} />Нова подія</button>
      </div>
    </React.Fragment>
  );
}

// ── mobile calendar (portal) ──
function MobileCalendar() {
  const d = window.WFP_CALENDAR;
  const cells = wfcalMonthCells();
  return (
    <div className="wfcal-m">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 12px' }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{d.monthLabel}</span>
        <span style={{ display: 'flex', gap: 6 }}><span className="wfcal-navbtn"><Icon name="chev_l" size={14} /></span><span className="wfcal-navbtn"><Icon name="chev_r" size={14} /></span></span>
      </div>
      <div className="wfcal-m-grid">
        {WFCAL_DOW.map((w) => <div className="wfcal-m-dow" key={w}>{w}</div>)}
        {cells.map((c, i) => {
          const evts = (!c.out && d.events[c.n]) || [];
          const isToday = !c.out && c.n === d.today;
          return (
            <div className={`wfcal-m-day${c.out ? ' is-out' : ''}${isToday ? ' is-today' : ''}`} key={i}>
              <span>{c.n}</span>
              <span className="wfcal-m-dots">
                {evts.slice(0, 3).map((e, j) => <span className="wfcal-m-dot" data-type={e.type} key={j} />)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, {
  CalendarMonth, CalendarWeek, CalendarDay, CalEventModal, CalRsvpModal, CalendarEmpty, MobileCalendar,
});
