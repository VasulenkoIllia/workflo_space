// prototype.jsx — interactive, clickable prototype of each product on one tab.
// Three live apps switchable from a top bar: Лендінг (TerminalLanding) ·
// Портал · Workspace (real sidebar navigation via AppShell onNav).
// All screen components are reused as-is from the design-canvas build.

const _ts = React.useState;
const _te = React.useEffect;

// guarded renderer — never crash the whole app if a component is missing
function S(name, props) {
  const C = window[name];
  return C ? React.createElement(C, props || {}) : (
    <div className="proto-missing">// екран «{name}» недоступний</div>
  );
}

// nav-id → screen content
const PORTAL_SCREENS = {
  inbox:     () => S('PortalInbox', { filter: 'all' }),
  orders:    () => S('PortalOrderView'),
  estimate:  () => S('PortalEstimate'),
  company:   () => S('PortalCompany'),
  support:   () => S('PortalSupport'),
  help:      () => S('PortalHelp'),
  billing:   () => S('PortalBillingProjects'),
  projects:  () => S('PortalServiceProjects'),
  secrets:   () => S('PortalSecrets'),
  wallet:    () => S('PortalWalletV2'),
  documents: () => S('PortalDocsHub'),
  loyalty:   () => S('PortalLoyalty'),
  referrals: () => S('PortalReferralFunnel'),
  team:      () => S('PortalTeam'),
  integrations: () => S('R4Integrations'),
  tour:      () => S('R4Onboarding'),
  settings:  () => S('PortalSettingsHub'),
};

const WS_SCREENS = {
  dashboard:   () => S('WorkspaceDashboard', { kanbanMode: 'board' }),
  board:       () => S('WorkspaceBoard'),
  auditmap:    () => S('WorkspaceAuditMap'),
  inbox:       () => S('WorkspaceInbox', { filter: 'all' }),
  orders:      () => S('WorkspaceOrders'),
  orderchat:   () => S('WorkspaceOrderChat'),
  leads:       () => S('WorkspaceLeads'),
  companies:   () => S('WorkspaceClients'),
  projects:    () => S('WsProjects'),
  comp:        () => S('WsCompensation'),
  planfact:    () => S('WsPlanFact'),
  'loyalty-set': () => S('WsLoyaltySettings'),
  notify:      () => S('WsNotifications'),
  legal:       () => S('WsLegalEntities'),
  contracts:   () => S('WsContractTemplates'),
  'svc-catalog': () => S('WsServiceCatalog'),
  dockit:      () => S('DocKitViewer'),
  support:     () => S('WorkspaceSupport'),
  canned:      () => S('WsCannedReplies'),
  kb:          () => S('WsKnowledgeBase'),
  branding:    () => S('WorkspaceBranding'),
  billing:     () => S('WorkspaceBillingHub'),
  debtors:     () => S('WorkspaceDebtors'),
  payouts:     () => S('WorkspacePayouts'),
  finance:     () => S('FinanceHub'),
  wsdocuments: () => S('DocumentsIndex'),
  cashflow:    () => S('WsCashFlow'),
  refund:      () => S('R4Refund'),
  search:      () => S('R4Search'),
  bulk:        () => S('R4Bulk'),
  export:      () => S('R4Export'),
  bot:         () => S('R4Bot'),
  dlq:         () => S('R4Dlq'),
  integrations: () => S('WorkspaceIntegrations'),
  trash:       () => S('R4Trash'),
  forbidden:   () => S('R4Forbidden'),
  mysettings:  () => S('R4ExecSettings'),
  blog:        () => S('WorkspaceBlogCMS', { view: 'list' }),
  cases:       () => S('WorkspaceCasesV2'),
  landinghub:  () => S('WsLandingHub'),
  testimonials: () => S('WsTestimonials'),
  'svc-admin': () => S('WorkspaceServicesAdmin'),
  vault:       () => S('WorkspaceVault'),
  reports:     () => S('ReportsHub'),
  mailtpl:     () => S('WsEmailTemplates'),
  bizreports:  () => S('WsReportsV1'),
  'admin-set': () => S('AdminSettingsHub'),
  sysmon:      () => S('SystemMonitoring'),
  leave:       () => S('LeaveAdmin'),
  calendar:    () => S('CalendarMonth'),
  calsettings: () => S('WsCalendarSettings'),
  team:        () => S('AdminTeamHub'),
  capacity:    () => S('WsTeamCapacity'),
  viewas:      () => S('WsViewAs'),
  authflows:   () => S('AuthFlowsViewer'),
  onboarding:  () => S('OnboardingFlow'),
  settings:    () => S('AdminHub'),
};

function navLabel(navArr, id) {
  const it = (navArr || []).find((n) => n.id === id);
  return it ? it.label : id;
}

// accent CSS vars (same resolution as AppShell)
function accentVars(theme, accent) {
  const p = (window.ACCENT_PRESETS || {})[accent];
  if (!p) return {};
  return {
    '--wf-accent': theme === 'dark' ? p.dark : p.light,
    '--wf-accent-bg': p.dark,
    '--wf-accent-soft': theme === 'dark' ? p.softDark : p.soft,
  };
}

// ── shared overlay host (⌘K search · bell notifications) ──
function ProtoOverlay({ kind, theme, accent, onClose }) {
  _te(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const onClick = (e) => {
    if (!e.target.closest('.wfp-cmdk, .wfp-bell-pop')) onClose();
  };
  return (
    <div className="wfp-root wf-root proto-ovl" data-theme={theme} data-accent={accent}
      style={accentVars(theme, accent)} onClick={onClick}>
      {kind === 'cmdk' && S('CmdKOverlay')}
      {kind === 'bell' && <div className="proto-ovl-bell">{S('BellDropdown')}</div>}
    </div>
  );
}

// ── Portal prototype ──
function PortalPrototype({ theme, accent, active, onNav }) {
  const [ovl, setOvl] = _ts(null);
  window.__portalNav = onNav; // bridge for audit-map cross-navigation
  const screen = active === 'inbox'
    ? <React.Fragment><WfsInboxItem onOpen={() => onNav('documents')} />{S('PortalInbox', { filter: 'all' })}</React.Fragment>
    : (PORTAL_SCREENS[active] || PORTAL_SCREENS.orders)();
  const crumbs = ['portal', navLabel(window.PORTAL_NAV, active)];
  return (
    <React.Fragment>
      <AppShell kind="portal" active={active} crumbs={crumbs}
        onNav={(id) => { setOvl(null); onNav(id); }}
        onSearch={() => setOvl('cmdk')} onBell={() => setOvl('bell')}
        aesthetic="B" theme={theme} accent={accent} density="comfortable">
        <div className="proto-screen" key={active}>{S('PortalAnnounceBanner')}{screen}</div>
      </AppShell>
      {ovl && <ProtoOverlay kind={ovl} theme={theme} accent={accent} onClose={() => setOvl(null)} />}
    </React.Fragment>
  );
}

// ── Workspace prototype ──
function WorkspacePrototype({ theme, accent, active, onNav, role, viewAs, onSetRole, onViewAs, onExitViewAs }) {
  const [ovl, setOvl] = _ts(null);
  window.__wsNav = onNav; // bridge for in-screen navigation (e.g. billing subtabs)
  window.__wsRole = role; // bridge for role-aware screens (e.g. Client360 finance tab)
  const screen = (WS_SCREENS[active] || WS_SCREENS.dashboard)();
  const crumbs = ['work', navLabel(window.WORKSPACE_NAV, active)];
  return (
    <React.Fragment>
      <AppShell kind="workspace" active={active} crumbs={crumbs}
        onNav={(id) => { setOvl(null); onNav(id); }}
        onSearch={() => setOvl('cmdk')} onBell={() => setOvl('bell')}
        role={role} viewAs={viewAs} onSetRole={onSetRole} onViewAs={onViewAs} onExitViewAs={onExitViewAs}
        aesthetic="B" theme={theme} accent={accent} density="comfortable">
        <div className="proto-screen" key={active}>{screen}</div>
      </AppShell>
      {ovl && <ProtoOverlay kind={ovl} theme={theme} accent={accent} onClose={() => setOvl(null)} />}
    </React.Fragment>
  );
}

// ── Landing prototype (full interactive home) ──
function LandingPrototype({ theme, accent, lang }) {
  return <TerminalLanding initLang={lang} initTheme={theme} accent={accent} />;
}

// ── Components catalog (walk through every UI atom) ──
function ComponentsPrototype() {
  return S('ProductBrandbook');
}

// ── Top switcher app ──
const PROTO_KEY = 'wf_proto_v1';
const ACCENTS = ['lime', 'amber', 'cyan'];

function loadState() {
  try { return JSON.parse(localStorage.getItem(PROTO_KEY)) || {}; } catch (e) { return {}; }
}

function PrototypeApp() {
  const saved = loadState();
  const [app, setApp] = _ts(['landing', 'portal', 'workspace', 'mobile', 'components'].includes(saved.app) ? saved.app : 'landing');
  const [theme, setTheme] = _ts(saved.theme || 'light');
  const [accent, setAccent] = _ts(saved.accent || 'lime');
  const [lang, setLang] = _ts(saved.lang || 'ua');
  const [portalActive, setPortalActive] = _ts(saved.portalActive || 'orders');
  const [wsActive, setWsActive] = _ts(saved.wsActive || 'dashboard');
  const [wsRole, setWsRole] = _ts(['owner', 'manager', 'executor'].includes(saved.wsRole) ? saved.wsRole : 'owner');
  const [viewAs, setViewAs] = _ts(saved.viewAs || null);
  const [mobileKind, setMobileKind] = _ts(saved.mobileKind || 'workspace');

  _te(() => {
    try { localStorage.setItem(PROTO_KEY, JSON.stringify({ app, theme, accent, lang, portalActive, wsActive, wsRole, viewAs, mobileKind })); } catch (e) {}
  }, [app, theme, accent, lang, portalActive, wsActive, wsRole, viewAs, mobileKind]);

  const presets = window.ACCENT_PRESETS || {};
  const tabs = [
    { id: 'landing',    label: 'Лендінг',    glyph: '◷' },
    { id: 'portal',     label: 'Портал',     glyph: '▤' },
    { id: 'workspace',  label: 'Workspace',  glyph: '▦' },
    { id: 'mobile',     label: 'Mobile',     glyph: '▢' },
    { id: 'components', label: 'Компоненти', glyph: '▣' },
  ];
  const hint = app === 'landing'
    ? 'жива головна · boot · перемикачі теми/мови всередині'
    : app === 'components'
    ? 'каталог усіх UI-атомів · скроль вниз'
    : app === 'mobile'
    ? 'мобільні застосунки · перемикач Портал / Workspace зверху · логін → нав · тема в «Ще»'
    : 'клікай пункти в лівому меню · ⌘K пошук · 🔔 нотифікації';

  return (
    <div className="proto-root">
      <div className="proto-bar">
        <span className="proto-brand">workflo<span className="dot">.</span>space <span className="proto-brand-tag">prototype</span></span>
        <div className="proto-tabs">
          {tabs.map((t) => (
            <button key={t.id} className="proto-tab" data-on={app === t.id} onClick={() => setApp(t.id)}>
              <span className="proto-tab-glyph">{t.glyph}</span>{t.label}
            </button>
          ))}
        </div>
        <span className="proto-spacer" />
        <span className="proto-hint">// {hint}</span>
        {/* language (portal/workspace use UA only; landing supports toggle) */}
        {app === 'landing' && (
          <div className="proto-seg" title="мова">
            <button data-on={lang === 'ua'} onClick={() => setLang('ua')}>UA</button>
            <button data-on={lang === 'en'} onClick={() => setLang('en')}>EN</button>
          </div>
        )}
        {/* accent */}
        <div className="proto-swatches" title="акцент">
          {ACCENTS.map((a) => {
            const p = presets[a] || {};
            return <span key={a} className="proto-sw" data-on={accent === a} style={{ background: p.dark || '#C5F82A' }} onClick={() => setAccent(a)} />;
          })}
        </div>
        {/* theme */}
        <div className="proto-seg" title="тема">
          <button data-on={theme === 'light'} onClick={() => setTheme('light')}>☀</button>
          <button data-on={theme === 'dark'} onClick={() => setTheme('dark')}>☾</button>
        </div>
      </div>

      <div className="proto-stage" data-app={app}>
        <div className="proto-stage-inner" key={app + theme + accent + lang}>
          {app === 'landing' && <LandingPrototype theme={theme} accent={accent} lang={lang} />}
          {app === 'portal' && <PortalPrototype theme={theme} accent={accent} active={portalActive} onNav={setPortalActive} />}
          {app === 'workspace' && <WorkspacePrototype theme={theme} accent={accent} active={wsActive} onNav={setWsActive}
            role={wsRole} viewAs={viewAs}
            onSetRole={(r) => { setViewAs(null); setWsRole(r); }}
            onViewAs={(v) => setViewAs(v)}
            onExitViewAs={() => setViewAs(null)} />}
          {app === 'mobile' && (
            <div className="proto-mobile-stage">
              <div className="proto-mobile-switch">
                <button data-on={mobileKind === 'workspace' || undefined} onClick={() => setMobileKind('workspace')}>▦ Workspace</button>
                <button data-on={mobileKind === 'portal' || undefined} onClick={() => setMobileKind('portal')}>▤ Портал</button>
              </div>
              <div className="proto-mobile-frame">
                {mobileKind === 'workspace'
                  ? <WorkspaceMobileApp key={'ws' + theme} initTheme={theme} accent={accent} />
                  : <PortalMobileApp key={'pt' + theme} initTheme={theme} accent={accent} />}
              </div>
            </div>
          )}
          {app === 'components' && <ComponentsPrototype />}
        </div>
      </div>
    </div>
  );
}

const _protoRoot = ReactDOM.createRoot(document.getElementById('root'));
_protoRoot.render(<PrototypeApp />);

// ── responsive tables: stamp each <td> with its column header so the phone
// card layout (product-responsive.css) can show "Header: value" per cell.
// Non-destructive (only sets a data-th attribute React doesn't manage) and
// self-healing across screen re-renders via a debounced observer.
(function () {
  function labelTables() {
    document.querySelectorAll('table.wfp-table').forEach((t) => {
      const ths = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      if (!ths.length) return;
      t.querySelectorAll('tbody tr').forEach((tr) => {
        const cells = [...tr.children];
        // skip colspan / empty-state rows (single wide cell)
        if (cells.length === 1 && cells[0].hasAttribute('colspan')) return;
        cells.forEach((td, i) => {
          const label = ths[i] || '';
          if (td.getAttribute('data-th') !== label) td.setAttribute('data-th', label);
        });
      });
    });
  }
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; labelTables(); }, 60);
  };
  // childList-only: setting data-th won't retrigger this observer
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
