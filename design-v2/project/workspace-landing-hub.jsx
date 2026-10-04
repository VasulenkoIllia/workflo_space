// workspace-landing-hub.jsx — single consolidated "Лендінг" hub.
// One place for everything about the public site: overview + sub-nav that
// reuses existing screens (branding/domain/CMS, services, cases, testimonials, blog).

const _lh = React.useState;

const LH_TABS = [
  ['overview', 'Огляд', 'kanban'],
  ['pages',    'Сторінки · бренд · SEO', 'star'],
  ['services', 'Послуги', 'kanban'],
  ['cases',    'Кейси', 'star'],
  ['testimonials', 'Відгуки', 'star'],
  ['blog',     'Блог', 'edit'],
];

function WsLandingHub() {
  const [tab, setTab] = _lh('overview');
  return (
    <React.Fragment>
      {/* slim hub bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="wfp-ph-h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>Лендінг<span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />опубліковано</span></h1>
          <div className="wfp-ph-sub">// усе про публічний сайт в одному місці · workflo.space</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wfp-btn"><Icon name="external" size={14} />Відкрити сайт</button>
          <button className="wfp-btn wfp-btn--primary"><Icon name="check" size={14} />Опублікувати зміни</button>
        </div>
      </div>

      {/* sub-nav */}
      <div className="wfdk-toolbar" style={{ marginBottom: 20, borderBottom: '1px solid var(--wf-border)', paddingBottom: 14 }}>
        <div className="wfdk-seg" style={{ flexWrap: 'wrap' }}>
          {LH_TABS.map(([id, l]) => <div key={id} className="wfdk-seg-opt" data-on={tab === id || undefined} onClick={() => setTab(id)}>{l}</div>)}
        </div>
      </div>

      <div key={tab}>
        {tab === 'overview' && <LhOverview onGo={setTab} />}
        {tab === 'pages' && (window.WorkspaceBranding ? <WorkspaceBranding /> : null)}
        {tab === 'services' && (window.WorkspaceServicesAdmin ? <WorkspaceServicesAdmin /> : null)}
        {tab === 'cases' && (window.WorkspaceCasesV2 ? <WorkspaceCasesV2 /> : null)}
        {tab === 'testimonials' && (window.WsTestimonials ? <WsTestimonials /> : null)}
        {tab === 'blog' && (window.WorkspaceBlogCMS ? <WorkspaceBlogCMS view="list" /> : null)}
      </div>
    </React.Fragment>
  );
}

// Overview: live status of the whole site + quick links into each area.
function LhOverview({ onGo }) {
  const cards = [
    { id: 'pages', icon: 'star', title: 'Сторінки · бренд · SEO', status: 'ok', statusLabel: '6 секцій активні', meta: 'hero · послуги · про нас · кейси · відгуки · контакти', cta: 'Редагувати сторінки' },
    { id: 'services', icon: 'kanban', title: 'Послуги', status: 'ok', statusLabel: '5 у каталозі', meta: 'показуються на /services · 3 ліди за тиждень', cta: 'Керувати послугами' },
    { id: 'cases', icon: 'star', title: 'Кейси', status: 'ok', statusLabel: '3 опубліковані', meta: '1 чернетка · AI-генерація з замовлення', cta: 'Редагувати кейси' },
    { id: 'testimonials', icon: 'star', title: 'Відгуки', status: 'ok', statusLabel: '3 опубліковані · 2 featured', meta: 'сер. оцінка 4.8 · блок + логотипи', cta: 'Керувати відгуками' },
    { id: 'blog', icon: 'edit', title: 'Блог', status: 'warn', statusLabel: '1 чернетка', meta: '8 опублікованих · CTA-блоки → ліди', cta: 'Відкрити блог' },
  ];
  return (
    <React.Fragment>
      {/* domain + publish status strip */}
      <div className="wfp-stats" style={{ marginBottom: 22 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">домен</div><div className="wfp-stat-v" style={{ fontSize: 18 }}>workflo.space</div><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-success)' }}>● підключено · SSL</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">останнє оновлення</div><div className="wfp-stat-v" style={{ fontSize: 18 }}>сьогодні</div><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>11:24 · Ілля</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">відвідувачів (7д)</div><div className="wfp-stat-v wfp-stat-v--accent">1 248</div><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-success)' }}>▲ 12%</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">ліди з сайту (7д)</div><div className="wfp-stat-v">9</div><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>форми + booking</div></div>
      </div>

      <div className="wfc-sec-h"><span className="wfc-sec-h-t">Блоки сайту</span><span className="wfc-sec-h-s">// клік — перейти до редагування</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.id} className="wfl-panel" style={{ cursor: 'pointer' }} onClick={() => onGo(c.id)}>
            <div className="wfl-panel-b" style={{ gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span className="wfc-proj-ico" style={{ width: 36, height: 36 }}><Icon name={c.icon} size={17} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div>
                  <div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)', marginTop: 2 }}>{c.meta}</div>
                </div>
                <span className="wfg-pill2" data-tone={c.status === 'ok' ? 'ok' : 'warn'}><span className="wfg-pill2-dot" />{c.statusLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--wf-border)' }}>
                <span className="wfp-link" style={{ fontSize: 12.5, fontWeight: 500 }}>{c.cta}</span>
                <Icon name="chev_r" size={14} color="var(--wf-fg-subtle)" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { WsLandingHub });
