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
}

/** ASCII hero banner — minimal cat + wordmark (design-v2 terminal-variant HERO_ASCII). */
export const HERO_ASCII = `   /\\_/\\        workflo.space
  ( ●.o )       ────────────────
   > ^ <        automation · ai · integrations`
