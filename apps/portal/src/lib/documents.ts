import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, api, getAccessToken } from '@/lib/api'

export type DocumentType =
  | 'invoice'
  | 'advance_invoice'
  | 'completion_act'
  | 'specification'
  | 'reconciliation_act'
  | 'contract'
export type DocumentStatus = 'draft' | 'generated' | 'sent' | 'accepted' // 06-ПІДПИС

export interface OrderDocument {
  id: string
  type: DocumentType
  number: string
  status: DocumentStatus
  generatedAt: string
  sentAt: string | null
  // 06-ПІДПИС: хто/коли прийняв (договір/акт)
  acceptedAt?: string | null
  acceptedByName?: string | null
  // 06-ДОГОВІР-2: зовнішній договір
  signedExternally?: boolean
  externalUrl?: string | null
  storedAs?: string | null
}

/** 06-SEND: документ у зведеному списку порталу (/documents) — з замовленням або без. */
export interface PortalDocument extends OrderDocument {
  order: { id: string; title: string } | null
}

/** 06-SEND: усі надіслані/прийняті документи компаній клієнта. */
export function usePortalDocuments() {
  return useQuery({
    queryKey: ['portal-documents'],
    queryFn: () =>
      api.get<{ documents: PortalDocument[] }>('/portal/documents').then((r) => r.documents),
  })
}

/** 06-SEND: відкриття будь-якого документа зі зведеного списку. */
export async function openPortalDocument(doc: PortalDocument): Promise<void> {
  if (doc.signedExternally) {
    if (doc.storedAs) return openStoredFile(doc)
    if (doc.externalUrl) {
      window.open(doc.externalUrl, '_blank', 'noopener')
      return
    }
    throw new Error('Для договору не додано ні файл, ні посилання')
  }
  const token = getAccessToken()
  const url = doc.order
    ? `${API_URL}/orders/${doc.order.id}/documents/${doc.id}/pdf`
    : `${API_URL}/documents/${doc.id}/pdf` // monthly_report без замовлення
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Не вдалося відкрити документ')
  const blobUrl = URL.createObjectURL(await res.blob())
  window.open(blobUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}

async function openStoredFile(doc: PortalDocument): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(`${API_URL}/documents/${doc.id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Не вдалося відкрити файл')
  const blobUrl = URL.createObjectURL(await res.blob())
  window.open(blobUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
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
  accepted: 'прийнято', // 06-ПІДПИС
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
  accepted: 'paid', // зелений тон — той самий, що «оплачено»
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

/** 06-ПІДПИС: клієнт приймає договір/акт — клік + ПІБ (typed signature). */
export function useAcceptDocument(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ docId, fullName }: { docId: string; fullName: string }) =>
      api.post(`/portal/documents/${docId}/accept`, { fullName }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['order-documents', orderId] })
      void qc.invalidateQueries({ queryKey: ['portal-documents'] })
    },
  })
}

/**
 * The PDF endpoint requires Bearer auth (in-memory token), so fetch the blob and open it in a new
 * tab. Falls back to a printable HTML page when the server has no Chromium.
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
