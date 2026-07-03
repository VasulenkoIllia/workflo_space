import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getAccessToken, setAccessToken } from '@/lib/api'

export interface AuthCompany {
  id: string
  name: string
  slug: string
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
  activeCompanyId?: string
  companies: AuthCompany[]
}

interface AuthContextValue {
  user: AuthState | null
  loading: boolean
  /** Password step. `twoFactorRequired` → caller shows the code step and calls verifyTwoFactor. */
  login: (email: string, password: string) => Promise<{ twoFactorRequired: boolean }>
  /** 2FA step: exchange the challenge + code for a session. */
  verifyTwoFactor: (code: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  reload: () => Promise<void>
}

export interface RegisterInput {
  email: string
  password: string
  displayName: string
  companyName: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setUser(await api.get<AuthState>('/auth/me'))
  }, [])

  // Holds the short-lived challenge between the password step and the 2FA code step.
  const challengeRef = useRef<string | null>(null)

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<{
        accessToken?: string
        twoFactorRequired?: boolean
        challengeToken?: string
      }>('/auth/login', { email, password })
      if (data.twoFactorRequired && data.challengeToken) {
        challengeRef.current = data.challengeToken
        return { twoFactorRequired: true }
      }
      if (data.accessToken) {
        setAccessToken(data.accessToken)
        await reload()
      }
      return { twoFactorRequired: false }
    },
    [reload]
  )

  const verifyTwoFactor = useCallback(
    async (code: string) => {
      const challengeToken = challengeRef.current
      if (!challengeToken) throw new Error('Немає активної сесії підтвердження')
      const data = await api.post<{ accessToken: string }>('/auth/2fa/login-verify', {
        challengeToken,
        code,
      })
      challengeRef.current = null
      setAccessToken(data.accessToken)
      await reload()
    },
    [reload]
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const data = await api.post<{ accessToken: string }>('/auth/register', input)
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

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, verifyTwoFactor, register, logout, reload }),
    [user, loading, login, verifyTwoFactor, register, logout, reload]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
