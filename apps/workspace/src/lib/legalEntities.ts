import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Agency legal entities (20-Д). Owner-managed registry of the ФОП/ТОВ an agency
 * issues documents from. Backend: /workspace/legal-entities (full CRUD + set-default).
 */
export interface LegalEntity {
  id: string
  name: string
  legalType: string
  legalName: string
  taxId: string | null
  vatPayer: boolean
  vatId: string | null
  legalAddress: string | null
  bankName: string | null
  iban: string | null
  signerName: string | null
  signerTitle: string | null
  stampUrl: string | null
  isDefault: boolean
  isComplete: boolean
  active: boolean
  createdAt: string
}

/**
 * Create/update payload. Optional fields are `string | null` — the backend schema
 * is `.nullish()`, so a cleared field sends `null` (lesson: createExpenseSchema-400).
 */
export interface LegalEntityInput {
  name: string
  legalType: string
  legalName: string
  taxId?: string | null
  vatPayer: boolean
  vatId?: string | null
  legalAddress?: string | null
  bankName?: string | null
  iban?: string | null
  signerName?: string | null
  signerTitle?: string | null
}

/** Convention for legalType (free-text П8; these are the canonical values). */
export const LEGAL_TYPE_LABEL: Record<string, string> = {
  fop: 'ФОП',
  tov: 'ТОВ',
  individual: 'Фізособа',
  foreign: 'Іноземна',
}

const KEY = ['ws-legal-entities'] as const

export function useLegalEntities() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<{ legalEntities: LegalEntity[] }>('/workspace/legal-entities'),
  })
  return {
    entities: q.data?.legalEntities ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
  }
}

export function useSaveLegalEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: LegalEntityInput & { id?: string }) =>
      id
        ? api.patch<{ legalEntity: LegalEntity }>(`/workspace/legal-entities/${id}`, body)
        : api.post<{ legalEntity: LegalEntity }>('/workspace/legal-entities', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSetDefaultLegalEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ legalEntity: LegalEntity }>(`/workspace/legal-entities/${id}/default`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteLegalEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: true }>(`/workspace/legal-entities/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}
