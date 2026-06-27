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
}

/** ASCII hero banner — minimal cat + wordmark (design-v2 terminal-variant HERO_ASCII). */
export const HERO_ASCII = `   /\\_/\\        workflo.space
  ( ●.o )       ────────────────
   > ^ <        automation · ai · integrations`
