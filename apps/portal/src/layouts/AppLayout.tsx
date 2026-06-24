import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppShell,
  CommandPalette,
  Sidebar,
  Topbar,
  useTheme,
  type CommandItem,
  type ThemeMode,
} from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/i18n'
import { PORTAL_NAV, activeNavId } from '@/config/nav'
import { SidebarCompanyMenu } from '@/components/SidebarCompanyMenu'

export function AppLayout() {
  const { user, logout } = useAuth()
  const { locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const company = user?.companies.find((c) => c.id === user.activeCompanyId) ?? user?.companies[0]
  const initials = (user?.profile.displayName ?? '?').trim().slice(0, 2).toUpperCase()

  const nextTheme: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }
  const themeGlyph: Record<ThemeMode, string> = { system: '◐', light: '☀', dark: '☾' }
  const themeTitle: Record<ThemeMode, string> = {
    system: 'Тема: системна',
    light: 'Тема: світла',
    dark: 'Тема: темна',
  }

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
    for (const e of PORTAL_NAV) {
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
  }, [navigate])

  const roleLabel =
    company?.role === 'owner'
      ? 'власник'
      : company?.role === 'member'
        ? 'учасник'
        : (user?.profile.role ?? '')
  const footer = (
    <SidebarCompanyMenu
      companyName={company?.name ?? 'workflo'}
      roleLabel={roleLabel}
      items={[
        { label: 'Моя компанія', onClick: () => navigate('/company') },
        { label: 'Налаштування', onClick: () => navigate('/settings') },
        { label: 'Вийти', danger: true, onClick: () => void logout() },
      ]}
    />
  )

  return (
    <AppShell
      kind="portal"
      aesthetic="A"
      windowTitle="portal.workflo.space — bash"
      statusBarRight={<span>{location.pathname}</span>}
      sidebar={
        <Sidebar
          nav={PORTAL_NAV}
          active={activeNavId(location.pathname)}
          aesthetic="A"
          sub="portal"
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
