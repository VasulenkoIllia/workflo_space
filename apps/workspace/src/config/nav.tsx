import { Icon, type SidebarNavEntry } from '@workflo/ui'

type WorkspaceRole = 'owner' | 'executor'

/** Owner sidebar — full agency cockpit (orders, clients, team). */
export const OWNER_NAV: SidebarNavEntry[] = [
  { id: 'dashboard', label: 'Огляд', icon: <Icon name="home" />, href: '/' },
  { id: 'orders', label: 'Замовлення', icon: <Icon name="kanban" />, href: '/orders' },
  { id: 'clients', label: 'Клієнти', icon: <Icon name="building" />, href: '/clients' },
  { group: 'Команда' },
  { id: 'team', label: 'Команда', icon: <Icon name="users" />, href: '/team' },
  { id: 'settings', label: 'Налаштування', icon: <Icon name="settings" />, href: '/settings' },
]

/** Executor sidebar — personal task board + profile. */
export const EXECUTOR_NAV: SidebarNavEntry[] = [
  { id: 'dashboard', label: 'Мої задачі', icon: <Icon name="kanban" />, href: '/' },
  { group: 'Акаунт' },
  { id: 'profile', label: 'Профіль', icon: <Icon name="users" />, href: '/profile' },
  { id: 'settings', label: 'Налаштування', icon: <Icon name="settings" />, href: '/settings' },
]

export function navForRole(role: WorkspaceRole | undefined): SidebarNavEntry[] {
  return role === 'owner' ? OWNER_NAV : EXECUTOR_NAV
}

/** Resolve the active nav id from the current pathname (matches first path segment). */
export function activeNavId(pathname: string, nav: SidebarNavEntry[]): string {
  const seg = '/' + (pathname.split('/')[1] ?? '')
  const found = nav.find((e) => 'href' in e && e.href === seg)
  if (found && 'id' in found) return found.id
  return 'dashboard'
}
