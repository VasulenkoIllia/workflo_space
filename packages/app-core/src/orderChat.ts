import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, api, getAccessToken } from './api.js'
import { subscribeSse } from './sse.js'

/**
 * Shared order-chat data layer (AR-42, audit r4 decomp B). The comment/reaction/
 * pin/search/typing/read/stream hooks were byte-identical in workspace+portal —
 * they hit the SAME `/orders/:id/...` endpoints. The two apps keep their app-specific
 * order-detail query (WorkspaceOrderDetail vs the client OrderDetail) + management
 * hooks local, and re-export this shared surface. `orderKeys` is shared too (the
 * chat mutations invalidate `.files`, which the local file hooks also key on).
 */

// ── Query keys (was `ws-order`/`order` — unified to `order`; single-scoped per app) ──
export const orderKeys = {
  detail: (id: string) => ['order', id] as const,
  comments: (id: string) => ['order', id, 'comments'] as const,
  activity: (id: string) => ['order', id, 'activity'] as const,
  files: (id: string) => ['order', id, 'files'] as const,
  timeLogs: (id: string) => ['order', id, 'time-logs'] as const,
}

// ── Shared chat types ────────────────────────────────────────────────────────
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

export interface TypingMarker {
  name: string
  until: number
}

// ── Query + mutation hooks ───────────────────────────────────────────────────
export function useComments(id: string) {
  return useQuery({
    queryKey: orderKeys.comments(id),
    queryFn: () => api.get<CommentsResult>(`/orders/${id}/comments?limit=50`),
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

export function markCommentsRead(id: string): Promise<unknown> {
  return api.post(`/orders/${id}/comments/read`, {})
}

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

/** Blob-URL webp-прев'ю зображення (S10-06ч). Викликач revoke'ає. */
export async function fetchFileThumbUrl(file: { id: string }): Promise<string> {
  const token = getAccessToken()
  const res = await fetch(`${API_URL}/files/${file.id}/thumb`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error('fetch failed')
  return URL.createObjectURL(await res.blob())
}

export async function downloadFile(file: { id: string; filename: string }): Promise<void> {
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
