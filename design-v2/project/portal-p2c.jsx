// portal-p2c.jsx — Wallet top-up (25-А) · Referral funnel (09-Б).

const _pt = React.useState;

// ════════════════ Поповнення гаманця (25-А) ════════════════
function PortalWalletTopup({ onClose }) {
  const [amount, setAmount] = _pt(500);
  const [method, setMethod] = _pt('card');
  const [status, setStatus] = _pt('choose');
  const presets = [200, 500, 1000, 2500];
  const bonus = amount >= 1000 ? Math.round(amount * 0.03) : 0;
  const pay = () => { setStatus('processing'); setTimeout(() => setStatus('done'), 1600); };
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 460, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="coins" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Поповнити баланс</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          {status === 'done' ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <Icon name="check" size={34} color="var(--wf-success)" />
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>+${amount}{bonus > 0 ? ` (+$${bonus} бонус)` : ''}</div>
              <div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)', marginTop: 4 }}>Баланс поповнено</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-subtle)', marginTop: 10, lineHeight: 1.6 }}>→ webhook: topup.succeeded<br />→ ledger += ${amount + bonus}</div>
            </div>
          ) : (
            <React.Fragment>
              <div className="wfp-field"><label>Сума поповнення</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {presets.map((p) => <button key={p} className="wfp-btn" data-on={amount === p || undefined} style={amount === p ? { borderColor: 'var(--wf-accent)', background: 'var(--wf-accent-soft)' } : undefined} onClick={() => setAmount(p)}>${p}</button>)}
                </div>
                <input value={amount} onChange={(e) => setAmount(+e.target.value || 0)} type="number" />
              </div>
              {bonus > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: 'var(--wf-accent-soft)', border: '1px solid var(--wf-accent)', fontSize: 12.5, marginBottom: 12 }}><Icon name="gift" size={14} color="var(--wf-fg)" />Бонус +3% за поповнення від $1000: <strong>+${bonus}</strong></div>}
              <div className="wfp-field"><label>Спосіб оплати</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['card', 'receipt', 'Картка'], ['bank', 'building', 'Банківський переказ'], ['crypto', 'coins', 'USDT · TRC20']].map(([id, ic, l]) => (
                    <div key={id} className="wfpi-method" data-on={method === id || undefined} onClick={() => setMethod(id)}><Icon name={ic} size={15} color="var(--wf-fg-muted)" />{l}</div>
                  ))}
                </div>
              </div>
              <button className="wfpi-paybtn" style={{ marginTop: 14 }} onClick={pay} disabled={status === 'processing'}>{status === 'processing' ? <React.Fragment><span className="wfpi-spin" />Обробка…</React.Fragment> : <React.Fragment><Icon name="lock" size={15} />Поповнити на ${amount}</React.Fragment>}</button>
            </React.Fragment>
          )}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 25-А</span><button className="wfp-btn wfp-btn--primary" onClick={onClose}>{status === 'done' ? 'Готово' : 'Закрити'}</button></div>
      </div>
    </div>
  );
}

// Wrapper: wallet is the single balance; top-up handled here
function PortalWalletV2() {
  const [topup, setTopup] = _pt(false);
  return (
    <React.Fragment>
      {window.WalletPortal ? <WalletPortal tab="transactions" onTopup={() => setTopup(true)} /> : null}
      {topup && <PortalWalletTopup onClose={() => setTopup(false)} />}
    </React.Fragment>
  );
}

// ════════════════ Реферальна воронка (09-Б) ════════════════
const REF_FUNNEL = [
  { stage: 'Кліки по лінку', value: 142, color: '#A3D90D' },
  { stage: 'Реєстрації', value: 38, color: '#0EA5E9' },
  { stage: 'Перші замовлення', value: 12, color: '#8B5CF6' },
  { stage: 'Оплачені', value: 9, color: '#1F8A5B' },
];
const REF_RECENT = [
  { who: 'tably.io', stage: 'Оплачено', date: '12.06', bonus: 140 },
  { who: 'nordstream.co', stage: 'Перше замовлення', date: '09.06', bonus: 0 },
  { who: 'maker@gmail', stage: 'Реєстрація', date: '07.06', bonus: 0 },
];
function PortalReferralFunnel() {
  const top = REF_FUNNEL[0].value;
  const earned = REF_RECENT.reduce((s, r) => s + r.bonus, 0);
  return (
    <React.Fragment>
      <PageHeader title="Реферальна програма" subtitle="// ваш лінк · воронка переходів · нараховані бонуси" />

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '13px 16px', border: '1px solid var(--wf-border)', borderRadius: 12, background: 'var(--wf-subtle)', marginBottom: 22 }}>
        <Icon name="gift" size={16} color="var(--wf-accent)" />
        <code style={{ flex: '1 1 160px', minWidth: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>workflo.space/r/brunky-olena</code>
        <button className="wfp-btn wfp-btn--sm"><Icon name="copy" size={12} />Копіювати</button>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm"><Icon name="send" size={12} />Поділитися</button>
      </div>

      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}>
        <div>
          <div className="wfc-sec-h"><span className="wfc-sec-h-t">Воронка</span><span className="wfc-sec-h-s">// конверсія {Math.round(REF_FUNNEL[3].value / top * 100)}% клік→оплата</span></div>
          <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 14 }}>
            {REF_FUNNEL.map((f, i) => {
              const pct = Math.round(f.value / top * 100);
              const conv = i > 0 ? Math.round(f.value / REF_FUNNEL[i - 1].value * 100) : 100;
              return (
                <div key={f.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{f.stage}</span>
                    <span className="wf-mono" style={{ fontSize: 12 }}>{f.value}{i > 0 && <span style={{ color: 'var(--wf-fg-subtle)', marginLeft: 6 }}>{conv}%</span>}</span>
                  </div>
                  <div style={{ height: 26, borderRadius: 6, background: 'var(--wf-subtle)', overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: f.color, borderRadius: 6, transition: 'width .4s' }} /></div>
                </div>
              );
            })}
          </div></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="wfp-stat" style={{ border: '1px solid var(--wf-border)', borderRadius: 12, padding: 16, cursor: 'pointer' }} onClick={() => window.__portalNav && window.__portalNav('wallet')}>
            <div className="wfp-stat-k">зароблено бонусів</div><div className="wfp-stat-v wfp-stat-v--accent">${earned}</div>
            <div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-accent)', marginTop: 4 }}>зараховано в гаманець →</div>
          </div>
          <div>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t" style={{ fontSize: 13 }}>Останні переходи</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REF_RECENT.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--wf-border)', borderRadius: 10 }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.who}</div><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{r.stage} · {r.date}</div></div>
                  {r.bonus > 0 ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />+${r.bonus}</span> : <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />в процесі</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { PortalWalletTopup, PortalWalletV2, PortalReferralFunnel });
