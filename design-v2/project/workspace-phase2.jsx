// workspace-phase2.jsx — Phase-2 workspace features:
//   AgencySwitcherPop (ADR-004) · DbMetrics (G6 ext) · ClientMargin (G9 ext).

const wfp2Usd = (n) => '$' + Math.abs(n).toLocaleString('en-US');

// ── ADR-004 · multi-agency switcher (topbar popover) ──
function AgencySwitcherPop() {
  const ag = window.WFP_AGENCIES;
  return (
    <div className="wfp2-agency-pop">
      <div className="wfp2-agency-h">// ваші агенції · {ag.length}</div>
      {ag.map((a) => (
        <div key={a.id} className="wfp2-agency-row" data-active={a.active || undefined}>
          <span className="wfp2-agency-av">{a.name[0].toUpperCase()}</span>
          <div className="wfp2-agency-meta">
            <div className="wfp2-agency-name">{a.name}</div>
            <div className="wfp2-agency-sub">{a.members} у команді · {a.clients} клієнтів</div>
          </div>
          {a.active ? <Icon name="check" size={15} color="var(--wf-accent)" /> : <span className="wfp2-agency-role">{a.role}</span>}
        </div>
      ))}
      <div className="wfp2-agency-add"><Icon name="plus" size={13} />Приєднатись / створити агенцію</div>
    </div>
  );
}

// ── G6 ext · DB metrics ──
function DbMetrics() {
  const d = window.WFP_DB_METRICS;
  const connPct = (d.conn.active / d.conn.max) * 100;
  const maxAvg = Math.max(...d.slowQueries.map((q) => q.avg));
  return (
    <React.Fragment>
      <PageHeader title="Моніторинг · База даних" subtitle="// Phase-2 · пул зʼєднань · cache · повільні запити">
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-accent)' }}>● live</span>
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Оновити · демо', 'ok')}><Icon name="clock" size={13} />Оновити</button>
      </PageHeader>

      <div className="wfp2-db-top">
        <div className="wfp2-db-card">
          <div className="wfp2-db-label">// пул зʼєднань</div>
          <div className="wfp2-db-v">{d.conn.active}<small> / {d.conn.max}</small></div>
          <div className="wfp2-db-bar"><span className="wfp2-db-bar-fill" data-warn={connPct > 70 || undefined} style={{ width: `${connPct}%` }} /></div>
          <div className="wfp2-db-sub">{d.conn.idle} idle · {Math.round(connPct)}% використано</div>
        </div>
        <div className="wfp2-db-card">
          <div className="wfp2-db-label">// cache hit ratio</div>
          <div className="wfp2-db-v" style={{ color: 'var(--wf-accent)' }}>{d.cacheHit}<small>%</small></div>
          <div className="wfp2-db-bar"><span className="wfp2-db-bar-fill" style={{ width: `${d.cacheHit}%` }} /></div>
          <div className="wfp2-db-sub">останні 24 год</div>
        </div>
        <div className="wfp2-db-card">
          <div className="wfp2-db-label">// queries / sec</div>
          <div className="wfp2-db-v">{d.qps}</div>
          <div className="wfp2-db-sub">середнє за хвилину</div>
        </div>
        <div className="wfp2-db-card">
          <div className="wfp2-db-label">// replica lag</div>
          <div className="wfp2-db-v">{d.replicaLag}</div>
          <div className="wfp2-db-sub">read-репліка в межах норми</div>
        </div>
      </div>

      <div style={{ marginTop: 22, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)' }}>// топ повільних запитів (pg_stat_statements)</div>
      <table className="wfp-table" style={{ marginTop: 10 }}>
        <thead><tr><th style={{ width: '42%' }}>Запит</th><th>Таблиця</th><th className="wfp-num">Викликів</th><th className="wfp-num">avg ms</th><th className="wfp-num">max ms</th><th></th></tr></thead>
        <tbody>
          {d.slowQueries.map((q, i) => (
            <tr key={i}>
              <td className="wfp-mono" style={{ fontSize: 11.5, color: 'var(--wf-fg-secondary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.q}</td>
              <td className="wfp-mono">{q.table}</td>
              <td className="wfp-num">{q.calls.toLocaleString('en-US')}</td>
              <td className="wfp-num">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                  <span className="wfp2-qbar" style={{ width: Math.max(8, (q.avg / maxAvg) * 60) }} />{q.avg}
                </span>
              </td>
              <td className="wfp-num" style={{ color: q.max > 600 ? 'var(--wf-destructive, #DC2626)' : 'var(--wf-fg)' }}>{q.max}</td>
              <td style={{ textAlign: 'right' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm">EXPLAIN</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ── G9 ext · per-client margin ──
function ClientMargin() {
  const d = window.WFP_CLIENT_MARGIN;
  return (
    <React.Fragment>
      <PageHeader title="Фінанси · Маржа по клієнтах" subtitle={`// Phase-2 · ${d.period} · дохід − собівартість (години × ставка)`}>
        <button className="wfp-btn"><Icon name="download" size={13} />CSV</button>
      </PageHeader>

      <StatsRow>
        <Stat k="дохід" v={wfp2Usd(d.totals.revenue)} kind="accent" sub="усі клієнти" />
        <Stat k="собівартість" v={wfp2Usd(d.totals.cost)} sub="години команди" />
        <Stat k="маржа" v={wfp2Usd(d.totals.margin)} sub={`${d.totals.marginPct}%`} />
        <Stat k="середня маржа" v={`${d.totals.marginPct}%`} kind="accent" sub="по портфелю" />
      </StatsRow>

      <table className="wfp-table" style={{ marginTop: 14 }}>
        <thead><tr><th style={{ width: '24%' }}>Клієнт</th><th className="wfp-num">Дохід</th><th className="wfp-num">Собівартість</th><th className="wfp-num">Год</th><th className="wfp-num">Ставка</th><th className="wfp-num">Маржа</th><th>Маржа %</th></tr></thead>
        <tbody>
          {d.rows.map((r) => {
            const margin = r.revenue - r.cost;
            const pct = Math.round((margin / r.revenue) * 100);
            return (
              <tr key={r.client}>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <WfAvatar kind={window.wfAvatarKindForIndustry ? window.wfAvatarKindForIndustry(r.industry) : 'startup'} size="xs" shape="circle" />{r.client}
                  </span>
                </td>
                <td className="wfp-num" style={{ color: 'var(--wf-success, #1F8A5B)' }}>{wfp2Usd(r.revenue)}</td>
                <td className="wfp-num">{wfp2Usd(r.cost)}</td>
                <td className="wfp-num wfp-mono">{r.hours}</td>
                <td className="wfp-num wfp-mono">${r.rate}/год</td>
                <td className="wfp-num" style={{ fontWeight: 600 }}>{wfp2Usd(margin)}</td>
                <td>
                  <span className="wfp2-margin-bar">
                    <span className="wfp2-margin-track"><span className="wfp2-margin-fill" data-low={pct < 45 || undefined} style={{ width: `${pct}%` }} /></span>
                    <span className="wfp2-margin-pct">{pct}%</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </React.Fragment>
  );
}

Object.assign(window, { AgencySwitcherPop, DbMetrics, ClientMargin });
