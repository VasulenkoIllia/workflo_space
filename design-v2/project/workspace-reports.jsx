// workspace-reports.jsx — Reports module for superadmin
// Five screens: Overview, Executors, Clients, Departments, Timesheet, Audit log

// ──────────────────────────────────────────────────────────────────────
// Reports tabs nav
// ──────────────────────────────────────────────────────────────────────
const REPORTS_NAV = [
  { id: 'overview',    label: 'Огляд',         href: '/reports' },
  { id: 'executors',   label: 'Виконавці',     href: '/reports/executors' },
  { id: 'clients',     label: 'Клієнти',       href: '/reports/clients' },
  { id: 'departments', label: 'Підрозділи',    href: '/reports/departments' },
  { id: 'timesheet',   label: 'Timesheet',     href: '/reports/timesheet' },
  { id: 'audit',       label: 'Audit log',     href: '/reports/audit' },
];

function ReportsHeader({ active }) {
  return (
    <React.Fragment>
      <PageHeader
        title="Звіти"
        subtitle="// для superadmin · працює тільки з реальними даними · oki for всіх клієнтів і виконавців"
      >
        <span className="wfp-rep-period">
          <Icon name="settings" size={11} color="var(--wf-fg-muted)" />
          <span className="wfp-rep-period-l">період:</span>
          <span>01.05 – 27.05.2026</span>
          <span style={{ color: 'var(--wf-fg-muted)' }}>· 27 днів</span>
          <Icon name="chevron" size={11} color="var(--wf-fg-muted)" />
        </span>
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт CSV · демо', 'ok')}><Icon name="download" size={13} />Експорт CSV</button>
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Subscribe email · демо', 'ok')}><Icon name="bell" size={13} />Subscribe email</button>
      </PageHeader>

      <div className="wfp-rep-tabs">
        {REPORTS_NAV.map((t) => (
          <span key={t.id} className="wfp-rep-tab" data-on={t.id === active || undefined} style={{ cursor: 'pointer' }} onClick={() => window.__reportsNav && window.__reportsNav(t.id)}>{t.label}</span>
        ))}
      </div>
    </React.Fragment>
  );
}

// Mini horizontal bar
function MiniBar({ value, max, kind = 'default' }) {
  const pct = Math.min(100, (value / (max || 100)) * 100);
  const cls = kind === 'low' ? ' wfp-mini-bar-fill--low'
            : kind === 'good' ? ' wfp-mini-bar-fill--good'
            : kind === 'warn' ? ' wfp-mini-bar-fill--warn'
            : kind === 'over' ? ' wfp-mini-bar-fill--over'
            : '';
  return (
    <div className="wfp-mini-bar">
      <div className={`wfp-mini-bar-fill${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Sparkline bars (weekly hours)
function Spark({ values, labels, current }) {
  const max = Math.max(...values);
  return (
    <div className="wfp-spark">
      {values.map((v, i) => (
        <div
          key={i}
          className={`wfp-spark-bar${i === current ? ' wfp-spark-bar--current' : (v > max * 0.6 ? ' wfp-spark-bar--accent' : '')}`}
          style={{ height: `${(v / max) * 100}%` }}
        >
          {labels && <span className="wfp-spark-bar-l">{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /reports — Overview
// ──────────────────────────────────────────────────────────────────────
function ReportsOverview() {
  const s = window.WFP_DATA.reports_summary;
  const depts = window.WFP_DATA.report_departments;
  const executors = window.WFP_DATA.report_executors;

  return (
    <React.Fragment>
      <ReportsHeader active="overview" />

      <StatsRow>
        <Stat k="виручка"            v={`$${s.revenue_usd.toLocaleString('uk-UA')}`}  sub={`+${Math.round(s.revenue_change * 100)}% до квітня`} kind="accent" />
        <Stat k="зібрано"            v={`$${s.collected_usd.toLocaleString('uk-UA')}`} sub={`outstanding: $${s.outstanding.toLocaleString('uk-UA')}`} />
        <Stat k="закрито замовлень"  v={s.orders_closed} sub={`${s.orders_active} активних`} />
        <Stat k="середній profit margin" v={`${Math.round(s.avg_margin * 100)}%`} sub="по закритих" kind="accent" />
      </StatsRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        {/* Revenue chart */}
        <div className="wfp-card">
          <div className="wfp-card-h">
            <div className="wfp-card-h-t">Виручка по тижнях</div>
            <div className="wfp-card-h-aux">// $ · травень 2026</div>
          </div>
          <Spark
            values={[2200, 1840, 3300, 2860, 2200]}
            labels={['w18', 'w19', 'w20', 'w21', 'w22']}
            current={3}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, padding: '12px 0 0', borderTop: '1px dashed var(--wf-border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            <span>// середній тиждень: <strong style={{ color: 'var(--wf-fg)' }}>$2 480</strong></span>
            <span>пік w20: <strong style={{ color: 'var(--wf-success)' }}>$3 300</strong></span>
          </div>
        </div>

        {/* Department donut */}
        <div className="wfp-card">
          <div className="wfp-card-h">
            <div className="wfp-card-h-t">Розподіл годин · підрозділи</div>
            <div className="wfp-card-h-aux">// 248h</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 18, alignItems: 'center' }}>
            <div className="wfp-donut">
              <div className="wfp-donut-c">
                <div className="wfp-donut-c-v">{s.hours_total}h</div>
                <div className="wfp-donut-c-l">total</div>
              </div>
            </div>
            <div className="wfp-donut-legend">
              {depts.map((d) => (
                <div key={d.id} className="wfp-donut-leg-row">
                  <span className="wfp-donut-leg-dot" style={{ background: d.color }} />
                  <span>{d.label}</span>
                  <span className="wfp-donut-leg-v">{d.hours}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
        <KPI k="utilization · команда" v={`${Math.round(s.utilization_avg * 100)}%`} sub="6 виконавців · середня" />
        <KPI k="cycle time · замовлення" v={`${s.cycle_avg_days}d`} sub="з створення до закриття" />
        <KPI k="hours · billable" v={`${s.hours_billable}h`} sub={`з ${s.hours_total}h залогованих (94%)`} />
        <KPI k="time-entries · з коментарями" v="78%" sub="ціль 85% · ↑ повноту спеки" />
      </div>

      {/* Top executors */}
      <div className="wfp-card" style={{ marginTop: 16 }}>
        <div className="wfp-card-h">
          <div className="wfp-card-h-t">Топ виконавці · цей місяць</div>
          <div className="wfp-card-h-aux">→ повний звіт</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {executors.slice(0, 4).map((e) => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 120px 90px', gap: 12, alignItems: 'center' }}>
              <span className={`wfp-av wfp-av--${e.id}`} style={{ width: 32, height: 32, fontSize: 11 }}>
                {e.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>
                  {e.role} · {e.depts.join(', ')}
                </div>
              </div>
              <span className="wfp-mono" style={{ fontSize: 13, fontWeight: 600 }}>{e.hours_logged}h</span>
              <MiniBar value={e.utilization * 100} max={100} kind={e.utilization > 0.8 ? 'warn' : e.utilization > 0.5 ? 'good' : 'low'} />
              <span className="wfp-mono" style={{ fontSize: 12, textAlign: 'right', color: 'var(--wf-success)' }}>${e.earnings_month.toLocaleString('uk-UA')}</span>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

function KPI({ k, v, sub }) {
  return (
    <div className="wfp-card" style={{ padding: 16 }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{k}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 600, color: 'var(--wf-fg)', fontFeatureSettings: '"tnum"' }}>{v}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /reports/executors
// ──────────────────────────────────────────────────────────────────────
function ReportsExecutors() {
  const e = window.WFP_DATA.report_executors;
  const totalHours = e.reduce((s, x) => s + x.hours_logged, 0);
  const totalEarnings = e.reduce((s, x) => s + x.earnings_month, 0);

  return (
    <React.Fragment>
      <ReportsHeader active="executors" />

      <StatsRow>
        <Stat k="команда"            v={e.length}                            sub="1 superadmin · 1 lead · 4 executors" />
        <Stat k="всього годин"       v={`${totalHours}h`}                    sub="billable: 94%" kind="accent" />
        <Stat k="payroll · травень"  v={`$${totalEarnings.toLocaleString('uk-UA')}`} sub="нараховано" />
        <Stat k="середня utilization" v={`${Math.round(e.reduce((s, x) => s + x.utilization, 0) / e.length * 100)}%`} sub="ціль 75%" />
      </StatsRow>

      <FilterBar search searchPlaceholder="Шукати виконавця…">
        <button className="wfp-pill" data-on="true">всі ролі</button>
        <button className="wfp-pill">executors</button>
        <button className="wfp-pill">leads</button>
        <span style={{ width: 1, height: 24, background: 'var(--wf-border)', margin: '0 4px' }} />
        <button className="wfp-pill">всі підрозділи</button>
      </FilterBar>

      <table className="wfp-table">
        <thead>
          <tr>
            <th>Виконавець</th>
            <th>Роль</th>
            <th>Підрозділ</th>
            <th className="wfp-num">Годин</th>
            <th className="wfp-num">Billable</th>
            <th>Utilization</th>
            <th>Comments %</th>
            <th className="wfp-num">Активних</th>
            <th className="wfp-num">Rate $/h</th>
            <th className="wfp-num">Заробіток</th>
          </tr>
        </thead>
        <tbody>
          {e.map((x) => (
            <tr key={x.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`wfp-av wfp-av--${x.id}`} style={{ width: 22, height: 22, fontSize: 9 }}>
                    {x.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </span>
                  <span style={{ fontWeight: 500 }}>{x.name}</span>
                </div>
              </td>
              <td className="wfp-mono" style={{ fontSize: 11, color: x.role === 'superadmin' ? 'var(--wf-accent)' : x.role === 'lead' ? 'var(--wf-warning)' : 'var(--wf-fg-secondary)' }}>{x.role}</td>
              <td className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>{x.depts.join(', ')}</td>
              <td className="wfp-num">{x.hours_logged}h</td>
              <td className="wfp-num" style={{ color: 'var(--wf-fg-muted)' }}>{x.hours_billable}h</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MiniBar value={x.utilization * 100} max={100} kind={x.utilization > 0.85 ? 'warn' : x.utilization > 0.55 ? 'good' : 'low'} />
                  <span className="wfp-mono" style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>{Math.round(x.utilization * 100)}%</span>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MiniBar value={x.comments_ratio * 100} max={100} kind={x.comments_ratio > 0.85 ? 'good' : x.comments_ratio > 0.6 ? 'warn' : 'over'} />
                  <span className="wfp-mono" style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>{Math.round(x.comments_ratio * 100)}%</span>
                </div>
              </td>
              <td className="wfp-num">{x.active_tasks}</td>
              <td className="wfp-num">${x.rate}</td>
              <td className="wfp-num" style={{ color: 'var(--wf-success)', fontWeight: 600 }}>${x.earnings_month.toLocaleString('uk-UA')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', border: '1px dashed var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--wf-fg)' }}>// як читати:</strong>
        {' '}Utilization — це % робочого часу від норми (40h/тижд). Comments % — частка time-entries з заповненим коментарем (важливо для повноти специфікації клієнту). Anna 100% comments / 4% utilization = новий executor.
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /reports/clients
// ──────────────────────────────────────────────────────────────────────
function ReportsClients() {
  const c = window.WFP_DATA.report_clients;
  const totalRev = c.reduce((s, x) => s + x.revenue, 0);
  const totalDebt = c.reduce((s, x) => s + x.debt, 0);
  const maxRev = Math.max(...c.map((x) => x.revenue));

  return (
    <React.Fragment>
      <ReportsHeader active="clients" />

      <StatsRow>
        <Stat k="клієнтів активних" v={c.length} sub="за період" />
        <Stat k="виручка по всіх"   v={`$${totalRev.toLocaleString('uk-UA')}`} sub="травень" kind="accent" />
        <Stat k="середній margin"   v={`${Math.round(c.reduce((s, x) => s + x.margin, 0) / c.length * 100)}%`} sub="по клієнтах" />
        <Stat k="загальний борг"    v={`$${totalDebt.toLocaleString('uk-UA')}`} sub={`${c.filter((x) => x.debt > 0).length} клієнтів`} kind="warn" />
      </StatsRow>

      <table className="wfp-table">
        <thead>
          <tr>
            <th>Клієнт</th>
            <th>Tier</th>
            <th className="wfp-num">Виручка</th>
            <th>% від загального</th>
            <th className="wfp-num">Годин</th>
            <th>Margin</th>
            <th className="wfp-num">Активних</th>
            <th className="wfp-num">Закрито</th>
            <th className="wfp-num">Борг</th>
            <th>Last order</th>
          </tr>
        </thead>
        <tbody>
          {c.map((x) => (
            <tr key={x.slug}>
              <td><span className="wfp-link" style={{ fontWeight: 500 }}>{x.name}</span></td>
              <td><TierBadge tier={x.tier} /></td>
              <td className="wfp-num" style={{ color: 'var(--wf-fg)', fontWeight: 600 }}>${x.revenue.toLocaleString('uk-UA')}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MiniBar value={x.revenue} max={maxRev} kind="good" />
                  <span className="wfp-mono" style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>{Math.round(x.revenue / totalRev * 100)}%</span>
                </div>
              </td>
              <td className="wfp-num">{x.hours}h</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MiniBar value={x.margin * 100} max={50} kind={x.margin > 0.30 ? 'good' : x.margin > 0.20 ? 'warn' : 'over'} />
                  <span className="wfp-mono" style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>{Math.round(x.margin * 100)}%</span>
                </div>
              </td>
              <td className="wfp-num">{x.orders_active}</td>
              <td className="wfp-num">{x.orders_closed}</td>
              <td className="wfp-num" style={{ color: x.debt > 0 ? 'var(--wf-destructive)' : 'var(--wf-fg-muted)' }}>
                {x.debt > 0 ? `$${x.debt.toLocaleString('uk-UA')}` : '—'}
              </td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{x.last_order}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /reports/timesheet — flat chronological view
// ──────────────────────────────────────────────────────────────────────
function ReportsTimesheet() {
  const t = window.WFP_DATA.report_timesheet;
  const totalMin = t.reduce((s, x) => s + x.minutes, 0);
  const withComments = t.filter((x) => x.comment).length;

  // Group by date
  const grouped = {};
  t.forEach((x) => {
    grouped[x.date] = grouped[x.date] || { day: x.day, entries: [], total: 0 };
    grouped[x.date].entries.push(x);
    grouped[x.date].total += x.minutes;
  });

  return (
    <React.Fragment>
      <ReportsHeader active="timesheet" />

      <StatsRow>
        <Stat k="записів"            v={t.length}    sub={`за ${Object.keys(grouped).length} днів`} />
        <Stat k="загальний час"      v={`${(totalMin / 60).toFixed(1)}h`} sub="через всю команду" kind="accent" />
        <Stat k="з коментарями"      v={`${withComments} / ${t.length}`}  sub={`${Math.round(withComments / t.length * 100)}% — до спеки`} kind={withComments / t.length > 0.8 ? 'accent' : 'warn'} />
        <Stat k="середня сесія"      v={`${Math.round(totalMin / t.length)}m`} sub="по всіх" />
      </StatsRow>

      <FilterBar search searchPlaceholder="Шукати в timesheet (виконавець, задача, клієнт)…">
        <button className="wfp-pill" data-on="true">за тиждень</button>
        <button className="wfp-pill">за місяць</button>
        <button className="wfp-pill">за квартал</button>
        <span style={{ width: 1, height: 24, background: 'var(--wf-border)', margin: '0 4px' }} />
        <button className="wfp-pill">всі виконавці</button>
        <button className="wfp-pill">всі клієнти</button>
      </FilterBar>

      <div className="wfp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 24px 24px 110px 110px 1fr 60px', gap: 10, padding: '10px 14px', background: 'color-mix(in oklab, var(--wf-fg) 2.5%, transparent)', borderBottom: '1px solid var(--wf-border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>дата</span>
          <span>д</span>
          <span></span>
          <span>задача</span>
          <span>клієнт</span>
          <span>коментар</span>
          <span style={{ textAlign: 'right' }}>хв</span>
        </div>
        {Object.entries(grouped).map(([date, group], gi) => (
          <React.Fragment key={date}>
            {group.entries.map((x, i) => (
              <div className="wfp-ts-row" key={`${date}-${i}`}>
                <span className="wfp-ts-date">{i === 0 ? date : ''}</span>
                <span className="wfp-ts-day">{i === 0 ? group.day : ''}</span>
                <span className={`wfp-av wfp-av--${x.executor}`} style={{ width: 22, height: 22, fontSize: 9 }}>
                  {x.executor === 'illia' ? 'ІВ' : x.executor === 'oleh' ? 'ОШ' : x.executor === 'maria' ? 'МБ' : x.executor === 'pavlo' ? 'ПК' : x.executor === 'denys' ? 'ДІ' : x.executor[0].toUpperCase()}
                </span>
                <span className="wfp-ts-task">{x.task}</span>
                <span className="wfp-ts-client">{x.client}</span>
                <span className={`wfp-ts-comment${!x.comment ? ' wfp-ts-comment--empty' : ''}`}>{x.comment || 'без коментаря'}</span>
                <span className="wfp-ts-min">{x.minutes}m</span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '70px 24px 1fr 60px', gap: 10, padding: '8px 14px', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', borderBottom: '1px solid var(--wf-border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              <span></span>
              <span></span>
              <span style={{ color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>// {date} разом</span>
              <span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--wf-fg)' }}>{(group.total / 60).toFixed(1)}h</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /reports/audit — system audit log
// ──────────────────────────────────────────────────────────────────────
function ReportsAudit() {
  const log = window.WFP_DATA.audit_log;
  return (
    <React.Fragment>
      <ReportsHeader active="audit" />

      <StatsRow>
        <Stat k="подій · 7 днів"     v={log.length} sub="всі дії в системі" />
        <Stat k="user actions"       v={log.filter((x) => x.actor !== 'system' && x.actor !== 'workflo').length} sub="люди" />
        <Stat k="auto / system"      v={log.filter((x) => x.actor === 'system' || x.actor === 'workflo').length} sub="webhook, reminder, cron" />
        <Stat k="settings changes"   v={log.filter((x) => x.kind === 'settings').length} sub="за період" kind="warn" />
      </StatsRow>

      <FilterBar search searchPlaceholder="Шукати event (актор / subject / detail)…">
        <button className="wfp-pill" data-on="true">всі типи</button>
        <button className="wfp-pill">task</button>
        <button className="wfp-pill">document</button>
        <button className="wfp-pill">payment</button>
        <button className="wfp-pill">settings</button>
        <span style={{ width: 1, height: 24, background: 'var(--wf-border)', margin: '0 4px' }} />
        <button className="wfp-pill">тільки зміни значень</button>
        <button className="wfp-pill">тільки system</button>
      </FilterBar>

      <div className="wfp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 100px 84px 140px 1fr 130px', gap: 12, padding: '10px 14px', background: 'color-mix(in oklab, var(--wf-fg) 2.5%, transparent)', borderBottom: '1px solid var(--wf-border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>timestamp</span>
          <span>actor</span>
          <span>type</span>
          <span>subject</span>
          <span>зміна · попереднє → нове</span>
          <span style={{ textAlign: 'right' }}>source</span>
        </div>
        {log.map((x, i) => (
          <div className="wfp-audit-row wfp-audit-row--v2" key={i}>
            <span className="wfp-audit-ts">{x.ts}</span>
            <span className={`wfp-audit-actor${x.actor === 'system' || x.actor === 'workflo' ? ' wfp-audit-actor--system' : ''}`}>{x.actor}</span>
            <span><span className={`wfp-audit-kind wfp-audit-kind--${x.kind}`}>{x.kind}</span></span>
            <span className="wfp-audit-subject">{x.subject}</span>
            <span className="wfp-audit-change">
              {x.from !== undefined
                ? <React.Fragment>
                    {x.field && <span className="wfp-audit-field">{x.field}</span>}
                    <span className="wfp-audit-from">{x.from}</span>
                    <Icon name="chevron" size={11} color="var(--wf-fg-subtle)" />
                    <span className="wfp-audit-to">{x.to}</span>
                  </React.Fragment>
                : <span className="wfp-audit-detail">{x.detail}</span>}
            </span>
            <span className="wfp-audit-ip">{x.ip}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', border: '1px dashed var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--wf-fg)' }}>// audit log retention:</strong>
        {' '}Записи зберігаються 18 місяців. Експорт CSV для бухгалтерії включає всі payment + document events.
        {' '}<strong style={{ color: 'var(--wf-fg)' }}>// security:</strong>
        {' '}IP-адреси маскуються (останній октет ***). Сесії доступні в /settings/security.
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /reports/departments
// ──────────────────────────────────────────────────────────────────────
function ReportsDepartments() {
  const d = window.WFP_DATA.report_departments;
  const totalHours = d.reduce((s, x) => s + x.hours, 0);
  const totalRev = d.reduce((s, x) => s + x.revenue, 0);

  return (
    <React.Fragment>
      <ReportsHeader active="departments" />

      <StatsRow>
        <Stat k="підрозділів активних" v={d.length} sub="всі задіяні" />
        <Stat k="загальний throughput" v={d.reduce((s, x) => s + x.throughput, 0)} sub="закрито за період" kind="accent" />
        <Stat k="середній cycle time" v={`${(d.reduce((s, x) => s + x.cycle, 0) / d.length).toFixed(1)}d`} sub="від інтейку до закриття" />
        <Stat k="bottleneck" v="Dev" sub="cycle 13.4d · вище за норму" kind="warn" />
      </StatsRow>

      <div className="wfp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '10px 14px', background: 'color-mix(in oklab, var(--wf-fg) 2.5%, transparent)', borderBottom: '1px solid var(--wf-border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>підрозділ</span>
          <span>години</span>
          <span>виручка</span>
          <span>throughput</span>
          <span>cycle time</span>
          <span>utilization</span>
        </div>
        {d.map((x) => (
          <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px', borderBottom: '1px solid var(--wf-border)', alignItems: 'center' }}>
            <div>
              <DeptBadge id={x.id} />
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 4 }}>
                {Math.round(x.hours / totalHours * 100)}% від загального
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600 }}>{x.hours}h</div>
              <MiniBar value={x.hours} max={totalHours / 2} kind="good" />
            </div>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600 }}>${x.revenue.toLocaleString('uk-UA')}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>{Math.round(x.revenue / totalRev * 100)}% revenue</div>
            </div>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600 }}>{x.throughput}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>tasks closed</div>
            </div>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600, color: x.cycle > 12 ? 'var(--wf-warning)' : 'var(--wf-fg)' }}>{x.cycle}d</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>avg per task</div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MiniBar value={x.utilization * 100} max={100} kind={x.utilization > 0.75 ? 'warn' : x.utilization > 0.4 ? 'good' : 'low'} />
                <span className="wfp-mono" style={{ fontSize: 12, fontWeight: 600 }}>{Math.round(x.utilization * 100)}%</span>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 4 }}>
                {x.utilization > 0.75 ? '🔥 перенавантаження' : x.utilization > 0.4 ? 'у нормі' : 'потенціал'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

Object.assign(window, {
  ReportsOverview,
  ReportsExecutors,
  ReportsClients,
  ReportsDepartments,
  ReportsTimesheet,
  ReportsAudit,
});
