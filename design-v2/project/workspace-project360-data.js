// workspace-project360-data.js — Project Card 360° (05-ПРОЄКТИ deep).
// Project = the top of the hierarchy: billing model lives here, orders & tasks
// hang off it. Two kinds: 'client' (billed) and 'internal' (team-owned, no billing).
// Mirrors the depth of Client 360°, but sliced agency-side vs client-side.

(function () {
  // agency teams — internal projects are owned by a team, not a client
  const TEAMS = [
    { id: 't-dev',  name: 'Команда розробки', lead: 'Андрій Левченко', size: 4 },
    { id: 't-grow', name: 'Маркетинг / ріст',  lead: 'Марія Слюсар',    size: 3 },
    { id: 't-all',  name: 'Вся агенція',        lead: 'Ілля Васюленко',  size: 9 },
  ];

  // agency people pool (roleIcon from avatar-icons WFA_GLYPHS)
  const P = {
    andriy: { name: 'Андрій Левченко', role: 'Lead Developer', roleIcon: 'lead' },
    maria:  { name: 'Марія Слюсар',    role: 'Frontend',        roleIcon: 'developer' },
    igor:   { name: 'Ігор Бондар',     role: 'Backend',         roleIcon: 'developer' },
    illia:  { name: 'Ілля Васюленко',  role: 'Owner / PM',      roleIcon: 'pm' },
    olena:  { name: 'Олена Кравець',   role: 'QA',              roleIcon: 'qa' },
    taras:  { name: 'Тарас Мельник',   role: 'Designer',        roleIcon: 'designer' },
  };

  // ── PROJECTS — the deep cards ──────────────────────────────────────
  const PROJECTS = [
    // 1 · retainer (абонплата) — the richest example
    {
      id: 'pr-ops', code: 'PRJ-118', kind: 'client',
      name: 'Підтримка та розвиток платформи', client: 'Brunky', clientId: 'brunky',
      model: 'fixed_monthly_advance', currency: 'USD', amount: 3200,
      hoursUsed: 47, hoursIncluded: 60, overageRate: 50,
      cycle: 'monthly_day', cycleDay: 1, terms: 'net14', entity: 'fop-vas',
      status: 'active', since: '14.04.2025', next: '01.07.2026',
      margin: 63, cost: 1180,
      desc: 'Місячний абонемент: підтримка платформи, дрібні фічі, моніторинг, SLA на інциденти.',
      contract: { status: 'signed', name: 'Абонентський договір №118/2025', number: '118/2025', template: 'Абонентський договір (UA)', format: 'UA', signedBy: 'Анна Ткач', signedDate: '14.04.2025', renews: '14.04.2027' },
      team: [
        { ...P.andriy, alloc: 30, rate: 32, commission: 5, lead: true },
        { ...P.igor,   alloc: 45, rate: 27, commission: 3 },
        { ...P.olena,  alloc: 15, rate: 22, commission: 0 },
        { ...P.illia,  alloc: 10, rate: 0,  commission: 0, zeroCost: true },
      ],
      retainer: {
        includes: [
          { label: 'Підтримка та хотфікси', detail: 'до 2 год реакції в робочий час', serviceId: 'sv-support' },
          { label: 'Моніторинг аптайму 24/7', detail: 'алерти в Telegram', serviceId: 'sv-monitor' },
          { label: 'Оренда сервера (prod)', detail: 'VPS у сумі абонплати', serviceId: 'sv-server' },
          { label: 'Щомісячний звіт', detail: 'витрати годин + рекомендації', serviceId: 'sv-report' },
        ],
        recurring: [
          { title: 'Бекап + перевірка відновлення', cadence: 'weekly',  day: 'Пн 09:00', team: 't-dev', assignee: 'igor',   auto: true,  last: '16.06', next: '23.06' },
          { title: 'Звіт по аптайму та інцидентах', cadence: 'monthly', day: '1-е число',  team: 't-dev', assignee: 'andriy', auto: true,  last: '01.06', next: '01.07' },
          { title: 'Sync-дзвінок із клієнтом',      cadence: 'biweekly',day: 'Чт 15:00',  team: 't-all', assignee: '',       auto: false, last: '12.06', next: '26.06' },
          { title: 'Оновлення залежностей + аудит',  cadence: 'monthly', day: '15-е число', team: 't-dev', assignee: 'igor',   auto: true,  last: '15.06', next: '15.07' },
        ],
      },
      orders: [
        { num: 'ORD-2455', title: 'Дашборд аналітики замовлень', status: 'in_progress', total: 0,    hours: 14, billing: 'included' },
        { num: 'ORD-2461', title: 'Редизайн сторінки меню',      status: 'review',      total: 1400, hours: 9,  billing: 'separate' },
        { num: 'ORD-2470', title: 'Гарячий фікс: оплата Apple Pay', status: 'done',     total: 0,    hours: 3,  billing: 'included' },
      ],
      tasks: [
        { title: 'Розслідувати падіння черги вебхуків', status: 'in_progress', assignee: 'igor',   hours: 4, billing: 'included' },
        { title: 'Додати фільтр по статусу в адмінці',  status: 'todo',        assignee: 'maria',  hours: 6, billing: 'included' },
        { title: 'Інтеграція нового еквайра (окремо)',   status: 'todo',        assignee: 'andriy', hours: 20, billing: 'separate' },
        { title: 'Консультація по архітектурі (goodwill)', status: 'done',     assignee: 'illia',  hours: 2, billing: 'free' },
      ],
      docs: [
        { kind: 'contract', name: 'Абонентський договір №118/2025', date: '14.04.2025', status: 'signed', format: 'UA' },
        { kind: 'invoice',  name: 'Рахунок INV-2026-0418', date: '01.06.2026', status: 'overdue', format: 'UA' },
        { kind: 'act',      name: 'Акт виконаних робіт №57',  date: '01.06.2026', status: 'awaiting', format: 'UA' },
      ],
      invoices: [
        { id: 'INV-2026-0418', date: '01.06.2026', due: '15.06.2026', amount: 3200, paid: 1400, status: 'overdue', overdueDays: 4 },
        { id: 'INV-2026-0388', date: '01.05.2026', due: '15.05.2026', amount: 3200, paid: 3200, status: 'paid' },
        { id: 'INV-2026-0352', date: '01.04.2026', due: '15.04.2026', amount: 3200, paid: 3200, status: 'paid' },
      ],
    },

    // 2 · hourly postpaid
    {
      id: 'pr-int', code: 'PRJ-121', kind: 'client',
      name: 'Інтеграція 1С ↔ Telegram-бот', client: 'Brunky', clientId: 'brunky',
      model: 'hourly_postpaid', currency: 'USD', rate: 45,
      hoursUsed: 28, cycle: 'monthly_day', cycleDay: 1, terms: 'net30', entity: 'eu-est',
      status: 'active', since: '02.05.2026', next: '01.07.2026',
      margin: 64, cost: 16,
      desc: 'Погодинна розробка інтеграції складського обліку 1С зі сповіщеннями в Telegram.',
      contract: { status: 'draft', name: 'Service Agreement #121', number: '121', template: 'Service Agreement (EU)', format: 'EU', signedBy: null, signedDate: null },
      team: [
        { ...P.andriy, alloc: 60, rate: 32, commission: 5, lead: true },
        { ...P.maria,  alloc: 40, rate: 22, commission: 0 },
      ],
      retainer: null,
      orders: [
        { num: 'ORD-2412', title: 'Інтеграція 1С ↔ Telegram-бот', status: 'in_progress', total: 4200, hours: 28, billing: 'separate' },
      ],
      tasks: [
        { title: 'Мапінг номенклатури 1С → JSON', status: 'done',        assignee: 'andriy', hours: 10, billing: 'separate' },
        { title: 'Вебхук-міст + черга подій',      status: 'in_progress', assignee: 'andriy', hours: 12, billing: 'separate' },
        { title: 'UI-команди бота',                status: 'todo',        assignee: 'maria',  hours: 6,  billing: 'separate' },
      ],
      docs: [
        { kind: 'contract', name: 'Service Agreement #121 (чернетка)', date: '—', status: 'draft', format: 'EU' },
      ],
      invoices: [
        { id: 'INV-2026-0402', date: '01.06.2026', due: '01.07.2026', amount: 1260, paid: 0, status: 'awaiting' },
      ],
    },

    // 3 · hourly prepaid — paused
    {
      id: 'pr-lms', code: 'PRJ-109', kind: 'client',
      name: 'LMS платформа · абонемент', client: 'EduForge', clientId: 'eduforge',
      model: 'fixed_monthly_advance', currency: 'USD', amount: 2800,
      hoursUsed: 52, hoursIncluded: 55, overageRate: 45,
      cycle: 'monthly_day', cycleDay: 5, terms: 'net14', entity: 'fop-vas',
      status: 'active', since: '03.05.2025', next: '05.07.2026',
      margin: 58, cost: 1176,
      desc: 'Абонемент на підтримку та розвиток LMS: контент-модуль, оцінювання, інтеграції.',
      contract: { status: 'signed', name: 'Абонентський договір №109/2025', number: '109/2025', template: 'Абонентський договір (UA)', format: 'UA', signedBy: 'М. Ковач', signedDate: '03.05.2025', renews: '03.05.2027' },
      team: [
        { ...P.maria,  alloc: 50, rate: 22, commission: 0, lead: true },
        { ...P.taras,  alloc: 30, rate: 24, commission: 0 },
        { ...P.olena,  alloc: 20, rate: 22, commission: 0 },
      ],
      retainer: {
        includes: [
          { label: 'Підтримка LMS', detail: 'усунення багів, консультації', serviceId: 'sv-support' },
          { label: 'Контент-оновлення', detail: 'до 4 модулів/міс', serviceId: 'sv-content' },
          { label: 'Інтеграції', detail: 'Zoom, платіжки', serviceId: 'sv-deps' },
        ],
        recurring: [
          { title: 'Регрес-тест ключових сценаріїв', cadence: 'weekly',  day: 'Пт 11:00', assignee: 'olena', auto: true, last: '13.06', next: '20.06' },
          { title: 'Звіт по навантаженню', cadence: 'monthly', day: '5-е число', assignee: 'maria', auto: true, last: '05.06', next: '05.07' },
        ],
      },
      orders: [
        { num: 'ORD-2390', title: 'Модуль сертифікатів', status: 'in_progress', total: 0, hours: 18, billing: 'included' },
      ],
      tasks: [
        { title: 'Генерація PDF-сертифікатів', status: 'in_progress', assignee: 'taras', hours: 8, billing: 'included' },
        { title: 'Імпорт студентів з CSV',     status: 'todo',        assignee: 'maria', hours: 5, billing: 'included' },
      ],
      docs: [
        { kind: 'contract', name: 'Абонентський договір №109/2025', date: '03.05.2025', status: 'signed', format: 'UA' },
      ],
      invoices: [
        { id: 'INV-2026-0410', date: '05.06.2026', due: '19.06.2026', amount: 2800, paid: 2800, status: 'paid' },
      ],
    },

    // 4 · closed
    {
      id: 'pr-land', code: 'PRJ-104', kind: 'client',
      name: 'Лендинг + CMS', client: 'Florèal', clientId: 'floreal',
      model: 'hourly_prepaid', currency: 'USD', rate: 40,
      hoursUsed: 86, hoursPrepaid: 90, cycle: 'manual', terms: 'due_on_receipt', entity: 'fop-vas',
      status: 'closed', since: '28.05.2025', next: '—',
      margin: 65, cost: 14,
      desc: 'Завершений проєкт: маркетинговий сайт + headless CMS.',
      contract: { status: 'signed', name: 'Договір про надання послуг №104', number: '104/2025', template: 'Договір про надання послуг (UA)', format: 'UA', signedBy: 'К. Флор', signedDate: '28.05.2025' },
      team: [ { ...P.taras, alloc: 60, rate: 24, commission: 0, lead: true }, { ...P.maria, alloc: 40, rate: 22, commission: 0 } ],
      retainer: null,
      orders: [ { num: 'ORD-2350', title: 'Лендинг + CMS', status: 'done', total: 3400, hours: 86, billing: 'separate' } ],
      tasks: [],
      docs: [ { kind: 'contract', name: 'Договір №104/2025', date: '28.05.2025', status: 'signed', format: 'UA' } ],
      invoices: [ { id: 'INV-2025-0301', date: '28.05.2025', due: '28.05.2025', amount: 3400, paid: 3400, status: 'paid' } ],
    },

    // 5 · INTERNAL — training, owned by team, no billing/contract/client
    {
      id: 'pr-edu', code: 'INT-07', kind: 'internal',
      name: 'Внутрішнє навчання · React 19 + RSC', client: null, clientId: null,
      team_id: 't-dev', purpose: 'Навчання',
      model: null, currency: null, status: 'active', since: '01.06.2026', next: '—',
      desc: 'Серія воркшопів і парного програмування для прокачки команди розробки. Не білиться, рахується в capacity.',
      contract: null, retainer: null,
      hoursUsed: 22, hoursPlanned: 40,
      team: [
        { ...P.andriy, alloc: 20, lead: true },
        { ...P.igor,   alloc: 25 },
        { ...P.maria,  alloc: 25 },
      ],
      orders: [],
      tasks: [
        { title: 'Воркшоп: Server Components', status: 'done',        assignee: 'andriy', hours: 4, billing: 'internal' },
        { title: 'Міграція внутр. тулзи на RSC', status: 'in_progress', assignee: 'igor',  hours: 10, billing: 'internal' },
        { title: 'Конспект + чеклист у Базу знань', status: 'todo',    assignee: 'maria',  hours: 4, billing: 'internal' },
      ],
      recurringInternal: [
        { title: 'Щотижневий воркшоп', cadence: 'weekly', day: 'Ср 16:00', assignee: 'andriy', auto: true, last: '11.06', next: '18.06' },
      ],
      docs: [],
      invoices: [],
    },

    // 6 · INTERNAL — organizational
    {
      id: 'pr-org', code: 'INT-03', kind: 'internal',
      name: 'Операційка агенції · Q3', client: null, clientId: null,
      team_id: 't-all', purpose: 'Організаційне',
      model: null, currency: null, status: 'active', since: '01.06.2026', next: '—',
      desc: 'Внутрішні організаційні задачі: найм, процеси, інструменти, ретро. Окремий простір для не-клієнтської роботи.',
      contract: null, retainer: null,
      hoursUsed: 31, hoursPlanned: 80,
      team: [
        { ...P.illia, alloc: 40, lead: true },
        { ...P.andriy, alloc: 15 },
        { ...P.maria,  alloc: 15 },
        { ...P.olena,  alloc: 10 },
      ],
      orders: [],
      tasks: [
        { title: 'Найм Middle Backend',          status: 'in_progress', assignee: 'illia',  hours: 12, billing: 'internal' },
        { title: 'Оновити онбординг-доку',        status: 'todo',        assignee: 'maria',  hours: 6,  billing: 'internal' },
        { title: 'Налаштувати CI для всіх репо',  status: 'in_progress', assignee: 'andriy', hours: 8,  billing: 'internal' },
        { title: 'Квартальне ретро',              status: 'todo',        assignee: 'illia',  hours: 3,  billing: 'internal' },
      ],
      recurringInternal: [
        { title: 'Тижневий стендап команди', cadence: 'weekly',  day: 'Пн 10:00', assignee: 'illia', auto: true, last: '16.06', next: '23.06' },
        { title: 'Місячне 1:1 з кожним',     cadence: 'monthly', day: 'остання пт', assignee: 'illia', auto: false, last: '30.05', next: '27.06' },
      ],
      docs: [],
      invoices: [],
    },
  ];

  const CADENCE = {
    weekly:   { label: 'Щотижня',     short: 'тижд' },
    biweekly: { label: 'Раз на 2 тижні', short: '2 тижд' },
    monthly:  { label: 'Щомісяця',    short: 'міс' },
  };

  const BILLING_TONE = {
    included: { label: 'у абонплаті', tone: 'ok',     hint: 'zero-billed · входить в абонплату' },
    separate: { label: 'окремо',      tone: 'accent', hint: 'білиться поверх — окреме замовлення/рахунок' },
    free:     { label: 'безоплатно',  tone: 'muted',  hint: 'goodwill · не білиться' },
    internal: { label: 'внутрішнє',   tone: 'muted',  hint: 'внутрішня робота · не білиться' },
  };

  const STATUS_TONE = {
    todo:        { label: 'у черзі',  tone: 'muted' },
    in_progress: { label: 'в роботі', tone: 'warn' },
    review:      { label: 'рев’ю',    tone: 'accent' },
    done:        { label: 'готово',   tone: 'ok' },
  };

  function money(n, cur) {
    if (window.WF_C360 && window.WF_C360.money) return window.WF_C360.money(n, cur || 'USD');
    return '$' + (n || 0).toLocaleString('en-US');
  }
  function person(key) { return P[key] || { name: key, role: '', roleIcon: 'user' }; }

  window.WF_PROJ = { PROJECTS, TEAMS, P, CADENCE, BILLING_TONE, STATUS_TONE, money, person };
})();
