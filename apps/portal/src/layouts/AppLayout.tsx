import { useEffect, useMemo, useState } from 'react'
import { AnnouncementBanner } from '@workflo/app-core'
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
import { BellDropdown } from '@workflo/app-core'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/i18n'
import { PORTAL_NAV, activeNavId } from '@/config/nav'
import { useNotifications } from '@/lib/notifications'
import { SidebarCompanyMenu } from '@/components/SidebarCompanyMenu'
import { EmailVerifyBanner } from '@/components/EmailVerifyBanner'

export function AppLayout() {
  const { user, logout } = useAuth()
  const { locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const company = user?.companies.find((c) => c.id === user.activeCompanyId) ?? user?.companies[0]
  const initials = (user?.profile.displayName ?? '?').trim().slice(0, 2).toUpperCase()

  // Breadcrumbs: app root + the active section's label (design topbar crumbs).
  const activeEntry = PORTAL_NAV.find((e) => 'id' in e && e.id === activeNavId(location.pathname))
  const sectionLabel =
    activeEntry && 'label' in activeEntry && typeof activeEntry.label === 'string'
      ? activeEntry.label
      : undefined
  const crumbs = ['portal', sectionLabel]
    .filter((c): c is string => Boolean(c))
    .map((c, i) => <span key={i}>{c}</span>)

  // Unread notifications → «Інбокс» nav badge + bell dot.
  const unread = useNotifications(1).data?.meta.unreadCount ?? 0
  const navWithBadges = PORTAL_NAV.map((e) =>
    'id' in e && e.id === 'inbox' && unread > 0 ? { ...e, badge: unread, badgeAccent: true } : e
  )

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
          nav={navWithBadges}
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
      <EmailVerifyBanner />
      {/* 01-Д: акаунт із тимчасовим паролем — нагадуємо змінити. */}
      {user?.mustChangePassword && (
        <div
          className="wfp-mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            padding: '8px 14px',
            fontSize: 12,
            borderBottom: '1px solid var(--wf-border)',
            background: 'color-mix(in oklab, var(--wf-warning, #b45309) 8%, transparent)',
          }}
        >
          <span>// у вас тимчасовий пароль — змініть його для безпеки акаунта</span>
          <button
            type="button"
            className="wfp-link"
            style={{ fontSize: 12 }}
            onClick={() => navigate('/settings')}
          >
            до налаштувань →
          </button>
        </div>
      )}
      <>
        <AnnouncementBanner />
        <Outlet />
      </>
      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        commands={commands}
        placeholder="Перейти до екрана…"
      />
    </AppShell>
  )
}
