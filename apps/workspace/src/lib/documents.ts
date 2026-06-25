import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, api, getAccessToken } from '@/lib/api'

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

/** Short code for the `.wfp-doc-type-pill` (design: documents-screens.jsx DocumentsIndex). */
export const DOC_TYPE_CODE: Record<DocumentType, string> = {
  invoice: 'INV',
  advance_invoice: 'ADV',
  completion_act: 'ACT',
  specification: 'SPC',
  reconciliation_act: 'REC',
  contract: 'CTR',
}

/** Status → `.wfp-badge--{cls}` tone (design DOC_STATUS map). */
export const DOC_STATUS_BADGE: Record<DocumentStatus, string> = {
  draft: 'soft',
  generated: 'partial',
  sent: 'partial',
}

export function useOrderDocuments(orderId: string) {
  return useQuery({
    queryKey: ['order-documents', orderId],
    queryFn: () =>
      api
        .get<{ documents: OrderDocument[] }>(`/orders/${orderId}/documents`)
        .then((r) => r.documents),
  })
}

export function useGenerateDocument(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (type: DocumentType) =>
      api.post<{ document: OrderDocument }>(`/orders/${orderId}/documents`, { type }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['order-documents', orderId] }),
  })
}

/** Send a document to the client (status → sent + client notification). */
export function useSendDocument(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (docId: string) =>
      api.post<{ document: OrderDocument }>(`/orders/${orderId}/documents/${docId}/send`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['order-documents', orderId] }),
  })
}

/**
 * The PDF endpoint requires Bearer auth (in-memory token), so a plain <a href> can't carry it —
 * fetch the blob and open it in a new tab. Falls back to a printable HTML page when the server
 * has no Chromium (it sets Content-Type accordingly; the browser renders either inline).
 */
export async function openDocumentPdf(orderId: string, doc: OrderDocument): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(`${API_URL}/orders/${orderId}/documents/${doc.id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Не вдалося відкрити документ')
  const url = URL.createObjectURL(await res.blob())
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
