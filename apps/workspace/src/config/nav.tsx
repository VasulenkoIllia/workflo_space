import { Icon, type SidebarNavEntry } from '@workflo/ui'
import type { AgencyRole } from '@/contexts/AuthContext'

/** Role char used in nav `roles` tags (design-v2 ia-roles): o=owner, m=manager, x=executor. */
const ROLE_CHAR: Record<AgencyRole, string> = { owner: 'o', manager: 'm', executor: 'x' }

/** A workspace nav entry may carry an optional `roles` tag (a subset of 'omx'). */
type WsNavEntry = SidebarNavEntry & { roles?: string }

/**
 * Single role-tagged workspace nav (design-v2 WORKSPACE_NAV shape — see
 * `DESIGN_SYSTEM.md §5.13.1` + `FRONTEND_STANDARDS` «Рольова навігація»). Items and group
 * headers carry a `roles` tag (o/m/x); `navVisibleForRole` filters by the active AgencyRole
 * and prunes empty group headers. Only screens that exist today are listed — the full design
 * nav (board, projects, leads, billing hub, …) lands with its Wave-1 screens.
 *
 * NOTE: design tags `orders`/`clients` as part of the operational set. `orders` is 'omx' in
 * the design (executor sees their own); kept 'om' here until the executor-scoped orders screen
 * exists (executor currently uses the personal dashboard).
 */
export const WORKSPACE_NAV: WsNavEntry[] = [
  { id: 'dashboard', label: 'Дашборд', icon: <Icon name="home" />, href: '/', roles: 'omx' },

  { group: 'Робота', roles: 'om' },
  { id: 'orders', label: 'Замовлення', icon: <Icon name="kanban" />, href: '/orders', roles: 'om' },

  { group: 'Клієнти', roles: 'om' },
  {
    id: 'clients',
    label: 'Клієнти',
    icon: <Icon name="building" />,
    href: '/clients',
    roles: 'om',
  },

  { group: 'Фінанси', roles: 'o' },
  { id: 'billing', label: 'Рахунки', icon: <Icon name="receipt" />, href: '/billing', roles: 'o' },
  {
    id: 'projects',
    label: 'Фін-проєкти',
    icon: <Icon name="list" />,
    href: '/projects',
    roles: 'o',
  },
  {
    id: 'finance',
    label: 'P&L і витрати',
    icon: <Icon name="file" />,
    href: '/finance',
    roles: 'o',
  },
  { id: 'payouts', label: 'Виплати', icon: <Icon name="users" />, href: '/payouts', roles: 'o' },
  {
    id: 'services',
    label: 'Каталог послуг',
    icon: <Icon name="star" />,
    href: '/services',
    roles: 'o',
  },
  {
    id: 'admin-wallet',
    label: 'Бонусні гаманці',
    icon: <Icon name="coins" />,
    href: '/admin-wallet',
    roles: 'o',
  },

  { group: 'Команда', roles: 'om' },
  { id: 'team', label: 'Команда', icon: <Icon name="users" />, href: '/team', roles: 'om' },

  { group: 'Акаунт', roles: 'omx' },
  { id: 'profile', label: 'Профіль', icon: <Icon name="users" />, href: '/profile', roles: 'omx' },
  // NOTE: no workspace /settings screen exists yet (only Profile). The nav lists built screens
  // only — re-add when the settings screen lands. The /settings route still renders a placeholder.
]

/**
 * Filter the nav for an agency role (ports design-v2 `navVisibleForRole`): keep entries with
 * no `roles` tag or whose tag includes the role char, then drop group headers left with no
 * following item. Filtered app-side so the shared `@workflo/ui` Sidebar stays presentational.
 */
export function navVisibleForRole(
  items: WsNavEntry[],
  role: AgencyRole | null | undefined
): SidebarNavEntry[] {
  const rc = role ? ROLE_CHAR[role] : 'o'
  const kept = items.filter((it) => !it.roles || it.roles.includes(rc))
  return kept.filter((it, i) => {
    if (!('group' in it)) return true
    const nx = kept[i + 1]
    return !!nx && !('group' in nx)
  })
}

/** Resolve the active nav id from the current pathname (matches first path segment). */
export function activeNavId(pathname: string, nav: SidebarNavEntry[]): string {
  const seg = '/' + (pathname.split('/')[1] ?? '')
  const found = nav.find((e) => 'href' in e && e.href === seg)
  if (found && 'id' in found) return found.id
  return 'dashboard'
}
