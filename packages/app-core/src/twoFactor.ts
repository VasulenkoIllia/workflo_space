import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api.js'

/** GET /auth/2fa/status — is 2FA on / pending, and how many backup codes remain. */
export interface TwoFactorStatus {
  enabled: boolean
  pending: boolean
  backupCodesRemaining: number
}

const key = ['2fa', 'status'] as const

export function useTwoFactorStatus() {
  return useQuery({
    queryKey: key,
    queryFn: () => api.get<TwoFactorStatus>('/auth/2fa/status'),
  })
}

/** POST /auth/2fa/setup — start setup, returns the secret + otpauth URL for the QR. */
export function useTwoFactorSetup() {
  return useMutation({
    mutationFn: () => api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {}),
  })
}

/** POST /auth/2fa/enable — confirm the first code → returns one-time backup codes. */
export function useTwoFactorEnable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api.post<{ backupCodes: string[] }>('/auth/2fa/enable', { code }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  })
}

/** POST /auth/2fa/disable — re-auth with a live code or the account password. */
export function useTwoFactorDisable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { code?: string; password?: string }) =>
      api.post<{ disabled: true }>('/auth/2fa/disable', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  })
}
