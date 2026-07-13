import { Icon, type SidebarNavEntry } from '@workflo/ui'

/**
 * Portal sidebar navigation — synced to the design-v2 PORTAL_NAV grouping
 * (`DESIGN_SYSTEM.md §5.13.1`). Unfiltered: the portal has no role-gated nav (a
 * company switcher lives in the footer). New destinations render Placeholder
 * until their feature wave. Phase-3 items (help, tour — `DESIGN_TODO §3`) omitted.
 */
export const PORTAL_NAV: SidebarNavEntry[] = [
  { id: 'inbox', label: 'Інбокс', icon: <Icon name="inbox" />, href: '/inbox' },
  { id: 'orders', label: 'Замовлення', icon: <Icon name="list" />, href: '/orders' },
  // 18-А: всі чати моїх замовлень одним списком
  { id: 'chats', label: 'Чати', icon: <Icon name="inbox" />, href: '/chats' },
  { id: 'projects', label: 'Проєкти', icon: <Icon name="kanban" />, href: '/projects' },

  { group: 'Фінанси' },
  { id: 'billing', label: 'Рахунки й борг', icon: <Icon name="receipt" />, href: '/billing' },
  { id: 'documents', label: 'Документи', icon: <Icon name="file" />, href: '/documents' },
  { id: 'wallet', label: 'Гаманець', icon: <Icon name="coins" />, href: '/wallet' },

  { group: 'Бонуси' },
  { id: 'loyalty', label: 'Лояльність', icon: <Icon name="star" />, href: '/loyalty' },
  { id: 'referrals', label: 'Реферали', icon: <Icon name="gift" />, href: '/referrals' },

  { group: 'Компанія' },
  { id: 'company', label: 'Моя компанія', icon: <Icon name="building" />, href: '/company' },
  { id: 'team', label: 'Учасники', icon: <Icon name="users" />, href: '/team' },

  { group: 'Налаштування' },
  { id: 'secrets', label: 'Секрети', icon: <Icon name="lock" />, href: '/secrets' },
  // «Інтеграції» приберано з nav до модуля 27 (рішення власника 07.07 — відкладено);
  // COV-PRT-1: пункт вів на Placeholder «Розділ у розробці».
  {
    id: 'settings',
    label: 'Налаштування акаунта',
    icon: <Icon name="settings" />,
    href: '/settings',
  },

  { group: 'Підтримка' },
  { id: 'support', label: 'Підтримка', icon: <Icon name="inbox" />, href: '/support' },
  { id: 'calendar', label: 'Зустрічі', icon: <Icon name="file" />, href: '/calendar' },
]

/**
 * Resolve the active nav id by the LONGEST matching href prefix, so nested paths
 * (e.g. `/settings/integrations`) resolve to their own item rather than a shorter
 * sibling (`/settings`). Falls back to 'orders'.
 */
export function activeNavId(pathname: string): string {
  let best: { id: string; href: string } | null = null
  for (const e of PORTAL_NAV) {
    if ('href' in e && e.href && (pathname === e.href || pathname.startsWith(e.href + '/'))) {
      if (!best || e.href.length > best.href.length) best = { id: e.id, href: e.href }
    }
  }
  return best?.id ?? 'orders'
}
