// product-shell.jsx — AppShell + Sidebar + Topbar for Portal & Workspace
// Two aesthetics: A=Terminal (wrapped in macOS chrome), B=Studio (clean shell).

// Accent colour presets (mirrored from terminal-variant.jsx so this file stands alone)
if (typeof window !== 'undefined' && !window.ACCENT_PRESETS) {
  window.ACCENT_PRESETS = {
    lime:    { name: 'Lime',       light: '#A3D90D', dark: '#C5F82A', soft: '#ECFCC4', softDark: '#3F4F0F' },
    amber:   { name: 'Amber CRT',  light: '#D97706', dark: '#FFB000', soft: '#FEF3C7', softDark: '#3F2A0F' },
    green:   { name: 'Phosphor',   light: '#16A34A', dark: '#22C55E', soft: '#DCFCE7', softDark: '#0F3F1F' },
    cyan:    { name: 'Cyan',       light: '#0891B2', dark: '#22D3EE', soft: '#CFFAFE', softDark: '#0F353F' },
    magenta: { name: 'Magenta',    light: '#C026D3', dark: '#E879F9', soft: '#FAE8FF', softDark: '#3F0F3F' },
    orange:  { name: 'Orange',     light: '#EA580C', dark: '#FB923C', soft: '#FFEDD5', softDark: '#3F1F0F' },
  };
}

// Lucide-style icons (1.6px stroke, currentColor)
const PIcon = {
  inbox:    <path d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3 7v6a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-6l3-7z"/>,
  receipt:  <path d="M6 2v20l3-2 3 2 3-2 3 2V2H6zM10 7h8M10 11h8M10 15h5"/>,
  file:     (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>),
  star:     <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7l3-7z"/>,
  gift:     (<><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9M12 8s-3-4-6-2 2 4 6 2zM12 8s3-4 6-2-2 4-6 2z"/></>),
  users:    (<><circle cx="9" cy="8" r="3.5"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/><circle cx="17" cy="6.5" r="2.8"/><path d="M16 14h2a4 4 0 0 1 4 4v2"/></>),
  settings: (<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .35 1.86l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.86-.35 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.86.35l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .35-1.86 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.35-1.86l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.86.35H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.86-.35l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.35 1.86V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></>),
  bell:     <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9zM13.7 21a2 2 0 0 1-3.4 0"/>,
  search:   (<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>),
  plus:     <path d="M12 5v14M5 12h14"/>,
  home:     (<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V9z"/></>),
  kanban:   (<><rect x="3" y="3" width="6" height="14" rx="1"/><rect x="11" y="3" width="6" height="10" rx="1"/><rect x="19" y="3" width="2" height="6" rx="0.5"/></>),
  building: (<><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01"/></>),
  coins:    (<><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/></>),
  truck:    (<><path d="M14 18V6h-9v12h9zM14 8h4l3 4v6h-7M5 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></>),
  edit:     <path d="M12 20h9M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z"/>,
  list:     <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>,
  chevron:  <path d="M6 9l6 6 6-6"/>,
  chev_r:   <path d="M9 6l6 6-6 6"/>,
  paperclip: <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>,
  send:     <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>,
  copy:     (<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>,
  external: <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>,
  check:    <path d="M5 12l5 5L20 7"/>,
  alert:    (<><path d="M12 2L2 22h20L12 2zM12 9v5"/><circle cx="12" cy="18" r="0.5" fill="currentColor"/></>),
  lock:     (<><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>),
  shield:   <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/>,
  eye:      (<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>),
  eye_off:  (<><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6 0 10 7 10 7a13.2 13.2 0 0 1-2.5 3.1M6.6 6.6A13.3 13.3 0 0 0 2 11s4 7 10 7a9 9 0 0 0 4-.9M3 3l18 18M9.5 9.5a3 3 0 0 0 4 4"/></>),
  mail:     (<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M3 6l9 7 9-7"/></>),
  clock:    (<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  key:      (<><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M14 9l2 2"/></>),
  globe:    (<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></>),
  calendar: (<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></>),
};

function Icon({ name, size = 16, color, style }) {
  const path = PIcon[name];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color || 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {path}
    </svg>
  );
}

// ─── Portal sidebar nav config ───
// Робота → Фінанси → Бонуси → Компанія → Налаштування → Підтримка.
// «Компанія» = профіль+люди; особисті налаштування акаунта живуть окремо.
const PORTAL_NAV = [
  { id: 'inbox',      label: 'Інбокс',       icon: 'inbox',    badge: '5',  badgeKind: 'accent', href: '/inbox' },
  { id: 'orders',     label: 'Замовлення',   icon: 'list',     badge: '2',  href: '/orders' },
  { id: 'projects',   label: 'Проєкти',      icon: 'copy',     badge: null, href: '/projects' },
  { group: 'Фінанси' },
  { id: 'billing',    label: 'Рахунки й борг', icon: 'receipt', badge: null, href: '/billing' },
  { id: 'documents',  label: 'Документи',    icon: 'file',     badge: '12', href: '/documents' },
  { id: 'wallet',     label: 'Гаманець',     icon: 'coins',    badge: null, href: '/wallet' },
  { group: 'Бонуси' },
  { id: 'loyalty',    label: 'Лояльність',   icon: 'star',     badge: null, href: '/loyalty' },
  { id: 'referrals',  label: 'Реферали',     icon: 'gift',     badge: null, href: '/referrals' },
  { group: 'Компанія' },
  { id: 'company',    label: 'Моя компанія', icon: 'building', badge: null, href: '/company' },
  { id: 'team',       label: 'Учасники',     icon: 'users',    badge: '4',  href: '/team' },
  { group: 'Налаштування' },
  { id: 'secrets',    label: 'Секрети',       icon: 'lock',     badge: null, href: '/secrets' },
  { id: 'integrations', label: 'Інтеграції', icon: 'globe',   badge: null, href: '/settings/integrations' },
  { id: 'settings',   label: 'Налаштування акаунта', icon: 'settings', badge: null, href: '/settings' },
  { group: 'Підтримка' },
  { id: 'support',    label: 'Підтримка',    icon: 'mail',     badge: '1',  href: '/support' },
  { id: 'help',       label: 'Довідка',     icon: 'file',     badge: null, href: '/help' },
  { id: 'tour',       label: 'Тур по порталу', icon: 'star',   badge: null, href: '/tour' },
];

// ─── Workspace sidebar nav ───
// Регрупінг 2026-06 для зрозумілості: кожна група має ≤6 пунктів і чітку назву.
//   Робота · Клієнти · Підтримка · Фінанси · Аналітика · Команда ·
//   Сайт і контент · Документи й шаблони · Інтеграції · Налаштування агенції ·
//   Інструменти · Службове · Профіль.
// Canonical role-based IA (ТЗ Частина I §2.1–2.5). Each item tags `roles`:
// o=owner · m=manager · x=executor. Groups inherit visibility from their items.
// Dev-debug screens (dlq/trash/403/auth) live in a de-emphasised `// службове` zone.
const WORKSPACE_NAV = [
  { id: 'dashboard',  label: 'Дашборд',      icon: 'home',     badge: null,  href: '/',        roles: 'omx' },
  { id: 'inbox',      label: 'Інбокс',       icon: 'inbox',    badge: '12',  badgeKind: 'accent', href: '/inbox', roles: 'omx' },

  { group: 'Робота', roles: 'omx' },
  { id: 'board',      label: 'Дошка задач',  icon: 'kanban',   badge: null,  href: '/board',   roles: 'omx' },
  { id: 'orders',     label: 'Замовлення',   icon: 'list',     badge: '7',   href: '/orders',  roles: 'omx' },
  { id: 'projects',   label: 'Проєкти',      icon: 'copy',     badge: null,  href: '/projects', roles: 'omx' },
  { id: 'calendar',   label: 'Календар',     icon: 'calendar', badge: null,  href: '/calendar', roles: 'omx' },

  { group: 'Клієнти', roles: 'om' },
  { id: 'leads',      label: 'Ліди',         icon: 'truck',    badge: '6',   href: '/leads',   roles: 'om', badgeKind: 'accent' },
  { id: 'companies',  label: 'Клієнти',      icon: 'building', badge: null,  href: '/clients', roles: 'om' },

  { group: 'Підтримка', roles: 'om' },
  { id: 'support',    label: 'Звернення',    icon: 'inbox',    badge: '3',   href: '/support', roles: 'om' },
  { id: 'canned',     label: 'Шаблони відповідей', icon: 'edit', badge: null, href: '/support/canned', roles: 'om' },
  { id: 'kb',         label: 'База знань',    icon: 'file',     badge: null,  href: '/support/kb', roles: 'om' },

  { group: 'Фінанси', roles: 'o' },
  { id: 'billing',    label: 'Білінг',       icon: 'receipt',  badge: null,  href: '/billing', roles: 'o' },
  { id: 'debtors',    label: 'Дебітори',     icon: 'clock',    badge: '4',   href: '/billing/debtors', roles: 'o' },
  { id: 'refund',     label: 'Повернення',   icon: 'download', badge: null,  href: '/billing/refunds', roles: 'o' },
  { id: 'payouts',    label: 'Виплати',      icon: 'send',     badge: null,  href: '/payouts', roles: 'ox' },
  { id: 'comp',       label: 'Ставки',       icon: 'coins',    badge: null,  href: '/billing/rates', roles: 'o' },
  { id: 'svc-catalog', label: 'Каталог послуг', icon: 'list',   badge: null,  href: '/billing/services-catalog', roles: 'o' },

  { group: 'Аналітика', roles: 'o' },
  { id: 'finance',    label: 'Фінанси / Маржа', icon: 'receipt', badge: null, href: '/finance', roles: 'o' },
  { id: 'cashflow',   label: 'Cash-flow',    icon: 'coins',    badge: null,  href: '/admin/cashflow', roles: 'o' },
  { id: 'reports',    label: 'Звіти',        icon: 'chevron',  badge: null,  href: '/reports', roles: 'o' },
  { id: 'bizreports', label: 'Бізнес-звіти', icon: 'chevron',  badge: null,  href: '/reports/v1', roles: 'o' },

  { group: 'Команда', roles: 'omx' },
  { id: 'team',       label: 'Команда',      icon: 'users',    badge: null,  href: '/team', roles: 'om' },
  { id: 'capacity',   label: 'Завантаженість', icon: 'clock',  badge: null,  href: '/team/capacity', roles: 'om' },
  { id: 'planfact',   label: 'План-факт годин', icon: 'kanban', badge: null, href: '/team/utilization', roles: 'ox' },
  { id: 'leave',      label: 'Відпустки',    icon: 'calendar', badge: '3',   href: '/admin/leave', roles: 'omx' },

  { group: 'Сайт і контент', roles: 'om' },
  { id: 'landinghub', label: 'Лендінг',      icon: 'globe',    badge: null,  href: '/landing', roles: 'om' },
  { id: 'blog',       label: 'Блог',         icon: 'edit',     badge: null,  href: '/content', roles: 'om' },
  { id: 'cases',      label: 'Кейси',        icon: 'file',     badge: null,  href: '/content/cases', roles: 'om' },
  { id: 'testimonials', label: 'Відгуки',    icon: 'star',     badge: null,  href: '/content/testimonials', roles: 'om' },
  { id: 'svc-admin',  label: 'Послуги (вітрина)', icon: 'list', badge: null, href: '/services', roles: 'om' },

  { group: 'Документи й шаблони', roles: 'o' },
  { id: 'wsdocuments', label: 'Документи',    icon: 'file',     badge: null,  href: '/documents', roles: 'o' },
  { id: 'legal',      label: 'Юр-особи агенції', icon: 'building', badge: null, href: '/admin/legal-entities', roles: 'o' },
  { id: 'contracts',  label: 'Шаблони договорів', icon: 'file', badge: null,  href: '/admin/contracts', roles: 'o' },
  { id: 'dockit',     label: 'Бланки документів', icon: 'receipt', badge: null, href: '/admin/documents', roles: 'o' },
  { id: 'mailtpl',    label: 'Email-шаблони', icon: 'mail',    badge: null,  href: '/admin/email-templates', roles: 'o' },

  { group: 'Інтеграції', roles: 'o' },
  { id: 'integrations', label: 'Інтеграції', icon: 'globe',    badge: null,  href: '/admin/integrations', roles: 'o' },
  { id: 'bot',        label: 'Telegram-бот', icon: 'send',     badge: null,  href: '/admin/bot', roles: 'o' },
  { id: 'notify',     label: 'Сповіщення',   icon: 'bell',     badge: null,  href: '/admin/notifications', roles: 'o' },

  { group: 'Налаштування агенції', roles: 'o' },
  { id: 'branding',   label: 'White-label',  icon: 'star',     badge: null,  href: '/settings/branding', roles: 'o' },
  { id: 'loyalty-set', label: 'Лояльність',  icon: 'star',     badge: null,  href: '/settings/loyalty', roles: 'o' },
  { id: 'calsettings', label: 'Налашт. календаря', icon: 'calendar', badge: null, href: '/calendar/settings', roles: 'o' },
  { id: 'sysmon',     label: 'Моніторинг',   icon: 'alert',    badge: null,  href: '/admin/system', roles: 'o' },
  { id: 'admin-set',  label: 'Загальні налаштування', icon: 'settings', badge: null, href: '/admin/templates', roles: 'o' },

  { group: 'Інструменти', roles: 'omx' },
  { id: 'search',     label: 'Пошук',        icon: 'search',   badge: null,  href: '/search',  roles: 'omx' },
  { id: 'auditmap',   label: 'Карта прототипу', icon: 'eye',   badge: null,  href: '/audit',   roles: 'omx' },
  { id: 'vault',      label: 'Сейф доступів', icon: 'lock',    badge: null,  href: '/vault',   roles: 'ox' },
  { id: 'bulk',       label: 'Bulk-дії',     icon: 'kanban',   badge: null,  href: '/orders?bulk', roles: 'om' },
  { id: 'export',     label: 'Експорт',      icon: 'download', badge: null,  href: '/reports/export', roles: 'o' },

  { group: 'Службове', roles: 'o', muted: true },
  { id: 'dlq',        label: 'Notif. DLQ',   icon: 'alert',    badge: null,  href: '/admin/notifications/dlq', roles: 'o' },
  { id: 'trash',      label: 'Кошик',        icon: 'truck',    badge: null,  href: '/admin/trash', roles: 'o' },
  { id: 'forbidden',  label: 'Доступ (403)', icon: 'lock',     badge: null,  href: '/admin/403', roles: 'o' },
  { id: 'authflows',  label: 'Вхід · стани', icon: 'lock',     badge: null,  href: '/auth/states', roles: 'o' },
  { id: 'viewas',     label: 'View-as екран', icon: 'eye',     badge: null,  href: '/admin/view-as', roles: 'o' },

  { group: 'Профіль', roles: 'omx' },
  { id: 'onboarding', label: 'Майстер запуску', icon: 'star', badge: null, href: '/onboarding', roles: 'o' },
  { id: 'mysettings', label: 'Мої налаштування', icon: 'settings', badge: null, href: '/settings/profile', roles: 'omx' },
];

// ─── Sidebar component ───
const ROLE_CHAR = { owner: 'o', manager: 'm', executor: 'x' };
const ROLE_LABEL = { owner: 'owner', manager: 'manager', executor: 'виконавець' };
const ROLE_DESC = { owner: 'повний доступ', manager: 'без фінансів і налаштувань', executor: 'лише своя площина' };
function navVisibleForRole(items, role) {
  const rc = ROLE_CHAR[role] || 'o';
  const kept = items.filter((it) => !it.roles || it.roles.includes(rc));
  // drop group headers with no item before the next group
  return kept.filter((it, i) => {
    if (!it.group) return true;
    const nx = kept[i + 1];
    return !!nx && !nx.group;
  });
}
function Sidebar({ kind = 'portal', active = 'orders', aesthetic = 'B', onNav, role = 'owner', onSetRole, viewAs, onViewAs }) {
  const [roleMenu, setRoleMenu] = React.useState(false);
  const [coMenu, setCoMenu] = React.useState(false);
  const rawItems = kind === 'portal' ? PORTAL_NAV : WORKSPACE_NAV;
  const items = kind === 'workspace' ? navVisibleForRole(rawItems, role) : rawItems;
  const companies = window.WFP_DATA.companies_owned;
  const [activeCoId, setActiveCoId] = React.useState((companies.find((c) => c.active) || companies[0]).id);
  const co = companies.find((c) => c.id === activeCoId) || companies[0];

  return (
    <aside className="wfp-sb">
      <div className="wfp-sb-head">
        <span className="wfp-sb-mark">workflo<span className="wfp-dot">.</span>space</span>
        <span className="wfp-sb-sub">{kind === 'portal' ? 'portal' : 'work'}</span>
      </div>
      <nav className="wfp-sb-nav">
        {items.map((it, i) => {
          if (it.group) return <div key={`g-${i}`} className={`wfp-sb-group${it.muted ? ' wfp-sb-group--muted' : ''}`}>{aesthetic === 'A' ? `// ${it.group.toLowerCase()}` : it.group}</div>;
          const on = it.id === active;
          return (
            <a key={it.id} className="wfp-sb-item" data-on={on || undefined}
              href={onNav ? '#' + it.id : undefined}
              style={onNav ? { cursor: 'pointer' } : undefined}
              onClick={onNav ? (e) => { e.preventDefault(); onNav(it.id); } : undefined}>
              <span className="wfp-sb-item-icon"><Icon name={it.icon} size={16} /></span>
              <span>{it.label}</span>
              {it.badge && (
                <span className={`wfp-sb-item-badge${it.badgeKind === 'accent' ? ' wfp-sb-item-badge--accent' : ''}`}>{it.badge}</span>
              )}
            </a>
          );
        })}
      </nav>

      {kind === 'portal' ? (
        <div className="wfp-sb-foot wfp-sb-user--menu">
          <button className="wfp-sb-company" onClick={() => setCoMenu((v) => !v)} data-open={coMenu || undefined} style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
            <div className="wfp-sb-company-avatar">{co.name.replace(/^(ФОП|ТОВ)\s*/, '').charAt(0)}</div>
            <div className="wfp-sb-company-meta">
              <div className="wfp-sb-company-name">{co.name}</div>
              <div className="wfp-sb-company-role">
                <span>{co.role}</span>
                <span>·</span>
                <span className="wfp-sb-company-role-tier">{co.tier}</span>
              </div>
            </div>
            <span className="wfp-sb-company-chev"><Icon name="chevron" size={14} /></span>
          </button>
          {coMenu && (
            <React.Fragment>
              <div className="wfp-sb-rolemenu-scrim" onClick={() => setCoMenu(false)} />
              <div className="wfp-sb-rolemenu">
                <div className="wfp-sb-rolemenu-h">// мої компанії</div>
                {companies.map((c) => (
                  <button key={c.id} className="wfp-sb-rolemenu-item" data-on={c.id === activeCoId || undefined}
                    onClick={() => { setActiveCoId(c.id); setCoMenu(false); window.wfToast && window.wfToast('Компанія: ' + c.name, 'ok'); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div className="wfp-sb-company-avatar" style={{ width: 26, height: 26, fontSize: 12 }}>{c.name.replace(/^(ФОП|ТОВ)\s*/, '').charAt(0)}</div>
                      <div>
                        <div className="wfp-sb-rolemenu-item-t">{c.name}</div>
                        <div className="wfp-sb-rolemenu-item-s">{c.role === 'owner' ? 'owner · повний доступ' : 'member · учасник'} · {c.tier}</div>
                      </div>
                    </div>
                    {c.id === activeCoId && <Icon name="check" size={14} />}
                  </button>
                ))}
                <div className="wfp-sb-rolemenu-sep" />
                <button className="wfp-sb-rolemenu-item" onClick={() => { setCoMenu(false); window.wfToast && window.wfToast('Додати / приєднатись до компанії · демо', 'info'); }}>
                  <div className="wfp-sb-rolemenu-item-t"><Icon name="plus" size={12} /> Додати компанію</div>
                </button>
              </div>
            </React.Fragment>
          )}
        </div>
      ) : (
        <div className="wfp-sb-user wfp-sb-user--menu">
          <button className="wfp-sb-user-btn" onClick={() => onSetRole && setRoleMenu((v) => !v)} data-open={roleMenu || undefined}>
            <div className="wfp-sb-user-av">ІВ</div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div className="wfp-sb-user-name">Ілля Васюленко</div>
              <div className="wfp-sb-user-meta">{ROLE_LABEL[role] || 'owner'}{onSetRole && <span className="wfp-sb-user-chev">▾</span>}</div>
            </div>
          </button>
          {roleMenu && onSetRole && (
            <React.Fragment>
              <div className="wfp-sb-rolemenu-scrim" onClick={() => setRoleMenu(false)} />
              <div className="wfp-sb-rolemenu">
                <div className="wfp-sb-rolemenu-h">// роль · демо</div>
                {['owner', 'manager', 'executor'].map((r) => (
                  <button key={r} className="wfp-sb-rolemenu-item" data-on={r === role && !viewAs || undefined}
                    onClick={() => { onSetRole(r); setRoleMenu(false); }}>
                    <div>
                      <div className="wfp-sb-rolemenu-item-t">{ROLE_LABEL[r]}</div>
                      <div className="wfp-sb-rolemenu-item-s">{ROLE_DESC[r]}</div>
                    </div>
                    {r === role && !viewAs && <Icon name="check" size={14} />}
                  </button>
                ))}
                <div className="wfp-sb-rolemenu-sep" />
                <button className="wfp-sb-rolemenu-item" data-on={viewAs === 'client' || undefined}
                  onClick={() => { onViewAs && onViewAs('client'); setRoleMenu(false); }}>
                  <div>
                    <div className="wfp-sb-rolemenu-item-t"><Icon name="eye" size={12} /> Дивитись як клієнт</div>
                    <div className="wfp-sb-rolemenu-item-s">read-only · очима Brunky</div>
                  </div>
                </button>
              </div>
            </React.Fragment>
          )}
        </div>
      )}
    </aside>
  );
}

// ─── Top bar ───
function Topbar({ crumbs = [], actions = null, aesthetic = 'B', onSearch, onBell, onMenu }) {
  return (
    <div className="wfp-topbar">
      {onMenu && (
        <button className="wfp-tb-burger" title="Меню" aria-label="Відкрити меню" onClick={onMenu}>
          <Icon name="list" size={18} />
        </button>
      )}
      <div className="wfp-crumb">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="wfp-crumb-sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'wfp-crumb-current' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="wfp-tb-right">
        {actions}
        <button className="wfp-iconbtn" title="Пошук (⌘K)" onClick={onSearch} style={onSearch ? { cursor: 'pointer' } : undefined}><Icon name="search" size={15} /></button>
        <button className="wfp-iconbtn" title="Нотифікації" onClick={onBell} style={onBell ? { cursor: 'pointer' } : undefined}>
          <Icon name="bell" size={15} />
          <span className="wfp-iconbtn-dot" />
        </button>
        <div className="wfp-tb-avatar">ІВ</div>
      </div>
    </div>
  );
}

// ─── Shell wrapper with optional window chrome (aesthetic A) ───
function AppShell({
  kind = 'portal',
  active,
  crumbs,
  topbarActions,
  children,
  aesthetic = 'B',
  theme = 'light',
  accent = 'lime',
  density = 'comfortable',
  windowTitle,
  onNav,
  onSearch,
  onBell,
  role = 'owner',
  onSetRole,
  viewAs,
  onViewAs,
  onExitViewAs,
}) {
  const accentPreset = (window.ACCENT_PRESETS && window.ACCENT_PRESETS[accent]) || null;
  const accentColor = accentPreset ? (theme === 'dark' ? accentPreset.dark : accentPreset.light) : undefined;
  const accentBg = accentPreset ? accentPreset.dark : undefined;
  const accentSoft = accentPreset ? (theme === 'dark' ? accentPreset.softDark : accentPreset.soft) : undefined;

  const [sbOpen, setSbOpen] = React.useState(false);
  const closeSb = () => setSbOpen(false);
  // close the drawer on Escape
  React.useEffect(() => {
    if (!sbOpen) return;
    const h = (e) => { if (e.key === 'Escape') setSbOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sbOpen]);

  const rootStyle = accentColor ? {
    '--wf-accent': accentColor,
    '--wf-accent-bg': accentBg,
    '--wf-accent-soft': accentSoft,
  } : {};

  const content = (
    <div className={`wfp-shell wfp-shell--${kind} wfp-aes${aesthetic}`} data-density={density} data-mobile-open={sbOpen || undefined}>
      <Sidebar kind={kind} active={active} aesthetic={aesthetic}
        onNav={onNav ? (id) => { closeSb(); onNav(id); } : undefined}
        role={role} onSetRole={onSetRole} viewAs={viewAs} onViewAs={onViewAs} />
      {sbOpen && <div className="wfp-sb-scrim" onClick={closeSb} />}
      <main className="wfp-main">
        {viewAs && (
          <div className="wfp-viewas-banner" role="alert">
            <Icon name="eye" size={15} />
            <span>Перегляд очима: <strong>{viewAs === 'client' ? 'Brunky · клієнт' : 'виконавець'}</strong> <span className="wfp-viewas-ro">(read-only · мутації заблоковані)</span></span>
            <button className="wfp-viewas-exit" onClick={onExitViewAs}>Вийти →</button>
          </div>
        )}
        <Topbar crumbs={crumbs || []} actions={topbarActions} aesthetic={aesthetic} onSearch={onSearch} onBell={onBell} onMenu={() => setSbOpen(true)} />
        <div className="wfp-content">{children}</div>
      </main>
    </div>
  );

  if (aesthetic === 'A') {
    const title = windowTitle || (kind === 'portal' ? 'portal.workflo.space — bash · 1440×900' : 'work.workflo.space — bash · 1440×900');
    return (
      <div className={`wfp-root wf-root${theme === 'dark' ? '' : ''}`} data-theme={theme} data-accent={accent} style={rootStyle}>
        <div className="wfp-window" style={{ height: '100%' }}>
          <div className="wfp-window-title">
            <div className="wfp-window-traffic">
              <span className="wfp-window-traffic-dot" />
              <span className="wfp-window-traffic-dot" />
              <span className="wfp-window-traffic-dot" />
            </div>
            <div className="wfp-window-title-c">{title}</div>
            <div />
          </div>
          <div className="wfp-window-body">{content}</div>
          <div className="wfp-window-statusbar">
            <div className="wfp-window-statusbar-l">
              <span className="wfp-status-dot" />
              <span>main</span>
              <span>·</span>
              <span>{kind === 'portal' ? 'portal' : 'work'}.workflo.space</span>
            </div>
            <div className="wfp-window-statusbar-r">
              <span>{(crumbs && crumbs.length) ? '/' + crumbs.slice(1).join('/') : '/'}</span>
              <span>·</span>
              <span>14:32</span>
              <span>·</span>
              <span>{theme}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`wfp-root wf-root`} data-theme={theme} data-accent={accent} style={{ ...rootStyle, height: '100%' }}>
      {content}
    </div>
  );
}

// ─── Helpers ───
function StatusDot({ status }) {
  const s = (window.WFP_DATA.client_statuses[status]) || { label: status, dot: 'var(--wf-fg-muted)' };
  return (
    <span className="wfp-order-status">
      <span className="wfp-status-dot" style={{ background: s.dot }} />
      <span>{s.label}</span>
    </span>
  );
}

// Chat author label with a small thematic avatar before the [who] bracket.
function ChatWho({ who, label }) {
  const name = label || who;
  if (who === 'system') {
    return <span className="wfp-chat-who wfp-chat-who--system">{name}</span>;
  }
  let kind = 'user', shape = 'circle', fill = 'soft';
  if (window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[who]) { kind = window.WFA_PERSON_KIND[who]; shape = 'tile'; }
  else if (who === 'workflo') { kind = 'developer'; shape = 'tile'; fill = 'solid'; }
  else if (who === 'client') { kind = 'user'; shape = 'circle'; }
  return (
    <span className="wfp-chat-who-wrap">
      {window.WfAvatar && <WfAvatar kind={kind} size="xs" shape={shape} fill={fill} />}
      <span className={`wfp-chat-who wfp-chat-who--${who}`}>{name}</span>
    </span>
  );
}

function AvatarsStack({ ids }) {
  if (!ids || !ids.length) return <span style={{ color: 'var(--wf-fg-subtle)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>—</span>;
  const top = ids.slice(0, 3);
  const more = ids.length - top.length;
  const kindFor = (id) => (window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[id]) || 'developer';
  return (
    <span className="wfp-av-stack wfp-av-stack--glyph">
      {top.map((id) => (
        window.WfAvatar
          ? <WfAvatar key={id} kind={kindFor(id)} size="xs" shape="circle" />
          : <span key={id} className={`wfp-av wfp-av--${id}`}>{id.slice(0, 2).toUpperCase()}</span>
      ))}
      {more > 0 && <span className="wfp-av wfp-av--more">+{more}</span>}
    </span>
  );
}

Object.assign(window, { AppShell, Sidebar, Topbar, Icon, StatusDot, AvatarsStack, ChatWho, PORTAL_NAV, WORKSPACE_NAV });
