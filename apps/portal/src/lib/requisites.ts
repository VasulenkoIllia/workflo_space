import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Client legal requisites (06-Б) — the document "to" party the client fills in Portal so
 * the agency can issue invoices/acts. One flat set per company. Backend:
 * GET/PATCH /portal/company/requisites (owner-gated).
 */
export interface Requisites {
  legalType: string | null
  legalName: string | null
  taxId: string | null
  vatPayer: boolean
  vatId: string | null
  legalAddress: string | null
  bankName: string | null
  iban: string | null
  signerName: string | null
  signerTitle: string | null
  documentEmail: string | null
  documentEmailCc: string | null
  legalIsComplete: boolean
}

/** Cleared optional fields send `null` — the backend schema is `.nullish()`. */
export interface RequisitesInput {
  legalType?: string | null
  legalName?: string | null
  taxId?: string | null
  vatPayer?: boolean
  vatId?: string | null
  legalAddress?: string | null
  bankName?: string | null
  iban?: string | null
  signerName?: string | null
  signerTitle?: string | null
  documentEmail?: string | null
  documentEmailCc?: string | null
}

const KEY = ['portal-requisites'] as const

/** enabled=false для учасника (не власника) — бек віддає реквізити лише власнику (403). */
export function useRequisites(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<{ requisites: Requisites }>('/portal/company/requisites'),
    enabled,
  })
}

export function useSaveRequisites() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RequisitesInput) =>
      api.patch<{ requisites: Requisites }>('/portal/company/requisites', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}
