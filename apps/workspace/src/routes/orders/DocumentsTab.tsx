import { toast } from 'sonner'
import { Button, EmptyState, Skeleton } from '@workflo/ui'
import { formatDate } from '@/lib/format'
import {
  DOC_STATUS_BADGE,
  DOC_STATUS_LABEL,
  DOC_TYPE_CODE,
  DOC_TYPE_LABEL,
  openDocumentPdf,
  useGenerateDocument,
  useOrderDocuments,
  useSendDocument,
  type DocumentType,
  type OrderDocument,
} from '@/lib/documents'

const GENERATE: { type: DocumentType; label: string }[] = [
  { type: 'invoice', label: 'Рахунок' },
  { type: 'completion_act', label: 'Акт' },
  { type: 'specification', label: 'Специфікація' },
]

/** Team-side documents tab: list the order's documents + generate an invoice/act/spec. */
export function DocumentsTab({ orderId }: { orderId: string }) {
  const { data: documents = [], isLoading } = useOrderDocuments(orderId)
  const generate = useGenerateDocument(orderId)
  const send = useSendDocument(orderId)

  const onGenerate = (type: DocumentType) =>
    generate.mutate(type, {
      onSuccess: (r) => toast.success(`Сформовано: ${r.document.number}`),
      onError: (e) =>
        toast.error('Не вдалося сформувати', {
          description: e instanceof Error ? e.message : undefined,
        }),
    })

  const onSend = (d: OrderDocument) =>
    send.mutate(d.id, {
      onSuccess: (r) => toast.success(`Надіслано клієнту: ${r.document.number}`),
      onError: (e) =>
        toast.error('Не вдалося надіслати', {
          description: e instanceof Error ? e.message : undefined,
        }),
    })

  return (
    <div className="wfp-chat" style={{ display: 'block' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {GENERATE.map((g) => (
          <Button
            key={g.type}
            variant="secondary"
            size="sm"
            loading={generate.isPending}
            onClick={() => onGenerate(g.type)}
          >
            + {g.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <Skeleton style={{ height: 40 }} />
          <Skeleton style={{ height: 40 }} />
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          glyph="// ∅"
          title="Документів ще немає"
          description="Сформуйте рахунок або акт із цього замовлення кнопками вище."
        />
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {documents.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1.3fr 1fr auto auto',
                alignItems: 'center',
                gap: 12,
                padding: '10px 8px',
                borderBottom: '1px solid var(--wf-border)',
              }}
            >
              <button
                type="button"
                className="wfp-mono"
                title="Переглянути PDF"
                onClick={() =>
                  void openDocumentPdf(orderId, d).catch(() =>
                    toast.error('Не вдалося відкрити документ')
                  )
                }
                style={{
                  fontSize: 12,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--wf-accent)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {d.number}
              </button>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="wfp-doc-type-pill" data-t={d.type}>
                  {DOC_TYPE_CODE[d.type]}
                </span>
                {DOC_TYPE_LABEL[d.type]}
              </span>
              <span className={`wfp-badge wfp-badge--${DOC_STATUS_BADGE[d.status]}`}>
                {DOC_STATUS_LABEL[d.status]}
              </span>
              <span
                className="wfp-mono"
                style={{ fontSize: 11, color: 'var(--wf-fg-muted)', whiteSpace: 'nowrap' }}
              >
                {formatDate(d.generatedAt)}
              </span>
              {d.status === 'sent' ? (
                <span
                  className="wfp-mono"
                  title="Надіслано клієнту"
                  style={{ fontSize: 11, color: 'var(--wf-success, var(--wf-accent))' }}
                >
                  ✓ надіслано
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={send.isPending && send.variables === d.id}
                  onClick={() => onSend(d)}
                >
                  Надіслати
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 12 }}
      >
        // Клік на номер → PDF · «Надіслати» → клієнт отримує сповіщення + статус «надіслано».
      </div>
    </div>
  )
}
