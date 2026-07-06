import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * 18-А portal-inbox: всі чати моїх замовлень одним списком. Бек віддає ЛИШЕ
 * публічні повідомлення (внутрішні нотатки команди для порталу не існують).
 */
export interface PortalConversation {
  orderId: string
  title: string
  clientStatus: string
  companyName: string | null
  lastMessage: {
    preview: string
    authorName: string
    isMine: boolean
    at: string
  } | null
  unread: number
  muted: boolean
  archived: boolean
}

export function useConversations() {
  return useQuery({
    queryKey: ['portal-conversations'],
    queryFn: () => api.get<{ conversations: PortalConversation[] }>('/portal/conversations'),
    refetchInterval: 30_000,
  })
}

/** Mute/archive стан треду — той самий ендпоінт учасника, що і в workspace. */
export function useSetConversationState(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { muted?: boolean; archived?: boolean }) =>
      api.put(`/orders/${orderId}/conversation`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['portal-conversations'] }),
  })
}
