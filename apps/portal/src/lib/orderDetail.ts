import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OrderClientStatus, OrderPriority } from '@workflo/types'
import { orderKeys } from '@workflo/app-core'
import { api } from '@/lib/api'

// Shared order-chat data layer lives in @workflo/app-core (AR-42, audit r4 decomp B);
// re-exported here so `@/lib/orderDetail` call-sites (ChatTab etc.) are unchanged.
export {
  orderKeys,
  useComments,
  useUpdateComment,
  useDeleteComment,
  useToggleReaction,
  usePinComment,
  useSearchComments,
  sendTyping,
  useParticipants,
  usePostComment,
  markCommentsRead,
  fetchFileBlobUrl,
  downloadFile,
  useCommentStream,
  type CommentAttachment,
  type ChatComment,
  type ReactionAgg,
  type ReadMarker,
  type ChatParticipant,
  type CommentsResult,
  type TypingMarker,
} from '@workflo/app-core'

export type StageStatusValue = 'pending' | 'in_progress' | 'done'

export interface OrderStage {
  id: string
  title: string
  description: string | null
  status: StageStatusValue
  position: number
}

export interface OrderDetail {
  id: string
  title: string
  description: string | null
  clientStatus: OrderClientStatus
  priority: OrderPriority
  totalAmount: number | null
  currency: string
  paidAt: string | null // 05-А: статус оплати замовлення
  dueDate: string | null
  createdAt: string
  updatedAt: string
  stages: OrderStage[]
}

export interface ActivityItem {
  id: string
  action: string
  metadata: Record<string, unknown> | null
  createdAt: string
  actor: { id: string; name: string }
}

export interface OrderFileItem {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  sha256: string
  uploadedBy: string
  createdAt: string
}

// Convention: when the API wraps the payload (e.g. `{ order }`), pass the wrapper
// type to api.get and `.then()`-unwrap it; when the data IS the payload (comments),
// pass it directly — api.request already unwraps the outer `{ success, data }`.
export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => api.get<{ order: OrderDetail }>(`/orders/${id}`).then((r) => r.order),
    enabled: id !== '',
  })
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: orderKeys.activity(id),
    queryFn: () =>
      api.get<{ activity: ActivityItem[] }>(`/orders/${id}/activity`).then((r) => r.activity),
    enabled: id !== '',
  })
}

export function useFiles(id: string) {
  return useQuery({
    queryKey: orderKeys.files(id),
    queryFn: () => api.get<{ files: OrderFileItem[] }>(`/orders/${id}/files`).then((r) => r.files),
    enabled: id !== '',
  })
}

/**
 * POST /portal/orders/:id/approval (02-А) — the company owner decides on the submitted
 * estimate. approve → opens the in-progress gate; reject MUST carry a reason.
 */
export function useDecideApproval(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { decision: 'approve' | 'reject'; comment?: string }) =>
      api.post<{ order: { id: string } }>(`/portal/orders/${id}/approval`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: orderKeys.activity(id) })
    },
  })
}

export function useUploadFile(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.upload<{ file: OrderFileItem }>(`/orders/${id}/files`, fd)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.files(id) }),
  })
}

export function useDeleteFile(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) => api.delete<{ id: string }>(`/files/${fileId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.files(id) }),
  })
}
