// workspace-notify.jsx — Loyalty settings (10) · Notifications hub (07/13) ·
// Portal announcement banner (07-В).

const _nf = React.useState;

// small pill toggle reused across this file
function NfToggle({ on, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 38, height: 22, borderRadius: 999, border: 0, cursor: 'pointer', padding: 2, background: on ? 'var(--wf-accent)' : 'var(--wf-border-strong)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .12s' }}>
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
    </button>
  );
}

// ════════════════ Налаштування лояльності (10-А/В/Г) ════════════════
function WsLoyaltySettings() {
  const D = window.WF_NOTIFY;
  const [tiers, setTiers] = _nf(D.LOYALTY_TIERS);
  const [cfg, setCfg] = _nf(D.LOYALTY_CONFIG);
  const tog = (k) => setCfg({ ...cfg, [k]: !cfg[k] });
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Програма лояльності</h1><div className="wfp-ph-sub">// тіри · знижки · перки · автопідвищення</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зберегти · демо', 'ok')}><Icon name="check" size={14} />Зберегти</button></div>
      </div>

      <div className="wfl-panel" style={{ marginBottom: 20 }}>
        <div className="wfl-panel-h"><span>// правила</span></div>
        <div className="wfl-panel-b" style={{ gap: 0 }}>
          {[['applyOneTime', 'Знижка на разові послуги', 'Застосовувати тірову знижку до разових позицій'], ['applyHourly', 'Знижка на погодинні', 'Застосовувати знижку до погодинних нарахувань'], ['autoUpgrade', 'Автопідвищення тіру', 'Підвищувати тір автоматично при досягненні порогу']].map(([k, t, d], i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: i ? '1px solid var(--wf-border)' : 0 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{t}</div><div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)' }}>{d}</div></div>
              <NfToggle on={cfg[k]} onClick={() => tog(k)} />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid var(--wf-border)' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>Нотифікація при наближенні до тіру</div><div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)' }}>Сповіщати клієнта при досягненні {cfg.notifyAt}% порогу</div></div>
            <input type="range" min="50" max="100" value={cfg.notifyAt} onChange={(e) => setCfg({ ...cfg, notifyAt: +e.target.value })} style={{ width: 160, accentColor: 'var(--wf-accent)' }} />
            <span className="wf-mono" style={{ fontSize: 12, width: 38 }}>{cfg.notifyAt}%</span>
          </div>
        </div>
      </div>

      <div className="wfc-sec-h"><span className="wfc-sec-h-t">Тіри</span><span className="wfc-sec-h-s">// поріг LTV · знижка · перки</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tiers.map((t, i) => (
          <div key={t.id} className="wfl-panel">
            <div className="wfl-panel-b" style={{ display: 'grid', gridTemplateColumns: '14px 150px 150px 110px 1fr', gap: 16, alignItems: 'center' }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: t.color }} />
              <div className="wfp-field" style={{ gap: 4 }}><label>Назва</label><input defaultValue={t.name} /></div>
              <div className="wfp-field" style={{ gap: 4 }}><label>Поріг LTV ($)</label><input defaultValue={t.threshold} /></div>
              <div className="wfp-field" style={{ gap: 4 }}><label>Знижка %</label><input defaultValue={t.discount} /></div>
              <div className="wfp-field" style={{ gap: 4 }}><label>Перки</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {t.perks.map((p) => <span key={p} className="wfl-card-chip">{p}</span>)}
                  <span className="wfl-card-chip" style={{ cursor: 'pointer', borderStyle: 'dashed', border: '1px dashed var(--wf-border)' }}><Icon name="plus" size={10} />перк</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <button className="wfl-add" style={{ padding: 12 }} onClick={() => window.wfToast && window.wfToast('Додати тір · демо', 'ok')}><Icon name="plus" size={13} />Додати тір</button>
      </div>
    </React.Fragment>
  );
}

// ════════════════ Хаб нотифікацій (07 / 13) ════════════════
const NF_TABS = [['announce', 'Оголошення'], ['digest', 'Дайджест'], ['thresholds', 'Пороги відповіді'], ['matrix', 'Матриця'], ['test', 'Тест']];
function WsNotifications() {
  const D = window.WF_NOTIFY;
  const [tab, setTab] = _nf('announce');
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Сповіщення</h1><div className="wfp-ph-sub">// оголошення · дайджест · пороги · матриця каналів</div></div>
      </div>
      <div className="wfdk-toolbar" style={{ marginBottom: 18 }}>
        <div className="wfdk-seg">{NF_TABS.map(([id, l]) => <div key={id} className="wfdk-seg-opt" data-on={tab === id || undefined} onClick={() => setTab(id)}>{l}</div>)}</div>
      </div>
      {tab === 'announce' && <NfAnnounce D={D} />}
      {tab === 'digest' && <NfDigest D={D} />}
      {tab === 'thresholds' && <NfThresholds D={D} />}
      {tab === 'matrix' && <NfMatrix D={D} />}
      {tab === 'test' && <NfTest />}
    </React.Fragment>
  );
}

function NfAnnounce({ D }) {
  const [create, setCreate] = _nf(false);
  return (
    <React.Fragment>
      <div className="wfc-sec-h"><span className="wfc-sec-h-t">In-app оголошення</span><button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => setCreate(true)}><Icon name="plus" size={13} />Створити</button></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {D.ANNOUNCEMENTS.map((a) => {
          const pct = a.total ? Math.round((a.reads / a.total) * 100) : 0;
          return (
            <div key={a.id} className="wfl-panel">
              <div className="wfl-panel-b" style={{ gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div><div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div><div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)', marginTop: 3 }}>{a.body}</div></div>
                  {a.status === 'active' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активне</span> : a.status === 'scheduled' ? <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />заплановано</span> : <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />чернетка</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, paddingTop: 10, borderTop: '1px solid var(--wf-border)' }}>
                  <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>{a.audience} · з {a.from}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 280 }}>
                    <span className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>прочитали {a.reads}/{a.total}</span>
                    <div className="wfc-bar" style={{ flex: 1 }}><div className="wfc-bar-fill" style={{ width: pct + '%' }} /></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {create && <AnnounceModal onClose={() => setCreate(false)} />}
    </React.Fragment>
  );
}
function AnnounceModal({ onClose }) {
  const [aud, setAud] = _nf('all');
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 520, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="bell" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Нове оголошення</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfp-field"><label>Заголовок</label><input placeholder="напр. Планове оновлення" /></div>
          <div className="wfp-field" style={{ marginTop: 12 }}><label>Текст</label><textarea className="wfl-select" style={{ height: 70, padding: '8px 10px', resize: 'vertical' }} /></div>
          <div className="wfp-field" style={{ marginTop: 12 }}><label>Аудиторія</label>
            <div className="wfc-seg"><div className="wfc-seg-opt" data-on={aud === 'all' || undefined} onClick={() => setAud('all')}>Усі клієнти</div><div className="wfc-seg-opt" data-on={aud === 'seg' || undefined} onClick={() => setAud('seg')}>Сегмент</div></div>
          </div>
          {aud === 'seg' && <div className="wfp-field" style={{ marginTop: 12 }}><label>Сегмент</label><select className="wfl-select"><option>partner</option><option>з боргом</option><option>активні 90д</option></select></div>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, fontSize: 12.5 }}><input type="checkbox" defaultChecked />Вимагати підтвердження прочитання</label>
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 07-В</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Чернетку</button><button className="wfp-btn wfp-btn--primary" onClick={onClose}>Опублікувати</button></div></div>
      </div>
    </div>
  );
}

function NfDigest({ D }) {
  const [d, setD] = _nf(D.DIGEST);
  return (
    <div style={{ maxWidth: 620 }}>
      <div className="wfl-panel" style={{ marginBottom: 16 }}>
        <div className="wfl-panel-b" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center' }}>
          <NfToggle on={d.enabled} onClick={() => setD({ ...d, enabled: !d.enabled })} />
          <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>Ранковий дайджест</div><div style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>Зведення листом щоранку</div></div>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, paddingTop: 12, borderTop: '1px solid var(--wf-border)' }}>
            <div className="wfp-field"><label>Час</label><input defaultValue={d.time} /></div>
            <div className="wfp-field"><label>Часовий пояс</label><input defaultValue={d.tz} /></div>
            <div className="wfp-field"><label>Кому</label><select className="wfl-select" defaultValue={d.to}><option value="owner">Власнику</option><option value="team">Усій команді</option><option value="admins">Адмінам</option></select></div>
          </div>
        </div>
      </div>
      <div className="wfc-sec-h"><span className="wfc-sec-h-t">Склад дайджесту</span></div>
      <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 0 }}>
        {d.sections.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i ? '1px solid var(--wf-border)' : 0 }}>
            <div style={{ flex: 1, fontSize: 13 }}>{s.label}</div>
            <NfToggle on={s.on} onClick={() => setD({ ...d, sections: d.sections.map((x) => x.id === s.id ? { ...x, on: !x.on } : x) })} />
          </div>
        ))}
      </div></div>
    </div>
  );
}

function NfThresholds({ D }) {
  const t = D.WAIT_THRESHOLDS;
  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)', marginBottom: 16, lineHeight: 1.6 }}>Коли клієнт написав і не отримав відповіді — нагадуємо виконавцю, потім ескалюємо власнику. Рахується у робочих годинах.</div>
      <div className="wfl-panel">
        <div className="wfl-panel-b" style={{ gap: 16 }}>
          <div className="wfc-grid2">
            <div className="wfp-field"><label>Нагадати виконавцю через (год)</label><input defaultValue={t.remindAfter} /></div>
            <div className="wfp-field"><label>Ескалювати через (год)</label><input defaultValue={t.escalateAfter} /></div>
          </div>
          <div className="wfp-field"><label>Ескалювати до</label><select className="wfl-select" defaultValue={t.escalateTo}><option value="owner">Власника</option><option value="lead">Тімліда</option></select></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}><input type="checkbox" defaultChecked={t.workHoursOnly} />Рахувати лише робочі години (з урахуванням 13-А)</label>
        </div>
      </div>
      <div className="wfc-sec-h" style={{ marginTop: 20 }}><span className="wfc-sec-h-t">Прев'ю ланцюжка</span></div>
      <div className="wfl-panel"><div className="wfl-panel-b"><div className="wfl-tl">
        <div className="wfl-tl-row"><span className="wfl-tl-dot" data-kind="inbound"><Icon name="mail" size={11} /></span><div className="wfl-tl-body"><div className="wfl-tl-txt" style={{ fontSize: 12.5 }}>Клієнт написав — таймер пішов</div><div className="wfl-tl-meta">0 год</div></div></div>
        <div className="wfl-tl-row"><span className="wfl-tl-dot" data-kind="stage"><Icon name="clock" size={11} /></span><div className="wfl-tl-body"><div className="wfl-tl-txt" style={{ fontSize: 12.5 }}>Нагадування виконавцю</div><div className="wfl-tl-meta">+{t.remindAfter} год</div></div></div>
        <div className="wfl-tl-row"><span className="wfl-tl-dot" data-kind="note"><Icon name="alert" size={11} /></span><div className="wfl-tl-body"><div className="wfl-tl-txt" style={{ fontSize: 12.5 }}>Ескалація власнику</div><div className="wfl-tl-meta">+{t.escalateAfter} год</div></div></div>
      </div></div></div>
    </div>
  );
}

function NfMatrix({ D }) {
  const [m, setM] = _nf(D.NOTIFY_MATRIX);
  const tog = (id, ch) => setM(m.map((r) => r.id === id ? { ...r, [ch]: !r[ch] } : r));
  return (
    <table className="wfp-table">
      <thead><tr><th>Подія</th><th>Розділ</th><th style={{ textAlign: 'center' }}>Email</th><th style={{ textAlign: 'center' }}>Telegram</th><th style={{ textAlign: 'center' }}>In-app</th></tr></thead>
      <tbody>
        {m.map((r) => (
          <tr key={r.id}>
            <td style={{ fontWeight: 500 }}>{r.label}</td>
            <td><span className="wfl-card-chip">{r.area}</span></td>
            {['email', 'telegram', 'inapp'].map((ch) => (
              <td key={ch} style={{ textAlign: 'center' }}><span style={{ display: 'inline-flex' }}><NfToggle on={r[ch]} onClick={() => tog(r.id, ch)} /></span></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NfTest() {
  const [ch, setCh] = _nf('telegram');
  const [sent, setSent] = _nf(false);
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)', marginBottom: 16 }}>Надішліть тестове сповіщення, щоб перевірити підключення каналу.</div>
      <div className="wfc-opts" style={{ marginBottom: 16 }}>
        {[['email', 'mail', 'Email'], ['telegram', 'send', 'Telegram-бот'], ['inapp', 'bell', 'In-app']].map(([id, ic, l]) => (
          <div key={id} className="wfc-opt" data-on={ch === id || undefined} onClick={() => { setCh(id); setSent(false); }}><span className="wfc-opt-radio" /><span className="wfc-opt-ico"><Icon name={ic} size={15} /></span><div className="wfc-opt-t">{l}</div></div>
        ))}
      </div>
      <button className="wfp-btn wfp-btn--primary" onClick={() => setSent(true)}><Icon name="send" size={14} />Надіслати тестове</button>
      {sent && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--wf-success)', marginTop: 14 }}>✓ тестове сповіщення надіслано через {ch}</div>}
    </div>
  );
}

// ════════════════ Portal announcement banner (07-В) ════════════════
function PortalAnnounceBanner() {
  const [dismissed, setDismissed] = _nf(false);
  if (dismissed) return null;
  const a = (window.WF_NOTIFY.ANNOUNCEMENTS || []).find((x) => x.status === 'active');
  if (!a) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--wf-accent-soft)', border: '1px solid var(--wf-accent)', marginBottom: 18 }}>
      <Icon name="bell" size={16} color="var(--wf-fg)" style={{ marginTop: 1 }} />
      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div><div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', marginTop: 2 }}>{a.body}</div></div>
      <button className="wfp-btn wfp-btn--sm" onClick={() => setDismissed(true)}><Icon name="check" size={13} />Зрозуміло</button>
    </div>
  );
}

Object.assign(window, { WsLoyaltySettings, WsNotifications, PortalAnnounceBanner, NfToggle });
