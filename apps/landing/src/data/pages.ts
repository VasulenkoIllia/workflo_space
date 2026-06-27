// pages.ts — content for the standalone landing routes (/services, /about, /contact),
// ported from design-v2 landing-marketing-data.js (UA). EN lands in the i18n slice.

export interface ServiceItem {
  slug: string
  num: string
  glyph: string
  name: string
  line: string
  summary: string
  problem: string[]
  deliverables: string[]
  stack: string[]
  examples: string
  typical: string
}

export const SERVICES_INTRO =
  'Чотири типи робіт. Не «розробка під ключ узагалі» — а конкретні задачі, які найчастіше приносять бізнеси. Клік на послугу — деталі, процес і приклади.'

export const SERVICES: ServiceItem[] = [
  {
    slug: 'integrations',
    num: '01',
    glyph: '⇄',
    name: 'Інтеграції та API',
    line: 'Коли дві системи не розмовляють між собою.',
    summary:
      'Зʼєднуємо те, що у вас вже є, щоб дані текли самі. CRM ↔ 1С, форми → база, Telegram ↔ Notion — без ручного перенесення.',
    problem: [
      'Менеджери вручну переносять дані з однієї системи в іншу.',
      'Замовлення губляться між формою, поштою й таблицею.',
      'Кожна нова інтеграція через Zapier коштує більше, ніж власний конектор.',
    ],
    deliverables: [
      'Двосторонній обмін між системами',
      'Webhook-обробники з ретраями й чергою',
      'Мапінг полів + валідація даних',
      'Лог і моніторинг збоїв',
      'Документація та доступи — ваші',
    ],
    stack: ['TypeScript', 'Node', 'Python', 'REST', 'webhooks', 'queues'],
    examples:
      'CRM ↔ 1С · Notion ↔ Telegram · форми → БД · GoogleSheets → email-розсилка з тригером.',
    typical: 'від 1–3 тижні',
  },
  {
    slug: 'ai-agents',
    num: '02',
    glyph: '✦',
    name: 'AI-агенти та workflow',
    line: 'Коли потрібен агент, який щось робить, а не просто чатить.',
    summary:
      'Агенти на ваших даних: саппорт з контекстом, аналітик звітів, генератор пропозицій. З гардами, ескалацією й вимірюваним результатом.',
    problem: [
      'Перша лінія підтримки тоне в однотипних питаннях.',
      'Звіти й пропозиції готуються руками годинами.',
      '«AI» з коробки не знає ваших даних і вигадує.',
    ],
    deliverables: [
      'Агент на вашій базі знань (RAG)',
      'Чіткі гарди + ескалація до людини',
      'Інтеграція в Telegram / портал / сайт',
      'Метрики: % автозакриття, точність',
      'Контроль вартості токенів',
    ],
    stack: ['OpenAI', 'Anthropic', 'LangChain', 'RAG', 'vector DBs'],
    examples:
      'Бот саппорту з контекстом · агент-аналітик · генератор пропозицій з CRM · processor документів.',
    typical: 'від 2–4 тижні',
  },
  {
    slug: 'portals',
    num: '03',
    glyph: '▦',
    name: 'Внутрішні портали та CRM',
    line: 'Коли готові SaaS не покривають ваші процеси.',
    summary:
      'Кастомний інструмент під ваш процес: портал замовлень, CRM під специфіку, real-time дашборд. Рівно те, що треба, без зайвого.',
    problem: [
      'Платите за 5 SaaS, а процес усе одно в Excel.',
      'Команда воює з інструментом замість роботи.',
      'Даних багато, але немає єдиної картини в реальному часі.',
    ],
    deliverables: [
      'Портал/CRM під ваш реальний процес',
      'Ролі та права (owner / member / executor)',
      'Real-time дашборд ключових метрик',
      'Мобільний-first, light + dark',
      'Хостинг і передача коду',
    ],
    stack: ['Next.js', 'React', 'Postgres', 'Prisma'],
    examples: 'Портал замовлень для клієнтів · кастомний CRM · dashboard з real-time даних.',
    typical: 'від 3–6 тижнів',
  },
  {
    slug: 'automation',
    num: '04',
    glyph: '⟳',
    name: 'Автоматизація рутини',
    line: 'Коли людина робить те, що має робити скрипт.',
    summary:
      'Парсинг, генерація документів, заплановані звіти, монітори. Забираємо повторювану рутину — звільняємо години щотижня.',
    problem: [
      'Хтось щодня копіює дані з сайтів у таблицю.',
      'Документи збираються вручну з шаблонів.',
      'Звіти готуються в кінці місяця «на колінці».',
    ],
    deliverables: [
      'Скрипти парсингу з розкладом',
      'Генерація документів із шаблонів',
      'Заплановані звіти в Telegram / пошту',
      'Монітори й алерти на збої',
      'Прозорий лог запусків',
    ],
    stack: ['Python', 'n8n', 'Make', 'GitHub Actions'],
    examples: 'Парсинг сайтів · генерація документів · заплановані звіти · scrapers · монітори.',
    typical: 'від кількох днів',
  },
]

export const serviceBySlug = (slug: string) => SERVICES.find((s) => s.slug === slug)

// ── /about ──
export interface TeamMember {
  name: string
  initials: string
  role: string
  focus: string
}

export const ABOUT = {
  intro:
    'Маленька команда, яка робить руками. Без прошарку менеджерів між вами й тим, хто пише код. Ви говорите з людьми, що відповідають за результат.',
  founder: {
    name: 'Ілля Васюленко',
    initials: 'ІВ',
    role: 'Засновник · fullstack',
    bio: [
      '8 років роблю інтеграції, портали й автоматизацію для малого та середнього бізнесу. Починав фрілансером, зараз — невелика команда під замовлення.',
      'Принцип простий: беремо задачу, де автоматизація реально економить гроші, і доводимо до робочого результату. Без vendor lock-in — увесь код і доступи ваші.',
    ],
    stats: [
      { v: '8', k: 'років досвіду' },
      { v: '40+', k: 'проєктів' },
      { v: '12', k: 'активних клієнтів' },
    ],
  },
  members: [
    {
      name: 'Олег Шевчук',
      initials: 'ОШ',
      role: 'Product · дизайн',
      focus: 'UX порталів, дизайн-система, фронт',
    },
    {
      name: 'Павло Кравець',
      initials: 'ПК',
      role: 'DevOps · інфра',
      focus: 'Деплой, моніторинг, надійність інтеграцій',
    },
    {
      name: 'Денис Бойко',
      initials: 'ДБ',
      role: 'Backend · інтеграції',
      focus: '1С, REST, черги, обробка даних',
    },
    {
      name: 'Анна Левченко',
      initials: 'АЛ',
      role: 'Контент · комунікація',
      focus: 'Кейси, блог, листування з клієнтами',
    },
  ] satisfies TeamMember[],
  principles: [
    [
      'Робимо, що економить гроші',
      'Не автоматизуємо заради автоматизації. Якщо задача не повертає вкладене — кажемо прямо.',
    ],
    [
      'Код і доступи — ваші',
      'Жодного lock-in. Усе передаємо повністю: репозиторій, документацію, паролі.',
    ],
    ['Видимість процесу', 'Ви бачите статус, години й рахунки в порталі. Без «зробимо колись».'],
    ['Людська мова', 'Пояснюємо технічне нормальними словами. Без жаргону й маркетингового шуму.'],
  ] satisfies [string, string][],
}

// ── /contact ──
export interface ContactChannel {
  kind: 'telegram' | 'mail' | 'globe'
  label: string
  value: string
  href: string
  primary?: boolean
  note: string
}

export interface ContactField {
  id: string
  label: string
  placeholder: string
  type: 'text' | 'textarea' | 'select'
  options?: string[]
}

export const CONTACT_PAGE = {
  intro:
    'Опишіть задачу — відповім протягом дня. Найшвидше в Telegram. Безкоштовний discovery-дзвінок на 30 хвилин, щоб зрозуміти, чи можу допомогти.',
  channels: [
    {
      kind: 'telegram',
      label: 'Telegram',
      value: '@workflo_space',
      href: 'https://t.me/workflo_space',
      primary: true,
      note: 'відповідь за годину',
    },
    {
      kind: 'mail',
      label: 'Email',
      value: 'hello@workflo.space',
      href: 'mailto:hello@workflo.space',
      note: 'для деталей і документів',
    },
    {
      kind: 'globe',
      label: 'Дзвінок',
      value: 'cal.com/workflo',
      href: 'https://cal.com/workflo',
      note: '30 хв · discovery',
    },
  ] satisfies ContactChannel[],
  fields: [
    { id: 'name', label: 'Як вас звати?', placeholder: 'Олена · Brunky', type: 'text' },
    {
      id: 'contact',
      label: 'Telegram або email',
      placeholder: '@olena / olena@brunky.ua',
      type: 'text',
    },
    {
      id: 'budget',
      label: 'Орієнтовний бюджет',
      placeholder: '',
      type: 'select',
      options: ['Ще не знаю', 'до $1 500', '$1 500 – $5 000', '$5 000+', 'Підписка / retainer'],
    },
    {
      id: 'task',
      label: 'Що треба зробити?',
      placeholder: 'Коротко: яка система, який результат хочете…',
      type: 'textarea',
    },
  ] satisfies ContactField[],
  reasons: [
    'Безкоштовний discovery-дзвінок',
    'Відповідь у день звернення',
    'Оцінка перед стартом, без сюрпризів',
    'NDA за потреби',
  ],
}
