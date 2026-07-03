import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, api } from '@/lib/api'

/** Which social providers the backend has configured (button visibility). */
export function useOauthProviders() {
  return useQuery({
    queryKey: ['oauth', 'providers'],
    queryFn: () => api.get<{ google: boolean }>('/auth/oauth/providers'),
    staleTime: 5 * 60 * 1000,
  })
}

export interface OauthAccountInfo {
  provider: string
  email: string
  createdAt: string
}

export function useOauthAccounts() {
  return useQuery({
    queryKey: ['oauth', 'accounts'],
    queryFn: () => api.get<{ accounts: OauthAccountInfo[] }>('/auth/oauth/accounts'),
  })
}

/** Unlink requires the account password — proves ≥1 login method remains. */
export function useUnlinkOauth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { provider: string; password: string }) =>
      api.delete<{ unlinked: true }>(`/auth/oauth/${body.provider}`, {
        body: { password: body.password },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['oauth', 'accounts'] }),
  })
}

/** Top-level navigation into the Google flow (login intent). */
export function startGoogleLogin(app: 'portal' | 'workspace') {
  window.location.href = `${API_URL}/auth/oauth/google?app=${app}`
}

/** Link intent for a logged-in user: fetch the signed URL, then navigate. */
export async function startGoogleLink(app: 'portal' | 'workspace') {
  const { url } = await api.get<{ url: string }>(`/auth/oauth/google/link-url?app=${app}`)
  window.location.href = url
}
