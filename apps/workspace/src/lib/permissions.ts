import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PermissionKey, PermissionLevel, PermissionRole } from '@workflo/types'
import { api } from '@/lib/api'

/** PERM-6: керування правами (owner-only) — GET /workspace/permissions. */
export interface PermissionsState {
  /** Відхилення матриці ролей від дефолтів каталогу. */
  roleOverrides: { role: PermissionRole; permission: PermissionKey; level: PermissionLevel }[]
  members: {
    profileId: string
    name: string
    role: 'owner' | 'manager' | 'executor'
    isLead: boolean
    overrides: { permission: PermissionKey; level: PermissionLevel }[]
  }[]
}

const KEY = ['ws-permissions'] as const

export function usePermissionsAdmin(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<PermissionsState>('/workspace/permissions'),
    enabled,
  })
}

/** level: null — скинути відхилення (повернути дефолт ролі / рядок матриці). */
export function useSetRolePermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: {
      role: PermissionRole
      permission: PermissionKey
      level: PermissionLevel | null
    }) =>
      api.put(`/workspace/permissions/roles/${v.role}`, {
        permission: v.permission,
        level: v.level,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSetMemberPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: {
      profileId: string
      permission: PermissionKey
      level: PermissionLevel | null
    }) =>
      api.put(`/workspace/permissions/members/${v.profileId}`, {
        permission: v.permission,
        level: v.level,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export const LEVEL_LABEL: Record<PermissionLevel, string> = {
  none: '— закрито',
  own: 'своє',
  team: 'підрозділ',
  all: 'усе',
}

export const ROLE_LABEL: Record<PermissionRole, string> = {
  manager: 'Менеджер',
  lead: 'Тімлід',
  executor: 'Виконавець',
}
