// workspace-services.jsx — final brief screens + shared components:
//   WorkspaceServicesAdmin  — /services-admin (manage landing catalog)
//   WorkspaceBillingServices — /billing/services (recurring + assigns)
//   NotificationCenter       — 🔔 dropdown (shared)
//   ToastSystem              — toast variants demo (shared)
// Uses PageHeader/StatsRow/Stat, Icon, WfAvatar, AvatarsStack, BillingSubtabs.

// ───────────────── /services-admin ─────────────────
function WorkspaceServicesAdmin() {
  const d = window.WFP_SERVICES_ADMIN;
  return (
    <React.Fragment>
      <PageHeader title="Послуги" subtitle="// каталог для лендінгу workflo.space/services · порядок + статуси + ліди">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Відкрити /services · демо', 'ok')}><Icon name="globe" size={14} />Відкрити /services</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Нова послуга · демо', 'ok')}><Icon name="plus" size={14} />Нова послуга</button>
      </PageHeader>

      <StatsRow>
        <Stat k="опубліковано" v={d.stats.published} sub="на лендінгу" />
        <Stat k="чернетки" v={d.stats.draft} kind="warn" sub="в роботі" />
        <Stat k="ліди · 30 дн" v={d.stats.leads30} kind="accent" sub="із форм послуг" />
        <Stat k="топ-послуга" v={d.stats.topService} sub="за лідами" />
      </StatsRow>

      <div style={{ marginTop: 14 }}>
        {d.items.map((s) => (
          <div className="wfs-svc-card" key={s.slug}>
            <span className="wfs-svc-glyph">{s.num}</span>
            <div className="wfs-svc-main">
              <div className="wfs-svc-name">
                {s.name}
                <span className="wfs-status" data-s={s.status}><span className="dot" />{s.status === 'published' ? 'опубліковано' : 'чернетка'}</span>
              </div>
              <div className="wfs-svc-sub">
                <span>/services/{s.slug}</span>
                <span>· {s.cases} {s.cases === 1 ? 'кейс' : 'кейси'}</span>
                <span>· оновлено {s.updated}</span>
              </div>
            </div>
            <div className="wfs-svc-right">
              <div className="wfs-svc-leads">
                <div className="wfs-svc-leads-v">{s.leads}</div>
                <div className="wfs-svc-leads-k">лідів</div>
              </div>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Редагувати · демо', 'ok')}><Icon name="edit" size={12} />Редагувати</button>
              <div className="wfs-svc-reorder">
                <button title="вище">▲</button>
                <button title="нижче">▼</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

// ───────────────── /billing/services ─────────────────
function WorkspaceBillingServices() {
  const d = window.WFP_BILLING_SERVICES;
  return (
    <React.Fragment>
      <PageHeader title="Білінг · Сервіси" subtitle="// recurring-підписки на обслуговування · MRR + призначення виконавців">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт · демо', 'ok')}><Icon name="download" size={14} />Експорт</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Новий сервіс · демо', 'ok')}><Icon name="plus" size={14} />Новий сервіс</button>
      </PageHeader>

      <StatsRow>
        <Stat k="MRR" v={`$${d.summary.mrr}`} kind="accent" sub="щомісячна виручка" />
        <Stat k="активних" v={d.summary.active} sub={`${d.summary.clients} клієнтів`} />
        <Stat k="на паузі" v={d.summary.paused} kind="warn" sub="не білиться" />
        <Stat k="середній чек" v={`$${Math.round(d.summary.mrr / d.summary.active)}`} sub="на сервіс" />
      </StatsRow>

      <BillingSubtabs active="services" badges={{ invoices: 4, payments: 5, debtors: 4, payouts: 6, services: d.rows.length }} />

      <table className="wfp-table">
        <thead>
          <tr>
            <th style={{ width: '32%' }}>Сервіс</th>
            <th>Клієнт</th>
            <th>Виконавці</th>
            <th>Наступний</th>
            <th className="wfp-num">Сума/міс</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.id}>
              <td>
                <div style={{ fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 2 }}>з {r.since}</div>
              </td>
              <td>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <WfAvatar kind={window.wfAvatarKindForIndustry ? window.wfAvatarKindForIndustry(r.industry) : 'startup'} size="xs" shape="circle" />
                  {r.client}
                </span>
              </td>
              <td><AvatarsStack ids={r.assignees} /></td>
              <td className="wfp-mono">{r.next}</td>
              <td className="wfp-num">${r.amount}</td>
              <td><span className="wfs-status" data-s={r.status}><span className="dot" />{r.status === 'active' ? 'активний' : 'пауза'}</span></td>
              <td style={{ textAlign: 'right' }}><button className="wfp-iconbtn"><Icon name="more" size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ───────────────── Notification center (shared) ─────────────────
const NOTIF_ICON = { order: 'kanban', payment: 'coins', mention: 'users', deadline: 'alert', system: 'settings', doc: 'file' };

function NotificationCenter({ initialTab = 'unread' }) {
  const [tab, setTab] = React.useState(initialTab);
  const all = window.WFP_NOTIFS;
  const rows = tab === 'unread' ? all.filter((n) => n.unread) : all;
  const unreadCount = all.filter((n) => n.unread).length;
  return (
    <div className="wfn">
      <div className="wfn-head">
        <Icon name="inbox" size={16} />
        <span className="wfn-title">Сповіщення</span>
        {unreadCount > 0 && <span className="wfn-count">{unreadCount}</span>}
        <button className="wfn-readall">Прочитати всі</button>
      </div>
      <div className="wfn-tabs">
        <button className="wfn-tab" data-on={tab === 'unread'} onClick={() => setTab('unread')}>Непрочитані</button>
        <button className="wfn-tab" data-on={tab === 'all'} onClick={() => setTab('all')}>Всі</button>
      </div>
      <div className="wfn-list">
        {rows.map((n) => {
          const av = n.actor && window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[n.actor];
          return (
            <div className="wfn-row" data-unread={n.unread || undefined} key={n.id}>
              {av
                ? <WfAvatar kind={av} size="sm" />
                : <span className="wfn-row-ic" style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in oklab, var(--wf-fg) 5%, transparent)', color: 'var(--wf-fg-muted)', flexShrink: 0 }}><Icon name={NOTIF_ICON[n.kind] || 'inbox'} size={15} /></span>}
              <div className="wfn-row-main">
                <div className="wfn-row-title">{n.title}</div>
                <div className="wfn-row-sub">{n.sub}</div>
              </div>
              <span className="wfn-row-ts">{n.ts}</span>
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ padding: 28, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)' }}>// все прочитано ✓</div>}
      </div>
      <div className="wfn-foot"><a href="#">Налаштувати сповіщення →</a></div>
    </div>
  );
}

// ───────────────── Toast system (shared) ─────────────────
const TOAST_ICON = {
  success: <path d="M20 6L9 17l-5-5" />,
  error:   (<><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></>),
  warning: (<><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" /></>),
  info:    (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></>),
  loading: <path d="M12 3a9 9 0 1 0 9 9" />,
};

function Toast({ t }) {
  return (
    <div className="wft" data-v={t.variant}>
      <span className="wft-ic">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={t.variant === 'loading' ? 'wft-spin' : undefined}>
          {TOAST_ICON[t.variant]}
        </svg>
      </span>
      <div className="wft-main">
        <div className="wft-title">{t.title}</div>
        {t.sub && <div className="wft-sub">{t.sub}</div>}
      </div>
      {t.action && <button className="wft-action">{t.action}</button>}
      {t.variant !== 'loading' && <button className="wft-close">×</button>}
    </div>
  );
}

function ToastSystem() {
  const toasts = window.WFP_TOASTS;
  return (
    <div className="wft-stack">
      {toasts.map((t) => <Toast key={t.id} t={t} />)}
      <div className="wft-stacked-note">+2 у стосі · клік щоб розгорнути</div>
    </div>
  );
}

Object.assign(window, {
  WorkspaceServicesAdmin, WorkspaceBillingServices, NotificationCenter, ToastSystem, Toast,
});
