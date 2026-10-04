// round4-dlq.jsx — G17 · Notification DLQ + retry admin (extends G6).
// Queue card · filters · failed table (channel/event/recipient/attempts/error) ·
// per-row retry/details/skip · bulk retry/skip · payload modal · empty state.

const _dq = React.useState;

const DQ_ROWS = [
  { id: 'n-9914', ts: '01.06 14:21', event: 'order.status_changed', chan: 'email', to: 'i•••@brunki.ua', att: 3, err: 'SMTP 550 mailbox unavailable', cls: 'smtp' },
  { id: 'n-9910', ts: '01.06 13:08', event: 'payment.received', chan: 'telegram', to: '@mono•••', att: 5, err: 'bot was blocked by the user', cls: 'tg' },
  { id: 'n-9902', ts: '01.06 11:54', event: 'document.signed', chan: 'email', to: 'o•••@eduforge.io', att: 2, err: 'connection timeout after 30s', cls: 'net' },
  { id: 'n-9888', ts: '01.06 09:30', event: 'invoice.overdue', chan: 'in_app', to: 'user#412', att: 1, err: 'websocket peer not connected', cls: 'ws' },
  { id: 'n-9871', ts: '31.05 22:14', event: 'order.assigned', chan: 'telegram', to: '@andriy•••', att: 4, err: '429 Too Many Requests · retry-after 35', cls: 'rate' },
];
const DQ_CHAN_IC = { email: 'mail', telegram: 'send', in_app: 'bell' };

function R4Dlq() {
  const [rows, setRows] = _dq(DQ_ROWS);
  const [sel, setSel] = _dq(() => new Set());
  const [detail, setDetail] = _dq(null);
  const [chan, setChan] = _dq('all');

  const view = rows.filter((r) => chan === 'all' || r.chan === chan);
  const allOn = view.length > 0 && view.every((r) => sel.has(r.id));
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const toggleAll = () => { if (allOn) setSel(new Set()); else setSel(new Set(view.map((r) => r.id))); };
  const retry = (ids) => { setRows((rs) => rs.filter((r) => !ids.includes(r.id))); setSel(new Set()); };

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Notification DLQ</h1><div className="wfp-ph-sub">// dead-letter queue · ручна переспроба й escalation</div></div>
      </div>

      <div className="r4-queue">
        <div className="r4-queue-cell"><span className="r4-statcell-k">у черзі на retry</span><span className="r4-statcell-v" data-warn="true">{rows.length}</span></div>
        <div className="r4-queue-cell"><span className="r4-statcell-k">обробляється зараз</span><span className="r4-statcell-v">2</span></div>
        <div className="r4-queue-cell"><span className="r4-statcell-k">наступна спроба</span><span className="r4-statcell-v" style={{ fontSize: 15 }}>через 0:42</span></div>
        <div className="r4-queue-cell"><span className="r4-statcell-k">доставлено / 24г</span><span className="r4-statcell-v" data-ok="true">1 284</span></div>
      </div>

      <div className="wfp-filters" style={{ marginBottom: 16 }}>
        {['all', 'email', 'telegram', 'in_app'].map((c) => <button key={c} className="wfp-pill" data-on={chan === c || undefined} onClick={() => setChan(c)}>{c === 'all' ? 'усі канали' : c}</button>)}
        <span style={{ width: 1, height: 24, background: 'var(--wf-border)', margin: '0 4px' }} />
        <button className="wfp-pill">за віком</button>
        <button className="wfp-pill">клас помилки</button>
      </div>

      {sel.size > 0 && (
        <div className="r4-selbar">
          <span className="r4-selbar-count"><span className="r4-selbar-n">{sel.size}</span>обрано</span>
          <button className="r4-selbar-clear" onClick={() => setSel(new Set())}>скасувати</button>
          <div className="r4-selbar-actions">
            <button className="r4-selbar-btn" onClick={() => retry([...sel])}><Icon name="send" size={13} />Retry обрані</button>
            <button className="r4-selbar-btn r4-selbar-btn--danger" onClick={() => retry([...sel])}><Icon name="truck" size={13} />Skip → graveyard</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="wfm-empty" style={{ padding: '60px 20px', color: 'var(--wf-fg-muted)' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)' }}>{`[ ✓ ]`}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--wf-fg)' }}>Черга порожня</div>
          <div style={{ fontSize: 13 }}>Усе доставлено · нових помилок немає</div>
        </div>
      ) : (
        <table className="wfp-table">
          <thead><tr>
            <th className="r4-checkcell"><span className="r4-checkbox" data-on={allOn || undefined} onClick={toggleAll}><Icon name="check" size={12} /></span></th>
            <th>Час</th><th>Подія</th><th>Канал</th><th>Отримувач</th><th className="wfp-num">Спроб</th><th>Помилка</th><th></th>
          </tr></thead>
          <tbody>{view.map((r) => {
            const on = sel.has(r.id);
            return (
              <tr key={r.id} data-sel={on || undefined}>
                <td className="r4-checkcell"><span className="r4-checkbox" data-on={on || undefined} onClick={() => toggle(r.id)}><Icon name="check" size={12} /></span></td>
                <td className="wfp-mono">{r.ts}</td>
                <td className="wfp-mono" style={{ fontSize: 11.5 }}>{r.event}</td>
                <td><span className="r4-chan"><Icon name={DQ_CHAN_IC[r.chan]} size={11} />{r.chan}</span></td>
                <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{r.to}</td>
                <td className="wfp-num">{r.att}</td>
                <td title={r.err}><span className="r4-err">{r.err}</span></td>
                <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => retry([r.id])}><Icon name="send" size={11} />retry</button>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setDetail(r)}>деталі</button>
                </div></td>
              </tr>
            );
          })}</tbody>
        </table>
      )}

      {detail && (
        <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) setDetail(null); }}>
          <div className="wfp-modal wfp-modal--lg" style={{ width: 560, margin: 0 }}>
            <div className="wfp-modal-h"><Icon name="alert" size={18} color="var(--wf-destructive)" /><span className="wfp-modal-h-t">{detail.id} · {detail.event}</span><span className="wfp-modal-h-aux">// {detail.att} спроб · {detail.chan}</span><span className="wfp-modal-h-close" onClick={() => setDetail(null)}><Icon name="alert" size={14} /></span></div>
            <div className="wfp-modal-body">
              <div className="r4-note" style={{ marginBottom: 8 }}>// last error</div>
              <div className="r4-reveal" style={{ color: 'var(--wf-destructive)', marginBottom: 16 }}>{detail.err}</div>
              <div className="r4-note" style={{ marginBottom: 8 }}>// payload</div>
              <pre style={{ margin: 0, padding: 14, borderRadius: 9, background: 'var(--wf-fg)', color: 'var(--wf-bg)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, lineHeight: 1.6, overflow: 'auto' }}>{`{
  "event": "${detail.event}",
  "channel": "${detail.chan}",
  "recipient": "${detail.to}",
  "attempts": ${detail.att},
  "next_retry_at": "2026-06-01T15:03:00Z",
  "error_class": "${detail.cls}"
}`}</pre>
            </div>
            <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// module 07 · retry/DLQ contract</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn wfp-btn--danger-soft" onClick={() => { retry([detail.id]); setDetail(null); }}>Skip + причина</button><button className="wfp-btn wfp-btn--primary" onClick={() => { retry([detail.id]); setDetail(null); }}><Icon name="send" size={13} />Retry зараз</button></div></div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

Object.assign(window, { R4Dlq });
