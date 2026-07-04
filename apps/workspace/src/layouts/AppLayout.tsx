import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppShell,
  CommandPalette,
  Sidebar,
  Topbar,
  Icon,
  useTheme,
  type CommandItem,
  type ThemeMode,
} from '@workflo/ui'
import { SidebarUserMenu } from '@/components/SidebarUserMenu'
import { TimerBar } from '@/components/TimerBar'
import { BellDropdown } from '@workflo/app-core'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/i18n'
import { navVisibleForRole, activeNavId, WORKSPACE_NAV } from '@/config/nav'
import { useOrders } from '@/lib/orders'
import { useNotifications } from '@/lib/notifications'

const ROLE_LABEL: Record<string, string> = {
  owner: 'власник',
  manager: 'менеджер',
  executor: 'виконавець',
}

export function AppLayout() {
  const { user, role, isOwner, logout } = useAuth()
  const { locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // Cycle system → light → dark → system (workspace follows the OS by default; this lets the
  // user pin a mode, persisted via ThemeProvider's localStorage).
  const nextTheme: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }
  const themeGlyph: Record<ThemeMode, string> = { system: '◐', light: '☀', dark: '☾' }
  const themeTitle: Record<ThemeMode, string> = {
    system: 'Тема: системна',
    light: 'Тема: світла',
    dark: 'Тема: темна',
  }

  const nav = navVisibleForRole(WORKSPACE_NAV, role)

  // Breadcrumbs: app root + the active section's label (design topbar crumbs).
  const activeEntry = nav.find((e) => 'id' in e && e.id === activeNavId(location.pathname, nav))
  const sectionLabel =
    activeEntry && 'label' in activeEntry && typeof activeEntry.label === 'string'
      ? activeEntry.label
      : undefined
  const crumbs = ['work', sectionLabel]
    .filter((c): c is string => Boolean(c))
    .map((c, i) => <span key={i}>{c}</span>)

  // Sidebar badges: new (un-triaged) orders on «Замовлення», unread notifications on «Інбокс».
  const newCount = useOrders({ status: 'new', limit: 100 }).data?.orders.length ?? 0
  const unread = useNotifications(1).data?.meta.unreadCount ?? 0
  const navWithBadges = nav.map((e) => {
    if (!('id' in e)) return e
    if (e.id === 'orders' && newCount > 0) return { ...e, badge: newCount, badgeAccent: true }
    if (e.id === 'inbox' && unread > 0) return { ...e, badge: unread, badgeAccent: true }
    return e
  })

  // ── ⌘K command palette ──────────────────────────────────────────────────
  const [cmdkOpen, setCmdkOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdkOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = []
    for (const e of nav) {
      if ('id' in e && e.href) {
        const href = e.href
        items.push({
          id: e.id,
          group: 'екрани',
          label: typeof e.label === 'string' ? e.label : e.id,
          icon: e.icon,
          run: () => navigate(href),
        })
      }
    }
    return items
  }, [nav, navigate])
  const name = user?.profile.displayName ?? '—'
  const initials = name.trim().slice(0, 2).toUpperCase()

  const footer = (
    <SidebarUserMenu
      name={name}
      roleLabel={ROLE_LABEL[role ?? ''] ?? role ?? ''}
      items={[
        {
          label: 'Профіль',
          icon: <Icon name="users" size={13} />,
          onClick: () => navigate('/profile'),
        },
        ...(isOwner
          ? [
              {
                label: 'Налаштування',
                icon: <Icon name="settings" size={13} />,
                onClick: () => navigate('/settings'),
              },
            ]
          : []),
        {
          label: 'Вийти',
          icon: <Icon name="close" size={13} />,
          onClick: () => void logout(),
          danger: true,
        },
      ]}
    />
  )

  return (
    <AppShell
      kind="workspace"
      aesthetic="A"
      windowTitle="work.workflo.space — bash"
      statusBarRight={<span>{location.pathname}</span>}
      sidebar={
        <Sidebar
          nav={navWithBadges}
          active={activeNavId(location.pathname, nav)}
          aesthetic="A"
          sub={isOwner ? 'workspace · owner' : 'workspace'}
          footer={footer}
          onNavigate={(_, href) => href && navigate(href)}
        />
      }
      topbar={
        <Topbar
          avatar={initials}
          crumbs={crumbs}
          onSearch={() => setCmdkOpen(true)}
          bellPanel={(close) => (
            <BellDropdown close={close} onOpenInbox={() => navigate('/inbox')} />
          )}
          bellDot={unread > 0}
          actions={
            <>
              <button
                type="button"
                className="wfp-iconbtn"
                onClick={() => setTheme(nextTheme[theme])}
                title={themeTitle[theme]}
                style={{ width: 'auto', padding: '0 8px', fontSize: 14 }}
              >
                {themeGlyph[theme]}
              </button>
              <button
                type="button"
                className="wfp-iconbtn"
                onClick={() => setLocale(locale === 'uk' ? 'en' : 'uk')}
                title="Змінити мову"
                style={{
                  width: 'auto',
                  padding: '0 8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                }}
              >
                {locale.toUpperCase()}
              </button>
            </>
          }
        />
      }
    >
      <Outlet />
      <TimerBar />
      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        commands={commands}
        placeholder="Перейти до екрана…"
      />
    </AppShell>
  )
}
