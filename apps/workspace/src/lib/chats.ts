import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** 18-хвости (chat-hub): mute/archive стану треду + відповідальний + «без відповіді». */

export interface ConversationState {
  muted: boolean
  archivedAt: string | null
  chatOwnerId: string | null
  /** явний відповідальний або «авто» = перший assignee */
  effectiveChatOwnerId: string | null
}

export function useConversationState(orderId: string) {
  return useQuery({
    queryKey: ['conversation-state', orderId],
    queryFn: () => api.get<ConversationState>(`/orders/${orderId}/conversation`),
    enabled: orderId !== '',
  })
}

export function useSetConversationState(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { muted?: boolean; archived?: boolean }) =>
      api.put(`/orders/${orderId}/conversation`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['conversation-state', orderId] }),
  })
}

export function useSetChatOwner(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string | null) =>
      api.patch(`/workspace/orders/${orderId}/chat-owner`, { profileId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['conversation-state', orderId] })
      void qc.invalidateQueries({ queryKey: ['unanswered-chats'] })
    },
  })
}

export interface UnansweredChat {
  orderId: string
  title: string
  companyName: string | null
  lastClientMessageAt: string
  hoursSince: number
  chatOwnerId: string | null
}

/** 18-Г: активні замовлення, де клієнт чекає на відповідь довше за поріг. */
export function useUnansweredChats(hours = 4) {
  return useQuery({
    queryKey: ['unanswered-chats', hours],
    queryFn: () =>
      api.get<{ unanswered: UnansweredChat[]; hours: number }>(
        `/workspace/chats/unanswered?hours=${hours}`
      ),
  })
}
