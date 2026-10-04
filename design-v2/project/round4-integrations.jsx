// round4-integrations.jsx — G18 · Integrations hub.
// Portal /settings/integrations (4+ cards) + Workspace /admin/integrations
// (6 system-level). Per-card states (connected/disconnected/error/plan).
// API-token create modal: name + scopes + expiry → reveal-once.

const _ig = React.useState;

const IG_PORTAL = [
  { id: 'tg', name: 'Telegram', logo: 'TG', color: '#229ED9', state: 'connected', meta: 'звʼязано · @ivanenko_op', desc: 'Сповіщення про статуси, документи й платежі у Telegram. Оберіть чат або канал.', cta: 'Відʼєднати', ghost: true },
  { id: 'ics', name: 'Calendar (.ics)', logo: 'CAL', color: '#0C0A09', state: 'connected', meta: 'feed активний', desc: 'Підпишіться на дедлайни й події у Google / Apple / Outlook.', copy: 'webcal://workflo.space/ics/feed/4f9a…c21' },
  { id: 'api', name: 'API-токени', logo: 'API', color: '#6D28D9', state: 'disconnected', meta: 'немає токенів', desc: 'Особисті токени для розробників-клієнтів, що тягнуть дані з workflo.', cta: 'Створити токен', token: true },
  { id: 'wh', name: 'Webhook-приймачі', logo: 'WH', color: '#0891B2', state: 'disconnected', meta: 'не налаштовано', desc: 'workflo шле події (order.created, payment.received) на ваш endpoint.', cta: 'Налаштувати', ghost: true },
  { id: 'e2t', name: 'Email-to-task', logo: '@', color: '#A8A29E', state: 'plan', meta: 'доступно з Pro', desc: 'Створюйте задачі, надсилаючи лист на унікальну адресу проєкту.', cta: 'Доступно з Pro', disabled: true },
];
const IG_WS = [
  { id: 'stripe', name: 'Stripe', logo: 'S', color: '#635BFF', state: 'connected', meta: 'live · acct_1Q…', desc: 'Прийом карткових платежів і підписок.' },
  { id: 'liqpay', name: 'LiqPay', logo: 'L', color: '#74B71B', state: 'connected', meta: 'live', desc: 'Оплата картками та Privat24 у ₴.' },
  { id: 'mono', name: 'Mono Acquiring', logo: 'M', color: '#0C0A09', state: 'error', meta: 'токен протерміновано', desc: 'Еквайринг monobank · IBAN-виписки.' },
  { id: 'sentry', name: 'Sentry', logo: 'SE', color: '#362D59', state: 'connected', meta: 'workflo-prod', desc: 'Трекінг помилок і алерти.' },
  { id: 'ga', name: 'Google Analytics', logo: 'GA', color: '#E37400', state: 'connected', meta: 'G-XXXX', desc: 'Аналітика лендінгу та порталу.' },
  { id: 'ph', name: 'PostHog', logo: 'PH', color: '#1D4AFF', state: 'disconnected', meta: 'не підключено', desc: 'Продуктова аналітика й сесії.' },
];
const IG_STATE_LABEL = { connected: 'підключено', disconnected: 'не підключено', error: 'помилка', plan: 'тариф' };

function R4TokenModal({ onClose, onCreate }) {
  const [scopes, setScopes] = _ig(['read:orders']);
  const [done, setDone] = _ig(false);
  const all = [['read:orders', 'читати замовлення'], ['read:invoices', 'читати рахунки'], ['read:documents', 'читати документи'], ['write:comments', 'писати коментарі']];
  const tog = (s) => setScopes((x) => x.includes(s) ? x.filter((y) => y !== s) : [...x, s]);
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 460, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="key" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">{done ? 'Токен створено' : 'Новий API-токен'}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="alert" size={14} /></span></div>
        <div className="wfp-modal-body">
          {!done ? (
            <React.Fragment>
              <div className="wfp-field" style={{ marginBottom: 16 }}><label>Назва</label><input defaultValue="Інтеграція з 1С" /></div>
              <div className="r4-note" style={{ marginBottom: 8 }}>// scopes</div>
              <div className="r4-scopes" style={{ marginBottom: 16 }}>
                {all.map(([s, l]) => <div key={s} className="r4-scope" data-on={scopes.includes(s) || undefined} onClick={() => tog(s)}><span className="r4-checkbox" data-on={scopes.includes(s) || undefined}><Icon name="check" size={11} /></span><span className="r4-scope-t" style={{ flex: 1 }}>{l}</span><span className="r4-scope-c">{s}</span></div>)}
              </div>
              <div className="wfp-field"><label>Діє до</label><input defaultValue="01.06.2027" /></div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="wfs-modal-lead">Скопіюйте токен зараз — більше він не показуватиметься.</div>
              <div className="r4-reveal">wf_sk_live_4f9ac21b8e7d3a…0xN<button className="r4-copyfield" style={{ border: 0, background: 'none', padding: 0, color: 'var(--wf-accent)' }}><Icon name="copy" size={14} /></button></div>
            </React.Fragment>
          )}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// {done ? 'reveal once' : scopes.length + ' scope(s)'}</span><div style={{ display: 'flex', gap: 8 }}>{!done ? <React.Fragment><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={() => setDone(true)}>Створити</button></React.Fragment> : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}</div></div>
      </div>
    </div>
  );
}

function R4Integrations() {
  const [scope, setScope] = _ig('portal');
  const [token, setToken] = _ig(false);
  const cards = scope === 'portal' ? IG_PORTAL : IG_WS;
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Інтеграції</h1><div className="wfp-ph-sub">// {scope === 'portal' ? 'portal · /settings/integrations' : 'workspace · /admin/integrations'}</div></div>
        <div className="wfp-ph-r"><div className="r4-seg"><div className="r4-seg-opt" data-on={scope === 'portal' || undefined} onClick={() => setScope('portal')}>Портал (клієнт)</div><div className="r4-seg-opt" data-on={scope === 'ws' || undefined} onClick={() => setScope('ws')}>Workspace (система)</div></div></div>
      </div>

      <div className="r4-cards">
        {cards.map((c) => (
          <div key={c.id} className="r4-card" data-state={c.disabled ? 'disabled' : undefined}>
            <div className="r4-card-top">
              <div className="r4-card-logo" style={{ background: c.color }}>{c.logo}</div>
              <div style={{ flex: 1 }}><div className="r4-card-name">{c.name}</div><div className="r4-card-meta">{c.meta}</div></div>
              <span className="r4-conn" data-s={c.state}><span className="r4-conn-dot" />{IG_STATE_LABEL[c.state]}</span>
            </div>
            <div className="r4-card-desc">{c.desc}</div>
            {c.copy && <div className="r4-copyfield"><input readOnly value={c.copy} /><button><Icon name="copy" size={13} /></button></div>}
            <div className="r4-card-foot">
              <span className="r4-note">{c.id === 'tg' ? 'чат · канал' : c.state === 'error' ? 'потрібна увага' : ''}</span>
              {c.cta && <button className={`wfp-btn wfp-btn--sm${c.ghost || c.disabled ? ' wfp-btn--ghost' : ' wfp-btn--primary'}`} disabled={c.disabled} onClick={c.token ? () => setToken(true) : undefined}>{c.cta}</button>}
              {!c.cta && c.state === 'error' && <button className="wfp-btn wfp-btn--sm wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Перепідключити · демо', 'ok')}>Перепідключити</button>}
              {!c.cta && c.state === 'connected' && <button className="wfp-btn wfp-btn--sm wfp-btn--ghost">Налаштувати</button>}
              {!c.cta && c.state === 'disconnected' && <button className="wfp-btn wfp-btn--sm wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Підключити · демо', 'ok')}>Підключити</button>}
            </div>
          </div>
        ))}
      </div>

      {token && <R4TokenModal onClose={() => setToken(false)} onCreate={() => {}} />}
    </React.Fragment>
  );
}

Object.assign(window, { R4Integrations, R4TokenModal });
