import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscribeSse } from '@/lib/sse'
import { api } from '@/lib/api'

/**
 * 29 Support (workspace) — черга тікетів агенції. Команда бачить усі тікети + internal-нотатки.
 * Тред живий через SSE. PATCH змінює статус/пріоритет/призначення/категорію.
 */
export interface WsTicket {
  id: string
  companyId: string | null
  openedById: string
  subject: string
  category: string | null
  priority: string
  status: string
  source: string // portal | email | telegram
  assignedToId: string | null
  firstResponseAt: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  company?: { id: string; name: string } | null
  _count?: { messages: number }
}

export interface WsTicketMessage {
  id: string
  content: string
  isInternal: boolean
  createdAt: string
  editedAt: string | null
  author: { id: string; name: string; kind: 'team' | 'client' }
}

export interface TicketFilters {
  status?: string
  priority?: string
  assignee?: string
}

export function useWsTickets(filters: TicketFilters) {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.priority) qs.set('priority', filters.priority)
  if (filters.assignee) qs.set('assignee', filters.assignee)
  return useQuery({
    queryKey: ['ws-support', 'tickets', filters],
    queryFn: () =>
      api
        .get<{ tickets: WsTicket[] }>(`/workspace/tickets?${qs.toString()}`)
        .then((r) => r.tickets),
  })
}

export function useWsTicket(id: string) {
  return useQuery({
    queryKey: ['ws-support', 'ticket', id],
    queryFn: () =>
      api.get<{ ticket: WsTicket; messages: WsTicketMessage[] }>(`/support/tickets/${id}`),
    enabled: id !== '',
  })
}

export function useWsReplyTicket(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ content, isInternal }: { content: string; isInternal?: boolean }) =>
      api.post(`/support/tickets/${id}/messages`, { content, isInternal }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ws-support', 'ticket', id] })
      void qc.invalidateQueries({ queryKey: ['ws-support', 'tickets'] })
    },
  })
}

export function usePatchTicket(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      status?: string
      priority?: string
      assignedToId?: string | null
      category?: string
    }) => api.patch(`/workspace/tickets/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ws-support'] })
    },
  })
}

export function useWsTicketStream(id: string) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!id) return
    const unsub = subscribeSse(`/support/tickets/${id}/messages/stream`, {
      onEvent: (event) => {
        if (event === 'message')
          void qc.invalidateQueries({ queryKey: ['ws-support', 'ticket', id] })
      },
    })
    return unsub
  }, [id, qc])
}
