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
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/i18n'
import { navVisibleForRole, activeNavId, WORKSPACE_NAV } from '@/config/nav'

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
    <div className="wfp-sb-foot">
      <button
        type="button"
        className="wfp-sb-company"
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 0,
          cursor: 'pointer',
        }}
        onClick={() => void logout()}
        title="Вийти"
      >
        <div className="wfp-sb-company-avatar">{initials.slice(0, 1)}</div>
        <div className="wfp-sb-company-meta">
          <div className="wfp-sb-company-name">{name}</div>
          <div className="wfp-sb-company-role">
            <span>{ROLE_LABEL[role ?? ''] ?? role}</span>
            <span>·</span>
            <span className="wfp-sb-company-role-tier">вийти</span>
          </div>
        </div>
        <span className="wfp-sb-company-chev">
          <Icon name="chevron" size={14} />
        </span>
      </button>
    </div>
  )

  return (
    <AppShell
      kind="workspace"
      aesthetic="A"
      windowTitle="work.workflo.space — bash"
      statusBarRight={<span>{location.pathname}</span>}
      sidebar={
        <Sidebar
          nav={nav}
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
          onSearch={() => setCmdkOpen(true)}
          onBell={() => {}}
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
      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        commands={commands}
        placeholder="Перейти до екрана…"
      />
    </AppShell>
  )
}
