// workspace-integrations.jsx — G21 · Integrations hub (module 27)
// /settings/integrations · 4 tabs: API keys · site-form · channels · webhooks.
// Token-show-once, CORS allowlist + snippet, channel adapters, webhook delivery log.

const _ih = React.useState;

const IH_TABS = [
  { id: 'keys',     label: 'API-ключі',     icon: 'key' },
  { id: 'form',     label: 'Форма на сайт', icon: 'globe' },
  { id: 'channels', label: 'Канали',        icon: 'inbox' },
  { id: 'webhooks', label: 'Webhooks',      icon: 'send' },
];

// ── tab 1 · API keys ────────────────────────────────────────────────
const API_KEYS = [
  { id: 'k1', name: 'Інтеграція з 1С', scopes: ['read:orders', 'read:invoices'], last: '2 год тому', status: 'active' },
  { id: 'k2', name: 'Сайт → /v1/leads',  scopes: ['write:leads'],                  last: '14 хв тому', status: 'active' },
  { id: 'k3', name: 'Zapier (старий)',   scopes: ['read:orders'],                  last: '40 днів тому', status: 'revoked' },
];

function IhKeys() {
  const [modal, setModal] = _ih(false);
  const [keys, setKeys] = _ih(API_KEYS);
  return (
    <React.Fragment>
      <div className="wfp-card-h" style={{ marginBottom: 14 }}>
        <div className="wfp-card-h-t">API-ключі</div>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => setModal(true)}><Icon name="plus" size={13} />Створити ключ</button>
      </div>
      <table className="wfp-table">
        <thead><tr><th>Назва</th><th>Scopes</th><th>Останнє використання</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id} style={k.status === 'revoked' ? { opacity: 0.55 } : undefined}>
              <td><span style={{ fontWeight: 500 }}>{k.name}</span><div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>wf_sk_live_••••{k.id}</div></td>
              <td><span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{k.scopes.map((s) => <span key={s} className="wfl-card-chip">{s}</span>)}</span></td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{k.last}</td>
              <td><span className="wfg-pill2" data-tone={k.status === 'active' ? 'ok' : 'muted'}><span className="wfg-pill2-dot" />{k.status === 'active' ? 'активний' : 'відкликаний'}</span></td>
              <td style={{ textAlign: 'right' }}>{k.status === 'active' && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setKeys((xs) => xs.map((x) => (x.id === k.id ? { ...x, status: 'revoked' } : x)))} style={{ color: 'var(--wf-destructive)' }}>Revoke</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {modal && <IhKeyModal onClose={() => setModal(false)} onCreate={(k) => setKeys((xs) => [k, ...xs])} />}
    </React.Fragment>
  );
}

function IhKeyModal({ onClose, onCreate }) {
  const [name, setName] = _ih('');
  const [scopes, setScopes] = _ih(['read:orders']);
  const [done, setDone] = _ih(false);
  const [copied, setCopied] = _ih(false);
  const all = [['read:orders', 'читати замовлення'], ['read:invoices', 'читати рахунки'], ['write:leads', 'приймати ліди'], ['read:clients', 'читати клієнтів'], ['write:comments', 'писати коментарі']];
  const tog = (s) => setScopes((x) => x.includes(s) ? x.filter((y) => y !== s) : [...x, s]);
  const create = () => { setDone(true); onCreate({ id: 'k' + Date.now(), name: name || 'Новий ключ', scopes, last: 'щойно', status: 'active' }); };
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 480, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="key" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">{done ? 'Ключ створено' : 'Новий API-ключ'}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          {!done ? (
            <React.Fragment>
              <div className="wfp-field" style={{ marginBottom: 16 }}><label>Назва</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Інтеграція з 1С" /></div>
              <div className="r4-note" style={{ marginBottom: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>// scopes</div>
              <div className="r4-scopes">
                {all.map(([s, l]) => <div key={s} className="r4-scope" data-on={scopes.includes(s) || undefined} onClick={() => tog(s)}><span className="r4-checkbox" data-on={scopes.includes(s) || undefined} style={{ width: 18, height: 18, borderRadius: 5, border: '1px solid var(--wf-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: scopes.includes(s) ? 'var(--wf-accent)' : 'transparent' }}><Icon name="check" size={11} /></span><span className="r4-scope-t" style={{ flex: 1 }}>{l}</span><span className="r4-scope-c">{s}</span></div>)}
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.6, marginBottom: 14 }}>Скопіюйте ключ зараз — <strong>більше він не показуватиметься</strong>.</div>
              <div className="r4-reveal" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--wf-fg)', color: 'var(--wf-accent)', padding: '12px 14px', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, wordBreak: 'break-all' }}>
                wf_sk_live_4f9ac21b8e7d3a0xN82kq
                <button onClick={() => setCopied(true)} style={{ border: 0, background: 'none', padding: 0, color: 'var(--wf-accent)', cursor: 'pointer', display: 'flex' }}><Icon name={copied ? 'check' : 'copy'} size={15} /></button>
              </div>
              {copied && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-success)', marginTop: 8 }}>✓ скопійовано в буфер</div>}
            </React.Fragment>
          )}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// {done ? 'reveal once' : scopes.length + ' scope(s)'}</span><div style={{ display: 'flex', gap: 8 }}>{!done ? <React.Fragment><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={create}>Створити</button></React.Fragment> : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}</div></div>
      </div>
    </div>
  );
}

// ── tab 2 · site form (inbound) ─────────────────────────────────────
const FORM_LEADS = [
  { time: '14 хв тому', src: 'form', who: 'andriy@coffeelab.ua', status: 'ok' },
  { time: '2 год тому',  src: 'form', who: 'sofia@tably.app',     status: 'ok' },
  { time: '5 год тому',  src: 'form', who: '— (spam)',            status: 'blocked' },
  { time: 'вчора',       src: 'form', who: 'm.kovach@eduforge.io', status: 'ok' },
];
const SNIPPET = `<form id="wf-lead">
  <input name="name" required>
  <input name="email" type="email" required>
  <textarea name="message"></textarea>
</form>
<script>
document.getElementById('wf-lead').onsubmit = async (e) => {
  e.preventDefault();
  await fetch('https://api.workflo.space/v1/leads', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer wf_sk_live_••••' },
    body: new FormData(e.target),
  });
};
</script>`;

function IhForm() {
  const [copied, setCopied] = _ih(false);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
      <div>
        <div className="wfp-card-h" style={{ marginBottom: 12 }}><div className="wfp-card-h-t">Сніпет для вашого сайту</div><div className="wfp-card-h-aux">// POST /v1/leads</div></div>
        <div style={{ position: 'relative' }}>
          <pre style={{ margin: 0, padding: 16, background: 'var(--wf-fg)', color: 'var(--wf-bg)', borderRadius: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, lineHeight: 1.6, overflowX: 'auto' }}>{SNIPPET}</pre>
          <button className="wfp-btn wfp-btn--sm" style={{ position: 'absolute', top: 10, right: 10 }} onClick={() => setCopied(true)}><Icon name={copied ? 'check' : 'copy'} size={12} />{copied ? 'Скопійовано' : 'Копіювати'}</button>
        </div>

        <div className="wfp-card-h" style={{ margin: '26px 0 12px' }}><div className="wfp-card-h-t">Останні ліди через форму</div></div>
        <table className="wfp-table">
          <thead><tr><th>Час</th><th>Джерело</th><th>Контакт</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {FORM_LEADS.map((l, i) => (
              <tr key={i}>
                <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{l.time}</td>
                <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><WfSource id={l.src} size="sm" />форма</span></td>
                <td className="wfp-mono">{l.who}</td>
                <td><span className="wfg-pill2" data-tone={l.status === 'ok' ? 'ok' : 'bad'}><span className="wfg-pill2-dot" />{l.status === 'ok' ? 'прийнято' : 'заблоковано'}</span></td>
                <td style={{ textAlign: 'right' }}>{l.status === 'ok' && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Лід →</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="wfl-panel">
          <div className="wfl-panel-h">// конфігурація</div>
          <div className="wfl-panel-b">
            <div className="wfp-field"><label>API-ключ</label>
              <select className="wfl-select"><option>Сайт → /v1/leads</option><option>Інтеграція з 1С</option></select></div>
            <div className="wfp-field"><label>Дозволені домени (CORS)</label><input defaultValue="coffeelab.ua, www.coffeelab.ua" /></div>
            <div className="wfl-card-chip" style={{ alignSelf: 'flex-start' }}><Icon name="shield" size={11} />ліди з інших доменів відхиляються</div>
          </div>
        </div>
        <div className="wfl-panel">
          <div className="wfl-panel-h">// воронка призначення</div>
          <div className="wfl-panel-b">
            <div className="wfp-field"><label>Етап для нових лідів</label>
              <select className="wfl-select"><option>Основна воронка · Нові</option><option>Партнери · Заявка</option></select></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── tab 3 · channels (adapters) ─────────────────────────────────────
const CHANNELS = [
  { id: 'telegram', state: 'connected', meta: '@workflo_bot · 312 діалогів', desc: 'Вхідні з Telegram-бота напряму у воронку лідів.' },
  { id: 'instagram', state: 'connected', meta: '@studio.workflo · DM + коментарі', desc: 'Direct-повідомлення та згадки стають лідами.' },
  { id: 'whatsapp', state: 'error', meta: 'токен протерміновано', desc: 'WhatsApp Business API — переписки як ліди.' },
  { id: 'facebook', state: 'disconnected', meta: 'не підключено', desc: 'Lead Ads + Messenger у вашу воронку.' },
  { id: 'tiktok', state: 'soon', meta: 'скоро', desc: 'TikTok Lead Generation — у дорожній карті.' },
  { id: 'email', state: 'soon', meta: 'скоро', desc: 'Email-to-lead на унікальну адресу проєкту.' },
];
const CH_LABEL = { connected: 'підключено', disconnected: 'не підключено', error: 'помилка', soon: 'скоро' };
const CH_TONE = { connected: 'connected', disconnected: 'disconnected', error: 'error', soon: 'plan' };

function IhChannels() {
  const [connect, setConnect] = _ih(null);
  return (
    <React.Fragment>
      <div className="r4-cards">
        {CHANNELS.map((c) => {
          const src = window.LEAD_SRC[c.id] || {};
          return (
            <div key={c.id} className="r4-card" data-state={c.state === 'soon' ? 'disabled' : undefined}>
              <div className="r4-card-top">
                <span className="wfg-src wfg-src--lg" style={{ background: src.color }}><WfSourceGlyph id={c.id} /></span>
                <div style={{ flex: 1 }}><div className="r4-card-name">{src.label}</div><div className="r4-card-meta">{c.meta}</div></div>
                <span className="r4-conn" data-s={CH_TONE[c.state]}><span className="r4-conn-dot" />{CH_LABEL[c.state]}</span>
              </div>
              <div className="r4-card-desc">{c.desc}</div>
              <div className="r4-card-foot">
                <span className="r4-note" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>{c.state === 'error' ? 'потрібна увага' : c.state === 'connected' ? 'adapter v1' : ''}</span>
                {c.state === 'connected' && <button className="wfp-btn wfp-btn--sm wfp-btn--ghost">Налаштувати</button>}
                {c.state === 'disconnected' && <button className="wfp-btn wfp-btn--sm wfp-btn--primary" onClick={() => setConnect(c.id)}>Підключити</button>}
                {c.state === 'error' && <button className="wfp-btn wfp-btn--sm wfp-btn--primary" onClick={() => setConnect(c.id)}>Перепідключити</button>}
                {c.state === 'soon' && <button className="wfp-btn wfp-btn--sm wfp-btn--ghost" disabled>Скоро</button>}
              </div>
            </div>
          );
        })}
      </div>
      {connect && <IhConnectModal id={connect} onClose={() => setConnect(null)} />}
    </React.Fragment>
  );
}

function WfSourceGlyph({ id }) {
  const s = window.LEAD_SRC[id] || {};
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>{s.glyph}</svg>;
}

function IhConnectModal({ id, onClose }) {
  const src = window.LEAD_SRC[id] || {};
  const [step, setStep] = _ih('auth');
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 440, margin: 0 }}>
        <div className="wfp-modal-h"><span className="wfg-src" style={{ background: src.color }}><WfSourceGlyph id={id} /></span><span className="wfp-modal-h-t">Підключити {src.label}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          {step === 'auth' ? (
            <React.Fragment>
              <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.6, marginBottom: 16 }}>Авторизуйте workflo через {src.label}. Ми отримаємо доступ лише до вхідних повідомлень.</div>
              <button className="wfp-btn wfp-btn--primary" style={{ width: '100%', justifyContent: 'center', background: src.color, color: '#fff', borderColor: src.color }} onClick={() => setStep('done')}><WfSourceGlyph id={id} />Увійти через {src.label}</button>
            </React.Fragment>
          ) : (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)', lineHeight: 1.8 }}>✓ авторизовано<br />✓ адаптер активовано<br /><span style={{ color: 'var(--wf-fg-muted)' }}>· вхідні зʼявляться у воронці</span></div>
          )}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// oauth · {step}</span><button className="wfp-btn wfp-btn--primary" onClick={onClose}>{step === 'done' ? 'Готово' : 'Закрити'}</button></div>
      </div>
    </div>
  );
}

// ── tab 4 · webhooks (outbound) ─────────────────────────────────────
const WEBHOOKS = [
  { id: 'w1', url: 'https://hooks.coffeelab.ua/wf', events: ['order.*', 'payment.*'], active: true, failing: false },
  { id: 'w2', url: 'https://api.tably.app/ingest',  events: ['lead.*'],               active: true, failing: true },
  { id: 'w3', url: 'https://old.zapier.com/hooks',  events: ['order.created'],        active: false, failing: false },
];
const DELIVERIES = [
  { event: 'order.created', ep: 'coffeelab', code: 200, attempts: 1, ts: '11:42', status: 'ok' },
  { event: 'payment.received', ep: 'coffeelab', code: 200, attempts: 1, ts: '11:20', status: 'ok' },
  { event: 'lead.created', ep: 'tably', code: 500, attempts: 4, ts: '10:58', status: 'fail' },
  { event: 'lead.created', ep: 'tably', code: 'timeout', attempts: 6, ts: '09:30', status: 'dlq' },
  { event: 'order.updated', ep: 'coffeelab', code: 200, attempts: 1, ts: 'вчора', status: 'ok' },
];

function IhWebhooks() {
  const [modal, setModal] = _ih(false);
  return (
    <React.Fragment>
      <div className="wfp-card-h" style={{ marginBottom: 14 }}>
        <div className="wfp-card-h-t">Endpoint'и</div>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => setModal(true)}><Icon name="plus" size={13} />Додати webhook</button>
      </div>
      <table className="wfp-table">
        <thead><tr><th>URL</th><th>Події</th><th>Стан</th><th></th></tr></thead>
        <tbody>
          {WEBHOOKS.map((w) => (
            <tr key={w.id} style={!w.active ? { opacity: 0.55 } : undefined}>
              <td className="wfp-mono" style={{ fontSize: 12 }}>{w.url}</td>
              <td><span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{w.events.map((e) => <span key={e} className="wfl-card-chip">{e}</span>)}</span></td>
              <td>{w.failing ? <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />збій доставки</span> : w.active ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активний</span> : <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />вимкнено</span>}</td>
              <td style={{ textAlign: 'right' }}><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Тест</button><button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Налашт.</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="wfp-card-h" style={{ margin: '26px 0 12px' }}><div className="wfp-card-h-t">Журнал доставки</div><div className="wfp-card-h-aux">// WebhookDelivery · останні 24 год</div></div>
      <table className="wfp-table">
        <thead><tr><th>Подія</th><th>Endpoint</th><th className="wfp-num">HTTP</th><th className="wfp-num">Спроби</th><th>Час</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          {DELIVERIES.map((d, i) => (
            <tr key={i}>
              <td className="wfp-mono">{d.event}</td>
              <td>{d.ep}</td>
              <td className="wfp-num" style={{ color: d.status === 'ok' ? 'var(--wf-success)' : 'var(--wf-destructive)' }}>{d.code}</td>
              <td className="wfp-num">{d.attempts}</td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{d.ts}</td>
              <td>{d.status === 'ok' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />доставлено</span> : d.status === 'fail' ? <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />помилка</span> : <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />у DLQ</span>}</td>
              <td style={{ textAlign: 'right' }}>{d.status !== 'ok' && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">{d.status === 'dlq' ? 'DLQ →' : 'Retry'}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {modal && <IhWebhookModal onClose={() => setModal(false)} />}
    </React.Fragment>
  );
}

function IhWebhookModal({ onClose }) {
  const [events, setEvents] = _ih(['order.created']);
  const all = ['order.created', 'order.updated', 'payment.received', 'lead.created', 'lead.converted', 'ticket.opened', 'ticket.resolved'];
  const tog = (e) => setEvents((x) => x.includes(e) ? x.filter((y) => y !== e) : [...x, e]);
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 480, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="send" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Новий webhook</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfp-field" style={{ marginBottom: 16 }}><label>Endpoint URL</label><input placeholder="https://example.com/webhooks/wf" /></div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 8 }}>// події</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {all.map((e) => <div key={e} className="r4-scope" data-on={events.includes(e) || undefined} onClick={() => tog(e)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--wf-border)', borderRadius: 8, cursor: 'pointer', background: events.includes(e) ? 'var(--wf-accent-soft)' : 'transparent', borderColor: events.includes(e) ? 'var(--wf-accent)' : 'var(--wf-border)' }}><span style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--wf-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: events.includes(e) ? 'var(--wf-accent)' : 'transparent' }}><Icon name="check" size={10} /></span><span className="wf-mono" style={{ fontSize: 11.5 }}>{e}</span></div>)}
          </div>
          <div className="wfp-field"><label>Signing secret</label><input defaultValue="whsec_••••••••••••" readOnly /></div>
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// {events.length} подій</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={onClose}>Створити</button></div></div>
      </div>
    </div>
  );
}

// ── shell ───────────────────────────────────────────────────────────
function WorkspaceIntegrations() {
  const [tab, setTab] = _ih('keys');
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Інтеграції</h1>
          <div className="wfp-ph-sub">// /settings/integrations · API · форма · канали · webhooks</div>
        </div>
      </div>
      <div className="wfg-tabs">
        {IH_TABS.map((t) => (
          <div key={t.id} className="wfg-tab" data-on={tab === t.id || undefined} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={14} />{t.label}
            {t.id === 'webhooks' && <span className="wfg-tab-badge" style={{ background: 'color-mix(in oklab, var(--wf-destructive) 18%, transparent)', color: 'var(--wf-destructive)' }}>1</span>}
          </div>
        ))}
      </div>
      {tab === 'keys' && <IhKeys />}
      {tab === 'form' && <IhForm />}
      {tab === 'channels' && <IhChannels />}
      {tab === 'webhooks' && <IhWebhooks />}
    </React.Fragment>
  );
}

Object.assign(window, { WorkspaceIntegrations });
