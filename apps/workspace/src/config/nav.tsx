import type { PermissionKey } from '@workflo/types'
import { Icon, type SidebarNavEntry } from '@workflo/ui'
import type { AgencyRole } from '@/contexts/AuthContext'

/** Role char used in nav `roles` tags (design-v2 ia-roles): o=owner, m=manager, x=executor. */
const ROLE_CHAR: Record<AgencyRole, string> = { owner: 'o', manager: 'm', executor: 'x' }

/** A workspace nav entry may carry an optional `roles` tag (a subset of 'omx') або — PERM-6 —
 *  `perm`: видимо, якщо є хоча б одне з прав (має пріоритет над `roles`). */
type WsNavEntry = SidebarNavEntry & { roles?: string; perm?: PermissionKey[] }

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
  { id: 'inbox', label: 'Інбокс', icon: <Icon name="inbox" />, href: '/inbox', roles: 'omx' },

  { group: 'Робота' },
  {
    id: 'orders',
    label: 'Замовлення',
    icon: <Icon name="kanban" />,
    href: '/orders',
    perm: ['orders.view'],
  },
  { id: 'board', label: 'Дошка задач', icon: <Icon name="kanban" />, href: '/board', roles: 'omx' },
  // design-v2: «Проєкти» — у «Робота» (раніше «Фін-проєкти» у Фінансах)
  {
    id: 'projects',
    label: 'Проєкти',
    icon: <Icon name="list" />,
    href: '/projects',
    perm: ['projects.view'],
  },
  // 18-А: єдиний хаб розмов (клієнт → замовлення), unread-бейджі всередині
  { id: 'chats', label: 'Чати', icon: <Icon name="inbox" />, href: '/chats', roles: 'omx' },
  // COV-UX-2: сторінка існувала з CAL-MVP, але в nav не була — досяжна лише прямим URL
  {
    id: 'calendar',
    label: 'Календар',
    icon: <Icon name="calendar" />,
    href: '/calendar',
    roles: 'omx',
  },
  {
    id: 'support',
    label: 'Підтримка',
    icon: <Icon name="inbox" />,
    href: '/support',
    roles: 'omx',
  },

  // 'omx': executor reaches «Секрети» (17-SHARE) under this group; clients/leads stay 'om'.
  { group: 'Клієнти' },
  {
    id: 'clients',
    label: 'Клієнти',
    icon: <Icon name="building" />,
    href: '/clients',
    perm: ['clients.view'],
  },
  {
    id: 'leads',
    label: 'Ліди',
    icon: <Icon name="users" />,
    href: '/leads',
    perm: ['leads.manage'],
  },
  // Credentials vault (17-ГЛОБАЛ + 17-SHARE): owner = all; executor = їхні розшарені секрети.
  { id: 'vault', label: 'Секрети', icon: <Icon name="lock" />, href: '/vault', roles: 'ox' },

  // DEDUP C9 (design-v2 WORKSPACE_NAV): Фінанси · Аналітика · Сайт і контент — замість
  // однієї групи на 10 пунктів
  { group: 'Фінанси' },
  {
    id: 'billing',
    label: 'Рахунки',
    icon: <Icon name="receipt" />,
    href: '/billing',
    perm: ['billing.view'],
  },
  {
    id: 'payouts',
    label: 'Виплати',
    icon: <Icon name="users" />,
    href: '/payouts',
    perm: ['payouts.manage', 'payouts.view_team'],
  },
  {
    id: 'services',
    label: 'Каталог послуг',
    icon: <Icon name="star" />,
    href: '/services',
    perm: ['settings.catalogs'],
  },
  {
    id: 'admin-wallet',
    label: 'Бонусні гаманці',
    icon: <Icon name="coins" />,
    href: '/admin-wallet',
    perm: ['billing.view'],
  },

  { group: 'Аналітика' },
  {
    id: 'finance',
    label: 'P&L і витрати',
    icon: <Icon name="file" />,
    href: '/finance',
    perm: ['finance.view'],
  },
  {
    id: 'margin',
    label: 'Маржа',
    icon: <Icon name="kanban" />,
    href: '/margin',
    perm: ['finance.view'],
  },
  {
    id: 'reports',
    label: 'Звіти',
    icon: <Icon name="receipt" />,
    href: '/reports',
    perm: ['reports.ops', 'finance.view', 'reports.audit'],
  },

  { group: 'Сайт і контент' },
  // S7-05 міні-CMS: блог + кейси лендінга (owner)
  {
    id: 'content',
    label: 'Контент',
    icon: <Icon name="file" />,
    href: '/content',
    perm: ['content.manage'],
  },

  { group: 'Команда', roles: 'omx' },
  // TEAM-ADMIN-2 + ROLE-NAV: 'omx' — виконавець бачить свій підрозділ (read-only)
  { id: 'team', label: 'Команда', icon: <Icon name="users" />, href: '/team', roles: 'omx' },
  // S13-04: відсутності — заявки/баланс у всіх, погодження в owner/manager
  {
    id: 'leave',
    label: 'Відсутності',
    icon: <Icon name="calendar" />,
    href: '/leave',
    roles: 'omx',
  },

  { group: 'Акаунт', roles: 'omx' },
  { id: 'profile', label: 'Профіль', icon: <Icon name="users" />, href: '/profile', roles: 'omx' },
  // DSN-7: хаб сповіщень (оголошення/розсилки, дайджест, пороги — за правами; канали й тест — усім)
  {
    id: 'notifications',
    label: 'Сповіщення',
    icon: <Icon name="bell" />,
    href: '/notifications',
    roles: 'omx',
  },
  // Settings: owner — конфіг агенції (6 табів); інші ролі — таб «Акаунт» (сповіщення,
  // Telegram, сесії). ROLE-NAV (аудит D6): раніше owner-only → нікому більше ніде.
  {
    id: 'settings',
    label: 'Налаштування',
    icon: <Icon name="settings" />,
    href: '/settings',
    roles: 'omx',
  },
]

/**
 * Filter the nav for an agency role (ports design-v2 `navVisibleForRole`): keep entries with
 * no `roles` tag or whose tag includes the role char, then drop group headers left with no
 * following item. Filtered app-side so the shared `@workflo/ui` Sidebar stays presentational.
 */
export function navVisibleForRole(
  items: WsNavEntry[],
  role: AgencyRole | null | undefined,
  can?: (key: PermissionKey) => boolean
): SidebarNavEntry[] {
  const rc = role ? ROLE_CHAR[role] : 'o'
  const kept = items.filter((it) => {
    // PERM-6: право (хоча б одне) має пріоритет над рольовим тегом
    if (it.perm && can) return it.perm.some((k) => can(k))
    return !it.roles || it.roles.includes(rc)
  })
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
