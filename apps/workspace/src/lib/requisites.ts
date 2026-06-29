import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /workspace/clients/:id/requisites (06-Б, P-3) — the document "to" party legal data.
 * Internal team only; managers are 403'd (legal/PII), so gate the query with enabled. */
export interface ClientRequisites {
  id: string
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

export function useClientRequisites(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ['ws-client-requisites', companyId],
    queryFn: () =>
      api.get<{ requisites: ClientRequisites }>(`/workspace/clients/${companyId}/requisites`),
    enabled: companyId !== '' && enabled,
  })
}

/** Editable requisite fields (28-Б agency-on-behalf). Empty strings → null on submit. */
export type ClientRequisitesInput = Partial<{
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
}>

/** PATCH /workspace/clients/:id/requisites — agency edits the client's legal data on behalf. */
export function useUpdateClientRequisites(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ClientRequisitesInput) =>
      api.patch<{ requisites: ClientRequisites }>(
        `/workspace/clients/${companyId}/requisites`,
        body
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-client-requisites', companyId] }),
  })
}
