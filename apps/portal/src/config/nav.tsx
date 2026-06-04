import { Icon, type SidebarNavEntry } from '@workflo/ui'

/** Portal sidebar navigation (app-specific config). */
export const PORTAL_NAV: SidebarNavEntry[] = [
  { id: 'orders', label: 'Замовлення', icon: <Icon name="list" />, href: '/orders' },
  { id: 'billing', label: 'Фінанси', icon: <Icon name="receipt" />, href: '/billing' },
  { id: 'wallet', label: 'Гаманець', icon: <Icon name="coins" />, href: '/wallet' },
  { id: 'documents', label: 'Документи', icon: <Icon name="file" />, href: '/documents' },
  { group: 'Бонуси' },
  { id: 'loyalty', label: 'Лояльність', icon: <Icon name="star" />, href: '/loyalty' },
  { id: 'referrals', label: 'Реферали', icon: <Icon name="gift" />, href: '/referrals' },
  { group: 'Команда' },
  { id: 'team', label: 'Учасники', icon: <Icon name="users" />, href: '/team' },
  { id: 'support', label: 'Підтримка', icon: <Icon name="inbox" />, href: '/support' },
  { id: 'settings', label: 'Налаштування', icon: <Icon name="settings" />, href: '/settings' },
]

/** Resolve the active nav id from the current pathname (matches first path segment). */
export function activeNavId(pathname: string): string {
  const seg = '/' + (pathname.split('/')[1] ?? '')
  const found = PORTAL_NAV.find((e) => 'href' in e && e.href === seg)
  return found && 'id' in found ? found.id : 'orders'
}
