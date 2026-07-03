// workspace-content-data.js — data for G4 workspace screens:
// access VAULT (encrypted credentials per client) + CMS posts list.
// CMS reuses window.WF_BLOG (landing-pages.js) where loaded; this adds the
// owner-side editorial metadata (status / author / views) keyed by slug.

window.WFP_VAULT = {
  stats: { secrets: 38, companies: 6, shared: 11, expiring: 2 },
  // grouped by client company
  groups: [
    {
      company: 'Brunky', avatar: 'food', tier: 'partner', count: 9,
      items: [
        { id: 'v1', label: 'Сервер 1С · SSH',        kind: 'ssh',     user: 'deploy@1c.brunky.ua', mask: '••••••••••••', updated: '12.05', strength: 'strong', shared: ['Ілля', 'Олег'] },
        { id: 'v2', label: 'CRM admin',              kind: 'login',   user: 'admin',               mask: '••••••••',     updated: '03.05', strength: 'strong', shared: ['Ілля'] },
        { id: 'v3', label: 'Telegram Bot Token',     kind: 'token',   user: '@brunky_drivers_bot', mask: '7xx…:AA••••', updated: '18.05', strength: 'strong', shared: ['Ілля', 'Олег'] },
        { id: 'v4', label: 'SMTP · розсилки',        kind: 'api',     user: 'no-reply@brunky.ua',  mask: '••••••••••',   updated: '21.04', strength: 'medium', shared: ['Олег'], expiring: true },
        { id: 'v5', label: 'Хостинг · cPanel',       kind: 'login',   user: 'brunky_main',         mask: '••••••••••••', updated: '28.03', strength: 'weak',   shared: ['Ілля'] },
      ],
    },
    {
      company: 'NordStream Logistics', avatar: 'logistics', tier: 'silver', count: 7,
      items: [
        { id: 'v6', label: 'API · трекінг вантажів', kind: 'api',     user: 'wf_integration',      mask: 'sk_live_••••', updated: '09.05', strength: 'strong', shared: ['Ілля'] },
        { id: 'v7', label: 'Admin панель WMS',       kind: 'login',   user: 'workflo',             mask: '••••••••••',   updated: '15.04', strength: 'medium', shared: ['Ілля', 'Марія'], expiring: true },
        { id: 'v8', label: 'GitHub · deploy key',    kind: 'ssh',     user: 'nordstream-ci',       mask: 'ssh-ed25519',  updated: '02.05', strength: 'strong', shared: ['Ілля'] },
      ],
    },
    {
      company: 'Tably', avatar: 'saas', tier: 'regular', count: 5,
      items: [
        { id: 'v9',  label: 'Supabase · service key', kind: 'api',    user: 'service_role',        mask: 'eyJ••••••••',  updated: '20.05', strength: 'strong', shared: ['Ілля', 'Олег'] },
        { id: 'v10', label: 'Vercel · deploy',        kind: 'token',  user: 'tably-prod',          mask: '••••••••••',   updated: '11.05', strength: 'strong', shared: ['Ілля'] },
      ],
    },
  ],
  // access audit log (right rail)
  log: [
    { ts: '29.05 14:22', who: 'Ілля',  action: 'переглянув',  what: 'Brunky · Telegram Bot Token' },
    { ts: '29.05 11:04', who: 'Олег',  action: 'скопіював',   what: 'Brunky · CRM admin' },
    { ts: '28.05 18:47', who: 'Ілля',  action: 'оновив',      what: 'Tably · Supabase service key' },
    { ts: '28.05 09:15', who: 'Марія', action: 'переглянула', what: 'NordStream · Admin WMS' },
    { ts: '27.05 16:30', who: 'Ілля',  action: 'додав',       what: 'Tably · Vercel deploy' },
    { ts: '26.05 13:02', who: 'Олег',  action: 'поділився',   what: 'Brunky · Сервер 1С → Олег' },
  ],
};

// CMS editorial layer — owner-facing status for each landing post/case.
window.WFP_CMS = {
  posts: [
    { slug: 'excel-to-crm-without-pain',   title: 'Як вибратись з Excel у CRM і нічого не зламати', status: 'published', date: '18.05.2026', author: 'Ілля',  views: '1.2k', tags: ['process', 'automation'], reading: '8 хв' },
    { slug: 'telegram-bot-for-drivers',    title: 'Telegram-бот для водіїв: від ідеї до 200 заявок/день', status: 'published', date: '06.05.2026', author: 'Ілля',  views: '860', tags: ['telegram', 'automation'], reading: '6 хв' },
    { slug: 'ai-agent-first-line-support', title: 'AI-агент на першій лінії підтримки: що працює, а що ні', status: 'published', date: '24.04.2026', author: 'Олег', views: '2.1k', tags: ['ai-agents'], reading: '9 хв' },
    { slug: 'integrations-without-zapier', title: 'Інтеграції без Zapier: коли писати свій конектор', status: 'draft',     date: '—',          author: 'Ілля',  views: '—',   tags: ['integrations'], reading: '7 хв' },
    { slug: 'invoicing-that-gets-paid',    title: 'Рахунки, які оплачують вчасно: 6 прийомів', status: 'scheduled', date: '02.06.2026', author: 'Олег', views: '—',   tags: ['process'], reading: '5 хв' },
  ],
  cases: [
    { slug: 'brunky-crm-1c',     client: 'Brunky',              industry: 'food',      title: 'CRM + 1С за 3 тижні замість 3 місяців', result: '−40% ручної роботи', status: 'published', featured: true },
    { slug: 'nordstream-track',  client: 'NordStream Logistics', industry: 'logistics', title: 'Трекінг вантажів у реальному часі', result: '200+ авто на карті', status: 'published', featured: false },
    { slug: 'tably-ai-support',  client: 'Tably',                industry: 'saas',      title: 'AI-підтримка закрила 70% тікетів', result: '70% автозакриття', status: 'draft', featured: false },
  ],
};
