// workspace-audit.jsx — Prototype coverage map (self-audit vs ТЗ).
// Lists every Workspace + Portal screen with a status badge and click-to-open.
// status: ready (флоу працює) · partial (рендериться, частина дій-заглушок) · demo (статика/перегляд)

const _au = React.useState;

// Curated status overlay by nav id. Anything not listed defaults to 'ready'.
const AUDIT_STATUS = {
  // workspace
  dashboard: ['ready', 'KPI + зрізи дошки, переходи'],
  inbox: ['partial', 'майстер-деталь; частина дій-заглушок'],
  board: ['ready', 'канбан + DnD + фільтри + налаштування колонок + додавання'],
  orders: ['ready', 'список + фільтри + bulk + деталь'],
  projects: ['ready', 'список + майстер проєкту'],
  companies: ['ready', 'attention-дашборд + картка 360° (7 табів, рольова)'],
  leads: ['ready', 'канбан + деталь + convert-модал (компанія+проєкт)'],
  support: ['partial', 'черга + тред; дії частково'],
  canned: ['partial', 'бібліотека шаблонів'],
  kb: ['partial', 'база знань — перегляд'],
  billing: ['partial', 'хаб білінгу — підтаби'],
  debtors: ['ready', 'дебітори + дії'],
  refund: ['partial', 'повернення — форма'],
  payouts: ['partial', 'виплати — розрахунок'],
  comp: ['ready', 'ставки/компенсації — триярус + модалка'],
  finance: ['ready', 'Огляд/Витрати/Маржа/P&L + recurring + cash-flow'],
  cashflow: ['ready', 'прогноз 1/2/3 міс + running-баланс'],
  wsdocuments: ['ready', 'DocumentsIndex: статуси + доставка + bulk'],
  reports: ['partial', 'звіти + audit (до→після)'],
  bizreports: ['ready', 'бізнес-звіти v1'],
  team: ['partial', 'ростер + підпорядкування'],
  capacity: ['ready', 'завантаженість + KPI-картки'],
  planfact: ['ready', '3 рівні: команда/люди/проєкти'],
  leave: ['partial', 'відпустки — заявки'],
  landinghub: ['partial', 'лендінг-хаб'],
  blog: ['partial', 'CMS блогу — редактор'],
  cases: ['ready', 'редактор кейсів + before/after + SEO'],
  testimonials: ['partial', 'відгуки CRUD'],
  'svc-admin': ['partial', 'каталог послуг'],
  search: ['partial', 'результати пошуку'],
  vault: ['partial', 'сейф доступів'],
  bulk: ['ready', 'bulk-операції'],
  export: ['demo', 'кнопка експорту'],
  legal: ['ready', 'юр-особи + isComplete-гейт'],
  contracts: ['partial', 'шаблони договорів'],
  dockit: ['ready', 'UA+EU бланки (12 типів) + стани + публічна сторінка'],
  mailtpl: ['ready', 'email-шаблони UA/EN + доставка'],
  calsettings: ['partial', 'налашт. календаря'],
  'loyalty-set': ['partial', 'налашт. лояльності'],
  integrations: ['partial', 'інтеграції'],
  bot: ['partial', 'telegram-бот'],
  branding: ['partial', 'white-label'],
  notify: ['partial', 'сповіщення — матриця'],
  sysmon: ['partial', 'моніторинг'],
  'admin-set': ['partial', 'налаштування агенції'],
  calendar: ['partial', 'календар'],
  orderchat: ['partial', 'чат замовлення'],
  dlq: ['demo', 'службове'], trash: ['demo', 'службове'], forbidden: ['demo', 'службове'],
  authflows: ['demo', 'службове'], viewas: ['ready', 'view-as запуск'],
  mysettings: ['partial', 'мої налаштування'], settings: ['partial', 'налаштування'],
};
const AUDIT_PORTAL = {
  inbox: ['partial', 'інбокс клієнта'],
  orders: ['ready', 'замовлення + деталь'],
  estimate: ['ready', 'кошторис fixed/hourly + погодження'],
  projects: ['ready', 'білінг по проєктах + оплата'],
  billing: ['ready', 'рахунки/борг + оплатити'],
  documents: ['ready', 'self-service + акт звірки (generating)'],
  docdiff: ['partial', 'зміни специфікації'],
  wallet: ['ready', 'гаманець — баланси + виписка'],
  loyalty: ['ready', 'лояльність — тіри'],
  referrals: ['ready', 'реферали — воронка'],
  company: ['ready', 'моя компанія + isComplete-гейт'],
  team: ['ready', 'учасники + ролі'],
  secrets: ['ready', 'секрети + 2FA reveal + журнал'],
  integrations: ['partial', 'інтеграції'],
  settings: ['partial', 'налаштування компанії'],
  support: ['partial', 'підтримка'], help: ['demo', 'довідка'], tour: ['demo', 'тур'],
};

const ST_META = {
  ready:   { label: 'готово',   tone: 'ok' },
  partial: { label: 'частково', tone: 'warn' },
  demo:    { label: 'демо',     tone: 'muted' },
};

function WorkspaceAuditMap() {
  const [tab, setTab] = _au('workspace');
  const nav = tab === 'workspace' ? window.WORKSPACE_NAV : window.PORTAL_NAV;
  const statusMap = tab === 'workspace' ? AUDIT_STATUS : AUDIT_PORTAL;
  const go = (id) => {
    if (tab === 'workspace') { window.__wsNav && window.__wsNav(id); }
    else { window.__portalNav && window.__portalNav(id); }
  };

  // build groups from nav
  const groups = [];
  let cur = { title: 'Головне', items: [] };
  nav.forEach((it) => {
    if (it.group) { if (cur.items.length) groups.push(cur); cur = { title: it.group, items: [] }; }
    else if (it.id) cur.items.push(it);
  });
  if (cur.items.length) groups.push(cur);

  // counts
  const all = nav.filter((n) => n.id);
  const cnt = (s) => all.filter((n) => (statusMap[n.id] || ['ready'])[0] === s).length;

  return (
    <React.Fragment>
      <PageHeader title="Карта прототипу" subtitle="// аудит покриття · клік по екрану → відкрити · статуси — самооцінка готовності">
        <div className="wff-seg">
          <button className="wff-seg-opt" data-on={tab === 'workspace' || undefined} onClick={() => setTab('workspace')}>Workspace</button>
          <button className="wff-seg-opt" data-on={tab === 'portal' || undefined} onClick={() => setTab('portal')}>Portal</button>
        </div>
      </PageHeader>

      <StatsRow>
        <Stat k="усього екранів" v={all.length} sub={tab === 'workspace' ? 'для owner' : 'портал клієнта'} />
        <Stat k="готово" v={cnt('ready')} sub="флоу працює" kind="accent" />
        <Stat k="частково" v={cnt('partial')} sub="рендериться, дії-заглушки" kind="warn" />
        <Stat k="демо" v={cnt('demo')} sub="статика / службове" />
      </StatsRow>

      <div className="wfau-note">
        <Icon name="eye" size={14} color="var(--wf-accent)" />
        <span>Підказка: проходьте прототип звичайними кліками — <strong>непідключені кнопки самі підсвічуються тостом</strong> «ще не підключено». Ця карта — швидкий зведений огляд + навігація.</span>
      </div>

      {groups.map((g, gi) => (
        <div key={gi} className="wfau-group">
          <div className="wfau-group-h">{g.title}</div>
          <div className="wfau-grid">
            {g.items.map((it) => {
              const [st, note] = statusMap[it.id] || ['ready', ''];
              const meta = ST_META[st] || ST_META.ready;
              return (
                <button key={it.id} className="wfau-card" data-st={st} onClick={() => go(it.id)}>
                  <div className="wfau-card-top">
                    <span className="wfau-card-name">{it.label}</span>
                    <span className="wfg-pill2" data-tone={meta.tone}><span className="wfg-pill2-dot" />{meta.label}</span>
                  </div>
                  <div className="wfau-card-note">{note || '—'}</div>
                  <div className="wfau-card-go">відкрити <Icon name="chevron" size={11} /></div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </React.Fragment>
  );
}

Object.assign(window, { WorkspaceAuditMap });
