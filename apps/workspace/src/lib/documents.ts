import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, api, getAccessToken } from '@/lib/api'

export type DocumentType =
  | 'invoice'
  | 'advance_invoice'
  | 'completion_act'
  | 'specification'
  | 'reconciliation_act'
  | 'contract'
  | 'monthly_report' // 19-Г
export type DocumentStatus = 'draft' | 'generated' | 'sent' | 'accepted' // 06-ПІДПИС

export interface OrderDocument {
  id: string
  type: DocumentType
  number: string
  status: DocumentStatus
  generatedAt: string
  sentAt: string | null
  // 06-ПІДПИС: хто/коли прийняв
  acceptedAt?: string | null
  acceptedByName?: string | null
  // 06-ДОГОВІР-2: зовнішній договір
  signedExternally?: boolean
  contractDate?: string | null
  externalUrl?: string | null
  storedAs?: string | null
}

export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  invoice: 'Рахунок',
  advance_invoice: 'Аванс-рахунок',
  completion_act: 'Акт виконаних робіт',
  specification: 'Специфікація',
  reconciliation_act: 'Акт звірки',
  contract: 'Договір',
  monthly_report: 'Місячний звіт', // 19-Г
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
  monthly_report: 'RPT', // 19-Г
}

/** Status → `.wfp-badge--{cls}` tone (design DOC_STATUS map). */
export const DOC_STATUS_BADGE: Record<DocumentStatus, string> = {
  draft: 'soft',
  generated: 'partial',
  sent: 'partial',
  accepted: 'paid', // зелений тон
}

/** A client document with its originating order (28-Б client card «Документи» tab). */
export interface ClientDocument extends OrderDocument {
  order: { id: string; title: string } | null
}

/** GET /workspace/clients/:id/documents — all of a client's documents across orders.
 * Internal-non-manager on the backend → gate the query with `enabled`. */
export function useClientDocuments(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ['client-documents', companyId],
    queryFn: () =>
      api
        .get<{ documents: ClientDocument[] }>(`/workspace/clients/${companyId}/documents`)
        .then((r) => r.documents),
    enabled: companyId !== '' && enabled,
  })
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

/** 06-Д: видати публічний лінк на рахунок (без логіна; ідемпотентно). */
export function usePublicLink(orderId: string) {
  return useMutation({
    mutationFn: (docId: string) =>
      api.post<{ publicToken: string; url: string }>(
        `/orders/${orderId}/documents/${docId}/public-link`
      ),
  })
}

/** 06-ДОГОВІР-2: реєстрація зовнішнього договору (номер/дата/підписант + файл або лінк). */
export async function registerExternalContract(
  companyId: string,
  input: {
    number: string
    contractDate: string
    signerName: string
    externalUrl?: string
    file?: File | null
  }
): Promise<void> {
  const token = getAccessToken()
  const url = `${API_URL}/workspace/companies/${companyId}/contracts/external`
  let res: Response
  if (input.file) {
    const fd = new FormData()
    fd.append('number', input.number)
    fd.append('contractDate', input.contractDate)
    fd.append('signerName', input.signerName)
    if (input.externalUrl) fd.append('externalUrl', input.externalUrl)
    fd.append('file', input.file)
    res = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      body: fd,
    })
  } else {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        number: input.number,
        contractDate: input.contractDate,
        signerName: input.signerName,
        ...(input.externalUrl ? { externalUrl: input.externalUrl } : {}),
      }),
    })
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    throw new Error(body?.error?.message ?? 'Не вдалося зареєструвати договір')
  }
}

/** 06-ДОГОВІР-2: відкрити збережений файл зовнішнього договору. */
export async function openContractFile(doc: OrderDocument): Promise<void> {
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

/**
 * The PDF endpoint requires Bearer auth (in-memory token), so a plain <a href> can't carry it —
 * fetch the blob and open it in a new tab. Falls back to a printable HTML page when the server
 * has no Chromium (it sets Content-Type accordingly; the browser renders either inline).
 */
export async function openDocumentPdf(orderId: string | null, doc: OrderDocument): Promise<void> {
  const token = getAccessToken()
  // 19-Г: company-scoped документи без замовлення (monthly_report) — generic-роут
  const url = orderId
    ? `${API_URL}/orders/${orderId}/documents/${doc.id}/pdf`
    : `${API_URL}/documents/${doc.id}/pdf`
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Не вдалося відкрити документ')
  const blobUrl = URL.createObjectURL(await res.blob())
  window.open(blobUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}
