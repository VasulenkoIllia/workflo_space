// workspace-monitoring.jsx — G6 · System Monitoring dashboard (/admin/system).
// owner-only operational health. Sections: health cards · cron heatmap ·
// notification health · audit feed · error log. Reuses PageHeader/Icon/WfAvatar.

function SystemMonitoring() {
  const d = window.WFP_MONITORING;
  return (
    <React.Fragment>
      <PageHeader title="Адмін · Моніторинг системи" subtitle="// owner · здоровʼя системи в реальному часі">
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-accent)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>● live</span>
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Оновити · демо', 'ok')}><Icon name="clock" size={13} />Оновити</button>
      </PageHeader>

      <div className="wfsm">
        {/* 1. health cards */}
        <div>
          <div className="wfsm-sec-h"><strong>Здоровʼя</strong> <span>// ключові метрики</span></div>
          <div className="wfsm-health">
            {d.health.map((h) => (
              <div className="wfsm-hcard" data-s={h.state} key={h.id}>
                <div className="wfsm-hcard-label">{h.label}</div>
                <div className={`wfsm-hcard-v${h.link ? ' is-link' : ''}`}>{h.value}</div>
                <div className="wfsm-hcard-sub">{h.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. cron heatmap */}
        <div>
          <div className="wfsm-sec-h"><strong>Крони · 7 днів</strong> <span>// клік на клітину → лог запуску</span></div>
          <div className="wfsm-heatmap">
            <div className="wfsm-hm-row is-head">
              <div className="wfsm-hm-name" style={{ color: 'var(--wf-fg-muted)', fontSize: 10.5 }}>// задача</div>
              {d.heatmapDays.map((day) => <div className="wfsm-hm-day" key={day}>{day}</div>)}
            </div>
            {d.heatmap.map((row) => (
              <div className="wfsm-hm-row" key={row.name}>
                <div className="wfsm-hm-name">{row.name}</div>
                {row.cells.map((c, i) => <div className="wfsm-hm-cell" data-s={c} key={i} title={c} />)}
              </div>
            ))}
          </div>
        </div>

        {/* 3+4. notif health | audit feed */}
        <div className="wfsm-grid2">
          <div>
            <div className="wfsm-sec-h"><strong>Канали сповіщень</strong> <span>// success rate</span></div>
            {d.notifChannels.map((c) => (
              <div className="wfsm-chan" data-s={c.state} key={c.id}>
                <span className="wfsm-chan-label">{c.label}</span>
                <span className="wfsm-chan-bar"><span className="wfsm-chan-bar-fill" style={{ width: `${c.rate}%` }} /></span>
                <span className="wfsm-chan-rate">{c.rate}%</span>
                <span className="wfsm-chan-sent">{c.sent}</span>
              </div>
            ))}
            <div className="wfsm-blocked">
              <div className="wfsm-blocked-h"><span>⚠ заблоковані отримувачі</span><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('retry failed · демо', 'ok')}>retry failed</button></div>
              {d.blocked.map((b, i) => (
                <div className="wfsm-blocked-row" key={i}><span>{b.who}</span><span>{b.channel} · {b.reason}</span></div>
              ))}
            </div>
          </div>

          <div>
            <div className="wfsm-sec-h"><strong>Audit log</strong> <span>// дії користувачів</span></div>
            <div className="wfsm-card">
              <div className="wfsm-card-h"><Icon name="lock" size={13} />останні дії<span className="live">live tail</span></div>
              {d.audit.map((a, i) => {
                const av = window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[a.actor];
                return (
                  <div className="wfsm-audit-row" key={i}>
                    <span className="wfsm-audit-ts">{a.ts}</span>
                    <div>
                      <span className="wfsm-audit-action">{a.action}</span>
                      <span className="wfsm-audit-badge" data-l={a.level}>{a.level}</span>
                      <div className="wfsm-audit-what">{a.actor === 'system' ? 'system' : a.actor} · {a.what}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 5. error log */}
        <div>
          <div className="wfsm-sec-h"><strong>Error log · Sentry</strong> <span>// топ issues за годину</span></div>
          <div className="wfsm-card">
            {d.errors.map((e) => (
              <div className="wfsm-err-row" key={e.id}>
                <span className="wfsm-err-count">{e.count}</span>
                <div className="wfsm-err-main">
                  <div className="wfsm-err-title">{e.title}</div>
                  <div className="wfsm-err-meta">{e.id} · востаннє {e.lastSeen} тому</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="wfsm-err-state" data-s={e.state}>{e.state}</span>
                  {e.state === 'unresolved' && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">resolve</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { SystemMonitoring });
