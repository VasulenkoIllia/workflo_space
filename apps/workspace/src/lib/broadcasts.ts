import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * S12-07 BULK-РОЗСИЛКИ (owner): email сегменту клієнтів. Чернетка → preview →
 * send (доставка через outbox + notify-матрицю; вимкнений system-email поважається).
 */
export type BroadcastSegment = 'all' | 'debtors' | 'tier'
export type BroadcastStatus = 'draft' | 'sending' | 'sent'
export type LoyaltyTier = 'new' | 'regular' | 'partner' | 'vip'

export interface Broadcast {
  id: string
  subject: string
  body: string
  segment: BroadcastSegment
  tier: LoyaltyTier | null
  status: BroadcastStatus
  recipientCount: number
  sentCount: number
  sentAt: string | null
  createdAt: string
}

export const SEGMENT_LABEL: Record<BroadcastSegment, string> = {
  all: 'усі клієнти',
  debtors: 'боржники',
  tier: 'loyalty-тір',
}

export const TIER_LABEL: Record<LoyaltyTier, string> = {
  new: 'Нові',
  regular: 'Постійні',
  partner: 'Партнери',
  vip: 'VIP',
}

export const BROADCAST_STATUS_LABEL: Record<BroadcastStatus, string> = {
  draft: 'чернетка',
  sending: 'надсилається',
  sent: 'надіслано',
}

const KEY = ['ws-broadcasts'] as const

export function useBroadcasts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<{ broadcasts: Broadcast[] }>('/workspace/broadcasts'),
  })
}

export interface BroadcastInput {
  subject: string
  body: string
  segment: BroadcastSegment
  tier?: LoyaltyTier | null
}

export function useSaveBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: BroadcastInput & { id?: string }) =>
      id
        ? api.patch<{ broadcast: Broadcast }>(`/workspace/broadcasts/${id}`, body)
        : api.post<{ broadcast: Broadcast }>('/workspace/broadcasts', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useBroadcastPreview(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'preview', id],
    queryFn: () => api.get<{ recipientCount: number }>(`/workspace/broadcasts/${id}/preview`),
    enabled: id != null,
  })
}

export function useSendBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ broadcast: Broadcast }>(`/workspace/broadcasts/${id}/send`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: true }>(`/workspace/broadcasts/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}
