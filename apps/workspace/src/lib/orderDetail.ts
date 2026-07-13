import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  BillingType,
  OrderClientStatus,
  OrderInternalStatus,
  OrderPriority,
  OrderType,
  StageStatus,
} from '@workflo/types'
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
  fetchFileThumbUrl,
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

export interface OrderStage {
  id: string
  title: string
  description: string | null
  status: StageStatus
  position: number
}

/** Internal-team order detail — superset of the client view. */
export interface WorkspaceOrderDetail {
  /** S10-01: теги замовлення (internal-only) */
  tags?: { id: string; name: string; color: string | null }[]
  /** S10-02 SLA (internal-only) */
  firstResponseDueAt?: string | null
  resolutionDueAt?: string | null
  firstRespondedAt?: string | null
  slaBreachedAt?: string | null
  id: string
  title: string
  description: string | null
  clientStatus: OrderClientStatus
  internalStatus: OrderInternalStatus
  priority: OrderPriority
  type?: OrderType
  billingType?: BillingType
  nomenclatureId?: string | null
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
  /** Мультивиконавці: співвиконавці ДОДАТКОВО до головного assignee. */
  coAssignees?: { id: string; name: string }[]
  project?: { id: string; name: string; billingModel: string } | null
  stages: OrderStage[]
  /** ПРИЙМАННЯ РОБОТИ (internal-only): план/факт/білабельно/до-оплати. */
  acceptance?: OrderAcceptance
  // S10-03: залежності — блокери цього замовлення / кого блокує воно
  blockedBy?: OrderDependencyRef[]
  blocks?: OrderDependencyRef[]
  isBlocked?: boolean
}

/** S10-03: посилання залежності (dependencyId — для видалення звʼязку). */
export interface OrderDependencyRef {
  dependencyId: string
  id: string
  title: string
  internalStatus: OrderInternalStatus
}

export interface AcceptanceExecutor {
  profileId: string
  name: string
  trackedHours: number
  payableHours: number
}
export interface OrderAcceptance {
  /** Всі задачі замовлення done → підказка «здай на приймання» (без автопереходу). */
  allTasksDone?: boolean
  submittedAt: string | null
  submittedBy: { id: string; name: string } | null
  acceptedAt: string | null
  acceptedBy: { id: string; name: string } | null
  plannedHours: number | null
  trackedHours: number
  billableHours: number | null
  executors: AcceptanceExecutor[]
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
  /** S10-06ч: чи є webp-прев'ю (зображення) — рендеримо мініатюру у списку. */
  hasThumb: boolean
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

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => api.get<{ order: WorkspaceOrderDetail }>(`/orders/${id}`).then((r) => r.order),
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

/** COV-UX-5: PATCH запису часу (лише автор; бек морозить після фіксації періоду). */
export function useUpdateTimeLog(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      logId,
      ...input
    }: {
      logId: string
      hours?: number
      date?: string
      comment?: string
    }) => api.patch<{ log: TimeLog }>(`/orders/${id}/time-logs/${logId}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.timeLogs(id) }),
  })
}

/** COV-UX-1: soft-delete замовлення у кошик (30 днів; відновлення — /orders → Кошик). */
export function useDeleteOrder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<{ id: string }>(`/orders/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) })
    },
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
  nomenclatureId?: string | null
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

/** ПРИЙМАННЯ: звірка годин (owner/manager) — білабельні клієнту + оплатні по-виконавцях. */
export function useReconcileOrder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      billableHours?: number | null
      settlements?: { profileId: string; payableHours: number }[]
    }) => api.put<{ id: string }>(`/orders/${id}/reconciliation`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.detail(id) }),
  })
}

/** Мультивиконавці: PUT повного списку співвиконавців замовлення (без головного). */
export function useSetOrderCoAssignees(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profileIds: string[]) =>
      api.put<{ coAssigneeIds: string[] }>(`/orders/${id}/assignees`, { profileIds }),
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

// ── S10-03: залежності між замовленнями ──────────────────────────────────────
export function useAddDependency(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dependsOnId: string) =>
      api.post<{ dependency: { id: string } }>(`/orders/${id}/dependencies`, { dependsOnId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.detail(id) }),
  })
}

export function useRemoveDependency(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dependencyId: string) =>
      api.delete<{ removed: true }>(`/orders/${id}/dependencies/${dependencyId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.detail(id) }),
  })
}
