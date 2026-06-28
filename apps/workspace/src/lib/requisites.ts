import { useQuery } from '@tanstack/react-query'
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
