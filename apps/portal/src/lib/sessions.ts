import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /auth/sessions — one row per live device (refresh-token family). */
export interface SessionInfo {
  id: string
  userAgent: string | null
  ip: string | null
  signedInAt: string
  lastActiveAt: string
  expiresAt: string
  current: boolean
}

const key = ['auth', 'sessions'] as const

export function useSessions() {
  return useQuery({
    queryKey: key,
    queryFn: () => api.get<{ sessions: SessionInfo[] }>('/auth/sessions'),
  })
}

/** DELETE /auth/sessions/:id — revoke one session (device logs out on next refresh, ≤15 хв). */
export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ revoked: true }>(`/auth/sessions/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  })
}

/** POST /auth/sessions/revoke-others — log out every device except this one. */
export function useRevokeOtherSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ revoked: number }>('/auth/sessions/revoke-others', {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  })
}

/** «Chrome · macOS» from a raw User-Agent — tiny heuristic, no dep. */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Невідомий пристрій'
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /opr\//i.test(ua)
      ? 'Opera'
      : /firefox\//i.test(ua)
        ? 'Firefox'
        : /chrome\//i.test(ua)
          ? 'Chrome'
          : /safari\//i.test(ua)
            ? 'Safari'
            : 'Браузер'
  const os = /iphone|ipad/i.test(ua)
    ? 'iOS'
    : /android/i.test(ua)
      ? 'Android'
      : /mac os x/i.test(ua)
        ? 'macOS'
        : /windows/i.test(ua)
          ? 'Windows'
          : /linux/i.test(ua)
            ? 'Linux'
            : ''
  return os ? `${browser} · ${os}` : browser
}
