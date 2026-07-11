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
  usePublicLink,
  useSendDocument,
  type DocumentType,
  type OrderDocument,
} from '@/lib/documents'

const GENERATE: { type: DocumentType; label: string }[] = [
  { type: 'invoice', label: 'Рахунок' },
  { type: 'advance_invoice', label: 'Аванс' },
  { type: 'completion_act', label: 'Акт' },
  { type: 'specification', label: 'Специфікація' },
  { type: 'reconciliation_act', label: 'Звірка' },
  { type: 'contract', label: 'Договір' },
]

/** Team-side documents tab: list the order's documents + generate an invoice/act/spec. */
export function DocumentsTab({ orderId }: { orderId: string }) {
  const { data: documents = [], isLoading } = useOrderDocuments(orderId)
  const generate = useGenerateDocument(orderId)
  const send = useSendDocument(orderId)
  const publicLink = usePublicLink(orderId)

  const onGenerate = (type: DocumentType) =>
    generate.mutate(type, {
      onSuccess: (r) => toast.success(`Сформовано: ${r.document.number}`),
    })

  const onSend = (d: OrderDocument) =>
    send.mutate(d.id, {
      onSuccess: (r) => toast.success(`Надіслано клієнту: ${r.document.number}`),
    })

  // 06-Д: лінк без логіна — копіюємо в буфер (ідемпотентно, токен видається раз)
  const onPublicLink = (d: OrderDocument) =>
    publicLink.mutate(d.id, {
      onSuccess: (r) => {
        void navigator.clipboard.writeText(r.url).then(
          () => toast.success('Публічне посилання скопійовано'),
          () => toast.info(r.url) // буфер недоступний — показуємо лінк
        )
      },
      onError: () => toast.error('Не вдалося видати посилання'),
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {(d.type === 'invoice' || d.type === 'advance_invoice') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Публічне посилання на рахунок (без логіна)"
                    loading={publicLink.isPending && publicLink.variables === d.id}
                    onClick={() => onPublicLink(d)}
                  >
                    🔗
                  </Button>
                )}
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
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 12 }}
      >
        // Клік на номер → PDF · «Надіслати» → сповіщення + статус «надіслано» · 🔗 → публічний лінк
        рахунку без логіна.
      </div>
    </div>
  )
}
