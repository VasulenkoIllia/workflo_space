// workspace-reports-v1.jsx — Reports v1 (19-А 5 reports · 19-Б export · 19-Д MoM)
// + Cash-flow forecast (22-Г).

const _rv = React.useState;
const usd = (n) => '$' + Math.abs(n).toLocaleString('en-US');

// export buttons with simulated feedback (19-Б)
function ExportButtons() {
  const [busy, setBusy] = _rv(null);
  const go = (fmt) => { setBusy(fmt); setTimeout(() => setBusy('done-' + fmt), 900); };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {['XLSX', 'CSV'].map((f) => (
        <button key={f} className="wfp-btn wfp-btn--sm" onClick={() => go(f)} disabled={busy === f}>
          <Icon name="download" size={12} />{busy === f ? '…' : busy === 'done-' + f ? '✓ ' + f : f}
        </button>
      ))}
    </div>
  );
}

// simple vertical bar chart
function Bars({ data, labels, color = 'var(--wf-accent)', fmt = usd, height = 150 }) {
  const max = Math.max(...data) * 1.1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height, padding: '8px 0' }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>{fmt(v)}</div>
          <div style={{ width: '70%', maxWidth: 44, height: `${(v / max) * 100}%`, background: typeof color === 'function' ? color(i) : color, borderRadius: '5px 5px 0 0', minHeight: 4 }} />
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}

function MarginBar({ pct }) {
  return <div className="wfc-bar" style={{ width: 90, display: 'inline-block', verticalAlign: 'middle' }}><div className="wfc-bar-fill" style={{ width: pct + '%' }} /></div>;
}

const REPV1_TABS = [['revenue', 'Виручка'], ['margin', 'Маржа'], ['debtors', 'Дебіторка'], ['util', 'Завантаженість'], ['clients', 'Нові клієнти']];

function WsReportsV1() {
  const D = window.WF_REPORTS;
  const R = D.REP;
  const [tab, setTab] = _rv('revenue');
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Звіти</h1><div className="wfp-ph-sub">// бізнес-звіти v1 · експорт XLSX/CSV на кожному</div></div>
      </div>

      {/* MoM deltas (19-Д) */}
      <div className="wfp-stats" style={{ marginBottom: 22 }}>
        {D.MOM.map((m) => {
          const good = m.inverse ? m.delta < 0 : m.delta > 0;
          return (
            <div key={m.k} className="wfp-stat">
              <div className="wfp-stat-k">{m.k}</div>
              <div className="wfp-stat-v" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>{m.v}
                <span style={{ fontSize: 12, fontWeight: 600, color: good ? 'var(--wf-success)' : 'var(--wf-destructive)' }}>{m.delta > 0 ? '▲' : '▼'} {Math.abs(m.delta)}%</span>
              </div>
              <div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>MoM</div>
            </div>
          );
        })}
      </div>

      <div className="wfdk-toolbar" style={{ marginBottom: 18 }}>
        <div className="wfdk-seg">{REPV1_TABS.map(([id, l]) => <div key={id} className="wfdk-seg-opt" data-on={tab === id || undefined} onClick={() => setTab(id)}>{l}</div>)}</div>
        <span style={{ flex: 1 }} />
        <ExportButtons />
      </div>

      {tab === 'revenue' && (
        <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 22, alignItems: 'start' }}>
          <div className="wfl-panel"><div className="wfl-panel-h"><span>// виручка по місяцях</span></div><div className="wfl-panel-b"><Bars data={R.revenueByMonth} labels={R.months} /></div></div>
          <div className="wfl-panel"><div className="wfl-panel-h"><span>// по клієнтах</span></div><div className="wfl-panel-b" style={{ gap: 10 }}>
            {R.revenueByClient.map((c) => { const max = R.revenueByClient[0].value; return (
              <div key={c.client} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 70px', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 12.5 }}>{c.client}</span>
                <div className="wfc-bar"><div className="wfc-bar-fill" style={{ width: (c.value / max * 100) + '%' }} /></div>
                <span className="wfp-num wf-mono" style={{ fontSize: 12 }}>{usd(c.value)}</span>
              </div>
            ); })}
          </div></div>
        </div>
      )}

      {tab === 'margin' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>
          {[['по клієнтах', R.marginByClient], ['по проєктах', R.marginByProject]].map(([title, rows]) => (
            <div key={title}>
              <div className="wfc-sec-h"><span className="wfc-sec-h-t" style={{ fontSize: 13 }}>Маржа {title}</span></div>
              <table className="wfp-table">
                <thead><tr><th>{title === 'по клієнтах' ? 'Клієнт' : 'Проєкт'}</th><th className="wfp-num">Дохід</th><th className="wfp-num">Собів.</th><th>Маржа</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.name}><td style={{ fontWeight: 500 }}>{r.name}</td><td className="wfp-num">{usd(r.revenue)}</td><td className="wfp-num" style={{ color: 'var(--wf-fg-muted)' }}>{usd(r.cost)}</td><td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><MarginBar pct={r.margin} /><span className="wfc-margin-v">{r.margin}%</span></span></td></tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === 'debtors' && (
        <table className="wfp-table">
          <thead><tr><th>Клієнт</th><th>Рахунок</th><th className="wfp-num">Борг</th><th>Прострочення</th></tr></thead>
          <tbody>{R.debtors.map((d) => (
            <tr key={d.invoice}><td style={{ fontWeight: 500 }}>{d.client}</td><td className="wfp-mono"><span className="wfp-link">{d.invoice}</span></td><td className="wfp-num" style={{ color: 'var(--wf-warning)', fontWeight: 600 }}>{usd(d.debt)}</td><td><span className="wfg-pill2" data-tone={d.overdue > 14 ? 'bad' : 'warn'}><span className="wfg-pill2-dot" />{d.overdue} дн</span></td></tr>
          ))}</tbody>
        </table>
      )}

      {tab === 'util' && (
        <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 14 }}>
          {R.utilization.map((u) => (
            <div key={u.name} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 50px', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>{u.name}</span>
              <div className="wfc-bar" style={{ height: 8 }}><div className="wfc-bar-fill" data-tone={u.util > 90 ? 'bad' : u.util < 60 ? 'warn' : undefined} style={{ width: u.util + '%' }} /></div>
              <span className="wfp-num wf-mono" style={{ fontSize: 12 }}>{u.util}%</span>
            </div>
          ))}
        </div></div>
      )}

      {tab === 'clients' && (
        <div className="wfl-panel"><div className="wfl-panel-h"><span>// нові клієнти (стовпчик) · реєстрації (число)</span></div><div className="wfl-panel-b">
          <Bars data={R.newClients.map((c) => c.clients)} labels={R.newClients.map((c) => c.month)} fmt={(v) => v} color="var(--wf-accent)" />
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>
            {R.newClients.map((c) => <span key={c.month}>{c.regs} реєстр.</span>)}
          </div>
        </div></div>
      )}
    </React.Fragment>
  );
}

// ════════════════ Cash-flow прогноз (22-Г) ════════════════
function WsCashFlow() {
  const C = window.WF_REPORTS.CASHFLOW;
  const [horizon, setHorizon] = React.useState(3); // 1 | 2 | 3 months
  const idx = C.months.map((_, i) => i).slice(0, horizon);
  let bal = C.opening;
  const running = C.months.map((_, i) => { bal = bal + C.inflow[i] - C.outflow[i]; return bal; });
  const max = Math.max(...C.inflow.slice(0, horizon), ...C.outflow.slice(0, horizon)) * 1.1;
  const sumIn = idx.reduce((a, i) => a + C.inflow[i], 0);
  const sumOut = idx.reduce((a, i) => a + C.outflow[i], 0);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Cash-flow прогноз</h1><div className="wfp-ph-sub">// надходження (нарахування + payment terms) vs витрати · горизонт {horizon} міс</div></div>
        <div className="wfp-ph-r" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="wff-seg">
            {[1, 2, 3].map((h) => <button key={h} className="wff-seg-opt" data-on={horizon === h || undefined} onClick={() => setHorizon(h)}>{h} міс</button>)}
          </div>
          <ExportButtons />
        </div>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 22 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">баланс зараз</div><div className="wfp-stat-v">{usd(C.opening)}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">надходження ({horizon} міс)</div><div className="wfp-stat-v wfp-stat-v--accent">{usd(sumIn)}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">витрати ({horizon} міс)</div><div className="wfp-stat-v wfp-stat-v--warn">{usd(sumOut)}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">прогноз на кінець</div><div className={`wfp-stat-v ${running[horizon - 1] >= C.opening ? 'wfp-stat-v--accent' : 'wfp-stat-v--warn'}`}>{usd(running[horizon - 1])}</div></div>
      </div>

      <div className="wfl-panel" style={{ marginBottom: 22 }}>
        <div className="wfl-panel-h"><span>// надходження ▲ vs витрати ▼ · баланс наростаючим</span></div>
        <div className="wfl-panel-b">
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', height: 200 }}>
            {idx.map((i) => {
              const mo = C.months[i];
              return (
              <div key={mo} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-success)' }}>{usd(C.inflow[i])}</span>
                    <div style={{ width: 30, height: `${C.inflow[i] / max * 100}%`, background: 'var(--wf-success, #1F8A5B)', borderRadius: '5px 5px 0 0' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-destructive)' }}>{usd(C.outflow[i])}</span>
                    <div style={{ width: 30, height: `${C.outflow[i] / max * 100}%`, background: 'var(--wf-destructive, #DC2626)', borderRadius: '5px 5px 0 0' }} />
                  </div>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600 }}>{mo}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: running[i] >= C.opening ? 'var(--wf-fg-muted)' : 'var(--wf-destructive)' }}>баланс {usd(running[i])}</div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        {[['Надходження · структура', C.breakdownIn, 'var(--wf-success, #1F8A5B)'], ['Витрати · структура', C.breakdownOut, 'var(--wf-destructive, #DC2626)']].map(([title, rows, col]) => {
          const tot = rows.reduce((a, b) => a + b.value, 0);
          return (
            <div key={title} className="wfl-panel"><div className="wfl-panel-h"><span>// {title.toLowerCase()}</span></div><div className="wfl-panel-b" style={{ gap: 10 }}>
              {rows.map((r) => (
                <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 10, alignItems: 'center' }}>
                  <div><div style={{ fontSize: 12.5 }}>{r.label}</div><div className="wfc-bar" style={{ marginTop: 5 }}><div className="wfc-bar-fill" style={{ width: (r.value / tot * 100) + '%', background: col }} /></div></div>
                  <span className="wfp-num wf-mono" style={{ fontSize: 12 }}>{usd(r.value)}</span>
                </div>
              ))}
            </div></div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { WsReportsV1, WsCashFlow });
