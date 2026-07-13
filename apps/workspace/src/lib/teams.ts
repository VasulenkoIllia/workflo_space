import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** TEAM-BOARDS (Фаза B): команди агенції — таби глобальної дошки задач. */
export type ColumnKind = 'todo' | 'in_progress' | 'done'

/** TASK-COLUMNS: кастомна колонка дошки команди; kind = мапінг на канонічний статус. */
export interface TeamColumn {
  id: string
  name: string
  kind: ColumnKind
  position: number
}

export interface Team {
  id: string
  name: string
  color: string | null
  position: number
  // TEAM-ADMIN-1: тімлід підрозділу (член команди)
  leadId: string | null
  lead: { id: string; name: string } | null
  _count: { members: number; tasks: number }
  columns: TeamColumn[]
}

export function useTeams() {
  return useQuery({
    queryKey: ['ws-teams'],
    queryFn: () => api.get<{ teams: Team[] }>('/workspace/teams').then((r) => r.teams),
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['ws-teams'] })
  void qc.invalidateQueries({ queryKey: ['ws-tasks'] })
  void qc.invalidateQueries({ queryKey: ['team-members'] })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post<{ team: Team }>('/workspace/teams', { name }),
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      name?: string
      position?: number
      leadId?: string | null
    }) => api.patch<{ team: Team }>(`/workspace/teams/${id}`, body),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/teams/${id}`),
    onSuccess: () => invalidate(qc),
  })
}

// ── TASK-COLUMNS: CRUD колонок дошки команди (owner/manager) ────────────────────
export function useCreateColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, name, kind }: { teamId: string; name: string; kind: ColumnKind }) =>
      api.post(`/workspace/teams/${teamId}/columns`, { name, kind }),
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      teamId,
      columnId,
      ...body
    }: {
      teamId: string
      columnId: string
      name?: string
      kind?: ColumnKind
      position?: number
    }) => api.patch(`/workspace/teams/${teamId}/columns/${columnId}`, body),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, columnId }: { teamId: string; columnId: string }) =>
      api.delete(`/workspace/teams/${teamId}/columns/${columnId}`),
    onSuccess: () => invalidate(qc),
  })
}

/** Owner призначає члена агенції в команду (null = прибрати). */
export function useSetMemberTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, teamId }: { profileId: string; teamId: string | null }) =>
      api.patch(`/workspace/executors/${profileId}/team`, { teamId }),
    onSuccess: () => invalidate(qc),
  })
}

/** 12-В KPI-картка виконавця (owner/manager). Вікно дефолт = поточний місяць. */
export interface ExecutorKpi {
  from: string
  to: string
  hoursLogged: number
  hoursAccepted: number
  revenueUsd: string
  activeOrders: number
  tasksDone: number
  onTimePct: number | null
  onTimeBase: number
}

export function useExecutorKpi(profileId: string) {
  return useQuery({
    queryKey: ['executor-kpi', profileId],
    queryFn: () =>
      api.get<{ kpi: ExecutorKpi }>(`/workspace/executors/${profileId}/kpi`).then((r) => r.kpi),
    enabled: profileId !== '',
  })
}
