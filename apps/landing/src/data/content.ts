// content.ts — UA landing copy, ported from design-v2 data.js (BRIEF.md v2.0).
// EN + remaining sections land in later S7 slices; slice 1 ships the homepage shell + hero.

/** DSN-9: рядки інтерфейсу головної, що не є «контентом» (підписи, стани форми, профіль). */
export interface LandingUi {
  casesIntro: string // {n} — кількість кейсів
  partnersIntro: string // {n} партнерів, {p} проєктів
  projectOne: string
  projectMany: string
  whoFocus: string
  whoStatus: string
  aboutEmph: string // абзац «about», що виділяється як >>>
  formRetry: string
  formSendError: string
  terms: string
  privacy: string
  clockLocale: string
}

export interface LandingContent {
  locale: 'uk' | 'en'
  ui: LandingUi
  nav: { label: string; href: string }[]
  ctaPortal: string
  ctaPrimary: string
  ctaSecondary: string
  hero: { h1: string[]; sub: string }
  live: string[]
  liveLabel: string
  liveAgo: string[]
  services: { num: string; name: string; line: string; examples: string; tools: string[] }[]
  cases: {
    num: string
    slug: string | null
    company: string
    name: string
    year: string
    duration: string
    context: string
    metrics: string[]
    stack: string[]
  }[]
  process: { num: string; name: string; desc: string }[]
  partners: {
    slug: string
    name: string
    industry: string
    location: string
    since: string
    accent: string
    logoGlyph: string
    bio: string
    projectsCount: number
  }[]
  spotlight: { name: string; status: string; desc: string; market: string; ctaEmailPh: string }
  about: string[]
  contact: {
    h2: string
    sub: string
    send: string
    or: string
    fName: string
    fContact: string
    fMessage: string
    channels: { kind: string; value: string }[]
  }
  scale: {
    subtitle: string
    stats: { v: string; k: string }[]
    ndaHead: string
    ndaHint: string
    nda: {
      tag: string
      name: string
      year: string
      duration: string
      summary: string
      impact: string[]
    }[]
  }
}

export const UA: LandingContent = {
  locale: 'uk',
  ui: {
    casesIntro: '// {n} публічних кейсів · цифри реальні',
    partnersIntro: '// {n} партнерів · {p} проєктів · довгострокові партнерства',
    projectOne: 'проєкт',
    projectMany: 'проєкти',
    whoFocus: 'автоматизація для команд, що виросли з Excel',
    whoStatus: 'available · приймаю проєкти Q3 2026',
    aboutEmph: 'Я роблю так, щоб цього не було.',
    formRetry: 'помилка — ще раз',
    formSendError: '// не вдалося надіслати — напишіть напряму нижче',
    terms: 'умови',
    privacy: 'приватність',
    clockLocale: 'uk-UA',
  },
  nav: [
    { label: 'Партнери', href: '#partners' },
    { label: 'Роботи', href: '#work' },
    { label: 'Послуги', href: '#services' },
    { label: 'Процес', href: '#process' },
    { label: 'Про мене', href: '#who' },
    { label: 'Контакт', href: '#contact' },
  ],
  ctaPortal: 'Мій кабінет',
  ctaPrimary: 'Обговорити проєкт',
  ctaSecondary: 'Подивитися роботи',
  hero: {
    h1: ['Я Ілля. Будую автоматизації', 'для команд, що виросли', 'з Excel.'],
    sub: 'Луцьк · Україна · 6 років у продуктовій розробці',
  },
  live: [
    'implementing webhook retry logic in workflo',
    'writing case study about retail integration',
    'review PR for client CRM portal',
    'shipping new agent prompts to staging',
  ],
  liveLabel: 'зараз:',
  liveAgo: ['12m ago', '2h ago', '8m ago', '1h ago'],
  services: [
    {
      num: '01',
      name: 'Інтеграції та API',
      line: 'Коли дві системи не розмовляють між собою.',
      examples:
        'CRM ↔ 1C · Notion ↔ Telegram · форми → внутрішня БД · GoogleSheets → email-розсилка з тригером.',
      tools: ['TypeScript', 'Node', 'Python', 'REST', 'webhooks', 'queues'],
    },
    {
      num: '02',
      name: 'AI-агенти та workflow',
      line: 'Коли потрібен агент, який щось робить, а не просто чатить.',
      examples:
        'Бот саппорту з контекстом ваших даних · агент-аналітик для звітів · генератор пропозицій з CRM · processor для документів.',
      tools: ['OpenAI', 'Anthropic', 'LangChain', 'RAG', 'vector DBs'],
    },
    {
      num: '03',
      name: 'Внутрішні портали та CRM',
      line: 'Коли готові SaaS не покривають ваші процеси.',
      examples:
        'Портал замовлень для клієнтів · кастомний CRM під специфіку · dashboard з real-time даних.',
      tools: ['Next.js', 'React', 'Postgres', 'Prisma'],
    },
    {
      num: '04',
      name: 'Автоматизація рутини',
      line: 'Коли людина робить те, що має робити скрипт.',
      examples:
        'Парсинг даних з сайтів · генерація документів з шаблонів · заплановані звіти · scrapers · монітори.',
      tools: ['Python', 'n8n', 'Make', 'GitHub Actions'],
    },
  ],
  cases: [
    {
      num: '01',
      slug: 'retail-1c-integration',
      company: 'retail',
      name: 'Інтеграція 1С ↔ Telegram для логістики',
      year: '2025',
      duration: '6 тижнів',
      context: '50 водіїв вручну скидали накладні в чат — без структури, з помилками.',
      metrics: [
        '−87% часу на обробку замовлень',
        '+€12k додаткового MRR',
        "4 системи з'єднано в один потік",
      ],
      stack: ['Next.js', 'Postgres', '1C API', 'Telegram Bot API', 'Anthropic'],
    },
    {
      num: '02',
      slug: 'ai-support-agent',
      company: 'saas',
      name: 'AI-агент саппорту для SaaS',
      year: '2024',
      duration: '4 тижні',
      context: 'First-response 14 годин, нові користувачі churning на третій день.',
      metrics: ['92% auto first response', '+24% CSAT', '~$3.2k/міс економія'],
      stack: ['Anthropic Claude', 'RAG', 'Pinecone', 'Python', 'Slack API'],
    },
    {
      num: '03',
      slug: 'custom-crm-logistics',
      company: 'logistics',
      name: 'Кастомний CRM для логістичного оператора',
      year: '2025',
      duration: '8 тижнів',
      context: 'Три системи (склад, доставка, фінанси) — нічна ручна синхронізація.',
      metrics: ['400 годин/міс економії', '3 системи → 1 портал', 'Real-time tracking'],
      stack: ['Next.js', 'Postgres', 'Prisma', 'Redis', 'Mapbox'],
    },
    {
      num: '04',
      slug: 'market-parser',
      company: 'agency',
      name: 'Парсер ринкових даних для агенції',
      year: '2024',
      duration: '2 тижні',
      context: 'Аналітик витрачав 18 годин на тиждень на ручний збір.',
      metrics: ['18 год → 12 хв щодня', '+200% частота звітів', '0 помилок копіювання'],
      stack: ['Python', 'Playwright', 'GitHub Actions', 'Sheets API'],
    },
    {
      num: '05',
      slug: null,
      company: 'workflo',
      name: 'Workflo',
      year: 'продукт у розробці',
      duration: 'beta Q3 2026',
      context: 'Платформа для команд, які працюють із замовленнями. Усе на одній сторінці.',
      metrics: ['240+ у waitlist', '3 пілотні команди', 'beta Q3 2026'],
      stack: ['Next.js', 'Postgres', 'Prisma', 'Anthropic', 'Tailwind'],
    },
  ],
  process: [
    {
      num: '01',
      name: 'Дзвінок 30 хв',
      desc: 'Розбираємо ваш процес, фіксуємо болі, визначаємо чи я підходжу. Без зобовʼязань.',
    },
    {
      num: '02',
      name: 'Технічна пропозиція',
      desc: 'Через 3–5 днів — документ із обсягом, технологіями, дедлайном і фіксованою ціною. Без «time & material».',
    },
    {
      num: '03',
      name: 'Розробка',
      desc: 'Щотижневі demo. Ви бачите прогрес кожні 7 днів — без сюрпризів. Slack або Telegram-канал проєкту.',
    },
    {
      num: '04',
      name: 'Запуск',
      desc: 'Деплой, тестування з командою, навчання, документація. Перші 2 тижні підтримки безкоштовно.',
    },
    {
      num: '05',
      name: 'Підтримка (опціонально)',
      desc: 'Місячна підписка на оновлення, моніторинг, нові фічі — за бажанням. Без неї нічого не зламається.',
    },
  ],
  partners: [
    {
      slug: 'brunky',
      name: 'Brunky',
      industry: 'Мережа кавʼярень',
      location: 'Lutsk, UA',
      since: '2024',
      accent: '#a36b3c',
      logoGlyph: 'B/',
      bio: 'Локальна мережа з чотирьох кавʼярень у Луцьку. Specialty кава, домашня випічка та доставка в бізнес-центри міста.',
      projectsCount: 2,
    },
    {
      slug: 'eduforge',
      name: 'EduForge',
      industry: 'Онлайн-курси · інфобізнес',
      location: 'Kyiv, UA',
      since: '2024',
      accent: '#5a7db5',
      logoGlyph: 'ef',
      bio: 'Інфобізнес із шести онлайн-курсів про дизайн, продукт і програмування. ~2400 активних студентів і сильна спільнота.',
      projectsCount: 1,
    },
    {
      slug: 'trasa-logistics',
      name: 'Trasa Logistics',
      industry: 'Логістика · 3PL',
      location: 'Lviv, UA',
      since: '2025',
      accent: '#3c7d5a',
      logoGlyph: 't//',
      bio: 'Оператор вантажних перевезень на маршрутах Україна–ЄС. 300 одиниць техніки, ~80 співробітників, три не повʼязані системи.',
      projectsCount: 1,
    },
    {
      slug: 'nordstream',
      name: 'Nordstream Agency',
      industry: 'Маркетинг-агенція',
      location: 'Kyiv, UA',
      since: '2024',
      accent: '#8b5fbf',
      logoGlyph: 'N→',
      bio: 'Performance-маркетингова агенція з Києва. 24 співробітники, переважно B2B-клієнти в IT та fintech.',
      projectsCount: 2,
    },
    {
      slug: 'tably',
      name: 'Tably',
      industry: 'B2B SaaS · бронювання послуг',
      location: 'Berlin, DE',
      since: '2025',
      accent: '#d97a4a',
      logoGlyph: '/t',
      bio: 'SaaS-платформа для салонів краси та барбершопів: записи, фінанси, лояльність. 8000+ активних користувачів у трьох країнах.',
      projectsCount: 1,
    },
  ],
  spotlight: {
    name: 'Workflo',
    status: 'in development · beta Q3 2026',
    desc: 'Платформа для команд, які працюють із замовленнями. Все на одній сторінці: замовлення, документи, фінанси, статуси в реальному часі. Без зайвого.',
    market:
      'Ринок: B2B-компанії 5–50 людей, які зараз тримають це в Notion, Excel або кустарному CRM.',
    ctaEmailPh: 'you@email.com',
  },
  contact: {
    h2: 'Поговоримо?',
    sub: 'Розкажіть коротко про проєкт — поверну протягом 24 годин у будні.',
    send: 'Надіслати',
    or: 'або напряму',
    fName: 'Імʼя',
    fContact: 'Telegram або email',
    fMessage: 'Опис проєкту',
    channels: [
      { kind: 'Telegram', value: '@vasulenkoillia' },
      { kind: 'Email', value: 'illia@workflo.space' },
      { kind: 'GitHub', value: 'VasulenkoIllia' },
    ],
  },
  about: [
    'Я з Луцька. Програмую з 2018-го, останні 4 роки — автоматизую процеси для бізнесів, які виросли з Excel.',
    'До цього: продуктова команда в логістичному стартапі, фронтенд для української fintech-компанії, freelance-проєкти для агенцій у ЄС.',
    '',
    'Більшість команд, які я бачив, втрачають по 10–20 годин на тиждень на роботу, яку має робити скрипт. Хтось копіює дані між таблицями, хтось вручну формує звіти, хтось пише одне й те саме email щодня.',
    '',
    'Я роблю так, щоб цього не було.',
    'Workflo — це мій спосіб дати цю можливість командам, які не можуть собі дозволити окремого розробника.',
  ],
  scale: {
    subtitle: 'Що тут показано явно — верхівка айсбергу. Більшість проєктів — під NDA.',
    stats: [
      { v: '12', k: 'total projects' },
      { v: '7', k: 'companies' },
      { v: '4 роки', k: 'in automation' },
      { v: '4', k: 'countries' },
      { v: '5', k: 'public case studies' },
      { v: '7', k: 'under nda' },
    ],
    ndaHead: '### under NDA · 7 проєктів',
    ndaHint: 'Компанії не називаю — під NDA. На запит можу надати референси від клієнтів.',
    nda: [
      {
        tag: 'fintech-eu',
        name: 'payment orchestrator',
        year: '2025',
        duration: '8 тижнів',
        summary: 'Роутинг платежів між 4 провайдерами · фолбек + ретраї',
        impact: ['sub-50ms latency p99', '4 системи зведено'],
      },
      {
        tag: 'healthtech',
        name: 'booking automation',
        year: '2024',
        duration: '12 тижнів',
        summary: 'Самозапис пацієнтів · 8 клінік',
        impact: ['−74% phone load', '24/7 self-service'],
      },
      {
        tag: 'b2b-saas-de',
        name: 'internal CRM',
        year: '2024',
        duration: '6 тижнів',
        summary: 'Внутрішній CRM для sales · 50 користувачів',
        impact: ['80% adoption за місяць'],
      },
      {
        tag: 'media-co',
        name: 'content pipeline',
        year: '2023',
        duration: '4 тижні',
        summary: 'AI-пайплайн рерайтера · ≈3k статей/міс',
        impact: ['5× вихідний обʼєм'],
      },
      {
        tag: 'legaltech',
        name: 'document parser',
        year: '2023',
        duration: '3 тижні',
        summary: 'Парсер контрактів у структуровані дані',
        impact: ['95% точність витягу'],
      },
      {
        tag: 'edtech-de',
        name: 'payment flow',
        year: '2023',
        duration: '5 тижнів',
        summary: 'Онлайн-оплата курсів · EUR/PLN/CZK',
        impact: ['+18% conversion'],
      },
      {
        tag: 'retail-pl',
        name: 'inventory sync',
        year: '2022',
        duration: '6 тижнів',
        summary: 'Синхронізація складів · 12 точок',
        impact: ['−6h/day введення', '99.8% точність'],
      },
    ],
  },
}

/** DSN-9: EN-поля партнерів (design-v2 pages-data.js WF_COMPANIES). */
const PARTNERS_EN: Record<string, { industry: string; bio: string }> = {
  brunky: {
    industry: 'Café network',
    bio: 'Brunky operates four cafés in Lutsk since 2021. They specialize in specialty coffee, in-house baking, and delivery to local business centres.',
  },
  eduforge: {
    industry: 'Online courses · infoproduct',
    bio: 'EduForge runs six online courses on design, product, and engineering. ~2,400 active students and a strong community.',
  },
  'trasa-logistics': {
    industry: 'Logistics · 3PL',
    bio: 'Trasa Logistics is a freight operator from Lviv, primarily on UA–EU routes. 300 vehicles, ~80 employees, three disconnected systems.',
  },
  nordstream: {
    industry: 'Marketing agency',
    bio: 'Nordstream is a performance marketing agency from Kyiv. 24 employees, mostly B2B clients in IT and fintech.',
  },
  tably: {
    industry: 'B2B SaaS · service booking',
    bio: 'Tably is a SaaS for salons, barbershops, and similar service businesses: bookings, finance, loyalty. 8000+ active users across three countries.',
  },
}

/**
 * DSN-9: EN-версія головної (/en) — копія з design-v2 data.js (WF_CONTENT.en) і pages-data.js
 * (EN-біо партнерів). Структура — як у UA; slug-и кейсів/партнерів ті самі (деталі — UA).
 */
export const EN: LandingContent = {
  locale: 'en',
  ui: {
    casesIntro: '// {n} public case studies · real numbers',
    partnersIntro: '// {n} partners · {p} projects · long-term partnerships',
    projectOne: 'project',
    projectMany: 'projects',
    whoFocus: 'automation for teams that outgrew Excel',
    whoStatus: 'available · taking projects Q3 2026',
    aboutEmph: "I make sure that doesn't happen.",
    formRetry: 'error — retry',
    formSendError: "// couldn't send — reach out directly below",
    terms: 'terms',
    privacy: 'privacy',
    clockLocale: 'en-GB',
  },
  nav: [
    { label: 'Partners', href: '#partners' },
    { label: 'Work', href: '#work' },
    { label: 'Services', href: '#services' },
    { label: 'Process', href: '#process' },
    { label: 'About', href: '#who' },
    { label: 'Contact', href: '#contact' },
  ],
  ctaPortal: 'Client portal',
  ctaPrimary: 'Start a project',
  ctaSecondary: 'See work',
  hero: {
    h1: ["I'm Illia. I build automations", 'for teams that outgrew', 'Excel.'],
    sub: 'Lutsk · Ukraine · 6 years building product',
  },
  live: UA.live,
  liveLabel: 'now:',
  liveAgo: UA.liveAgo,
  services: [
    {
      num: '01',
      name: 'Integrations & APIs',
      line: "When two systems don't talk to each other.",
      examples:
        'CRM ↔ 1C · Notion ↔ Telegram · forms → internal DB · Sheets → triggered email campaigns.',
      tools: ['TypeScript', 'Node', 'Python', 'REST', 'webhooks', 'queues'],
    },
    {
      num: '02',
      name: 'AI agents & workflow',
      line: 'When you need an agent that does things, not just chats.',
      examples:
        'Support bot with your data context · analyst agent for reports · proposal generator from CRM · document processors.',
      tools: ['OpenAI', 'Anthropic', 'LangChain', 'RAG', 'vector DBs'],
    },
    {
      num: '03',
      name: 'Internal portals & CRM',
      line: "When off-the-shelf SaaS doesn't fit your process.",
      examples:
        'Order portal for clients · custom CRM matching your specifics · real-time dashboards.',
      tools: ['Next.js', 'React', 'Postgres', 'Prisma'],
    },
    {
      num: '04',
      name: 'Routine automation',
      line: 'When a human does what a script should do.',
      examples:
        'Web data parsing · template-based document generation · scheduled reports · scrapers · monitors.',
      tools: ['Python', 'n8n', 'Make', 'GitHub Actions'],
    },
  ],
  cases: [
    {
      num: '01',
      slug: 'retail-1c-integration',
      company: 'retail',
      name: '1C ↔ Telegram integration for logistics',
      year: '2025',
      duration: '6 weeks',
      context: '50 drivers dropped invoices in chat manually — no structure, errors compounding.',
      metrics: [
        '−87% order processing time',
        '+€12k additional MRR',
        '4 systems joined in one flow',
      ],
      stack: ['Next.js', 'Postgres', '1C API', 'Telegram Bot API', 'Anthropic'],
    },
    {
      num: '02',
      slug: 'ai-support-agent',
      company: 'saas',
      name: 'AI support agent for SaaS',
      year: '2024',
      duration: '4 weeks',
      context: '14h first-response time, new users churning on day three.',
      metrics: ['92% auto first response', '+24% CSAT', '~$3.2k/mo saved'],
      stack: ['Anthropic Claude', 'RAG', 'Pinecone', 'Python', 'Slack API'],
    },
    {
      num: '03',
      slug: 'custom-crm-logistics',
      company: 'logistics',
      name: 'Custom CRM for logistics operator',
      year: '2025',
      duration: '8 weeks',
      context: 'Three systems (warehouse, delivery, finance) — nightly manual sync.',
      metrics: ['400 hrs/mo saved', '3 systems → 1 portal', 'Real-time tracking'],
      stack: ['Next.js', 'Postgres', 'Prisma', 'Redis', 'Mapbox'],
    },
    {
      num: '04',
      slug: 'market-parser',
      company: 'agency',
      name: 'Market data parser for agency',
      year: '2024',
      duration: '2 weeks',
      context: 'Analyst spent 18 hours a week on manual collection.',
      metrics: ['18h → 12min daily', '+200% report cadence', '0 copy-paste errors'],
      stack: ['Python', 'Playwright', 'GitHub Actions', 'Sheets API'],
    },
    {
      num: '05',
      slug: null,
      company: 'workflo',
      name: 'Workflo',
      year: 'in development',
      duration: 'beta Q3 2026',
      context: 'Platform for teams that run on orders. Everything on one page.',
      metrics: ['240+ waitlist', '3 pilot teams', 'beta Q3 2026'],
      stack: ['Next.js', 'Postgres', 'Prisma', 'Anthropic', 'Tailwind'],
    },
  ],
  process: [
    {
      num: '01',
      name: '30-min call',
      desc: "We unpack your process, log the pains, and decide whether I'm a fit. No strings attached.",
    },
    {
      num: '02',
      name: 'Technical proposal',
      desc: "In 3–5 days — a doc with scope, tech, deadlines and fixed price. No 'time & material'.",
    },
    {
      num: '03',
      name: 'Build',
      desc: 'Weekly demo. You see progress every 7 days — no surprises. Slack or Telegram channel for the project.',
    },
    {
      num: '04',
      name: 'Launch',
      desc: 'Deploy, test with the team, train, document. First 2 weeks of support included.',
    },
    {
      num: '05',
      name: 'Support (optional)',
      desc: 'Monthly subscription for updates, monitoring, new features — if you want it. Nothing breaks without it.',
    },
  ],
  partners: UA.partners.map((p) => ({ ...p, ...PARTNERS_EN[p.slug] })),
  spotlight: {
    name: 'Workflo',
    status: 'in development · beta Q3 2026',
    desc: 'Platform for teams that run on orders. Everything on one page: orders, documents, finance, real-time status. Nothing extra.',
    market: 'Market: B2B teams of 5–50 currently holding this in Notion, Excel or a homegrown CRM.',
    ctaEmailPh: 'you@email.com',
  },
  contact: {
    h2: "Let's talk?",
    sub: "Tell me briefly about the project — I'll respond within 24 business hours.",
    send: 'Send',
    or: 'or directly',
    fName: 'Name',
    fContact: 'Telegram or email',
    fMessage: 'Project description',
    channels: UA.contact.channels,
  },
  about: [
    "I'm from Lutsk. Coding since 2018, the last 4 years automating processes for businesses that outgrew Excel.",
    'Before this: product team at a logistics startup, frontend for a Ukrainian fintech, freelance projects with EU agencies.',
    '',
    "Most teams I've seen lose 10–20 hours a week on work that should be done by a script. Someone copying data between tables, someone hand-building reports, someone typing the same email every day.",
    '',
    "I make sure that doesn't happen.",
    "Workflo is my way of giving the same capability to teams that can't afford a dedicated developer.",
  ],
  scale: {
    subtitle: 'What is shown above is the tip of the iceberg. Most projects are under NDA.',
    stats: [
      { v: '12', k: 'total projects' },
      { v: '7', k: 'companies' },
      { v: '4 years', k: 'in automation' },
      { v: '4', k: 'countries' },
      { v: '5', k: 'public case studies' },
      { v: '7', k: 'under nda' },
    ],
    ndaHead: '### under NDA · 7 projects',
    ndaHint: 'Companies not named — under NDA. References available on request.',
    nda: [
      {
        tag: 'fintech-eu',
        name: 'payment orchestrator',
        year: '2025',
        duration: '8 weeks',
        summary: 'Routing payments across 4 providers · fallback + retry',
        impact: ['sub-50ms latency p99', '4 systems unified'],
      },
      {
        tag: 'healthtech',
        name: 'booking automation',
        year: '2024',
        duration: '12 weeks',
        summary: 'Patient self-booking · 8 clinics',
        impact: ['−74% phone load', '24/7 self-service'],
      },
      {
        tag: 'b2b-saas-de',
        name: 'internal CRM',
        year: '2024',
        duration: '6 weeks',
        summary: 'Internal CRM for sales · 50 users',
        impact: ['80% adoption in 1 month'],
      },
      {
        tag: 'media-co',
        name: 'content pipeline',
        year: '2023',
        duration: '4 weeks',
        summary: 'AI rewriter pipeline · ~3k articles/mo',
        impact: ['5× output volume'],
      },
      {
        tag: 'legaltech',
        name: 'document parser',
        year: '2023',
        duration: '3 weeks',
        summary: 'Contract parser to structured data',
        impact: ['95% extraction accuracy'],
      },
      {
        tag: 'edtech-de',
        name: 'payment flow',
        year: '2023',
        duration: '5 weeks',
        summary: 'Online course payments · EUR/PLN/CZK',
        impact: ['+18% conversion'],
      },
      {
        tag: 'retail-pl',
        name: 'inventory sync',
        year: '2022',
        duration: '6 weeks',
        summary: 'Warehouse sync · 12 stores',
        impact: ['−6h/day data entry', '99.8% accuracy'],
      },
    ],
  },
}

/** ASCII hero banner — minimal cat + wordmark (design-v2 terminal-variant HERO_ASCII). */
export const HERO_ASCII = `   /\\_/\\        workflo.space
  ( ●.o )       ────────────────
   > ^ <        automation · ai · integrations`
