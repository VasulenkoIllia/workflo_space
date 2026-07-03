// product-data.js — placeholder data for Portal + Workspace + Documents
window.WFP_DATA = {

  // Active company (multi-company switcher demo)
  companies_owned: [
    { id: 'fop',     name: 'ФОП Іваненко О. М.', role: 'owner',  tier: 'partner',  active: true  },
    { id: 'romashka', name: 'ТОВ Ромашка',         role: 'owner',  tier: 'silver',   active: false },
    { id: 'brunky',   name: 'Brunky',              role: 'member', tier: 'partner',  active: false },
  ],

  // Loyalty tiers
  tiers: {
    new:     { label: 'new',     color: 'var(--wf-fg-muted)',   discount: '0%' },
    regular: { label: 'regular', color: 'var(--wf-fg)',         discount: '3%' },
    silver:  { label: 'silver',  color: 'var(--wf-fg-muted)',   discount: '5%' },
    partner: { label: 'partner', color: 'var(--wf-accent)',     discount: '8%' },
    vip:     { label: 'vip',     color: '#D97706',              discount: '12%' },
  },

  // Portal orders (client view — current company)
  orders: [
    {
      num: 'ORD-2412',
      title: 'Інтеграція 1С ↔ Telegram-бот для водіїв',
      status: 'pending_approval', // client must approve estimate
      sub_status: 'estimating',
      priority: 'high',
      total: 4200,
      paid: 0,
      currency: '$',
      deadline: '2026-06-08',
      created: '2026-05-22',
      assignees: ['illia', 'oleh'],
      comments_unread: 2,
      files: 4,
      docs: 1,
    },
    {
      num: 'ORD-2411',
      title: 'Парсер прайсів конкурентів',
      status: 'in_progress',
      priority: 'normal',
      total: 1800,
      paid: 900,
      currency: '$',
      deadline: '2026-06-02',
      created: '2026-05-18',
      assignees: ['illia'],
      comments_unread: 0,
      files: 7,
      docs: 2,
    },
    {
      num: 'ORD-2410',
      title: 'Налаштування CRM воронок під продажі',
      status: 'review',
      priority: 'normal',
      total: 650,
      paid: 0,
      currency: '$',
      deadline: '2026-05-28',
      created: '2026-05-14',
      assignees: ['illia'],
      comments_unread: 1,
      files: 3,
      docs: 1,
    },
    {
      num: 'ORD-2408',
      title: 'AI-агент саппорту першої лінії',
      status: 'done',
      priority: 'normal',
      total: 3400,
      paid: 3400,
      currency: '$',
      deadline: '2026-05-10',
      created: '2026-04-20',
      assignees: ['illia', 'oleh'],
      comments_unread: 0,
      files: 12,
      docs: 3,
    },
    {
      num: 'ORD-2407',
      title: 'Звіт по витратах з банкових виписок',
      status: 'done',
      priority: 'low',
      total: 1200,
      paid: 1200,
      currency: '$',
      deadline: '2026-04-30',
      created: '2026-04-15',
      assignees: ['illia'],
      comments_unread: 0,
      files: 5,
      docs: 2,
    },
  ],

  // IRC-style chat thread for one order
  chat: [
    { ts: '22.05 14:32', who: 'client',    name: 'Олена Іваненко', text: 'Привіт. Потрібна інтеграція 1С ↔ Telegram, щоб водії скидали накладні через бот.' },
    { ts: '22.05 14:34', who: 'system',    text: 'order created · status: new' },
    { ts: '22.05 14:45', who: 'illia',     name: 'Ілля',           text: 'Привіт. Скільки водіїв і яка версія 1С?' },
    { ts: '22.05 14:52', who: 'client',    name: 'Олена Іваненко', text: '54 водії, 1С 8.3 (БП). Зараз все летить у Viber у форматі "фото + ПІБ + сума". Хаос.' },
    { ts: '22.05 14:55', who: 'illia',     name: 'Ілля',           text: 'Ясно. Закину пропозицію сьогодні-завтра. Кілька питань у файлі — глянь.', attach: { name: 'brief-questions.pdf', size: '24 КБ' } },
    { ts: '22.05 17:18', who: 'client',    name: 'Олена Іваненко', text: 'Готово, у файлі є відповіді.', attach: { name: 'answers-2025-05-22.pdf', size: '88 КБ' } },
    { ts: '23.05 09:14', who: 'system',    text: 'status: clarification → estimating' },
    { ts: '23.05 10:02', who: 'illia',     name: 'Ілля',           text: 'Оцінка: $4 200, 6 тижнів. Розбивка: бот + 1С-конектор (40%), парсер накладних + AI-валідація (35%), адмінка + ролі (25%). Деталі — у документі.' },
    { ts: '23.05 10:03', who: 'system',    text: 'document generated: spec-ord-2412.pdf · awaiting approval' },
  ],

  // Invoices (Portal billing)
  invoices: [
    { num: 'INV-2025-0414', order: 'ORD-2411', amount: 1800, paid: 900,  status: 'partial', date: '2026-05-18', due: '2026-06-02' },
    { num: 'INV-2025-0411', order: 'ORD-2410', amount: 650,  paid: 0,    status: 'unpaid',  date: '2026-05-14', due: '2026-05-28' },
    { num: 'INV-2025-0392', order: 'ORD-2408', amount: 3400, paid: 3400, status: 'paid',    date: '2026-04-20', due: '2026-05-04' },
    { num: 'INV-2025-0388', order: 'ORD-2407', amount: 1200, paid: 1200, status: 'paid',    date: '2026-04-15', due: '2026-04-29' },
  ],

  // Workspace kanban — all active orders, multiple companies
  kanban: {
    columns: [
      { id: 'inbox',       title: 'Вхідні',     hint: 'new, clarification' },
      { id: 'estimating',  title: 'Оцінка',     hint: 'estimating' },
      { id: 'doing',       title: 'В роботі',   hint: 'in_progress, revision, on_hold' },
      { id: 'review',      title: 'На перевірці', hint: 'review' },
    ],
    cards: [
      { id: 'ORD-2412', col: 'estimating', priority: 'high',   client: 'Brunky',     title: 'Інтеграція 1С ↔ Telegram-бот',         assignees: ['illia', 'oleh'], deadline: '08.06', comments: 2, files: 4, days_in_col: 1 },
      { id: 'ORD-2415', col: 'inbox',      priority: 'high',   client: 'Trasa',      title: 'Webhook retry queue для логістики',     assignees: [],                deadline: '12.06', comments: 0, files: 1, days_in_col: 0 },
      { id: 'ORD-2414', col: 'inbox',      priority: 'normal', client: 'EduForge',   title: 'Парсер курсів конкурентів',             assignees: [],                deadline: '15.06', comments: 1, files: 2, days_in_col: 0 },
      { id: 'ORD-2411', col: 'doing',      priority: 'normal', client: 'Brunky',     title: 'Парсер прайсів',                        assignees: ['illia'],         deadline: '02.06', comments: 0, files: 7, days_in_col: 3 },
      { id: 'ORD-2413', col: 'doing',      priority: 'low',    client: 'NordStream', title: 'Notion → Telegram daily digest',        assignees: ['oleh'],          deadline: '20.06', comments: 0, files: 2, days_in_col: 2 },
      { id: 'ORD-2410', col: 'review',     priority: 'normal', client: 'Tably',      title: 'Налаштування CRM воронок',              assignees: ['illia'],         deadline: '28.05', comments: 1, files: 3, days_in_col: 1, overdue: true },
      { id: 'ORD-2409', col: 'doing',      priority: 'high',   client: 'EduForge',   title: 'AI-агент саппорту v2 — escalation logic', assignees: ['illia'],       deadline: '30.05', comments: 0, files: 5, days_in_col: 5 },
    ],
    done_count: 14,
  },

  // Workspace debtors
  debtors: [
    { company: 'Tably',     debt_usd: 650,  debt_uah: 26_870, oldest_inv: 'INV-2025-0411', age_days: 13, overdue_count: 1, status: 'warning'  },
    { company: 'NordStream', debt_usd: 2200, debt_uah: 90_980, oldest_inv: 'INV-2025-0398', age_days: 34, overdue_count: 2, status: 'overdue'  },
    { company: 'EduForge',  debt_usd: 480,  debt_uah: 19_840, oldest_inv: 'INV-2025-0416', age_days: 4,  overdue_count: 1, status: 'fresh'    },
    { company: 'Brunky',    debt_usd: 900,  debt_uah: 37_210, oldest_inv: 'INV-2025-0414', age_days: 9,  overdue_count: 1, status: 'warning'  },
  ],

  // Workspace companies
  companies: [
    { slug: 'brunky',     name: 'Brunky',     industry: 'retail · логістика',  tier: 'partner', orders: 8, revenue_usd: 24_400, active: 2, debt: 900 },
    { slug: 'eduforge',   name: 'EduForge',   industry: 'edtech',              tier: 'silver',  orders: 5, revenue_usd: 12_100, active: 1, debt: 480 },
    { slug: 'trasa',      name: 'Trasa',      industry: 'logistics',           tier: 'partner', orders: 6, revenue_usd: 18_900, active: 1, debt: 0   },
    { slug: 'nordstream', name: 'NordStream', industry: 'b2b saas',            tier: 'silver',  orders: 4, revenue_usd: 9_400,  active: 1, debt: 2200 },
    { slug: 'tably',      name: 'Tably',      industry: 'hr-tech',             tier: 'regular', orders: 3, revenue_usd: 4_300,  active: 1, debt: 650 },
  ],

  // Team executors (Workspace)
  team: [
    { id: 'illia', name: 'Ілля Васюленко', role: 'owner',    rate: 35, active_tasks: 5, hours_week: 38, earnings_month: 4200 },
    { id: 'oleh',  name: 'Олег Шевченко',  role: 'executor', rate: 22, active_tasks: 3, hours_week: 28, earnings_month: 1850 },
    { id: 'maria', name: 'Марія Бойко',    role: 'executor', rate: 18, active_tasks: 2, hours_week: 16, earnings_month: 720 },
  ],

  // Workspace order detail — time log
  timelog: [
    { date: '24.05', who: 'illia', hours: 2.5,  desc: 'Розбір API 1С 8.3 · знайшов гарний REST-шар через ВЕБ-сервіси' },
    { date: '24.05', who: 'illia', hours: 1.0,  desc: 'Скетч архітектури — бот, queue, валідатор' },
    { date: '23.05', who: 'oleh',  hours: 3.0,  desc: 'Пілотний бот на python-telegram-bot · базовий flow' },
    { date: '23.05', who: 'illia', hours: 0.5,  desc: 'Daily standup + sync з клієнтом' },
    { date: '22.05', who: 'illia', hours: 1.5,  desc: 'Discovery call · 54 водії, 1С 8.3 БП' },
  ],

  // Activity log (Workspace order detail)
  activity: [
    { ts: '24.05 17:42', actor: 'illia', what: 'status: estimating → in_progress' },
    { ts: '24.05 17:40', actor: 'client', what: 'approved estimate $4 200' },
    { ts: '24.05 11:08', actor: 'illia', what: 'invoice INV-2025-0418 generated · sent' },
    { ts: '23.05 10:03', actor: 'system', what: 'document created · spec-ord-2412.pdf' },
    { ts: '23.05 10:02', actor: 'illia', what: 'estimate set · $4 200' },
    { ts: '23.05 09:14', actor: 'illia', what: 'status: clarification → estimating' },
    { ts: '22.05 14:32', actor: 'client', what: 'order created' },
  ],

  // Invoice for PDF preview
  invoice_full: {
    num: 'INV-2025-0418',
    date: '24.05.2026',
    due:  '07.06.2026',
    order: 'ORD-2412',
    project: 'Інтеграція 1С ↔ Telegram-бот для водіїв',
    from: {
      name: 'ФОП Васюленко Ілля Сергійович',
      tin:  '3456789012',
      addr: 'вул. Лесі Українки, 14/3, м. Луцьк, 43000',
      iban: 'UA21 3052 9900 0002 6005 0123 45678',
      bank: 'JSC CB "PrivatBank"',
      email: 'illia@workflo.space',
    },
    to: {
      name: 'ТОВ Брунки',
      tin:  '42345678',
      addr: 'просп. Степана Бандери, 22, м. Київ, 04073',
      contact: 'Олена Іваненко · olena@brunky.ua',
    },
    items: [
      { n: 1, desc: 'Аналіз вимог · discovery · архітектурна нотатка',                 qty: 1, unit: 'роб.', price: 420,  sum: 420  },
      { n: 2, desc: 'Розробка Telegram-бота для водіїв (54 user-flow + admin panel)',  qty: 1, unit: 'роб.', price: 1680, sum: 1680 },
      { n: 3, desc: 'Інтеграція 1С 8.3 ↔ middleware (REST → queue → 1С документ)',     qty: 1, unit: 'роб.', price: 1260, sum: 1260 },
      { n: 4, desc: 'AI-валідація накладних · vision + structured output',             qty: 1, unit: 'роб.', price: 540,  sum: 540  },
      { n: 5, desc: 'Тестування, документація, передача',                              qty: 1, unit: 'роб.', price: 300,  sum: 300  },
    ],
    subtotal: 4200,
    discount: 0,
    total: 4200,
    currency: '$',
    uah_total: 173_400,
    rate_note: 'НБУ 24.05.2026: 1 $ = 41.2857 ₴',
    note: 'Призначення платежу: оплата по інвойсу INV-2025-0418 / ORD-2412',
  },

  // ─── Completion Act (акт виконаних робіт) ───
  act_full: {
    num: 'ACT-2025-0392',
    date: '24.05.2026',
    order: 'ORD-2412',
    project: 'Інтеграція 1С ↔ Telegram-бот для водіїв',
    invoice_ref: 'INV-2025-0418 від 24.05.2026',
    period_from: '22.04.2026',
    period_to:   '24.05.2026',
    items: [
      { n: 1, desc: 'Аналіз вимог · discovery · архітектурна нотатка',                 qty: 1, unit: 'роб.', price: 420,  sum: 420  },
      { n: 2, desc: 'Розробка Telegram-бота для водіїв (54 user-flow + admin panel)',  qty: 1, unit: 'роб.', price: 1680, sum: 1680 },
      { n: 3, desc: 'Інтеграція 1С 8.3 ↔ middleware (REST → queue → 1С документ)',     qty: 1, unit: 'роб.', price: 1260, sum: 1260 },
      { n: 4, desc: 'AI-валідація накладних · vision + structured output',             qty: 1, unit: 'роб.', price: 540,  sum: 540  },
      { n: 5, desc: 'Тестування, документація, передача',                              qty: 1, unit: 'роб.', price: 300,  sum: 300  },
    ],
    total: 4200,
    uah_total: 173_400,
    acceptance_text:
      'Сторони підтверджують: роботи, перелічені вище, виконані повністю та у належній якості. Замовник претензій до якості, обсягу, строків виконання робіт не має. Виконавець передав, а Замовник прийняв результати робіт у повному обсязі.',
  },

  // ─── Reconciliation Act (акт звірки) ───
  reconciliation_full: {
    num: 'REC-2025-0014',
    date: '24.05.2026',
    period_from: '01.01.2026',
    period_to:   '24.05.2026',
    opening_balance: 0,
    rows: [
      { date: '15.01.2026', doc: 'INV-2025-0388', desc: 'Рахунок · ORD-2407 · Звіт по витратах',           debit: 1200, credit: 0,    },
      { date: '29.01.2026', doc: 'PAY-2026-0021', desc: 'Оплата SWIFT · ORD-2407',                          debit: 0,    credit: 1200, },
      { date: '20.02.2026', doc: 'INV-2025-0392', desc: 'Рахунок · ORD-2408 · AI-агент саппорту',           debit: 3400, credit: 0,    },
      { date: '04.03.2026', doc: 'PAY-2026-0038', desc: 'Оплата USDT TRC20 · ORD-2408',                     debit: 0,    credit: 3400, },
      { date: '14.05.2026', doc: 'INV-2025-0411', desc: 'Рахунок · ORD-2410 · CRM-воронки',                 debit: 650,  credit: 0,    },
      { date: '18.05.2026', doc: 'INV-2025-0414', desc: 'Рахунок · ORD-2411 · Парсер прайсів',              debit: 1800, credit: 0,    },
      { date: '20.05.2026', doc: 'PAY-2026-0117', desc: 'Часткова оплата · INV-2025-0414 (50%)',            debit: 0,    credit: 900,  },
      { date: '24.05.2026', doc: 'INV-2025-0418', desc: 'Рахунок · ORD-2412 · Telegram-бот + 1С',           debit: 4200, credit: 0,    },
    ],
    closing_balance_label: 'Заборгованість Замовника на користь Виконавця',
  },

  // ─── Specification (специфікація проєкту) ───
  spec_full: {
    num: 'SPC-2025-0418',
    date: '23.05.2026',
    order: 'ORD-2412',
    project: 'Інтеграція 1С ↔ Telegram-бот для водіїв',
    summary:
      'Створення Telegram-бота для 54 водіїв-кур\'єрів компанії Brunky, який автоматизує приймання накладних з рейсів. Бот валідує фото-документи через AI vision, формує структуровані дані та автоматично створює документи "Надходження товарів" у 1С 8.3 БП. Поточний процес (хаотичні фото у Viber) замінюється на детермінований конвеєр з адмін-панеллю.',
    goals: [
      'Зменшити час обробки накладної з 8 хв (ручний ввід) до < 30 сек (бот + AI).',
      'Усунути ризики помилок ручного вводу — AI валідатор + людська перевірка на спірних кейсах.',
      'Дати disp/бухгалтерії real-time видимість стану рейсів через адмін-панель.',
      'Підготувати ґрунт для повного переходу з Viber на бот як єдиний канал документообігу.',
    ],
    scope: [
      { l: 'Telegram-бот · user side', i: ['flow реєстрації водія за номером телефону', 'submit накладної (фото + ПІБ + сума)', 'статус останніх 5 здач', 'нагадування про незакриті рейси'] },
      { l: 'AI-валідатор',              i: ['OCR фото накладної (vision)', 'structured output: дата, сума, № документа, ПІБ', 'confidence-score; <0.85 → manual review', 'логування всіх рішень моделі'] },
      { l: '1С-конектор',               i: ['middleware REST → queue → 1С BSP', 'створення документа "Надходження товарів"', 'idempotency keys, retry-логіка', 'health-check ендпоінт'] },
      { l: 'Адмін-панель',              i: ['таблиця всіх submission', 'фільтри: водій / статус / дата', 'manual review queue', 'ролі: dispatcher, accountant, admin'] },
    ],
    deliverables: [
      { n: 1, name: 'Telegram bot · backend',          format: 'python-telegram-bot v21, PostgreSQL', notes: 'docker-image + helm-chart' },
      { n: 2, name: 'AI vision middleware',            format: 'FastAPI + Gemini 2.5 Flash',          notes: 'API-ключ Замовника' },
      { n: 3, name: '1С-конектор + БСП-розширення',    format: 'EPF + Web-сервіс',                    notes: 'передається разом з документацією встановлення' },
      { n: 4, name: 'Адмін-панель (web)',              format: 'React 18 + Vite + Tailwind',          notes: 'SSO через Telegram OAuth' },
      { n: 5, name: 'Документація + 2-годинне навчання', format: 'Markdown у Notion + Zoom-запис',    notes: '' },
    ],
    milestones: [
      { week: '1–2', name: 'Discovery + сетап інфраструктури',    deliverables: 'Архітектура, dev/stage env, базовий bot skeleton' },
      { week: '3–4', name: 'AI + 1С інтеграція',                  deliverables: 'AI middleware + 1С-конектор, e2e-тест на 5 кейсах' },
      { week: '5',   name: 'Адмін-панель + manual review',        deliverables: 'Адмін-панель, ролі, manual review queue' },
      { week: '6',   name: 'UAT + продакшен-реліз + навчання',    deliverables: 'Прод-деплой, навчання команди, гарантійне обслуговування 30 днів' },
    ],
    acceptance: [
      'Бот успішно проходить тестування на 50 синтетичних накладних з accuracy ≥ 95%.',
      'Документ у 1С створюється протягом < 60 сек після submit в бот (p95).',
      'Адмін-панель доступна 24/7 на стейджингу 7 днів без падінь.',
      'Документація передана; команда Brunky самостійно виконує 5 e2e-сценаріїв.',
    ],
    out_of_scope: [
      'Інтеграція з іншими CRM/ERP крім 1С 8.3 БП.',
      'Звітність та аналітика (тільки сирі дані експортом).',
      'Мобільний застосунок (тільки Telegram-бот).',
      'Маркетинговий запуск серед водіїв (це робить команда Замовника).',
    ],
    price: { fixed: 4200, hourly_overage: 35, currency: '$' },
    duration_weeks: 6,
    payment_terms: '50% передоплати після підписання, 50% — після прийняття результату.',
  },

  // ─── Contract (договір) ───
  contract_full: {
    num: 'CTR-2025-0004',
    date: '22.04.2025',
    place: 'м. Луцьк',
    project: 'Розробка програмного забезпечення',
    parties: {
      executor: {
        title: 'Виконавець',
        name: 'Фізична особа-підприємець Васюленко Ілля Сергійович',
        short: 'ФОП Васюленко І. С.',
        basis: 'що діє на підставі виписки з ЄДР',
        tin:  '3456789012',
        addr: 'вул. Лесі Українки, 14/3, м. Луцьк, 43000',
        iban: 'UA21 3052 9900 0002 6005 0123 45678',
        bank: 'JSC CB "PrivatBank"',
        email: 'illia@workflo.space',
      },
      client: {
        title: 'Замовник',
        name:  'Товариство з обмеженою відповідальністю «Брунки»',
        short: 'ТОВ «Брунки»',
        basis: 'в особі директора Іваненко Олени Петрівни, що діє на підставі Статуту',
        tin:   '42345678',
        addr:  'просп. Степана Бандери, 22, м. Київ, 04073',
        email: 'olena@brunky.ua',
      },
    },
    sections: [
      {
        h: '1. ПРЕДМЕТ ДОГОВОРУ',
        p: [
          '1.1. Виконавець зобов\'язується на власний ризик виконати, а Замовник — прийняти та оплатити роботи з розробки програмного забезпечення (далі — "ПЗ" / "Роботи") відповідно до Технічного завдання (Специфікації), що оформлюється окремими додатками і є невід\'ємною частиною цього Договору.',
          '1.2. Перелік, обсяг, строки та вартість Робіт за кожним замовленням визначаються у Специфікації, яка погоджується Сторонами в електронному вигляді через систему workflo.space.',
        ],
      },
      {
        h: '2. ВАРТІСТЬ ТА ПОРЯДОК ОПЛАТИ',
        p: [
          '2.1. Загальна вартість Робіт визначається у Специфікації до кожного замовлення.',
          '2.2. Оплата здійснюється в безготівковій формі на банківський рахунок Виконавця у гривнях за курсом НБУ на день виставлення рахунку, або у USDT (TRC20) — за погодженням Сторін.',
          '2.3. Стандартні умови оплати: 50% передоплати після підписання Специфікації, 50% — протягом 7 (семи) календарних днів з дати підписання Акту виконаних робіт.',
          '2.4. У разі затримки оплати понад 14 (чотирнадцять) календарних днів Виконавець має право зупинити виконання Робіт до повного погашення заборгованості.',
        ],
      },
      {
        h: '3. ПРАВА ТА ОБОВ\'ЯЗКИ СТОРІН',
        p: [
          '3.1. Виконавець зобов\'язується: виконати Роботи відповідно до Специфікації; повідомляти Замовника про прогрес не рідше одного разу на тиждень через систему workflo.space; передати результат у форматі, узгодженому в Специфікації.',
          '3.2. Замовник зобов\'язується: своєчасно надавати інформацію та матеріали, необхідні для виконання Робіт; здійснювати оплату згідно з умовами п. 2; приймати результати Робіт у строки, передбачені Специфікацією.',
          '3.3. Сторони визнають, що електронне листування через систему workflo.space, телеграм-канал та електронну пошту має силу письмового документа.',
        ],
      },
      {
        h: '4. ПРИЙМАННЯ-ПЕРЕДАЧА РОБІТ',
        p: [
          '4.1. Передача результату Робіт оформлюється Актом виконаних робіт, який Виконавець надсилає Замовнику в електронному вигляді через систему workflo.space.',
          '4.2. Замовник зобов\'язаний підписати Акт або надати мотивовану відмову протягом 5 (п\'яти) робочих днів. Якщо відмова не надана у вказаний строк, Акт вважається підписаним, а Роботи — прийнятими.',
        ],
      },
      {
        h: '5. ВЛАСНІСТЬ ТА АВТОРСЬКІ ПРАВА',
        p: [
          '5.1. Майнові права на результати Робіт переходять до Замовника з моменту повної оплати відповідного замовлення.',
          '5.2. Виконавець залишає за собою право використовувати знеособлені фрагменти ПЗ (бібліотеки, утиліти, патерни) у власних проєктах за умови, що це не порушує конфіденційність Замовника.',
        ],
      },
      {
        h: '6. КОНФІДЕНЦІЙНІСТЬ',
        p: [
          '6.1. Сторони зобов\'язуються зберігати в таємниці будь-яку інформацію комерційного, технічного або фінансового характеру, що стала відома у зв\'язку з виконанням цього Договору.',
          '6.2. Зобов\'язання щодо конфіденційності діють протягом 3 (трьох) років після припинення дії Договору.',
        ],
      },
      {
        h: '7. ВІДПОВІДАЛЬНІСТЬ',
        p: [
          '7.1. За порушення зобов\'язань Сторони несуть відповідальність відповідно до чинного законодавства України.',
          '7.2. Загальна відповідальність Виконавця обмежується сумою, отриманою за відповідним замовленням.',
        ],
      },
      {
        h: '8. ФОРС-МАЖОР',
        p: [
          '8.1. Сторони звільняються від відповідальності за невиконання зобов\'язань, якщо доведуть, що воно сталося внаслідок дії обставин непереборної сили (війна, надзвичайний стан, природні катаклізми, рішення державних органів).',
        ],
      },
      {
        h: '9. СТРОК ДІЇ ТА ПРИКІНЦЕВІ ПОЛОЖЕННЯ',
        p: [
          '9.1. Договір набуває чинності з моменту підписання Сторонами та діє до 31 грудня року, наступного за роком підписання, з можливістю автоматичного продовження на один календарний рік.',
          '9.2. Будь-які зміни та доповнення до цього Договору оформлюються додатковими угодами в письмовій або електронній формі.',
          '9.3. Цей Договір укладено у двох примірниках (по одному для кожної Сторони), що мають однакову юридичну силу.',
        ],
      },
    ],
  },

  // ─── Documents list (for /documents page) ───
  documents_list: [
    { num: 'INV-2025-0418', type: 'invoice',         order: 'ORD-2412', date: '24.05.2026', amount: 4200, status: 'sent',   sender: 'illia',  size: '124 КБ', delivery: 'opened',    channel: 'email' },
    { num: 'SPC-2025-0418', type: 'specification',   order: 'ORD-2412', date: '23.05.2026', amount: null, status: 'signed', sender: 'illia',  size: '198 КБ', delivery: 'opened',    channel: 'email' },
    { num: 'INV-2025-0414', type: 'invoice',         order: 'ORD-2411', date: '18.05.2026', amount: 1800, status: 'sent',   sender: 'illia',  size: '118 КБ', delivery: 'delivered', channel: 'telegram' },
    { num: 'INV-2025-0411', type: 'invoice',         order: 'ORD-2410', date: '14.05.2026', amount: 650,  status: 'sent',   sender: 'illia',  size: '116 КБ', delivery: 'error',     channel: 'email' },
    { num: 'ACT-2025-0398', type: 'completion_act',  order: 'ORD-2408', date: '04.05.2026', amount: 3400, status: 'signed', sender: 'illia',  size: '142 КБ', delivery: 'opened',    channel: 'email' },
    { num: 'INV-2025-0392', type: 'invoice',         order: 'ORD-2408', date: '20.04.2026', amount: 3400, status: 'superseded', supersededBy: 'INV-2025-0398', sender: 'illia', size: '120 КБ', delivery: 'sent', channel: 'email' },
    { num: 'CTR-2025-0004', type: 'contract',        order: '—',        date: '22.04.2025', amount: null, status: 'signed', sender: 'illia',  size: '264 КБ', delivery: 'opened',    channel: 'email' },
    { num: 'ACT-2025-0388', type: 'completion_act',  order: 'ORD-2407', date: '01.05.2026', amount: 1200, status: 'signed', sender: 'illia',  size: '138 КБ', delivery: 'delivered', channel: 'telegram' },
    { num: 'INV-2025-0388', type: 'invoice',         order: 'ORD-2407', date: '15.04.2026', amount: 1200, status: 'sent',   sender: 'illia',  size: '116 КБ', delivery: 'opened',    channel: 'email' },
    { num: 'REC-2025-0014', type: 'reconciliation_act', order: '—',     date: '24.05.2026', amount: null, status: 'draft',  sender: 'illia',  size: '102 КБ', delivery: null,        channel: null },
  ],

  doc_types: {
    invoice:            { code: 'INV', label: 'Рахунок',                color: '#0C0A09' },
    completion_act:     { code: 'ACT', label: 'Акт виконаних робіт',    color: '#16A34A' },
    reconciliation_act: { code: 'REC', label: 'Акт звірки',             color: '#D97706' },
    specification:      { code: 'SPC', label: 'Специфікація',           color: '#A3D90D' },
    contract:           { code: 'CTR', label: 'Договір',                color: '#0891B2' },
  },

  // Files attached to ORD-2412
  order_files: [
    { ext: 'PDF', name: 'brief-questions.pdf',       size: '24 КБ',  by: 'illia',  date: '22.05 14:55', isOwn: false, preview: true  },
    { ext: 'PDF', name: 'answers-2025-05-22.pdf',    size: '88 КБ',  by: 'illia',  date: '22.05 17:18', isOwn: true,  preview: true  },
    { ext: 'XLS', name: 'drivers-list-v2.xlsx',      size: '36 КБ',  by: 'illia',  date: '23.05 11:04', isOwn: true,  preview: false },
    { ext: 'PNG', name: '1c-schema-sketch.png',      size: '184 КБ', by: 'illia',  date: '24.05 10:32', isOwn: false, preview: true  },
  ],

  // Documents linked to ORD-2412
  order_docs: [
    { type: 'specification', num: 'SPC-2025-0418', date: '23.05.2026', amount: null, status: 'signed' },
    { type: 'invoice',       num: 'INV-2025-0418', date: '24.05.2026', amount: 4200, status: 'sent'   },
  ],

  // ─── Portal /billing → Payments tab (incoming payments by client) ───
  payments: [
    { date: '20.05.2026', amount: 900,  type: 'partial',   method: 'IBAN · UAH', invoice: 'INV-2025-0414', order: 'ORD-2411', rate: 41.21, uah: 37_089 },
    { date: '04.05.2026', amount: 3400, type: 'full',      method: 'USDT · TRC20', invoice: 'INV-2025-0392', order: 'ORD-2408', rate: null,  uah: null },
    { date: '29.04.2026', amount: 1200, type: 'full',      method: 'IBAN · UAH', invoice: 'INV-2025-0388', order: 'ORD-2407', rate: 40.98, uah: 49_176 },
    { date: '12.04.2026', amount: 180,  type: 'bonus',     method: 'loyalty',    invoice: '—',             order: '—',         rate: null,  uah: null },
    { date: '03.04.2026', amount: 200,  type: 'referral',  method: 'referral',   invoice: '—',             order: '—',         rate: null,  uah: null },
  ],

  // ─── Portal /billing → Recurring tab ───
  recurring: [
    { name: 'Підтримка та супровід · base',  amount: 200, period: 'month',  next: '01.06.2026', status: 'active',  started: '01.02.2026', invoiced: 4 },
    { name: 'Backup-моніторинг · 1С + бот',  amount: 80,  period: 'month',  next: '15.06.2026', status: 'active',  started: '15.04.2026', invoiced: 2 },
    { name: 'AI-токени · gemini-flash',      amount: 35,  period: 'month',  next: '01.06.2026', status: 'paused',  started: '01.03.2026', invoiced: 2 },
  ],

  // ─── Portal Inbox (cross-order messages for client) ───
  portal_inbox: [
    {
      id: 'pi1',
      kind: 'mention',
      source: 'ORD-2411',
      source_title: 'Парсер прайсів конкурентів',
      company: 'ТОВ Брунки',
      actor: 'illia',
      actor_name: 'Ілля',
      preview: '@olena дивись, можемо запустити пілот вже завтра. Як зручніше — ранок чи вечір?',
      ts: '24.05 11:18',
      unread: true,
      mentioned: true,
    },
    {
      id: 'pi2',
      kind: 'doc',
      source: 'ORD-2412',
      source_title: 'Інтеграція 1С ↔ Telegram-бот',
      company: 'ТОВ Брунки',
      actor: 'system',
      preview: 'Згенеровано документ: spec-ord-2412.pdf. Перегляньте та підтвердіть оцінку $4 200.',
      ts: '23.05 10:03',
      unread: true,
      mentioned: false,
    },
    {
      id: 'pi3',
      kind: 'status',
      source: 'ORD-2412',
      source_title: 'Інтеграція 1С ↔ Telegram-бот',
      company: 'ТОВ Брунки',
      actor: 'system',
      preview: 'Статус замовлення: clarification → estimating. Чекаємо вашого підтвердження оцінки.',
      ts: '23.05 09:14',
      unread: true,
      mentioned: false,
    },
    {
      id: 'pi4',
      kind: 'chat',
      source: 'ORD-2412',
      source_title: 'Інтеграція 1С ↔ Telegram-бот',
      company: 'ТОВ Брунки',
      actor: 'illia',
      actor_name: 'Ілля',
      preview: 'Ясно. Закину пропозицію сьогодні-завтра. Кілька питань у файлі — глянь.',
      ts: '22.05 14:55',
      unread: true,
      mentioned: false,
    },
    {
      id: 'pi5',
      kind: 'payment',
      source: 'INV-2025-0411',
      source_title: 'Рахунок INV-2025-0411 · ORD-2410',
      company: 'ТОВ Брунки',
      actor: 'system',
      preview: 'Нагадування: рахунок $650 не оплачено вже 13 днів. Дедлайн оплати — 28.05.2026.',
      ts: '24.05 09:00',
      unread: true,
      mentioned: false,
    },
    {
      id: 'pi6',
      kind: 'marketing',
      source: 'system',
      source_title: 'Новина продукту',
      actor: 'workflo',
      preview: 'Новий редактор замовлень: створюйте задачі швидше з шаблонами. Спробуйте при наступному замовленні.',
      ts: '23.05 12:00',
      unread: false,
      mentioned: false,
    },
    {
      id: 'pi7',
      kind: 'doc',
      source: 'ACT-2025-0398',
      source_title: 'Акт виконаних робіт · ORD-2408',
      company: 'ТОВ Брунки',
      actor: 'illia',
      actor_name: 'Ілля',
      preview: 'Підготували акт виконаних робіт. Підпис очікується від вас протягом 5 днів.',
      ts: '04.05 16:42',
      unread: false,
      mentioned: false,
    },
    {
      id: 'pi8',
      kind: 'system',
      source: 'system',
      source_title: 'Технічне обслуговування',
      actor: 'workflo',
      preview: 'Заплановане оновлення 26.05 з 02:00 до 02:30 — короткочасна недоступність порталу.',
      ts: '20.05 18:00',
      unread: false,
      mentioned: false,
    },
  ],

  // Active thread (used in detail pane when user opens an inbox item)
  inbox_thread_2412: [
    { ts: '22.05 14:32', who: 'client',    name: 'Олена',  text: 'Привіт. Потрібна інтеграція 1С ↔ Telegram, щоб водії скидали накладні через бот.' },
    { ts: '22.05 14:45', who: 'illia',     name: 'Ілля',   text: 'Привіт. Скільки водіїв і яка версія 1С?' },
    { ts: '22.05 14:52', who: 'client',    name: 'Олена',  text: '54 водії, 1С 8.3 (БП). Зараз все летить у Viber. Хаос.' },
    { ts: '22.05 14:55', who: 'illia',     name: 'Ілля',   text: 'Ясно. Закину пропозицію сьогодні-завтра. Кілька питань у файлі — глянь.' },
  ],

  // ─── Workspace Inbox (cross-client, cross-team) ───
  workspace_inbox: [
    {
      id: 'wi1',
      kind: 'mention',
      source: 'ORD-2412',
      source_title: 'Інтеграція 1С ↔ Telegram-бот',
      client: 'Brunky',
      actor: 'oleh',
      actor_name: 'Олег',
      preview: '@illia глянь чи їхня версія 1С 8.3 БП підтримує REST через ВЕБ-сервіси. Якщо ні — пропоную EDT.',
      ts: '23.05 09:00',
      unread: true,
      mentioned: true,
      internal: true,
    },
    {
      id: 'wi2',
      kind: 'order',
      source: 'ORD-2415',
      source_title: 'Webhook retry queue для логістики',
      client: 'Trasa',
      actor: 'system',
      preview: 'Нове замовлення від клієнта Trasa. Потрібен assignment виконавця. Пріоритет: high.',
      ts: '24.05 16:32',
      unread: true,
      mentioned: false,
    },
    {
      id: 'wi3',
      kind: 'chat',
      source: 'ORD-2412',
      source_title: 'Інтеграція 1С ↔ Telegram-бот',
      client: 'Brunky',
      actor: 'olena',
      actor_name: 'Олена',
      preview: 'Готово, у файлі є відповіді на ваші питання.',
      ts: '22.05 17:18',
      unread: true,
      mentioned: false,
    },
    {
      id: 'wi4',
      kind: 'payment',
      source: 'INV-2025-0414',
      source_title: 'Часткова оплата · ORD-2411',
      client: 'Brunky',
      actor: 'system',
      preview: 'Отримано часткову оплату: $900 з $1 800. Метод: IBAN UAH. Webhook PrivatBank.',
      ts: '20.05 14:11',
      unread: true,
      mentioned: false,
      amount: 900,
    },
    {
      id: 'wi5',
      kind: 'overdue',
      source: 'INV-2025-0398',
      source_title: 'Прострочений рахунок · NordStream',
      client: 'NordStream',
      actor: 'system',
      preview: 'Прострочено понад 30 днів: $2 200. Auto-reminder надіслано через Telegram. Час особистого контакту.',
      ts: '24.05 08:00',
      unread: false,
      mentioned: false,
    },
    {
      id: 'wi6',
      kind: 'status',
      source: 'ORD-2410',
      source_title: 'Налаштування CRM воронок',
      client: 'Tably',
      actor: 'system',
      preview: 'Дедлайн 28.05 наближається — залишилось 1 день. Статус: review. Очікує feedback клієнта.',
      ts: '24.05 12:00',
      unread: false,
      mentioned: false,
    },
    {
      id: 'wi7',
      kind: 'doc',
      source: 'ACT-2025-0398',
      source_title: 'Акт виконаних робіт · ORD-2408',
      client: 'EduForge',
      actor: 'system',
      preview: 'Клієнт підписав акт виконаних робіт. Замовлення закрите. Оплата вже надійшла.',
      ts: '04.05 18:42',
      unread: false,
      mentioned: false,
    },
    {
      id: 'wi8',
      kind: 'marketing',
      source: 'system',
      source_title: 'Реліз 0.6.2',
      client: '—',
      actor: 'workflo',
      preview: 'Новий AI-помічник у редакторі блогу — генерує draft з outline за 30 сек. Спробуй у /blog/new.',
      ts: '20.05 12:00',
      unread: false,
      mentioned: false,
    },
  ],

  // ─── Workspace /companies (list) — extends report_clients with activity heatmap ───
  companies_full: [
    { slug: 'brunky',     name: 'Brunky',     tier: 'partner', industry: 'retail · логістика', members: 4, orders_active: 2, orders_closed: 6, revenue_total: 18900, revenue_month: 4400, debt: 900, last_activity: 'зараз',         heatmap: [3, 4, 2, 5, 3, 1, 0, 2, 4, 5, 6, 3, 2, 1, 0, 0, 2, 3, 4, 2, 1, 5, 4, 3, 6, 5, 4, 2] },
    { slug: 'eduforge',   name: 'EduForge',   tier: 'silver',  industry: 'edtech',             members: 3, orders_active: 1, orders_closed: 4, revenue_total: 12100, revenue_month: 3120, debt: 480,  last_activity: '2 год тому',   heatmap: [2, 1, 0, 3, 2, 1, 0, 0, 1, 2, 3, 4, 2, 1, 1, 2, 3, 0, 0, 1, 2, 3, 4, 2, 1, 0, 1, 2] },
    { slug: 'trasa',      name: 'Trasa',      tier: 'partner', industry: 'logistics',          members: 5, orders_active: 1, orders_closed: 5, revenue_total: 16400, revenue_month: 2800, debt: 0,    last_activity: 'вчора',        heatmap: [4, 3, 5, 2, 1, 0, 0, 3, 4, 3, 2, 1, 0, 2, 3, 4, 5, 3, 2, 1, 0, 0, 2, 3, 4, 5, 3, 2] },
    { slug: 'nordstream', name: 'NordStream', tier: 'silver',  industry: 'b2b saas',           members: 2, orders_active: 1, orders_closed: 3, revenue_total: 9400,  revenue_month: 1480, debt: 2200, last_activity: '3 дні тому',   heatmap: [1, 2, 1, 0, 0, 1, 2, 3, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0] },
    { slug: 'tably',      name: 'Tably',      tier: 'regular', industry: 'hr-tech',            members: 2, orders_active: 1, orders_closed: 2, revenue_total: 4300,  revenue_month: 600,  debt: 650,  last_activity: '5 днів тому', heatmap: [0, 1, 0, 2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { slug: 'aqualife',   name: 'AquaLife',   tier: 'new',     industry: 'retail · food',      members: 1, orders_active: 0, orders_closed: 0, revenue_total: 0,     revenue_month: 0,    debt: 0,    last_activity: 'учора',        heatmap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0] },
  ],

  // ─── /billing/payouts — earnings per executor for the period ───
  payouts: {
    period: { from: '01.05.2026', to: '27.05.2026', label: 'травень 2026', closed: false },
    summary: { total: 6700, billable_hours: 232, paid: 0, pending: 6700, executors: 6 },
    rows: [
      { id: 'illia',  name: 'Ілля',  role: 'owner', rate: 35, hours: 92, hours_billable: 88, base: 3080, bonus: 280,  total: 3360, status: 'pending', notes: 'discovery + arch · ORD-2412 60% обсягу' },
      { id: 'pavlo',  name: 'Павло', role: 'manager',       rate: 28, hours: 64, hours_billable: 60, base: 1680, bonus: 140,  total: 1820, status: 'pending', notes: 'webhook queue для Trasa' },
      { id: 'oleh',   name: 'Олег',  role: 'executor',   rate: 22, hours: 48, hours_billable: 46, base: 1012, bonus: 0,    total: 1012, status: 'pending', notes: 'bot MVP · парсер прайсів' },
      { id: 'maria',  name: 'Марія', role: 'executor',   rate: 18, hours: 28, hours_billable: 26, base: 468,  bonus: 30,   total: 498,  status: 'pending', notes: 'дизайн воронок CRM' },
      { id: 'denys',  name: 'Денис', role: 'executor',   rate: 20, hours: 14, hours_billable: 12, base: 240,  bonus: 0,    total: 240,  status: 'pending', notes: 'Notion → Telegram integration' },
      { id: 'anna',   name: 'Анна',  role: 'executor',   rate: 16, hours: 2,  hours_billable: 2,  base: 32,   bonus: 0,    total: 32,   status: 'pending', notes: 'тестовий період' },
    ],
  },

  // ─── Active company (full details for /settings/company) ───
  active_company: {
    id: 'brunky',
    name: 'ТОВ «Брунки»',
    legal_name: 'Товариство з обмеженою відповідальністю «Брунки»',
    type: 'tov',
    tin: '42345678',
    slug: 'brunky',
    addr: 'просп. Степана Бандери, 22, м. Київ, 04073',
    iban: 'UA21 3052 9900 0002 6005 0123 45678',
    bank: 'JSC CB "PrivatBank"',
    email: 'invoices@brunky.ua',
    phone: '+380 44 555 12 22',
    director: 'Іваненко Олена Петрівна',
    currency: 'usd',
    doc_lang: 'ua',
    invoice_email: 'invoices@brunky.ua',
    industry: 'retail · логістика',
    created_at: '12.02.2026',
    tier: 'silver',
  },

  // ─── Members of active company (Portal /team + /settings/members) ───
  company_members: [
    { id: 'olena',  name: 'Олена Іваненко',     email: 'olena@brunky.ua',  role: 'owner',  joined: '12.02.2026', last_active: 'зараз',       phone_verified: true,  active_orders: 3, comments_count: 24, is_me: true  },
    { id: 'petro',  name: 'Петро Шевченко',     email: 'petro@brunky.ua',  role: 'member', joined: '18.02.2026', last_active: '2 год тому',   phone_verified: true,  active_orders: 1, comments_count: 12, is_me: false },
    { id: 'oksana', name: 'Оксана Лозова',      email: 'oksana@brunky.ua', role: 'member', joined: '05.03.2026', last_active: 'вчора',        phone_verified: false, active_orders: 2, comments_count: 8,  is_me: false },
    { id: 'taras',  name: 'Тарас Коваленко',    email: 'taras@brunky.ua',  role: 'member', joined: '14.04.2026', last_active: '3 дні тому',   phone_verified: true,  active_orders: 0, comments_count: 4,  is_me: false },
  ],

  // ─── Pending invites for /settings/members ───
  company_pending_invites: [
    { email: 'andriy@brunky.ua', role: 'member', sent: '24.05.2026', expires: '31.05.2026', by: 'olena' },
  ],

  // ─── Notification settings (event × channel matrix) ───
  notification_events: [
    { id: 'new_comment',        label: 'Нове повідомлення в чаті задачі',  area: 'Задачі',     defaults: { email: true,  telegram: true,  inapp: true  } },
    { id: 'mention',            label: '@згадка у повідомленні',           area: 'Задачі',     defaults: { email: true,  telegram: true,  inapp: true  } },
    { id: 'status_change',      label: 'Зміна статусу замовлення',         area: 'Задачі',     defaults: { email: false, telegram: true,  inapp: true  } },
    { id: 'pending_approval',   label: 'Потрібне ваше підтвердження',      area: 'Задачі',     defaults: { email: true,  telegram: true,  inapp: true  } },
    { id: 'deadline_reminder',  label: 'Наближення дедлайну (за 3 дні)',   area: 'Задачі',     defaults: { email: true,  telegram: false, inapp: true  } },
    { id: 'invoice_received',   label: 'Новий рахунок',                    area: 'Білінг',     defaults: { email: true,  telegram: true,  inapp: true  } },
    { id: 'payment_confirmed',  label: 'Платіж підтверджено',              area: 'Білінг',     defaults: { email: true,  telegram: true,  inapp: true  } },
    { id: 'invoice_overdue',    label: 'Рахунок прострочено',              area: 'Білінг',     defaults: { email: true,  telegram: true,  inapp: true  } },
    { id: 'document_ready',     label: 'Новий документ (акт, спека)',      area: 'Документи',  defaults: { email: true,  telegram: false, inapp: true  } },
    { id: 'document_signed',    label: 'Документ підписано',               area: 'Документи',  defaults: { email: true,  telegram: false, inapp: true  } },
    { id: 'loyalty_tier_up',    label: 'Зміна tier лояльності',            area: 'Бонуси',     defaults: { email: true,  telegram: false, inapp: true  } },
    { id: 'referral_signup',    label: 'Ваш реферал зареєструвався',       area: 'Бонуси',     defaults: { email: true,  telegram: true,  inapp: true  } },
    { id: 'team_invite',        label: 'Нові члени команди',               area: 'Команда',    defaults: { email: false, telegram: false, inapp: true  } },
    { id: 'product_update',     label: 'Оновлення продукту (раз/тижд)',    area: 'Інше',       defaults: { email: false, telegram: false, inapp: true  } },
  ],

  // ─── Current user (for settings) ───
  current_user: {
    id: 'u-olena',
    name: 'Олена Іваненко',
    email: 'olena@brunky.ua',
    phone: '+380 50 123 84 12',
    phone_masked: '+380 50 ••• 84 12',
    phone_verified: true,
    phone_verified_at: '12.04.2026',
    two_factor: 'sms',
    two_factor_enabled: true,
    telegram_bound: true,
    telegram_username: '@olena_ivanenko',
    sessions_count: 3,
    last_password_change: '08.03.2026',
  },

  // ─── Auth sessions (for settings/security) ───
  auth_sessions: [
    { id: 's1', device: 'macOS · Chrome 132', city: 'Київ, Україна', ip: '194.45.***',  last_seen: 'зараз',        current: true  },
    { id: 's2', device: 'iOS · Safari',       city: 'Київ, Україна', ip: '37.115.***',  last_seen: '2 год тому',   current: false },
    { id: 's3', device: 'Android · Telegram Web App', city: 'Львів, Україна', ip: '212.90.***', last_seen: '3 дні тому', current: false },
  ],

  // ─── /orders/new — conversational chat draft (alt variant) ───
  order_new_chat: [
    { ts: '14:30', who: 'system',  text: 'session started · created by olena@brunky.ua · scope: new order intake' },
    { ts: '14:30', who: 'workflo', text: 'Привіт 👋 Я допоможу оформити замовлення за 5 хвилин. Розкажіть, що потрібно зробити — одним реченням ок.' },
    { ts: '14:31', who: 'client',  name: 'Олена', text: 'Інтеграція 1С ↔ Telegram-бот для водіїв, щоб водії скидали накладні через бот.' },
    { ts: '14:31', who: 'workflo', text: 'Ясно. Дайте трохи деталей: скільки водіїв, версія 1С, скільки накладних на день у середньому. Можете прикріпити брифи чи скріни.' },
    { ts: '14:33', who: 'client',  name: 'Олена', text: '54 водія, 1С 8.3 БП. Сьогодні в середньому ~180 накладних на день. Все летить у Viber — хаос. Прикріпила приклади.', attach: { name: 'examples.zip', size: '4.2 МБ' } },
    { ts: '14:33', who: 'workflo', text: 'Прийняв. Коли вам це потрібно?' },
    { ts: '14:34', who: 'client',  name: 'Олена', text: 'В ідеалі до 15.06.2026' },
    { ts: '14:34', who: 'workflo', text: 'Записав 15.06.2026. Пріоритет?' },
    { ts: '14:35', who: 'client',  name: 'Олена', text: 'normal. Якщо щось поміняється — скажу.' },
    { ts: '14:35', who: 'workflo', text: 'Останнє питання: будь-які особливості (стек, обмеження, інтеграції)? Якщо нічого — натисніть "Завершити".' },
  ],

  // ─── Reports data (for superadmin reports module) ───
  reports_period: { from: '01.05.2026', to: '27.05.2026', days: 27, label: 'травень 2026' },

  reports_summary: {
    revenue_usd: 12400,
    revenue_change: 0.18,
    hours_total: 248,
    hours_billable: 232,
    orders_closed: 14,
    orders_active: 7,
    cycle_avg_days: 11.2,
    collected_usd: 8700,
    outstanding: 4230,
    avg_margin: 0.31,
    utilization_avg: 0.78,
  },

  report_executors: [
    { id: 'illia', name: 'Ілля Васюленко',  role: 'owner', depts: ['Auto', 'Dev'],
      hours_logged: 92, hours_billable: 88, comments_ratio: 0.83, utilization: 0.92,
      rate: 35, earnings_month: 3080, active_tasks: 5, closed_tasks: 8 },
    { id: 'pavlo', name: 'Павло Кравець',   role: 'manager',       depts: ['Auto'],
      hours_logged: 64, hours_billable: 60, comments_ratio: 0.92, utilization: 0.80,
      rate: 28, earnings_month: 1680, active_tasks: 3, closed_tasks: 5 },
    { id: 'oleh',  name: 'Олег Шевченко',   role: 'executor',   depts: ['Dev', 'Auto'],
      hours_logged: 48, hours_billable: 46, comments_ratio: 0.71, utilization: 0.60,
      rate: 22, earnings_month: 1012, active_tasks: 3, closed_tasks: 4 },
    { id: 'maria', name: 'Марія Бойко',     role: 'executor',   depts: ['Design'],
      hours_logged: 28, hours_billable: 26, comments_ratio: 0.94, utilization: 0.35,
      rate: 18, earnings_month: 468, active_tasks: 2, closed_tasks: 2 },
    { id: 'denys', name: 'Денис Іщенко',    role: 'executor',   depts: ['Dev'],
      hours_logged: 14, hours_billable: 12, comments_ratio: 0.55, utilization: 0.17,
      rate: 20, earnings_month: 240, active_tasks: 2, closed_tasks: 1 },
    { id: 'anna',  name: 'Анна Лозова',     role: 'executor',   depts: ['Content'],
      hours_logged: 2,  hours_billable: 2,  comments_ratio: 1.00, utilization: 0.04,
      rate: 16, earnings_month: 32,  active_tasks: 1, closed_tasks: 0 },
  ],

  report_clients: [
    { slug: 'brunky',     name: 'Brunky',     tier: 'partner', revenue: 4400, hours: 84, orders_active: 2, orders_closed: 6, debt: 900,  margin: 0.34, last_order: '24.05' },
    { slug: 'eduforge',   name: 'EduForge',   tier: 'silver',  revenue: 3120, hours: 62, orders_active: 1, orders_closed: 4, debt: 480,  margin: 0.28, last_order: '20.05' },
    { slug: 'trasa',      name: 'Trasa',      tier: 'partner', revenue: 2800, hours: 48, orders_active: 1, orders_closed: 5, debt: 0,    margin: 0.36, last_order: '22.05' },
    { slug: 'nordstream', name: 'NordStream', tier: 'silver',  revenue: 1480, hours: 28, orders_active: 1, orders_closed: 3, debt: 2200, margin: 0.22, last_order: '15.05' },
    { slug: 'tably',      name: 'Tably',      tier: 'regular', revenue: 600,  hours: 12, orders_active: 1, orders_closed: 2, debt: 650,  margin: 0.18, last_order: '14.05' },
  ],

  report_departments: [
    { id: 'auto',    label: 'Automation',  color: '#A3D90D', hours: 134, revenue: 5600, throughput: 6, cycle: 9.8,  utilization: 0.84 },
    { id: 'dev',     label: 'Development', color: '#0891B2', hours: 76,  revenue: 4200, throughput: 4, cycle: 13.4, utilization: 0.72 },
    { id: 'design',  label: 'Design',      color: '#D946EF', hours: 28,  revenue: 1800, throughput: 3, cycle: 8.6,  utilization: 0.35 },
    { id: 'content', label: 'Content',     color: '#D97706', hours: 10,  revenue: 800,  throughput: 1, cycle: 7.0,  utilization: 0.13 },
  ],

  report_timesheet: [
    { date: '24.05', day: 'Сб', executor: 'illia', task: 'ORD-2412', client: 'Brunky',     minutes: 137, comment: 'Розбір API 1С + архітектура' },
    { date: '24.05', day: 'Сб', executor: 'oleh',  task: 'ORD-2411', client: 'Brunky',     minutes: 60,  comment: 'Тестування пілоту парсера' },
    { date: '23.05', day: 'Пт', executor: 'illia', task: 'ORD-2412', client: 'Brunky',     minutes: 90,  comment: '' },
    { date: '23.05', day: 'Пт', executor: 'oleh',  task: 'ORD-2412', client: 'Brunky',     minutes: 180, comment: 'Bot MVP — реєстрація, submit' },
    { date: '23.05', day: 'Пт', executor: 'maria', task: 'ORD-2410', client: 'Tably',      minutes: 120, comment: 'Дизайн воронок CRM — 4 варіанти' },
    { date: '22.05', day: 'Чт', executor: 'illia', task: 'ORD-2412', client: 'Brunky',     minutes: 90,  comment: 'Discovery call · 54 водії' },
    { id: '22.05', day: 'Чт', executor: 'pavlo', task: 'ORD-2415', client: 'Trasa',      minutes: 75,  comment: 'Архітектура webhook retry queue' },
    { date: '22.05', day: 'Чт', executor: 'oleh',  task: 'ORD-2411', client: 'Brunky',     minutes: 180, comment: 'Парсер прайсів — 5 сайтів' },
    { date: '21.05', day: 'Ср', executor: 'illia', task: 'ORD-2409', client: 'EduForge',   minutes: 240, comment: 'AI-агент escalation logic' },
    { date: '21.05', day: 'Ср', executor: 'denys', task: 'ORD-2413', client: 'NordStream', minutes: 120, comment: 'Notion API integration' },
  ],

  audit_log: [
    { ts: '24.05.2026 17:42', actor: 'illia',  kind: 'task',     subject: 'ORD-2412', detail: 'зміна статусу', field: 'status', from: 'estimating', to: 'in_progress', ip: '194.45.123.x' },
    { ts: '24.05.2026 17:40', actor: 'client (olena)', kind: 'task', subject: 'ORD-2412', detail: 'approved estimate $4 200',           ip: '37.115.45.x' },
    { ts: '24.05.2026 11:08', actor: 'illia',  kind: 'document', subject: 'INV-2025-0418', detail: 'invoice generated · sent to client', ip: '194.45.123.x' },
    { ts: '24.05.2026 10:22', actor: 'illia',  kind: 'settings', subject: 'team · Олег Ш.', detail: 'зміна ставки', field: 'rate', from: '$20/год', to: '$22/год', ip: '194.45.123.x' },
    { ts: '24.05.2026 09:14', actor: 'system', kind: 'auto',     subject: 'INV-2025-0411', detail: 'reminder sent · day 11 of 14',      ip: 'system' },
    { ts: '23.05.2026 16:48', actor: 'illia',  kind: 'settings', subject: 'team · Денис І.', detail: 'зміна ролі', field: 'role', from: 'executor', to: 'manager', ip: '194.45.123.x' },
    { ts: '23.05.2026 10:03', actor: 'illia',  kind: 'document', subject: 'SPC-2025-0418', detail: 'specification created',             ip: '194.45.123.x' },
    { ts: '23.05.2026 09:14', actor: 'illia',  kind: 'task',     subject: 'ORD-2412', detail: 'зміна статусу', field: 'status', from: 'clarification', to: 'estimating', ip: '194.45.123.x' },
    { ts: '23.05.2026 09:08', actor: 'oleh',   kind: 'comment',  subject: 'ORD-2412', detail: 'internal note added',                   ip: '212.90.45.x' },
    { ts: '22.05.2026 15:10', actor: 'illia',  kind: 'settings', subject: 'project · PRJ-118', detail: 'білінг-цикл', field: 'cycle', from: 'щомісяця · 1-е', to: 'щомісяця · 5-е', ip: '194.45.123.x' },
    { ts: '22.05.2026 14:32', actor: 'client (olena)', kind: 'task', subject: 'ORD-2412', detail: 'order created · Brunky',            ip: '37.115.45.x' },
    { ts: '22.05.2026 11:05', actor: 'illia',  kind: 'settings', subject: 'team', detail: 'запрошено члена', field: 'invite', from: '—', to: 'denys@workflo.space · executor', ip: '194.45.123.x' },
    { ts: '21.05.2026 18:20', actor: 'illia',  kind: 'settings', subject: 'legal entity', detail: 'дефолтна юр-особа', field: 'default', from: 'ТОВ «Воркфло»', to: 'ФОП Васюленко І.', ip: '194.45.123.x' },
    { ts: '20.05.2026 14:11', actor: 'system', kind: 'payment',  subject: 'INV-2025-0414', detail: 'partial payment $900 received',    ip: 'webhook · PrivatBank' },
    { ts: '20.05.2026 12:00', actor: 'workflo', kind: 'release', subject: 'platform', detail: 'deployed v0.6.2',                       ip: 'ci/cd' },
    { ts: '18.05.2026 17:30', actor: 'illia',  kind: 'settings', subject: 'department', detail: 'створено підрозділ', field: 'create', from: '—', to: 'Content', ip: '194.45.123.x' },
  ],

  // ─── Loyalty (Portal) ───
  loyalty: {
    current_tier: 'silver',
    next_tier: 'partner',
    total_spent_usd: 22380,
    total_spent_uah: 924_500,
    spent_this_year: 6400,
    next_tier_threshold: 25000,
    next_tier_remaining: 2620,
    bonus_balance: 340,
    bonus_total_earned: 580,
    bonus_total_spent: 240,
    progress_pct: 0.83,
    transactions: [
      { date: '20.05.2026', kind: 'earned', amount: 88,  source: 'loyalty', basis: 'оплата INV-2025-0414 · 5% від $1 800' },
      { date: '04.05.2026', kind: 'earned', amount: 170, source: 'loyalty', basis: 'оплата INV-2025-0392 · 5% від $3 400' },
      { date: '29.04.2026', kind: 'earned', amount: 60,  source: 'loyalty', basis: 'оплата INV-2025-0388 · 5% від $1 200' },
      { date: '15.04.2026', kind: 'spent',  amount: -120, source: 'loyalty', basis: 'застосовано до INV-2025-0388 (знижка)' },
      { date: '03.04.2026', kind: 'earned', amount: 200, source: 'referral', basis: 'NordStream підключився як клієнт · 5% від першого замовлення' },
      { date: '01.04.2026', kind: 'spent',  amount: -60, source: 'loyalty', basis: 'застосовано до INV-2025-0382' },
      { date: '15.03.2026', kind: 'earned', amount: 62,  source: 'loyalty', basis: 'оплата INV-2025-0371 · upgrade на silver +5%' },
    ],
    spending_history: [
      { month: 'Гру', amount: 0 },
      { month: 'Січ', amount: 1200 },
      { month: 'Лют', amount: 800 },
      { month: 'Бер', amount: 2200 },
      { month: 'Кві', amount: 4600 },
      { month: 'Тра', amount: 6400 },
    ],
  },

  // ─── Referrals (Portal) ───
  referrals: {
    code: 'BRUNKY-25',
    link: 'workflo.space/?ref=BRUNKY-25',
    stats: {
      invited: 7,
      signed_up: 4,
      active_clients: 2,
      earned_total: 380,
      pending_potential: 220,
    },
    list: [
      { invited_at: '03.04.2026', email_masked: 'n***@nordstream.io', status: 'active',    first_order_at: '03.04.2026', bonus: 200, note: 'NordStream · 1 замовлення оплачено' },
      { invited_at: '12.04.2026', email_masked: 'm***@trasa.app',     status: 'active',    first_order_at: '15.04.2026', bonus: 180, note: 'Trasa · 1 замовлення оплачено' },
      { invited_at: '20.04.2026', email_masked: 'o***@eduforge.io',   status: 'signed_up', first_order_at: null,         bonus: 0,   note: 'EduForge · зареєструвалась, чекаємо замовлення' },
      { invited_at: '02.05.2026', email_masked: 'a***@example.com',   status: 'signed_up', first_order_at: null,         bonus: 0,   note: 'чекаємо першого замовлення' },
      { invited_at: '10.05.2026', email_masked: 'b***@example.com',   status: 'invited',   first_order_at: null,         bonus: 0,   note: 'надіслано, не зареєструвалась' },
      { invited_at: '18.05.2026', email_masked: 'c***@example.com',   status: 'invited',   first_order_at: null,         bonus: 0,   note: 'нагадування через 3 дні' },
      { invited_at: '20.05.2026', email_masked: 'd***@example.com',   status: 'cancelled', first_order_at: null,         bonus: 0,   note: 'не відповіла за тиждень · автоматично закрито' },
    ],
  },

  // ─── Role permissions matrix ───
  role_permissions: [
    { area: 'Задачі',     items: [
      { what: 'Бачити всі задачі',              owner: true, manager: 'dept', executor: 'assigned' },
      { what: 'Бачити intake (нові)',           owner: true, manager: true,   executor: true },
      { what: 'Створювати задачі вручну',       owner: true, manager: true,   executor: false },
      { what: 'Видаляти задачі (soft)',         owner: true, manager: false,  executor: false },
      { what: 'Призначати виконавців',          owner: true, manager: 'dept', executor: false },
      { what: 'Розблокувати (done → revision)', owner: true, manager: false,  executor: false },
    ] },
    { area: 'Час',        items: [
      { what: 'Логувати час (свій)',             owner: true, manager: true,   executor: true },
      { what: 'Редагувати свої записи',          owner: true, manager: true,   executor: true },
      { what: 'Редагувати чужі записи',          owner: true, manager: 'dept', executor: false },
      { what: 'Бачити час команди',              owner: true, manager: 'dept', executor: false },
    ] },
    { area: 'Документи',  items: [
      { what: 'Генерувати документи',            owner: true, manager: true,   executor: false },
      { what: 'Відправляти клієнту',             owner: true, manager: 'dept', executor: false },
      { what: 'Видаляти чернетки',               owner: true, manager: 'dept', executor: false },
    ] },
    { area: 'Білінг',     items: [
      { what: 'Бачити всі рахунки',              owner: true, manager: false,  executor: false },
      { what: 'Виставляти рахунки',              owner: true, manager: false,  executor: false },
      { what: 'Відмічати оплачено',              owner: true, manager: false,  executor: false },
    ] },
    { area: 'Команда',    items: [
      { what: 'Запрошувати членів',              owner: true, manager: 'dept', executor: false },
      { what: 'Змінювати ролі',                  owner: true, manager: false,  executor: false },
      { what: 'Бачити earnings команди',         owner: true, manager: 'dept', executor: false },
      { what: 'Бачити свій earnings',            owner: true, manager: true,   executor: true },
    ] },
    { area: 'Звіти',      items: [
      { what: 'Audit log',                       owner: true, manager: false,  executor: false },
      { what: 'Звіт по виконавцях',              owner: true, manager: 'dept', executor: false },
      { what: 'Звіт по клієнтах',                owner: true, manager: false,  executor: false },
      { what: 'Timesheet (всі)',                 owner: true, manager: 'dept', executor: false },
    ] },
  ],

  // ─── Pending invites ───
  pending_invites: [
    { email: 'serhii@workflo.space',  role: 'executor', dept: 'dev',      sent: '23.05.2026', expires: '30.05.2026', by: 'illia' },
    { email: 'kateryna@workflo.space', role: 'executor', dept: 'design',  sent: '24.05.2026', expires: '31.05.2026', by: 'illia' },
  ],

  // ─── Departments (Workspace) · lead = тімлід підрозділу (member id) ───
  departments: [
    { id: 'dev',        label: 'Development', short: 'Dev',  color: '#0891B2', count_active: 5, count_total: 18, lead: 'denys' },
    { id: 'design',     label: 'Design',      short: 'Des',  color: '#D946EF', count_active: 2, count_total: 6,  lead: null    },
    { id: 'automation', label: 'Automation',  short: 'Auto', color: '#A3D90D', count_active: 3, count_total: 11, lead: 'pavlo' },
    { id: 'content',    label: 'Content',     short: 'Cnt',  color: '#D97706', count_active: 1, count_total: 4  },
  ],

  // ─── Team v2 (with roles + dept membership + reporting line) ───
  // reportsTo = id керівника (підпорядкування); owner reportsTo: null
  team_v2: [
    { id: 'illia',  name: 'Ілля Васюленко',  role: 'owner',    title: 'Засновник',        departments: ['dev', 'automation'],   rate: 35, active_tasks: 5, hours_week: 38, reportsTo: null },
    { id: 'pavlo',  name: 'Павло Кравець',   role: 'manager',  title: 'Тімлід Automation', departments: ['automation'],          rate: 28, active_tasks: 3, hours_week: 32, reportsTo: 'illia' },
    { id: 'denys',  name: 'Денис Іщенко',    role: 'manager',  title: 'Тімлід Development', departments: ['dev'],                 rate: 24, active_tasks: 2, hours_week: 20, reportsTo: 'illia' },
    { id: 'oleh',   name: 'Олег Шевченко',   role: 'executor', title: 'Розробник',         departments: ['dev', 'automation'],   rate: 22, active_tasks: 3, hours_week: 28, reportsTo: 'pavlo' },
    { id: 'maria',  name: 'Марія Бойко',     role: 'executor', title: 'Дизайнер',          departments: ['design'],              rate: 18, active_tasks: 2, hours_week: 16, reportsTo: 'illia' },
    { id: 'anna',   name: 'Анна Лозова',     role: 'executor', title: 'Контент-менеджер',  departments: ['content'],             rate: 16, active_tasks: 1, hours_week: 12, reportsTo: 'illia' },
  ],

  // ─── Active timer (one per user) ───
  active_timer: {
    executor: 'illia',
    task_id: 'ORD-2412',
    task_title: 'Інтеграція 1С ↔ Telegram-бот',
    client: 'Brunky',
    started_at: '24.05 14:22',
    elapsed_seconds: 2832,    // 47:12
    paused: false,
  },

  // ─── Time entries for ORD-2412 (extended w/ comments) ───
  time_entries_2412: [
    { id: 'te-active', date: '24.05', executor: 'illia', start: '14:22', end: null,    minutes: 47, comment: '', billable: true, status: 'active' },
    { id: 'te5',       date: '24.05', executor: 'illia', start: '11:00', end: '12:30', minutes: 90, comment: 'Скетч архітектури — bot + queue + 1С-конектор. Прийняли рішення про idempotency keys на стороні middleware.', billable: true, status: 'done' },
    { id: 'te4',       date: '23.05', executor: 'oleh',  start: '14:00', end: '17:00', minutes: 180, comment: 'Пілотний bot на python-telegram-bot v21. Реєстрація водія за номером. Базовий flow — фото + ПІБ + сума.', billable: true, status: 'done' },
    { id: 'te3',       date: '23.05', executor: 'illia', start: '10:00', end: '11:00', minutes: 60,  comment: 'Розбір API 1С 8.3 БП — знайшов REST через ВЕБ-сервіси (БСП). Тест-запит з Postman пройшов.', billable: true, status: 'done' },
    { id: 'te2',       date: '23.05', executor: 'illia', start: '09:00', end: '09:30', minutes: 30,  comment: '', billable: true, status: 'done' },
    { id: 'te1',       date: '22.05', executor: 'illia', start: '14:30', end: '16:00', minutes: 90,  comment: 'Discovery call. 54 водії, 1С 8.3 БП, ~180 накладних/день. Знімок існуючого Viber-флоу.', billable: true, status: 'done' },
  ],

  // ─── Final spec draft for closing task ───
  final_spec_2412: {
    status: 'draft',
    generated_at: '24.05.2026 17:14',
    version: 1,
    ai_polished: false,
    content_md: `# Виконано

## Discovery + архітектура
- Розбір API 1С 8.3 БП — знайдено REST через ВЕБ-сервіси (БСП)
- Архітектурна нотатка: bot + middleware queue + 1С-конектор
- Прийнято рішення про idempotency keys на стороні middleware

## Telegram-бот (MVP)
- python-telegram-bot v21
- Реєстрація водія за номером телефону
- Submit накладної: фото + ПІБ + сума
- Базовий admin-канал для review

## 1С-інтеграція
- Підключено до 1С 8.3 БП через REST (ВЕБ-сервіси)
- Створення документа "Надходження товарів" автоматично
- Retry-логіка + idempotency keys

## Не завершено
- AI-валідатор фото (vision)
- Адмін-панель (web)
- Manual review queue`,
  },

  // ─── Workspace /orders/intake — unassigned new orders ───
  intake_orders: [
    {
      num: 'ORD-2416', client: 'EduForge', title: 'Інтеграція Stripe → 1С для автомат-нарахування підписок',
      created: '24.05.2026 14:32', priority: 'high', budget: 2800, deadline: '14.06',
      suggested_dept: 'automation', ai_confidence: 0.87,
      preview: 'Маємо приблизно 240 активних підписок у Stripe. Хочемо щоб гроші автоматично потрапляли в 1С з прив\'язкою...',
      created_by: 'olha@eduforge.io',
    },
    {
      num: 'ORD-2415', client: 'Trasa', title: 'Webhook retry queue для логістики',
      created: '24.05.2026 16:32', priority: 'high', budget: 1400, deadline: '12.06',
      suggested_dept: 'dev', ai_confidence: 0.92,
      preview: 'Наш постачальник Nova Post періодично шле webhook\'и, які потрібно надійно проковтнути. Хочемо queue + retry...',
      created_by: 'taras@trasa.app',
    },
    {
      num: 'ORD-2414', client: 'EduForge', title: 'Парсер курсів конкурентів — 12 сайтів',
      created: '24.05.2026 11:08', priority: 'normal', budget: 1800, deadline: '15.06',
      suggested_dept: 'automation', ai_confidence: 0.78,
      preview: 'Потрібно щодня парсити 12 сайтів конкурентів — назва, ціна, обсяг (год). Структура різна — потрібен AI-парсер...',
      created_by: 'olha@eduforge.io',
    },
    {
      num: 'ORD-2413', client: 'NordStream', title: 'Notion → Telegram daily digest',
      created: '23.05.2026 18:42', priority: 'low', budget: 600, deadline: '20.06',
      suggested_dept: 'automation', ai_confidence: 0.94,
      preview: 'Хочемо щоранку о 9:00 присилати в Telegram-канал команди дайджест активних задач з Notion...',
      created_by: 'mike@nordstream.io',
    },
  ],

  // Statuses (color + label) — client-facing
  client_statuses: {
    new:              { label: 'Створено',           dot: 'var(--wf-fg-muted)'  },
    clarification:    { label: 'Уточнюємо',          dot: 'var(--wf-warning)'   },
    estimating:       { label: 'Оцінюємо',           dot: 'var(--wf-warning)'   },
    pending_approval: { label: 'Очікує підтвердження', dot: 'var(--wf-warning)' },
    in_progress:      { label: 'В роботі',           dot: 'var(--wf-accent)'    },
    revision:         { label: 'Доробка',            dot: 'var(--wf-warning)'   },
    review:           { label: 'На перевірці',       dot: 'var(--wf-accent)'    },
    done:             { label: 'Готово',             dot: 'var(--wf-success)'   },
    cancelled:        { label: 'Скасовано',          dot: 'var(--wf-destructive)' },
  },
};
