// content.ts — UA landing copy, ported from design-v2 data.js (BRIEF.md v2.0).
// EN + remaining sections land in later S7 slices; slice 1 ships the homepage shell + hero.

export interface LandingContent {
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
}

export const UA: LandingContent = {
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
}

/** ASCII hero banner — minimal cat + wordmark (design-v2 terminal-variant HERO_ASCII). */
export const HERO_ASCII = `   /\\_/\\        workflo.space
  ( ●.o )       ────────────────
   > ^ <        automation · ai · integrations`
