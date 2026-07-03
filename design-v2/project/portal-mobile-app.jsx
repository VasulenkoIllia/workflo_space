// portal-mobile-app.jsx — workflo.space CLIENT PORTAL native-mobile app.
// Interactive phone mirroring the Mobile Workspace: login(OTP) → tab nav
// (Замовлення / Інбокс / Фінанси / Документи / Ще) → order chat → loyalty,
// + "Ще" sheet (multi-company switch · theme · logout). Reuses the existing
// portal-mobile screens (MobileOrders/Inbox/Billing/Documents/Loyalty/Chat/
// Login) — interactivity is threaded through window.__PMA.

const _pm = React.useState;
const _pme = React.useEffect;
const _pmr = React.useRef;

function PMASheet({ theme, onTheme, onClose, onNav, onLogout }) {
  const co = (window.WFP_DATA && window.WFP_DATA.companies_owned) || [];
  const menu = [
    { id: 'loyalty', label: 'Лояльність', icon: 'star' },
    { id: 'referrals', label: 'Реферали', icon: 'gift' },
    { id: 'team', label: 'Учасники', icon: 'users', badge: '4' },
    { id: 'settings', label: 'Налаштування', icon: 'settings' },
  ];
  return (
    <div className="wfm-sheet-scrim" onClick={(e) => { if (e.target.classList.contains('wfm-sheet-scrim')) onClose(); }}>
      <div className="wfm-sheet">
        <div className="wfm-sheet-grip" />
        <div className="wfm-sheet-h">Компанія</div>
        <div className="wfm-sheet-sub">// переключити активну компанію</div>
        <div className="wfm-sheet-list">
          {co.map((c) => (
            <div key={c.id} className="wfm-sheet-row" onClick={onClose}>
              <span className="wfm-sheet-av">{c.name.replace(/[^А-Яа-яA-Za-z]/g, '').slice(0, 2).toUpperCase()}</span>
              <div><div className="wfm-sheet-row-name">{c.name}</div><div className="wfm-sheet-row-meta">{c.role} · <span className="wfm-sheet-tier">{c.tier}</span></div></div>
              {c.active ? <span className="wfm-sheet-check"><Icon name="check" size={18} /></span> : <span />}
            </div>
          ))}
        </div>

        <div className="wfm-sheet-sub" style={{ margin: '16px 0 8px' }}>// тема</div>
        <div className="wfm-themeswitch">
          <button data-on={theme === 'light' || undefined} onClick={() => onTheme('light')}>☀ світла</button>
          <button data-on={theme === 'dark' || undefined} onClick={() => onTheme('dark')}>☾ темна</button>
        </div>

        <div className="wfm-menu" style={{ marginTop: 14 }}>
          {menu.map((m) => (
            <div key={m.id} className="wfm-menu-row" onClick={() => onNav(m.id)}>
              <span className="wfm-menu-icon"><Icon name={m.icon} size={18} /></span>
              <span className="wfm-menu-label">{m.label}</span>
              {m.badge ? <span className="wfm-menu-badge">{m.badge}</span> : <span className="wfm-menu-chev"><Icon name="chev_r" size={15} /></span>}
            </div>
          ))}
          <div className="wfm-menu-row wfm-logout" onClick={onLogout}><span className="wfm-menu-icon"><Icon name="lock" size={18} /></span><span className="wfm-menu-label">Вийти</span><span /></div>
        </div>
      </div>
    </div>
  );
}

function PortalMobileApp({ initTheme = 'light', accent = 'lime' }) {
  const [theme, setTheme] = _pm(initTheme);
  const [authed, setAuthed] = _pm(false);
  const [loginStep, setLoginStep] = _pm(1);
  const [tab, setTab] = _pm('orders');
  const [route, setRoute] = _pm(null); // null | 'chat' | 'loyalty'
  const [sheet, setSheet] = _pm(false);

  // fit-to-height scaler
  const scaleRef = _pmr(null);
  const [scale, setScale] = _pm(1);
  _pme(() => {
    const el = scaleRef.current; if (!el) return;
    const fit = () => { const h = el.clientHeight, w = el.clientWidth; if (h && w) setScale(Math.min(1, (h - 4) / 844, (w - 4) / 392)); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  // expose interactivity to the reused portal-mobile screens
  window.__PMA = {
    nav: (id) => { if (id === 'more') { setSheet(true); } else { setRoute(null); setSheet(false); setTab(id); } },
    open: () => setRoute('chat'),
    back: () => setRoute(null),
    loginNext: () => setLoginStep(2),
    loginAuth: () => setAuthed(true),
  };

  const wrap = (inner) => (
    <div ref={scaleRef} style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 390, height: 844, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: 'center' }}>
        <MPhone theme={theme} accent={accent}>{inner}</MPhone>
      </div>
    </div>
  );

  if (!authed) return wrap(window.MobileLogin ? React.createElement(window.MobileLogin, { step: loginStep }) : <div className="wfm" />);

  let screen;
  if (route === 'chat') screen = window.MobileOrderChat ? React.createElement(window.MobileOrderChat) : null;
  else if (route === 'loyalty') screen = window.MobileLoyalty ? React.createElement(window.MobileLoyalty) : null;
  else if (tab === 'inbox') screen = window.MobileInbox ? React.createElement(window.MobileInbox) : null;
  else if (tab === 'billing') screen = window.MobileBilling ? React.createElement(window.MobileBilling) : null;
  else if (tab === 'documents') screen = window.MobileDocuments ? React.createElement(window.MobileDocuments) : null;
  else screen = window.MobileOrders ? React.createElement(window.MobileOrders) : null;

  return wrap(
    <React.Fragment>
      <div style={{ height: '100%' }} key={(route || tab)}>{screen}</div>
      {sheet && <PMASheet theme={theme} onTheme={setTheme} onClose={() => setSheet(false)} onLogout={() => { setSheet(false); setAuthed(false); setLoginStep(1); }} onNav={(id) => { setSheet(false); if (id === 'loyalty') setRoute('loyalty'); }} />}
    </React.Fragment>
  );
}

Object.assign(window, { PortalMobileApp, PMASheet });
