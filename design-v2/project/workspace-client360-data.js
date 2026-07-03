// workspace-client360-data.js — data for Client Card 360° (28-Б) + fin-projects (05)
// + legal entities (20-Д) + payment terms (05-Г) + compensation (12-А).
// Single owner-facing client used for the deep card: "Brunky".

(function () {
  const money = (n, cur) => {
    const sym = { USD: '$', EUR: '€', UAH: '₴' }[cur] || '$';
    if (cur === 'UAH') return n.toLocaleString('uk-UA') + ' ' + sym;
    return sym + n.toLocaleString('en-US');
  };

  // ─── Agency legal entities (20-Д) — used by project wizard + settings ───
  const LEGAL_ENTITIES = [
    { id: 'fop-vas',  name: 'ФОП Васюленко І.', kind: 'ФОП · 3 група', tax: 'ЄП 5%', country: 'UA', edrpou: '3214567890', iban: 'UA47 3052 9900 0002 6007 0123 4567', vat: false, addr: 'м. Київ, вул. Хрещатик 1', forCur: ['UAH', 'USD'], def: true },
    { id: 'tov-wf',   name: 'ТОВ «Воркфло»',    kind: 'ТОВ · загальна', tax: 'ПДВ 20%', country: 'UA', edrpou: '44217890', iban: 'UA21 3223 1300 0002 6007 2335 6001', vat: true, addr: 'м. Київ, вул. Січових Стрільців 21', forCur: ['UAH'], def: false },
    { id: 'eu-est',   name: 'Workflo OÜ',        kind: 'OÜ · Estonia',   tax: 'VAT EE', country: 'EE', edrpou: '16482931', iban: '', vat: true, addr: 'Tallinn, Sepapaja tn 6', forCur: ['EUR', 'USD'], def: false },
  ];
  // isComplete-гейт (20-Д): юр-особа готова до документів, лише якщо заповнені всі реквізити.
  const LEGAL_REQUIRED = [['name', 'Юр. назва'], ['edrpou', 'ЄДРПОУ / рег.№'], ['iban', 'IBAN'], ['addr', 'Адреса']];
  function legalMissing(e) { return LEGAL_REQUIRED.filter(([k]) => !e[k] || String(e[k]).trim() === '').map(([, label]) => label); }
  function legalComplete(e) { return legalMissing(e).length === 0; }

  // ─── Billing models (05-ПРОЕКТИ) ───
  const BILLING_MODELS = [
    { id: 'fixed_monthly_advance', label: 'Абонплата (аванс)', short: 'fixed · monthly', desc: 'Фіксована сума щомісяця наперед. Включені години — інформативно.', icon: 'receipt' },
    { id: 'hourly_prepaid',        label: 'Погодинно · передплата', short: 'hourly · prepaid', desc: 'Клієнт поповнює баланс годин наперед, списуємо за фактом.', icon: 'clock' },
    { id: 'hourly_postpaid',       label: 'Погодинно · постоплата', short: 'hourly · postpaid', desc: 'Рахунок наприкінці циклу за фактично відпрацьовані години.', icon: 'clock' },
  ];

  const BILLING_CYCLES = [
    { id: 'monthly_day', label: 'Кожного N-числа', hint: 'авто-рахунок + акт' },
    { id: 'weekly',      label: 'Щотижня', hint: 'авто-закриття зданих задач' },
    { id: 'manual',      label: 'Вручну', hint: 'рахунок створюється руками' },
  ];

  // ─── Payment terms (05-Г) ───
  const PAYMENT_TERMS = [
    { id: 'due_on_receipt', label: 'По факту (0 дн)', days: 0 },
    { id: 'net7',  label: 'Net 7',  days: 7 },
    { id: 'net14', label: 'Net 14', days: 14, def: true },
    { id: 'net30', label: 'Net 30', days: 30 },
  ];

  // ─── The deep client ───
  const CLIENT = {
    id: 'brunky', name: 'Brunky', legalName: 'ТОВ «Бранкі Фуд»',
    tier: 'partner', industry: 'Food delivery', site: 'brunky.com',
    since: '12.04.2025', currency: 'USD',
    tags: ['VIP', 'швидко реагує', 'food-tech'],
    segments: ['Активні 90д', 'LTV > $20k'],
    referredBy: { name: 'EduForge', kind: 'клієнт-реферал', bonus: '5% від доходу' },
    owner: 'Андрій Левченко',
    // Платіжні реквізити клієнта — на кого виставляємо рахунок (06-Б).
    // filledBy: хто заповнив — 'клієнт' (через портал) або 'агенція' (за клієнта).
    billing: {
      filledBy: 'клієнт', confirmed: true,
      legalName: 'ТОВ «Бранкі Фуд»', kind: 'ТОВ', taxId: '41255890', vat: false,
      address: 'м. Київ, вул. Велика Васильківська 100, 03150',
      bank: 'АТ КБ «ПриватБанк»', iban: 'UA90 3052 9900 0002 6005 0123 4567',
      docEmail: 'finance@brunky.com', signer: 'Ткач Анна Петрівна', signerRole: 'Директор',
    },
    kpis: { ltv: 28400, debt: 1800, margin: 62, activeProjects: 2, openOrders: 3, hoursMonth: 47, hoursIncluded: 60 },
    risks: [
      { id: 'overdue', tone: 'bad',  label: 'Рахунок прострочено', detail: 'INV-2025-0418 · 6 дн овердʼю · $1 800' },
      { id: 'cap',     tone: 'warn', label: 'Близько ліміту годин', detail: '47 / 60 год цього циклу' },
    ],
  };

  // People (28-А)
  const PEOPLE = [
    { id: 'p1', name: 'Анна Ткач',      email: 'anna@brunky.com',   role: 'owner',  status: 'active', last: 'сьогодні 09:12', twofa: true },
    { id: 'p2', name: 'Сергій Лозовий',  email: 'sergiy@brunky.com', role: 'member', status: 'active', last: 'вчора 18:40',   twofa: true },
    { id: 'p3', name: 'Ірина Гай',       email: 'iryna@brunky.com',  role: 'member', status: 'active', last: '4 дні тому',     twofa: false },
    { id: 'p4', name: 'Олег Дрозд',      email: 'oleg@brunky.com',   role: 'billing', status: 'invited', last: '—',            twofa: false },
  ];

  // Projects (05-ПРОЕКТИ)
  const PROJECTS = [
    {
      id: 'pr-ops', name: 'Підтримка та розвиток платформи', code: 'PRJ-118',
      model: 'fixed_monthly_advance', currency: 'USD', amount: 3200, cycle: 'monthly_day', cycleDay: 1,
      entity: 'fop-vas', contract: 'required', contractStatus: 'signed', status: 'active',
      hoursUsed: 47, hoursIncluded: 60, terms: 'net14',
      cost: 1180, margin: 63, paymentTerm: 'Net 14', next: '01.07.2026',
      desc: 'Місячний абонемент: підтримка, дрібні фічі, моніторинг.',
    },
    {
      id: 'pr-int', name: 'Інтеграція 1С ↔ Telegram-бот', code: 'PRJ-121',
      model: 'hourly_postpaid', currency: 'USD', rate: 45, cycle: 'monthly_day', cycleDay: 1,
      entity: 'eu-est', contract: 'required', contractStatus: 'draft', status: 'active',
      hoursUsed: 28, terms: 'net30',
      cost: 16, margin: 64, paymentTerm: 'Net 30', next: '01.07.2026',
      desc: 'Погодинна розробка інтеграції складського обліку.',
    },
    {
      id: 'pr-land', name: 'Лендинг + CMS', code: 'PRJ-104',
      model: 'hourly_prepaid', currency: 'USD', rate: 40, cycle: 'manual',
      entity: 'fop-vas', contract: 'optional', contractStatus: 'signed', status: 'closed',
      hoursUsed: 86, hoursPrepaid: 90, terms: 'due_on_receipt',
      cost: 14, margin: 65, paymentTerm: 'Передоплата', next: '—',
      desc: 'Завершений проєкт: маркетинговий сайт + headless CMS.',
    },
  ];

  // Finance (05-Г, 05-В, 22-Д)
  const FINANCE = {
    invoices: [
      { id: 'INV-2025-0418', project: 'pr-ops', date: '28.05.2026', due: '11.06.2026', amount: 3200, paid: 1400, status: 'overdue', overdueDays: 6, channel: ['email', 'telegram'] },
      { id: 'INV-2025-0402', project: 'pr-int', date: '01.05.2026', due: '31.05.2026', amount: 1260, paid: 1260, status: 'paid', channel: ['email'] },
      { id: 'INV-2025-0388', project: 'pr-ops', date: '01.05.2026', due: '15.05.2026', amount: 3200, paid: 3200, status: 'paid', channel: ['email', 'telegram'] },
    ],
    dunning: [
      { step: 1, when: 'через 1 день', tone: 'soft',  label: 'Мʼяке нагадування', sent: '12.06.2026', status: 'sent' },
      { step: 2, when: 'через 3 дні',  tone: 'soft',  label: 'Повторне нагадування', sent: '14.06.2026', status: 'sent' },
      { step: 3, when: 'через 7 днів', tone: 'firm',  label: 'Жорстке нагадування', sent: '—', status: 'scheduled' },
      { step: 4, when: 'через 14 днів', tone: 'final', label: 'Призупинення робіт', sent: '—', status: 'scheduled' },
    ],
  };

  // Documents (06) — два розділи: 'work' (для старту: договори/NDA) і
  // 'result' (результати/білінг: рахунки/акти/звірки).
  const DOCS = [
    { id: 'd1', kind: 'contract', docType: 'work',   name: 'Договір №118/2025', project: 'PRJ-118', date: '14.04.2025', status: 'signed', signedBy: 'Анна Ткач', delivery: { email: 'opened', telegram: 'delivered' }, format: 'UA' },
    { id: 'd5', kind: 'nda',      docType: 'work',   name: 'NDA (підписаний скан).pdf', project: '—', date: '20.04.2025', status: 'uploaded', delivery: {}, format: 'UA' },
    { id: 'd4', kind: 'contract', docType: 'work',   name: 'Service Agreement #121', project: 'PRJ-121', date: '—', status: 'draft', delivery: {}, format: 'EU' },
    { id: 'd2', kind: 'invoice',  docType: 'result', name: 'Рахунок INV-2025-0418', project: 'PRJ-118', date: '28.05.2026', status: 'overdue', delivery: { email: 'opened', telegram: 'delivered' }, format: 'UA' },
    { id: 'd3', kind: 'act',      docType: 'result', name: 'Акт виконаних робіт №57', project: 'PRJ-118', date: '01.06.2026', status: 'awaiting', delivery: { email: 'delivered', telegram: 'pending' }, format: 'UA' },
    { id: 'd6', kind: 'recon',    docType: 'result', name: 'Акт звірки за Q2 2026', project: '—', date: '10.06.2026', status: 'signed', delivery: { email: 'delivered' }, format: 'UA' },
  ];

  // Secrets (17) — ресурс + гнучкі типізовані поля. Не завжди є пароль:
  // токени/API-ключі окремі поля; набір полів різний на кожен ресурс.
  const FIELD_KINDS = {
    url:      { label: 'URL / ресурс', icon: 'globe', secret: false },
    login:    { label: 'Логін',        icon: 'users', secret: false },
    email:    { label: 'Email',        icon: 'mail',  secret: false },
    password: { label: 'Пароль',       icon: 'lock',  secret: true },
    api_key:  { label: 'API-ключ',     icon: 'key',   secret: true },
    token:    { label: 'Токен',        icon: 'key',   secret: true },
    secret_w: { label: 'Secret / webhook', icon: 'shield', secret: true },
    note:     { label: 'Нотатка',      icon: 'edit',  secret: false },
  };
  const RESOURCE_TYPES = {
    crm:     { label: 'CRM', icon: 'building' },
    server:  { label: 'Сервер', icon: 'shield' },
    hosting: { label: 'Хостинг', icon: 'globe' },
    api:     { label: 'API / сервіс', icon: 'key' },
    db:      { label: 'База даних', icon: 'building' },
    other:   { label: 'Інше', icon: 'lock' },
  };
  const SECRETS = [
    { id: 's1', resource: 'KeyCRM', type: 'crm', updated: '5 дн тому', addedBy: 'клієнт', fields: [
      { kind: 'url', value: 'brunky.keycrm.app' },
      { kind: 'login', value: 'anna@brunky.com' },
      { kind: 'password', value: 'Kc9$mPx2!vQ7' },
      { kind: 'api_key', value: 'kc_live_8f2a91c4e7' },
    ] },
    { id: 's2', resource: '1С сервер', type: 'server', updated: '14 дн тому', addedBy: 'клієнт', fields: [
      { kind: 'url', value: 'rdp://1c.brunky.local:3389' },
      { kind: 'login', value: 'wf_integrator' },
      { kind: 'password', value: 'Srv!7782xQ' },
    ] },
    { id: 's3', resource: 'Telegram Bot API', type: 'api', updated: '5 дн тому', addedBy: 'команда', fields: [
      { kind: 'token', value: '7782913:AAH-bot-token-xyz' },
      { kind: 'note', value: '@brunky_bot · вебхук на prod' },
    ] },
    { id: 's4', resource: 'Postgres prod (RO)', type: 'db', updated: '1 міс тому', addedBy: 'команда', fields: [
      { kind: 'url', value: 'db.brunky.io:5432/prod' },
      { kind: 'login', value: 'wf_ro' },
      { kind: 'password', value: 'Pg__ro__2026' },
    ] },
  ];
  // back-compat alias
  const SECRET_TYPES = RESOURCE_TYPES;
  const SECRET_LOG = [
    { who: 'Андрій Левченко', secret: 'KeyCRM · API-ключ', action: 'reveal', when: 'сьогодні 11:04', twofa: true },
    { who: 'Марія Слюсар',    secret: 'Telegram Bot API · токен', action: 'copy',   when: 'вчора 16:22',   twofa: true },
    { who: 'Андрій Левченко', secret: '1С сервер · пароль',  action: 'edit',   when: '3 дні тому',    twofa: true },
  ];

  // Activity (28-В)
  const ACTIVITY = [
    { kind: 'note',    txt: 'Клієнт просить пріоритет на інтеграцію 1С — дедлайн початок липня.', who: 'Андрій Левченко', when: 'сьогодні 10:30' },
    { kind: 'stage',   txt: 'Створено проєкт «Інтеграція 1С ↔ Telegram-бот» (PRJ-121)', who: 'система', when: 'вчора 14:02' },
    { kind: 'inbound', txt: 'Рахунок INV-2025-0418 прострочено — запущено dunning', who: 'система', when: '12.06.2026' },
    { kind: 'note',    txt: 'Дзвінок-синк: домовились про збільшення абонплати з липня.', who: 'Андрій Левченко', when: '08.06.2026' },
    { kind: 'inbound', txt: 'Оплата $3 200 за INV-2025-0388', who: 'система', when: '03.06.2026' },
  ];

  window.WF_C360 = {
    money, LEGAL_ENTITIES, legalComplete, legalMissing, BILLING_MODELS, BILLING_CYCLES, PAYMENT_TERMS,
    CLIENT, PEOPLE, PROJECTS, FINANCE, DOCS, SECRETS, SECRET_TYPES, RESOURCE_TYPES, FIELD_KINDS, SECRET_LOG, ACTIVITY,
  };
})();
