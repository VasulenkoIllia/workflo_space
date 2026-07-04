import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  BillingType,
  OrderClientStatus,
  OrderInternalStatus,
  OrderPriority,
  OrderType,
  StageStatus,
} from '@workflo/types'
import { API_URL, api, getAccessToken } from '@/lib/api'
import { subscribeSse } from '@/lib/sse'

export interface OrderStage {
  id: string
  title: string
  description: string | null
  status: StageStatus
  position: number
}

/** Internal-team order detail — superset of the client view. */
export interface WorkspaceOrderDetail {
  id: string
  title: string
  description: string | null
  clientStatus: OrderClientStatus
  internalStatus: OrderInternalStatus
  priority: OrderPriority
  type?: OrderType
  billingType?: BillingType
  totalAmount: number | null
  fixedPrice?: number | null
  hourlyRate?: number | null
  estimatedHours?: number | null
  currency: string
  dueDate: string | null
  paidAt?: string | null
  onHoldReason?: string | null
  cancelledReason?: string | null
  requiresApproval?: boolean
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null
  createdAt: string
  updatedAt: string
  company?: { id: string; name: string } | null
  assignee?: { id: string; name: string } | null
  project?: { id: string; name: string; billingModel: string } | null
  stages: OrderStage[]
}

export interface CommentAttachment {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface ChatComment {
  id: string
  content: string
  isInternal: boolean
  createdAt: string
  editedAt: string | null
  author: { id: string; name: string; kind: 'team' | 'client' }
  /** null-и всередині = оригінал видалено/недоступний («повідомлення видалено»). */
  replyTo?: { id: string; authorName: string | null; preview: string | null } | null
  attachments?: CommentAttachment[]
  /** S10 @mention: profile-ids згаданих (виділення + «вас згадали»). */
  mentions?: string[]
  /** S10 реакції: агрегат {emoji, count, mine, names} (канон 03-C). */
  reactions?: ReactionAgg[]
  /** 03-Г pin: закріплено командою (клієнт бачить, не керує). */
  pinnedAt?: string | null
}

export interface ReactionAgg {
  emoji: string
  count: number
  mine: boolean
  names: string[]
}

export interface ReadMarker {
  profileId: string
  name: string
  lastReadAt: string
}

export interface ChatParticipant {
  id: string
  name: string
  kind: 'team' | 'client'
}

export interface CommentsResult {
  comments: ChatComment[]
  /** 03-Г: секція «Закріплене» (може містити старші за сторінку повідомлення). */
  pinned?: ChatComment[]
  meta: {
    hasMore: boolean
    unreadCount: number
    lastReadAt: string | null
    /** Read-маркери ІНШИХ учасників (S10) — ✓✓ на власних повідомленнях. */
    reads?: ReadMarker[]
  }
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

export interface TimeLog {
  id: string
  hours: number
  date: string
  comment: string | null
  executorId: string
  createdAt: string
}

export interface TimeLogsResult {
  logs: TimeLog[]
  totalHours: number
}

export const orderKeys = {
  detail: (id: string) => ['ws-order', id] as const,
  comments: (id: string) => ['ws-order', id, 'comments'] as const,
  activity: (id: string) => ['ws-order', id, 'activity'] as const,
  files: (id: string) => ['ws-order', id, 'files'] as const,
  timeLogs: (id: string) => ['ws-order', id, 'time-logs'] as const,
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => api.get<{ order: WorkspaceOrderDetail }>(`/orders/${id}`).then((r) => r.order),
    enabled: id !== '',
  })
}

export function useComments(id: string) {
  return useQuery({
    queryKey: orderKeys.comments(id),
    queryFn: () => api.get<CommentsResult>(`/orders/${id}/comments?limit=50`),
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

export function useTimeLogs(id: string) {
  return useQuery({
    queryKey: orderKeys.timeLogs(id),
    queryFn: () => api.get<TimeLogsResult>(`/orders/${id}/time-logs`),
    enabled: id !== '',
  })
}

/** PATCH — редагування власного повідомлення (15хв; owner — будь-коли). */
export function useUpdateComment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { commentId: string; content: string }) =>
      api
        .patch<{ comment: ChatComment }>(`/orders/${id}/comments/${input.commentId}`, {
          content: input.content,
        })
        .then((r) => r.comment),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.comments(id) }),
  })
}

/** DELETE — soft-delete (автор/owner); у списку повідомлення зникає. */
export function useDeleteComment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete<{ deleted: true }>(`/orders/${id}/comments/${commentId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.comments(id) }),
  })
}

/** Тогл реакції: mine → DELETE, інакше POST (канон 03-C). */
export function useToggleReaction(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { commentId: string; emoji: string; mine: boolean }) =>
      input.mine
        ? api.delete(`/orders/${id}/comments/${input.commentId}/reactions`, {
            body: { emoji: input.emoji },
          })
        : api.post(`/orders/${id}/comments/${input.commentId}/reactions`, {
            emoji: input.emoji,
          }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.comments(id) }),
  })
}

/** Pin/unpin (03-Г) — лише команда (бек енфорсить 403 для клієнта). */
export function usePinComment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { commentId: string; pinned: boolean }) =>
      input.pinned
        ? api.delete(`/orders/${id}/comments/${input.commentId}/pin`)
        : api.post(`/orders/${id}/comments/${input.commentId}/pin`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.comments(id) }),
  })
}

/** Пошук по коментарях ЦЬОГО замовлення (03-В), від 2 символів. */
export function useSearchComments(id: string, q: string) {
  return useQuery({
    queryKey: [...orderKeys.comments(id), 'search', q] as const,
    queryFn: () =>
      api
        .get<{ results: ChatComment[] }>(`/orders/${id}/comments/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.results),
    enabled: id !== '' && q.trim().length >= 2,
    staleTime: 10_000,
  })
}

// Typing (03-Б): пінг не частіше ніж раз на 2.5с, fire-and-forget.
const typingLastSent = new Map<string, number>()
export function sendTyping(id: string, internal = false): void {
  const now = Date.now()
  if (now - (typingLastSent.get(id) ?? 0) < 2500) return
  typingLastSent.set(id, now)
  void api.post(`/orders/${id}/comments/typing`, { internal }).catch(() => undefined)
}

export interface TypingMarker {
  name: string
  until: number
}

/** Хто може бути @-згаданим у чаті цього замовлення (S10). */
export function useParticipants(id: string) {
  return useQuery({
    queryKey: [...orderKeys.comments(id), 'participants'] as const,
    queryFn: () =>
      api
        .get<{ participants: ChatParticipant[] }>(`/orders/${id}/participants`)
        .then((r) => r.participants),
    enabled: id !== '',
    staleTime: 60_000,
  })
}

export function usePostComment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      content: string
      isInternal?: boolean
      replyToId?: string
      fileIds?: string[]
      mentionIds?: string[]
    }) =>
      api.post<{ comment: ChatComment }>(`/orders/${id}/comments`, input).then((r) => r.comment),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.comments(id) })
      void qc.invalidateQueries({ queryKey: orderKeys.files(id) })
    },
  })
}

export function useCreateTimeLog(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { hours: number; date: string; comment?: string }) =>
      api.post<{ log: TimeLog }>(`/orders/${id}/time-logs`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.timeLogs(id) }),
  })
}

export function useDeleteTimeLog(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (logId: string) => api.delete<{ id: string }>(`/orders/${id}/time-logs/${logId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.timeLogs(id) }),
  })
}

/**
 * POST /workspace/orders/:id/submit-approval (02-А) — the team sends the estimate to the
 * client for approval (order → pending_approval). Re-submitting a rejected estimate resets
 * it to pending. Requires a pre-work status + an estimate (fixed price, or rate + hours).
 */
export function useSubmitApproval(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (note?: string) =>
      api.post<{ order: { id: string } }>(
        `/workspace/orders/${id}/submit-approval`,
        note ? { note } : {}
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: orderKeys.activity(id) })
      void qc.invalidateQueries({ queryKey: ['ws-orders'] })
    },
  })
}

/** Internal-team estimate edit: fixed sum OR hourly rate+hours. Server locks billing fields
 * once approval is pending/approved, so the editor only renders pre-approval (02-А). */
export interface UpdateOrderInput {
  billingType?: BillingType
  fixedPrice?: number | null
  hourlyRate?: number | null
  estimatedHours?: number | null
}

export function useUpdateOrder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateOrderInput) =>
      api.patch<{ order: { id: string } }>(`/orders/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: orderKeys.activity(id) })
      void qc.invalidateQueries({ queryKey: ['ws-orders'] })
    },
  })
}

export function useTransitionStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { status: OrderInternalStatus; comment?: string }) =>
      // The endpoint returns only the changed fields (not the full detail).
      api.patch<{
        order: Pick<
          WorkspaceOrderDetail,
          | 'id'
          | 'internalStatus'
          | 'clientStatus'
          | 'onHoldReason'
          | 'cancelledReason'
          | 'updatedAt'
        >
      }>(`/orders/${id}/status`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: orderKeys.activity(id) })
      // A transition can emit a system comment — refetch chat (SSE may be mid-reconnect).
      void qc.invalidateQueries({ queryKey: orderKeys.comments(id) })
      void qc.invalidateQueries({ queryKey: ['ws-orders'] })
    },
  })
}

export function useAssignOrder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assigneeId: string | null) =>
      api.patch<{ order: { id: string; assigneeId: string | null } }>(`/orders/${id}/assign`, {
        assigneeId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: ['ws-orders'] })
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

export function markCommentsRead(id: string): Promise<unknown> {
  return api.post(`/orders/${id}/comments/read`, {})
}

/** The /content endpoint requires Bearer auth, so fetch the blob and trigger a download. */
/** Blob-URL файлу з Authorization (03-МЕДІА: інлайн <img>/<audio>/<video>). Викликач revoke'ає. */
export async function fetchFileBlobUrl(file: { id: string }): Promise<string> {
  const token = getAccessToken()
  const res = await fetch(`${API_URL}/files/${file.id}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error('fetch failed')
  return URL.createObjectURL(await res.blob())
}

export async function downloadFile(file: Pick<OrderFileItem, 'id' | 'filename'>): Promise<void> {
  const url = await fetchFileBlobUrl(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer revoke so the browser can dispatch the download (immediate revoke can cancel it).
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Live chat subscription — mount at the page level (not inside the chat tab) so
 * comments arriving while the user is on another tab still land in the cache.
 */
export function useCommentStream(id: string) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!id) return
    return subscribeSse(`/orders/${id}/comments/stream`, {
      onEvent: (event, dataStr) => {
        let incoming: unknown
        try {
          incoming = JSON.parse(dataStr)
        } catch {
          return
        }
        // Edit/delete/reactions (S10): замінити/прибрати повідомлення в кеші.
        if (event === 'comment_updated') {
          if (!isChatComment(incoming)) return
          qc.setQueryData<CommentsResult>(orderKeys.comments(id), (old) => {
            if (!old) return old
            return {
              ...old,
              comments: old.comments.map((c) => (c.id === incoming.id ? incoming : c)),
            }
          })
          return
        }
        if (event === 'comment_deleted') {
          const d = incoming as { id?: string }
          if (typeof d?.id !== 'string') return
          qc.setQueryData<CommentsResult>(orderKeys.comments(id), (old) =>
            old ? { ...old, comments: old.comments.filter((c) => c.id !== d.id) } : old
          )
          return
        }
        // Typing (03-Б): ефемерний маркер у кеші; ChatTab сам гасить по until.
        if (event === 'typing') {
          const t = incoming as { name?: string }
          if (typeof t?.name !== 'string') return
          qc.setQueryData<TypingMarker>(['order-typing', id], {
            name: t.name,
            until: Date.now() + 4000,
          })
          return
        }
        // Read receipts (S10): оновити маркер читача → живі ✓✓.
        if (event === 'read') {
          const r = incoming as ReadMarker
          if (typeof r?.profileId !== 'string' || typeof r?.lastReadAt !== 'string') return
          qc.setQueryData<CommentsResult>(orderKeys.comments(id), (old) => {
            if (!old) return old
            const reads = old.meta.reads ?? []
            const next = reads.some((m) => m.profileId === r.profileId)
              ? reads.map((m) => (m.profileId === r.profileId ? { ...m, ...r } : m))
              : [...reads, r]
            return { ...old, meta: { ...old.meta, reads: next } }
          })
          return
        }
        if (event !== 'comment') return
        if (!isChatComment(incoming)) return
        qc.setQueryData<CommentsResult>(orderKeys.comments(id), (old) => {
          if (!old || old.comments.some((c) => c.id === incoming.id)) return old
          return { ...old, comments: [...old.comments, incoming] }
        })
      },
    })
  }, [id, qc])
}

function isChatComment(v: unknown): v is ChatComment {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  const author = c.author as Record<string, unknown> | undefined
  return (
    typeof c.id === 'string' &&
    typeof c.content === 'string' &&
    typeof c.isInternal === 'boolean' &&
    typeof c.createdAt === 'string' &&
    typeof author?.id === 'string' &&
    typeof author?.name === 'string'
  )
}
