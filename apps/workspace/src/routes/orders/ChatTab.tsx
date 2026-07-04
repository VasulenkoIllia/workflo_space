import { OrderChat } from '@workflo/app-core'
import { useAuth } from '@/contexts/AuthContext'
import { useUploadFile } from '@/lib/orderDetail'

/**
 * Internal-team chat (03-чат). Thin wrapper over the shared <OrderChat> — the team
 * view enables every capability (owner can edit/delete anyone). The live SSE stream
 * (useCommentStream) is mounted at the page level, not here.
 */
export function ChatTab({ orderId }: { orderId: string }) {
  const { user, isOwner } = useAuth()
  const upload = useUploadFile(orderId)
  return (
    <OrderChat
      orderId={orderId}
      currentUserId={user?.profile.id ?? ''}
      capabilities={{
        canPin: true,
        canFilterInternal: true,
        canPostInternal: true,
        canEditAnyone: isOwner,
      }}
      upload={upload}
    />
  )
}
