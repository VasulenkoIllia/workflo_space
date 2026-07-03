// workspace-finance.jsx — G9 · Finance / Expenses. Inline-SVG donut + line chart.
// FinanceOverview · ExpensesTab · PnlChart · ExpenseModal · PnlReport.

const fmtUsd = (n) => '$' + Math.abs(n).toLocaleString('en-US');
const WFF_CAT = {};
(window.WFP_FINANCE.categories || []).forEach((c) => { WFF_CAT[c.id] = c; });

// donut chart (SVG, stroke-dasharray)
function Donut({ data, total }) {
  const R = 52, C = 2 * Math.PI * R, cx = 64, cy = 64;
  let acc = 0;
  return (
    <svg className="wff-donut" width="128" height="128" viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="color-mix(in oklab, var(--wf-fg) 7%, transparent)" strokeWidth="16" />
      {data.map((d, i) => {
        const frac = d.amount / total;
        const dash = frac * C;
        const off = acc;
        acc += dash;
        return (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={d.color} strokeWidth="16"
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off}
            transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
        );
      })}
      <text className="wff-donut-center-v" x="64" y="62" textAnchor="middle">{fmtUsd(total)}</text>
      <text className="wff-donut-center-k" x="64" y="76" textAnchor="middle">ВИТРАТИ / МІС</text>
    </svg>
  );
}

// line chart (3 series)
function LineChart({ pnl }) {
  const W = 720, H = 240, padL = 44, padR = 12, padT = 14, padB = 26;
  const all = [...pnl.revenue, ...pnl.expenses, ...pnl.profit];
  const max = Math.ceil(Math.max(...all) / 2000) * 2000;
  const n = pnl.months.length;
  const x = (i) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);
  const line = (arr) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const series = [
    { arr: pnl.revenue, color: 'var(--wf-success, #1F8A5B)' },
    { arr: pnl.expenses, color: 'var(--wf-destructive, #DC2626)' },
    { arr: pnl.profit, color: 'var(--wf-accent)' },
  ];
  const ticks = [0, max / 2, max];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <g className="wff-svg-grid">
        {ticks.map((t, i) => <line key={i} x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} />)}
      </g>
      {ticks.map((t, i) => <text key={i} className="wff-svg-axis" x={padL - 6} y={y(t) + 3} textAnchor="end">${t / 1000}k</text>)}
      {pnl.months.map((m, i) => <text key={i} className="wff-svg-axis" x={x(i)} y={H - 8} textAnchor="middle">{m}</text>)}
      {series.map((s, si) => (
        <React.Fragment key={si}>
          <polyline points={line(s.arr)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {s.arr.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.color} />)}
        </React.Fragment>
      ))}
    </svg>
  );
}

// ───────────── Overview ─────────────
function FinanceOverview({ embed }) {
  const f = window.WFP_FINANCE;
  const o = f.overview;
  return (
    <React.Fragment>
      {!embed && (
      <PageHeader title="Фінанси · Огляд" subtitle={`// ${f.period} · дохід − витрати = прибуток`}>
        <button className="wfp-btn"><Icon name="download" size={13} />CSV</button>
        <button className="wfp-btn wfp-btn--primary"><Icon name="plus" size={13} />Витрата</button>
      </PageHeader>
      )}

      <div className="wff-overview">
        <div className="wff-ocard">
          <span className="wff-ocard-label">// дохід</span>
          <span className="wff-ocard-v is-income">{fmtUsd(o.income)}</span>
          <span className="wff-ocard-delta" data-up="true">▲ {o.delta}% до квітня</span>
        </div>
        <div className="wff-ocard">
          <span className="wff-ocard-label">// витрати за категоріями</span>
          <div className="wff-donut-wrap">
            <Donut data={f.categories} total={o.expenses} />
            <div className="wff-legend">
              {f.categories.map((c) => (
                <div className="wff-legend-row" key={c.id}>
                  <span className="wff-legend-dot" style={{ background: c.color }} />
                  <span className="wff-legend-label">{c.label}</span>
                  <span className="wff-legend-amt">{fmtUsd(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="wff-ocard">
          <span className="wff-ocard-label">// чистий прибуток</span>
          <span className="wff-ocard-v is-net">{fmtUsd(o.net)}</span>
          <span className="wff-ocard-delta" data-up="true">маржа {o.margin}%</span>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <PnlChart embed />
      </div>
    </React.Fragment>
  );
}

// ───────────── P&L chart ─────────────
function PnlChart({ embed }) {
  const f = window.WFP_FINANCE;
  return (
    <div className="wff-chart">
      <div className="wff-chart-head">
        <div className="wff-chart-legend">
          <span className="wff-chart-leg"><span className="ln" style={{ background: 'var(--wf-success, #1F8A5B)' }} />дохід</span>
          <span className="wff-chart-leg"><span className="ln" style={{ background: 'var(--wf-destructive, #DC2626)' }} />витрати</span>
          <span className="wff-chart-leg"><span className="ln" style={{ background: 'var(--wf-accent)' }} />прибуток</span>
        </div>
        <div className="wff-period">
          <span className="wff-period-opt">3м</span>
          <span className="wff-period-opt" data-on="true">6м</span>
          <span className="wff-period-opt">рік</span>
        </div>
      </div>
      <LineChart pnl={f.pnl} />
    </div>
  );
}

// ───────────── Expenses tab ─────────────
const WFF_FREQ = { monthly: 'щомісяця', quarterly: 'щокварталу', yearly: 'щороку', once: 'разово' };
// normalise any recurring expense to a monthly-equivalent for MRR
const WFF_MONTHLY = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12, once: 0 };
function ExpensesTab({ embed }) {
  const f = window.WFP_FINANCE;
  const [type, setType] = React.useState('all'); // all | recurring | once
  const [cat, setCat] = React.useState('all');
  const rows = f.expenses.filter((e) =>
    (type === 'all' || (type === 'recurring' ? e.freq !== 'once' : e.freq === 'once')) &&
    (cat === 'all' || e.category === cat));
  const recurring = f.expenses.filter((e) => e.freq !== 'once' && e.active !== false);
  const mrr = Math.round(recurring.reduce((s, e) => s + e.amount * (WFF_MONTHLY[e.freq] || 0), 0));
  const oneTime = f.expenses.filter((e) => e.freq === 'once').reduce((s, e) => s + e.amount, 0);
  return (
    <React.Fragment>
      {!embed && (
      <PageHeader title="Фінанси · Витрати" subtitle="// ledger витрат · recurring + разові">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт · демо', 'ok')}><Icon name="download" size={13} />Експорт</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Нова витрата · демо', 'ok')}><Icon name="plus" size={13} />Нова витрата</button>
      </PageHeader>
      )}
      {!embed && (
      <Tabs items={[{ id: 'overview', label: 'Огляд' }, { id: 'expenses', label: 'Витрати' }, { id: 'pnl', label: 'P&L' }]} value="expenses" />
      )}

      <StatsRow>
        <Stat k="recurring · / міс" v={fmtUsd(mrr)} sub={`${recurring.length} підписок (monthly-eq)`} kind="accent" />
        <Stat k="разові · період" v={fmtUsd(oneTime)} sub="не в MRR" />
        <Stat k="позицій у ledger" v={f.expenses.length} sub={`${f.expenses.filter((e) => e.active === false).length} на паузі`} />
        <Stat k="категорій" v={f.categories.length} sub="розподіл у донаті" />
      </StatsRow>

      <div className="wff-filters">
        <div className="wff-seg">
          {[['all', 'усі'], ['recurring', 'recurring'], ['once', 'разові']].map(([id, l]) => (
            <button key={id} className="wff-seg-opt" data-on={type === id || undefined} onClick={() => setType(id)}>{l}</button>
          ))}
        </div>
        <select className="wff-catsel" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">всі категорії</option>
          {f.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      <table className="wfp-table" style={{ marginTop: 4 }}>
        <thead><tr><th style={{ width: '26%' }}>Назва</th><th>Категорія</th><th>Постачальник</th><th>Частота</th><th className="wfp-num">Сума</th><th className="wfp-num">/ міс (eq)</th><th>Звʼязок</th><th></th></tr></thead>
        <tbody>
          {rows.map((e) => {
            const cat2 = WFF_CAT[e.category] || {};
            const monthly = Math.round(e.amount * (WFF_MONTHLY[e.freq] || 0));
            return (
              <tr key={e.id} style={e.active === false ? { opacity: 0.5 } : undefined}>
                <td style={{ fontWeight: 500 }}>{e.name}{e.active === false && <span className="wff-paused">пауза</span>}</td>
                <td><span className="wff-cat"><span className="wff-cat-dot" style={{ background: cat2.color }} />{cat2.label}</span></td>
                <td>{e.vendor}</td>
                <td><span className="wff-freq" data-f={e.freq}>{WFF_FREQ[e.freq]}</span></td>
                <td className="wfp-num">{fmtUsd(e.amount)}</td>
                <td className="wfp-num wfp-mono" style={{ color: e.freq === 'once' ? 'var(--wf-fg-subtle)' : 'var(--wf-fg-secondary)' }}>{e.freq === 'once' ? '—' : fmtUsd(monthly)}</td>
                <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{e.linked}</td>
                <td style={{ textAlign: 'right' }}><button className="wfp-iconbtn"><Icon name="edit" size={13} /></button></td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--wf-fg-subtle)' }}>// немає витрат за фільтром</td></tr>}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ───────────── Expense modal (conditional fields) ─────────────
function ExpenseModal() {
  return (
    <div className="wfp-modal-overlay" style={{ position: 'relative', padding: 0, background: 'transparent', display: 'block' }}>
      <div className="wfp-modal wfp-modal--lg" style={{ margin: 0 }}>
        <div className="wfp-modal-h"><span className="wfp-modal-h-t">Нова витрата</span><span className="wfp-modal-h-aux">// finance.expense</span><span className="wfp-modal-h-close"><Icon name="close" size={15} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfcal-form">
            <div className="wfcal-field"><span className="wfcal-field-label">// тип</span>
              <div className="wfas-seg"><span className="wfas-seg-opt" data-on="true">recurring</span><span className="wfas-seg-opt">one-time</span></div>
            </div>
            <div className="wff-cond">
              <div className="wfcal-field"><span className="wfcal-field-label">// частота</span>
                <div className="wfas-seg"><span className="wfas-seg-opt" data-on="true">щомісяця</span><span className="wfas-seg-opt">щокварталу</span><span className="wfas-seg-opt">щороку</span></div>
              </div>
            </div>
            <div className="wfcal-field"><span className="wfcal-field-label">// назва</span><input className="wfcal-input" defaultValue="Supabase + Postgres" /></div>
            <div className="wfcal-form-row">
              <div className="wfcal-field"><span className="wfcal-field-label">// категорія</span>
                <select className="wfcal-input">{window.WFP_FINANCE.categories.map((c) => <option key={c.id}>{c.label}</option>)}</select>
              </div>
              <div className="wfcal-field"><span className="wfcal-field-label">// сума ($)</span><input className="wfcal-input" defaultValue="320" /></div>
            </div>
            <div className="wfcal-form-row">
              <div className="wfcal-field"><span className="wfcal-field-label">// з дати</span><input className="wfcal-input" defaultValue="15.02.2026" /></div>
              <div className="wfcal-field"><span className="wfcal-field-label">// звʼязок (компанія / виконавець)</span><input className="wfcal-input" defaultValue="—" /></div>
            </div>
            <div className="wfcal-field"><span className="wfcal-field-label">// нотатки</span><textarea className="wfcal-input" rows={2} style={{ resize: 'vertical' }} defaultValue="" /></div>
          </div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// recurring впливає на P&L щомісяця</span>
          <div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасувати · демо', 'ok')}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зберегти · демо', 'ok')}>Зберегти</button></div>
        </div>
      </div>
    </div>
  );
}

// ───────────── /reports/pnl table ─────────────
function PnlReport({ embed }) {
  const f = window.WFP_FINANCE;
  return (
    <React.Fragment>
      {!embed && (
      <PageHeader title="Звіт · P&L" subtitle="// дохід − витрати по місяцях + маржа">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('CSV export · демо', 'ok')}><Icon name="download" size={13} />CSV export</button>
      </PageHeader>
      )}
      <table className="wfp-table" style={{ marginTop: 6 }}>
        <thead><tr><th>Місяць</th><th className="wfp-num">Дохід</th><th className="wfp-num">Зарплати</th><th className="wfp-num">Інфра</th><th className="wfp-num">Софт</th><th className="wfp-num">Маркет.</th><th className="wfp-num">Витрати</th><th className="wfp-num">Прибуток</th><th className="wfp-num">Маржа</th></tr></thead>
        <tbody>
          {f.pnlTable.map((r, i) => (
            <tr key={i}>
              <td className="wfp-mono">{r.month}</td>
              <td className="wfp-num" style={{ color: 'var(--wf-success, #1F8A5B)' }}>{fmtUsd(r.revenue)}</td>
              <td className="wfp-num">{fmtUsd(r.salary)}</td>
              <td className="wfp-num">{fmtUsd(r.infra)}</td>
              <td className="wfp-num">{fmtUsd(r.software)}</td>
              <td className="wfp-num">{fmtUsd(r.marketing)}</td>
              <td className="wfp-num">{fmtUsd(r.total)}</td>
              <td className="wfp-num" style={{ color: 'var(--wf-accent)', fontWeight: 600 }}>{fmtUsd(r.profit)}</td>
              <td className="wfp-num wfp-mono">{r.margin}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ───────────── Finance hub (tabs: Огляд / Витрати / P&L) ─────────────
function FinanceHub() {
  const [tab, setTab] = React.useState('overview');
  return (
    <React.Fragment>
      <PageHeader title="Фінанси / Маржа" subtitle="// owner-only · дохід − витрати = прибуток · recurring + разові">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('CSV export · демо', 'ok')}><Icon name="download" size={13} />CSV export</button>
        <button className="wfp-btn wfp-btn--primary"><Icon name="plus" size={13} />Витрата</button>
      </PageHeader>
      <Tabs items={[{ id: 'overview', label: 'Огляд' }, { id: 'expenses', label: 'Витрати' }, { id: 'margin', label: 'Маржа' }, { id: 'pnl', label: 'P&L' }]} value={tab} onChange={setTab} />
      <div style={{ marginTop: 6 }}>
        {tab === 'overview' && <FinanceOverview embed />}
        {tab === 'expenses' && <ExpensesTab embed />}
        {tab === 'margin' && window.MarginTab && <MarginTab />}
        {tab === 'pnl' && <PnlReport embed />}
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { FinanceHub, FinanceOverview, PnlChart, ExpensesTab, ExpenseModal, PnlReport, Donut, LineChart });
