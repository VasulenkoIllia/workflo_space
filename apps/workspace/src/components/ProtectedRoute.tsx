import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Button } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'

function Centered({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        height: '100%',
        color: 'var(--wf-fg-muted)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        textAlign: 'center',
        padding: 24,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Gate for the whole workspace: must be authenticated AND part of the internal
 * team (owner | executor). Clients belong in the portal, not the workspace.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, isInternal, logout } = useAuth()
  const location = useLocation()

  if (loading) return <Centered>// завантаження…</Centered>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (!isInternal) {
    // Authenticated but a client account — no workspace access.
    return (
      <Centered>
        <div>
          <div style={{ color: 'var(--wf-fg)', fontSize: 15, marginBottom: 6 }}>
            Немає доступу до кабінету команди
          </div>
          // цей розділ лише для команди агенції. Клієнтський кабінет — portal.workflo.space
        </div>
        <Button variant="ghost" onClick={() => void logout()}>
          Вийти
        </Button>
      </Centered>
    )
  }

  return <>{children}</>
}

/** Restrict a route to specific roles (e.g. owner-only). Others bounce to home. */
export function RoleRoute({
  allow,
  children,
}: {
  allow: Array<'owner' | 'executor'>
  children: ReactNode
}) {
  const { user, loading } = useAuth()
  // Defensive: usually nested under <ProtectedRoute> (which holds until resolved),
  // but guard `loading` so a standalone use never flashes a wrong redirect.
  if (loading) return <Centered>// завантаження…</Centered>
  const role = user?.profile.role
  if (role !== 'owner' && role !== 'executor') return <Navigate to="/" replace />
  if (!allow.includes(role)) return <Navigate to="/" replace />
  return <>{children}</>
}
