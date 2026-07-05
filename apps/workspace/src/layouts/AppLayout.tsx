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
import { BellDropdown, TwoFactorSection } from '@workflo/app-core'
import { refreshAccessToken } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/i18n'
import { navVisibleForRole, activeNavId, WORKSPACE_NAV } from '@/config/nav'
import { useOrders } from '@/lib/orders'
import { useGlobalSearch } from '@/lib/search'
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
  // S11-02: серверний пошук у палітрі (debounce на рівні keystroke → state, query кешується)
  const [searchQ, setSearchQ] = useState('')
  const search = useGlobalSearch(cmdkOpen ? searchQ : '')
  const asyncItems = useMemo<CommandItem[]>(() => {
    const d = search.data
    if (!d) return []
    return [
      ...d.orders.map((o) => ({
        id: `s-order-${o.id}`,
        group: 'замовлення',
        label: o.title,
        icon: <Icon name="kanban" size={13} />,
        run: () => navigate(`/orders/${o.id}`),
      })),
      ...d.companies.map((c) => ({
        id: `s-company-${c.id}`,
        group: 'клієнти',
        label: c.name,
        icon: <Icon name="building" size={13} />,
        run: () => navigate(`/clients/${c.id}`),
      })),
      ...d.leads.map((l) => ({
        id: `s-lead-${l.id}`,
        group: 'ліди',
        label: l.name,
        icon: <Icon name="users" size={13} />,
        run: () => navigate(`/leads/${l.id}`),
      })),
      ...d.projects.map((p) => ({
        id: `s-project-${p.id}`,
        group: 'проєкти',
        label: p.name,
        icon: <Icon name="receipt" size={13} />,
        run: () => navigate(`/projects/${p.id}`),
      })),
    ]
  }, [search.data, navigate])
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
      {/* 2FA-POLICY: grace banner → forced setup once the deadline passes (the API gate
          already 403s everything except /auth/*, so this screen is the only useful one). */}
      {user?.twoFactorSetup?.blocking ? (
        <ForcedTwoFactorSetup />
      ) : (
        <>
          {user?.twoFactorSetup?.required && (
            <div
              className="wfp-mono"
              style={{
                fontSize: 12,
                padding: '8px 12px',
                marginBottom: 14,
                border: '1px solid var(--wf-warning, #b45309)',
                borderRadius: 'var(--wf-radius)',
                color: 'var(--wf-warning, #b45309)',
              }}
            >
              // агенція вимагає 2FA — налаштуйте до{' '}
              {user.twoFactorSetup.deadline
                ? new Date(user.twoFactorSetup.deadline).toLocaleDateString('uk-UA')
                : '—'}{' '}
              у{' '}
              <button
                type="button"
                className="wfp-link"
                style={{ fontSize: 12 }}
                onClick={() => navigate('/profile')}
              >
                Профілі
              </button>
              , інакше вхід буде заблоковано
            </div>
          )}
          {/* 01-Д: акаунт із тимчасовим паролем — нагадуємо змінити. */}
          {user?.mustChangePassword && (
            <div
              className="wfp-mono"
              style={{
                fontSize: 12,
                padding: '8px 12px',
                marginBottom: 14,
                border: '1px solid var(--wf-warning, #b45309)',
                borderRadius: 'var(--wf-radius)',
                color: 'var(--wf-warning, #b45309)',
              }}
            >
              // у вас тимчасовий пароль — змініть його у{' '}
              <button
                type="button"
                className="wfp-link"
                style={{ fontSize: 12 }}
                onClick={() => navigate('/profile')}
              >
                Профілі
              </button>
            </div>
          )}
          <Outlet />
        </>
      )}
      <TimerBar />
      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        commands={commands}
        asyncItems={asyncItems}
        onQueryChange={setSearchQ}
        placeholder="Пошук: замовлення, клієнти, ліди, проєкти…"
      />
    </AppShell>
  )
}

/** 2FA-POLICY forced-setup screen: shown instead of the app once the grace expired.
 * The API gate already limits the session to /auth/* — the 2FA setup endpoints live
 * there, so the setup card works; «Продовжити» rotates the token (drops tfaDue) and
 * reloads the session. */
function ForcedTwoFactorSetup() {
  const { reload } = useAuth()
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">// політика безпеки агенції</div>
          <h1 className="wfp-ph-h1">Потрібна двофакторна автентифікація</h1>
        </div>
      </div>
      <div
        className="wfp-mono"
        style={{ fontSize: 12, color: 'var(--wf-fg-muted)', marginBottom: 16 }}
      >
        // грейс-період минув — доступ до workspace відновиться одразу після налаштування 2FA
      </div>
      <TwoFactorSection app="workspace" />
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="wfp-link"
          onClick={() => {
            void (async () => {
              await refreshAccessToken()
              await reload()
              window.location.assign('/')
            })()
          }}
        >
          Я налаштував 2FA — продовжити →
        </button>
      </div>
    </div>
  )
}
