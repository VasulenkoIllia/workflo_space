import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getAccessToken, setAccessToken } from '@/lib/api'

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
  role: 'owner' | 'executor' | 'client'
  language?: string
  theme?: string
  avatarUrl?: string | null
}

export interface AuthState {
  profile: AuthProfile
  activeCompanyId?: string | null
  companies: AuthCompany[]
}

interface AuthContextValue {
  user: AuthState | null
  loading: boolean
  /** Convenience role flags (workspace = internal team: owner | executor). */
  isOwner: boolean
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

  const role = user?.profile.role
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isOwner: role === 'owner',
      isExecutor: role === 'executor',
      isInternal: role === 'owner' || role === 'executor',
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
