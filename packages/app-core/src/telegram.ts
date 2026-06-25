import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api.js'

export interface TelegramStatus {
  linked: boolean
  linkedAt: string | null
}

/** Telegram link status (S6-06). Refetches on window focus so returning from the bot updates it. */
export function useTelegramStatus() {
  return useQuery({
    queryKey: ['telegram-status'],
    queryFn: () => api.get<TelegramStatus>('/profile/telegram'),
  })
}

export function useTelegramConnect() {
  return useMutation({
    mutationFn: () =>
      api.post<{ deepLink: string; expiresAt: string }>('/profile/telegram/connect'),
  })
}

export function useTelegramDisconnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<{ linked: boolean }>('/profile/telegram'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['telegram-status'] }),
  })
}
