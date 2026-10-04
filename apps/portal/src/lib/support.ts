import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscribeSse } from '@workflo/app-core'
import { api } from '@/lib/api'

/**
 * 29 Support — тікети клієнта. Клієнт бачить лише свої тікети й лише public-повідомлення
 * (internal-нотатки команди відфільтровані на бекенді). Тред живий через SSE.
 */
export interface SupportTicket {
  id: string
  companyId: string | null
  subject: string
  category: string | null
  priority: string
  status: string
  assignedToId: string | null
  createdAt: string
  updatedAt: string
  company?: { id: string; name: string } | null
  _count?: { messages: number }
}

export interface TicketMessage {
  id: string
  content: string
  isInternal: boolean
  createdAt: string
  editedAt: string | null
  author: { id: string; name: string; kind: 'team' | 'client' }
}

export function useTickets() {
  return useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: () => api.get<{ tickets: SupportTicket[] }>('/support/tickets').then((r) => r.tickets),
  })
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['support', 'ticket', id],
    queryFn: () =>
      api.get<{ ticket: SupportTicket; messages: TicketMessage[] }>(`/support/tickets/${id}`),
    enabled: id !== '',
  })
}

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      subject: string
      category?: string
      priority?: string
      message: string
    }) => api.post<{ id: string }>('/support/tickets', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['support', 'tickets'] }),
  })
}

export function useReplyTicket(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => api.post(`/support/tickets/${id}/messages`, { content }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support', 'ticket', id] })
      void qc.invalidateQueries({ queryKey: ['support', 'tickets'] })
    },
  })
}

/** SSE live-тред: на нове повідомлення інвалідовуємо тред (re-fetch з leak-guard). */
export function useTicketStream(id: string) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!id) return
    const unsub = subscribeSse(`/support/tickets/${id}/messages/stream`, {
      onEvent: (event) => {
        if (event === 'message') {
          void qc.invalidateQueries({ queryKey: ['support', 'ticket', id] })
        }
      },
    })
    return unsub
  }, [id, qc])
}
