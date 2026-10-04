import { OrderChat } from '@workflo/app-core'
import { useAuth } from '@/contexts/AuthContext'
import { useUploadFile } from '@/lib/orderDetail'

/**
 * Client-facing chat (03-чат). Thin wrapper over the shared <OrderChat> — the client
 * view has no internal notes, no pin controls, and edits/deletes only its own messages.
 * The live SSE stream (useCommentStream) is mounted at the page level, not here.
 */
export function ChatTab({ orderId }: { orderId: string }) {
  const { user } = useAuth()
  const upload = useUploadFile(orderId)
  return (
    <OrderChat
      orderId={orderId}
      currentUserId={user?.profile.id ?? ''}
      capabilities={{
        canPin: false,
        canFilterInternal: false,
        canPostInternal: false,
        canEditAnyone: false,
      }}
      upload={upload}
    />
  )
}
