import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getAccessToken, setAccessToken } from '@/lib/api'

/**
 * Agency (team) role — the CANON the workspace gates on. Mirrors the backend
 * `AgencyRole` (apps/api/src/auth/tokens.ts, enforced in can.ts). `manager` sits
 * between owner and executor: operational access without finance/settings.
 */
export type AgencyRole = 'owner' | 'manager' | 'executor'

export interface AuthCompany {
  id: string
  name: string | null
  slug: string | null
  role: 'owner' | 'member'
}

export interface AuthProfile {
  id: string
  email: string
  displayName: string
  /** UI hint only — NEVER gate on this. Workspace gates on `agencyRole`. */
  role: 'owner' | 'executor' | 'client'
  language?: string
  theme?: string
  avatarUrl?: string | null
}

export interface AuthState {
  profile: AuthProfile
  activeCompanyId?: string | null
  companies: AuthCompany[]
  // Agency/team axis (from /auth/me) — canon for workspace role gating.
  activeAgencyId?: string | null
  agencyRole?: AgencyRole | null
  agencyMemberships?: { agencyId: string; role: AgencyRole }[]
}

interface AuthContextValue {
  user: AuthState | null
  loading: boolean
  /** Active agency (team) role — canon for gating. Null if not agency staff. */
  role: AgencyRole | null
  /** Convenience role flags derived from `agencyRole` (owner | manager | executor). */
  isOwner: boolean
  isManager: boolean
  isExecutor: boolean
  isInternal: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  reload: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setUser(await api.get<AuthState>('/auth/me'))
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<{ accessToken: string }>('/auth/login', { email, password })
      setAccessToken(data.accessToken)
      await reload()
    },
    [reload]
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {})
    } catch {
      /* ignore — clear local state regardless */
    }
    setAccessToken(null)
    setUser(null)
  }, [])

  // Restore session on mount: refresh (httpOnly cookie) → /auth/me.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // StrictMode mounts effects twice in dev; if the first pass already
        // obtained a token, skip refresh (token rotation would 401 the 2nd call).
        if (!getAccessToken()) {
          const data = await api.post<{ accessToken: string }>('/auth/refresh')
          setAccessToken(data.accessToken)
        }
        const me = await api.get<AuthState>('/auth/me')
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Gate on the AGENCY role (canon), not profile.role (a UI hint). isInternal = is agency staff.
  const role = user?.agencyRole ?? null
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      role,
      isOwner: role === 'owner',
      isManager: role === 'manager',
      isExecutor: role === 'executor',
      isInternal: role != null,
      login,
      logout,
      reload,
    }),
    [user, loading, role, login, logout, reload]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
