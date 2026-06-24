import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type DocumentType =
  | 'invoice'
  | 'advance_invoice'
  | 'completion_act'
  | 'specification'
  | 'reconciliation_act'
  | 'contract'
export type DocumentStatus = 'draft' | 'generated' | 'sent'

export interface OrderDocument {
  id: string
  type: DocumentType
  number: string
  status: DocumentStatus
  generatedAt: string
  sentAt: string | null
}

export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  invoice: 'Рахунок',
  advance_invoice: 'Аванс-рахунок',
  completion_act: 'Акт виконаних робіт',
  specification: 'Специфікація',
  reconciliation_act: 'Акт звірки',
  contract: 'Договір',
}

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: 'чернетка',
  generated: 'сформовано',
  sent: 'надіслано',
}

/** Read-only: the client sees documents the team issued on their order. */
export function useOrderDocuments(orderId: string) {
  return useQuery({
    queryKey: ['order-documents', orderId],
    queryFn: () =>
      api
        .get<{ documents: OrderDocument[] }>(`/orders/${orderId}/documents`)
        .then((r) => r.documents),
  })
}
