// workspace-p2b.jsx — П2 block B:
// WsTeamCapacity (12-Б capacity + 12-В KPI) · WsViewAs (20-Б) ·
// AuthFlowsViewer (01-А magic-link · 01-Д must-change · 01-Г email-change).

const _p2 = React.useState;
const NORM_WEEK = 40;

// per-executor KPI overlay (вчасність) keyed by id — layered onto report_executors
const KPI_ONTIME = { illia: 96, lead: 92, dev1: 88, dev2: 79, dev3: 94, dev4: 85 };

function WsTeamCapacity() {
  const team = (window.WFP_DATA.team || []);
  const exec = (window.WFP_DATA.report_executors || []);
  const byId = Object.fromEntries(exec.map((e) => [e.id, e]));
  const totalFree = team.reduce((s, t) => s + Math.max(0, NORM_WEEK - (t.hours_week || 0)), 0);
  const overloaded = team.filter((t) => (t.hours_week || 0) > NORM_WEEK).length;
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Команда · завантаженість</h1><div className="wfp-ph-sub">// capacity за тижневою нормою {NORM_WEEK} год · KPI виконавців</div></div>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 22 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">людей у команді</div><div className="wfp-stat-v">{team.length}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">вільних годин/тижд</div><div className="wfp-stat-v wfp-stat-v--accent">{totalFree}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">перевантажених</div><div className={`wfp-stat-v${overloaded ? ' wfp-stat-v--warn' : ''}`}>{overloaded}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">активних задач</div><div className="wfp-stat-v">{team.reduce((s, t) => s + (t.active_tasks || 0), 0)}</div></div>
      </div>

      {/* capacity (12-Б) */}
      <div className="wfc-sec-h"><span className="wfc-sec-h-t">Завантаженість тижня</span><span className="wfc-sec-h-s">// хто вільний / перевантажений</span></div>
      <div className="wfl-panel" style={{ marginBottom: 26 }}><div className="wfl-panel-b" style={{ gap: 0 }}>
        {team.map((t, i) => {
          const used = t.hours_week || 0; const pct = Math.round((used / NORM_WEEK) * 100);
          const over = used > NORM_WEEK; const free = NORM_WEEK - used;
          return (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 150px', gap: 16, alignItems: 'center', padding: '13px 0', borderTop: i ? '1px solid var(--wf-border)' : 0 }}>
              <div><div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{t.role} · {t.active_tasks} задач</div></div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)', marginBottom: 4 }}><span>{used} / {NORM_WEEK} год</span><span>{pct}%</span></div>
                <div className="wfc-bar" style={{ height: 8 }}><div className="wfc-bar-fill" data-tone={over ? 'bad' : pct < 60 ? 'warn' : undefined} style={{ width: Math.min(pct, 100) + '%' }} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>{over ? <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />+{used - NORM_WEEK} год понад</span> : free > 8 ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />вільно {free} год</span> : <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />в нормі</span>}</div>
            </div>
          );
        })}
      </div></div>

      {/* KPI cards (12-В) */}
      <div className="wfc-sec-h"><span className="wfc-sec-h-t">KPI виконавців</span><span className="wfc-sec-h-s">// вчасність · години · виручка за період</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {team.map((t) => {
          const e = byId[t.id] || {};
          const ontime = KPI_ONTIME[t.id] || 90;
          const util = Math.round((e.utilization || 0.8) * 100);
          return (
            <div key={t.id} className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="wfc-proj-ico" style={{ width: 34, height: 34 }}><Icon name="users" size={16} /></span>
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{t.role}</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, textAlign: 'center' }}>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: ontime >= 90 ? 'var(--wf-success)' : ontime >= 80 ? 'var(--wf-warning)' : 'var(--wf-destructive)' }}>{ontime}%</div><div className="wf-mono" style={{ fontSize: 9, color: 'var(--wf-fg-subtle)' }}>вчасність</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700 }}>{e.hours_logged || t.hours_week || 0}</div><div className="wf-mono" style={{ fontSize: 9, color: 'var(--wf-fg-subtle)' }}>годин</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700 }}>${((t.earnings_month || 0) / 1000).toFixed(1)}k</div><div className="wf-mono" style={{ fontSize: 9, color: 'var(--wf-fg-subtle)' }}>виручка</div></div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-subtle)', marginBottom: 3 }}><span>utilization</span><span>{util}%</span></div>
                <div className="wfc-bar"><div className="wfc-bar-fill" style={{ width: util + '%' }} /></div>
              </div>
            </div></div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

// ════════════════ View-as клієнт (20-Б) ════════════════
function WsViewAs() {
  const [client, setClient] = _p2('Brunky');
  const [active, setActive] = _p2(true);
  if (!active) {
    return (
      <React.Fragment>
        <div className="wfp-ph"><div className="wfp-ph-l"><h1 className="wfp-ph-h1">View-as клієнт</h1><div className="wfp-ph-sub">// перегляд порталу очима клієнта · read-only</div></div></div>
        <div style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center', padding: 36, border: '1px dashed var(--wf-border)', borderRadius: 14 }}>
          <Icon name="eye" size={26} color="var(--wf-fg-muted)" />
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 12 }}>Оберіть клієнта</div>
          <select className="wfl-select" style={{ maxWidth: 240, margin: '14px auto 18px' }} value={client} onChange={(e) => setClient(e.target.value)}><option>Brunky</option><option>EduForge</option><option>Tably</option></select>
          <div><button className="wfp-btn wfp-btn--primary" onClick={() => setActive(true)}><Icon name="eye" size={14} />Увійти в режим перегляду</button></div>
        </div>
      </React.Fragment>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: -24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', background: 'var(--wf-fg)', color: 'var(--wf-bg)' }}>
        <Icon name="eye" size={15} />
        <div style={{ flex: 1, fontSize: 12.5 }}>Ви переглядаєте портал очима <strong>{client}</strong> · <span style={{ opacity: 0.7 }}>read-only — дії вимкнено</span></div>
        <button className="wfp-btn wfp-btn--sm" style={{ background: 'var(--wf-bg)', color: 'var(--wf-fg)' }} onClick={() => setActive(false)}>Вийти</button>
      </div>
      <div style={{ padding: 24, pointerEvents: 'none', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 5 }} />
        {window.PortalBillingProjects ? <PortalBillingProjects /> : <div>портал</div>}
      </div>
    </div>
  );
}

// ════════════════ Auth flows (01-А / 01-Д / 01-Г) ════════════════
function AuthCard({ title, sub, children, foot }) {
  return (
    <div style={{ minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--wf-subtle)', borderRadius: 14, border: '1px solid var(--wf-border)' }}>
      <div style={{ width: 380, maxWidth: '100%', background: 'var(--wf-surface)', border: '1px solid var(--wf-border)', borderRadius: 16, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,.08)' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space</div>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 14 }}>{title}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-muted)', marginTop: 5 }}>{sub}</div>
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        {foot && <div style={{ marginTop: 18, fontSize: 12, color: 'var(--wf-fg-muted)', textAlign: 'center' }}>{foot}</div>}
      </div>
    </div>
  );
}

function AuthMagicLink() {
  const [mode, setMode] = _p2('password');
  return (
    <AuthCard title="Вхід" sub="// portal.workflo.space" foot={<a className="wfp-link">Немає акаунта? Зареєструватися</a>}>
      <div className="wfc-seg"><div className="wfc-seg-opt" data-on={mode === 'password' || undefined} onClick={() => setMode('password')}>Пароль</div><div className="wfc-seg-opt" data-on={mode === 'magic' || undefined} onClick={() => setMode('magic')}>За посиланням</div></div>
      <div className="wfp-field"><label>Email</label><input defaultValue="olena@brunky.ua" /></div>
      {mode === 'password'
        ? <React.Fragment><div className="wfp-field"><label>Пароль</label><input type="password" defaultValue="········" /></div><button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }}>Увійти</button></React.Fragment>
        : <React.Fragment><div style={{ fontSize: 12, color: 'var(--wf-fg-muted)', lineHeight: 1.5 }}>Надішлемо одноразове посилання на пошту. Діє 15 хв, працює один раз. Пароль не потрібен.</div><button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Надіслати посилання · демо', 'ok')}><Icon name="mail" size={14} />Надіслати посилання</button></React.Fragment>}
    </AuthCard>
  );
}
function AuthLinkSent() {
  return (
    <AuthCard title="Перевірте пошту" sub="// надіслали лист на olena@brunky.ua" foot={<a className="wfp-link">← інший спосіб входу</a>}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
        <span style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--wf-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="mail" size={26} color="var(--wf-fg)" /></span>
        <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', textAlign: 'center', lineHeight: 1.6 }}>Натисніть посилання у листі, щоб увійти. Можна закрити цю вкладку.</div>
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-subtle)', textAlign: 'center' }}>не прийшов лист? повторно через 0:42</div>
    </AuthCard>
  );
}
function AuthMustChange() {
  return (
    <AuthCard title="Змініть пароль" sub="// тимчасовий пароль · потрібно оновити">
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--wf-warning) 10%, transparent)', border: '1px solid color-mix(in oklab, var(--wf-warning) 30%, var(--wf-border))', fontSize: 12, color: 'var(--wf-fg-secondary)' }}><Icon name="alert" size={14} color="var(--wf-warning)" />Ваш акаунт створено вручну з тимчасовим паролем. Задайте власний, щоб продовжити.</div>
      <div className="wfp-field"><label>Новий пароль</label><input type="password" placeholder="мін. 8 символів" /></div>
      <div className="wfp-field"><label>Повторіть пароль</label><input type="password" /></div>
      <button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Зберегти і увійти · демо', 'ok')}>Зберегти і увійти</button>
    </AuthCard>
  );
}
function AuthEmailChange() {
  const [sent, setSent] = _p2(false);
  return (
    <AuthCard title="Зміна email" sub="// підтвердження на стару + нову адресу">
      {!sent ? (
        <React.Fragment>
          <div className="wfp-field"><label>Поточна адреса</label><div style={{ fontSize: 13, padding: '2px 0' }}>olena@brunky.ua</div></div>
          <div className="wfp-field"><label>Нова адреса</label><input placeholder="new@brunky.com" /></div>
          <div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)', lineHeight: 1.5 }}>Надішлемо лист підтвердження на обидві адреси. Email зміниться лише після підтвердження з обох.</div>
          <button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }} onClick={() => setSent(true)}>Надіслати підтвердження</button>
        </React.Fragment>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['olena@brunky.ua', 'стара адреса', 'opened'], ['new@brunky.com', 'нова адреса', 'pending']].map(([addr, l, st]) => (
            <div key={addr} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', border: '1px solid var(--wf-border)', borderRadius: 9 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: st === 'opened' ? 'var(--wf-success)' : 'var(--wf-warning)' }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 500 }}>{addr}</div><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{l}</div></div>
              <span className="wfg-pill2" data-tone={st === 'opened' ? 'ok' : 'warn'}><span className="wfg-pill2-dot" />{st === 'opened' ? 'підтверджено' : 'очікує'}</span>
            </div>
          ))}
        </div>
      )}
    </AuthCard>
  );
}

const AUTH_STATES = [['magic', 'Вхід (magic-link)'], ['sent', 'Лист надіслано'], ['mustchange', 'Зміна пароля'], ['email', 'Зміна email']];
function AuthFlowsViewer() {
  const [st, setSt] = _p2('magic');
  return (
    <React.Fragment>
      <div className="wfp-ph"><div className="wfp-ph-l"><h1 className="wfp-ph-h1">Вхід та безпека · стани</h1><div className="wfp-ph-sub">// magic-link (лише Portal) · примусова зміна пароля · зміна email</div></div></div>
      <div className="wfdk-toolbar" style={{ marginBottom: 18 }}><div className="wfdk-seg">{AUTH_STATES.map(([id, l]) => <div key={id} className="wfdk-seg-opt" data-on={st === id || undefined} onClick={() => setSt(id)}>{l}</div>)}</div></div>
      {st === 'magic' && <AuthMagicLink />}
      {st === 'sent' && <AuthLinkSent />}
      {st === 'mustchange' && <AuthMustChange />}
      {st === 'email' && <AuthEmailChange />}
    </React.Fragment>
  );
}

Object.assign(window, { WsTeamCapacity, WsViewAs, AuthFlowsViewer });
