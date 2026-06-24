import { EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { formatDate } from '@/lib/format'
import { DOC_STATUS_LABEL, DOC_TYPE_LABEL, useOrderDocuments } from '@/lib/documents'

/** Client-side: read-only list of documents the team issued on this order. */
export function DocumentsTab({ orderId }: { orderId: string }) {
  const { data: documents = [], isLoading } = useOrderDocuments(orderId)

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gap: 8, padding: '14px 0' }}>
        <Skeleton style={{ height: 40 }} />
        <Skeleton style={{ height: 40 }} />
      </div>
    )
  }
  if (documents.length === 0) {
    return (
      <div style={{ padding: '14px 0' }}>
        <EmptyState
          glyph="// docs"
          title="Документів ще немає"
          description="Рахунки, акти та специфікації зʼявляться тут після виставлення командою."
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 2, padding: '8px 0' }}>
      {documents.map((d) => (
        <div
          key={d.id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1.4fr 1fr auto',
            alignItems: 'center',
            gap: 12,
            padding: '10px 8px',
            borderBottom: '1px solid var(--wf-border)',
          }}
        >
          <span className="wfp-mono" style={{ fontSize: 12 }}>
            {d.number}
          </span>
          <span style={{ fontWeight: 500 }}>{DOC_TYPE_LABEL[d.type]}</span>
          <span
            className="wfp-mono"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <StatusDot tone={d.status === 'sent' ? 'success' : 'accent'} />
            {DOC_STATUS_LABEL[d.status]}
          </span>
          <span
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', whiteSpace: 'nowrap' }}
          >
            {formatDate(d.generatedAt)}
          </span>
        </div>
      ))}
    </div>
  )
}
