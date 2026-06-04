import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppShell, Sidebar, Topbar, Icon } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/i18n'
import { PORTAL_NAV, activeNavId } from '@/config/nav'

export function AppLayout() {
  const { user, logout } = useAuth()
  const { locale, setLocale } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const company = user?.companies.find((c) => c.id === user.activeCompanyId) ?? user?.companies[0]
  const initials = (user?.profile.displayName ?? '?').trim().slice(0, 2).toUpperCase()

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
        <div className="wfp-sb-company-avatar">{(company?.name ?? 'W').slice(0, 1)}</div>
        <div className="wfp-sb-company-meta">
          <div className="wfp-sb-company-name">{company?.name ?? 'workflo'}</div>
          <div className="wfp-sb-company-role">
            <span>{company?.role ?? user?.profile.role}</span>
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
          onSearch={() => {}}
          onBell={() => {}}
          actions={
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
          }
        />
      }
    >
      <Outlet />
    </AppShell>
  )
}
