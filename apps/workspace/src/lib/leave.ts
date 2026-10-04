import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * S13-04/05 LEAVE: відсутності команди. Self-service заявки (vacation/sick/dayoff/unpaid),
 * owner/manager погоджують; баланс відпустки — accrual від hireDate (обчислюваний на беку).
 */
export type LeaveType = 'vacation' | 'sick' | 'dayoff' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface LeaveRequest {
  id: string
  profileId: string
  profile: { name: string }
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  status: LeaveStatus
  reason: string | null
  rejectReason: string | null
  reviewedBy: { name: string } | null
  reviewedAt: string | null
  createdAt: string
}

export interface LeaveBalance {
  perYear: number
  accruedDays: number
  usedDays: number
  pendingDays: number
  balanceDays: number
  hireDate: string
}

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  vacation: 'Відпустка',
  sick: 'Лікарняний',
  dayoff: 'Відгул',
  unpaid: 'Без збереження',
}

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: 'на погодженні',
  approved: 'погоджено',
  rejected: 'відхилено',
  cancelled: 'скасовано',
}

export const LEAVE_STATUS_BADGE: Record<LeaveStatus, string> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  cancelled: 'muted',
}

const KEY = ['ws-leave'] as const

export function useLeaves(status?: LeaveStatus) {
  return useQuery({
    queryKey: [...KEY, 'list', status ?? 'all'],
    queryFn: () =>
      api.get<{ leaves: LeaveRequest[]; canReview: boolean }>(
        `/workspace/leave${status ? `?status=${status}` : ''}`
      ),
  })
}

export function useLeaveBalance(profileId?: string) {
  return useQuery({
    queryKey: [...KEY, 'balance', profileId ?? 'me'],
    queryFn: () =>
      api.get<{ balance: LeaveBalance }>(
        `/workspace/leave/balance${profileId ? `?profileId=${profileId}` : ''}`
      ),
  })
}

export function useCreateLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { type: LeaveType; startDate: string; endDate: string; reason?: string }) =>
      api.post<{ leave: LeaveRequest }>('/workspace/leave', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDecideLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string
      action: 'approve' | 'reject'
      reason?: string
    }) =>
      api.post<{ leave: LeaveRequest }>(
        `/workspace/leave/${id}/${action}`,
        action === 'reject' ? { reason } : undefined
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<{ cancelled: true }>(`/workspace/leave/${id}/cancel`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}
