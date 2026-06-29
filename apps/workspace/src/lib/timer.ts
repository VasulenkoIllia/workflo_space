import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** A running time-tracking timer (02-orders T2). endedAt is always null while running. */
export interface ActiveTimer {
  id: string
  orderId: string
  hours: number
  startedAt: string | null
  endedAt: string | null
  date: string
  comment: string | null
  executorId: string
  order: { id: string; title: string } | null
}

/** GET /workspace/timer — the caller's running timer (or null). Polled so a timer started on
 * another device / auto-stopped by cron eventually reflects; the bar ticks locally meanwhile. */
export function useActiveTimer() {
  return useQuery({
    queryKey: ['active-timer'],
    queryFn: () => api.get<{ timer: ActiveTimer | null }>('/workspace/timer').then((r) => r.timer),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Invalidate the timer + any order's logged-time/detail (start may auto-stop another order). */
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['active-timer'] })
  void qc.invalidateQueries({ queryKey: ['ws-order'] })
}

export function useStartTimer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post<{ timer: ActiveTimer }>('/workspace/timer/start', { orderId }),
    onSuccess: () => invalidate(qc),
  })
}

export function useStopTimer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ timer: ActiveTimer | null }>('/workspace/timer/stop'),
    onSuccess: () => invalidate(qc),
  })
}

/** "Hh Mm Ss" elapsed since an ISO start — for the live-ticking bar. */
export function formatElapsed(startedAtIso: string, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - new Date(startedAtIso).getTime()) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
