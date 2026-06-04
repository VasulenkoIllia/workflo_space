import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OrderClientStatus, OrderPriority } from '@workflo/types'
import { API_URL, api, getAccessToken } from '@/lib/api'
import { subscribeSse } from '@/lib/sse'

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
  dueDate: string | null
  createdAt: string
  updatedAt: string
  stages: OrderStage[]
}

export interface ChatComment {
  id: string
  content: string
  isInternal: boolean
  createdAt: string
  editedAt: string | null
  author: { id: string; name: string }
}

export interface CommentsResult {
  comments: ChatComment[]
  meta: { hasMore: boolean; unreadCount: number; lastReadAt: string | null }
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

export const orderKeys = {
  detail: (id: string) => ['order', id] as const,
  comments: (id: string) => ['order', id, 'comments'] as const,
  activity: (id: string) => ['order', id, 'activity'] as const,
  files: (id: string) => ['order', id, 'files'] as const,
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

export function usePostComment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      api
        .post<{ comment: ChatComment }>(`/orders/${id}/comments`, { content })
        .then((r) => r.comment),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.comments(id) }),
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
export async function downloadFile(file: OrderFileItem): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(`${API_URL}/files/${file.id}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error('download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
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
 * Appends streamed comments to the comments query (dedupe by id; shape-guarded).
 */
export function useCommentStream(id: string) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!id) return
    return subscribeSse(`/orders/${id}/comments/stream`, {
      onEvent: (event, dataStr) => {
        if (event !== 'comment') return
        let incoming: unknown
        try {
          incoming = JSON.parse(dataStr)
        } catch {
          return
        }
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
    typeof author?.id === 'string' &&
    typeof author?.name === 'string'
  )
}
