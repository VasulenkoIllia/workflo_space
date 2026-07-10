import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** TEAM-BOARDS (Фаза B): команди агенції — таби глобальної дошки задач. */
export interface Team {
  id: string
  name: string
  color: string | null
  position: number
  _count: { members: number; tasks: number }
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
    mutationFn: ({ id, ...body }: { id: string; name?: string; position?: number }) =>
      api.patch<{ team: Team }>(`/workspace/teams/${id}`, body),
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

/** Owner призначає члена агенції в команду (null = прибрати). */
export function useSetMemberTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, teamId }: { profileId: string; teamId: string | null }) =>
      api.patch(`/workspace/executors/${profileId}/team`, { teamId }),
    onSuccess: () => invalidate(qc),
  })
}
