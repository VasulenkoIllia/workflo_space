// workspace-services-data.js — data for the final brief screens:
//   /services-admin   — manage the landing /services catalog (owner)
//   /billing/services — recurring services catalog + per-client assigns
//   notification center feed + toast samples (shared components)

window.WFP_SERVICES_ADMIN = {
  stats: { published: 4, draft: 1, leads30: 23, topService: 'Інтеграції' },
  items: [
    { slug: 'integrations', num: '01', name: 'Інтеграції та API',        status: 'published', leads: 11, order: 1, updated: '18.05', cases: 2 },
    { slug: 'ai-agents',    num: '02', name: 'AI-агенти та workflow',     status: 'published', leads: 7,  order: 2, updated: '22.05', cases: 1 },
    { slug: 'portals',      num: '03', name: 'Внутрішні портали та CRM',  status: 'published', leads: 4,  order: 3, updated: '11.05', cases: 1 },
    { slug: 'automation',   num: '04', name: 'Автоматизація рутини',      status: 'published', leads: 1,  order: 4, updated: '03.05', cases: 1 },
    { slug: 'data-eng',     num: '05', name: 'Data engineering (beta)',   status: 'draft',     leads: 0,  order: 5, updated: '—',     cases: 0 },
  ],
};

window.WFP_BILLING_SERVICES = {
  summary: { mrr: 940, active: 5, paused: 1, clients: 4 },
  rows: [
    { id: 's1', name: 'Підтримка та супровід · base',  client: 'Brunky',       industry: 'food',      amount: 200, period: 'month', next: '01.06', status: 'active', assignees: ['illia', 'pavlo'], since: '01.02.2026' },
    { id: 's2', name: 'Backup-моніторинг · 1С + бот',  client: 'Brunky',       industry: 'food',      amount: 80,  period: 'month', next: '15.06', status: 'active', assignees: ['pavlo'],          since: '15.04.2026' },
    { id: 's3', name: 'API-моніторинг трекінгу',       client: 'NordStream',   industry: 'logistics', amount: 260, period: 'month', next: '05.06', status: 'active', assignees: ['illia'],          since: '10.03.2026' },
    { id: 's4', name: 'AI-саппорт · retainer',         client: 'Tably',        industry: 'saas',      amount: 320, period: 'month', next: '20.06', status: 'active', assignees: ['illia', 'oleh'],  since: '20.04.2026' },
    { id: 's5', name: 'SEO + контент · 10 год/міс',    client: 'EduForge',     industry: 'education', amount: 180, period: 'month', next: '12.06', status: 'active', assignees: ['anna'],           since: '01.05.2026' },
    { id: 's6', name: 'Хостинг + домени',              client: 'Brunky',       industry: 'food',      amount: 40,  period: 'month', next: '—',     status: 'paused', assignees: ['pavlo'],          since: '01.01.2026' },
  ],
};

window.WFP_NOTIFS = [
  { id: 'n1', kind: 'order',   actor: 'oleh',  unread: true,  ts: '5 хв',  title: 'Олег призначений на ORD-2415', sub: 'Webhook retry queue · Trasa' },
  { id: 'n2', kind: 'payment', client: 'Brunky', unread: true, ts: '40 хв', title: 'Оплата отримана · $4 200', sub: 'INV-2025-0418 · Brunky' },
  { id: 'n3', kind: 'mention', actor: 'illia', unread: true,  ts: '1 год', title: 'Ілля згадав вас у ORD-2412', sub: '«глянь версію 1С 8.3…»' },
  { id: 'n4', kind: 'deadline', unread: false, ts: '3 год', title: 'Дедлайн завтра · ORD-2409', sub: 'AI-агент саппорту v2 · EduForge' },
  { id: 'n5', kind: 'system',  unread: false, ts: '5 год', title: 'Курс НБУ оновлено', sub: '₴41.5 → ₴41.7 за $1' },
  { id: 'n6', kind: 'doc',     client: 'NordStream', unread: false, ts: 'вчора', title: 'Акт підписано · NordStream', sub: 'act-2025-0411.pdf' },
];

// toast samples for the shared Toast system demo
window.WFP_TOASTS = [
  { id: 't1', variant: 'success', title: 'Рахунок створено', sub: 'INV-2025-0419 · надіслано клієнту' },
  { id: 't2', variant: 'error',   title: 'Не вдалося зберегти', sub: 'Перевірте зʼєднання', action: 'Повторити' },
  { id: 't3', variant: 'warning', title: 'Картку повернуто', sub: 'inbox → done заборонено', action: 'Ок' },
  { id: 't4', variant: 'info',    title: 'Нове замовлення', sub: 'ORD-2416 у колонці «Вхідні»', action: 'Відкрити' },
  { id: 't5', variant: 'loading', title: 'Генеруємо PDF…', sub: 'Специфікація ORD-2412' },
];
