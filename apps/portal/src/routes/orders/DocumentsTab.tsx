import { useState } from 'react'
import { toast } from 'sonner'
import { Button, EmptyState, Input, Modal, Skeleton } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import {
  DOC_STATUS_BADGE,
  DOC_STATUS_LABEL,
  DOC_TYPE_CODE,
  DOC_TYPE_LABEL,
  openDocumentPdf,
  useAcceptDocument,
  useOrderDocuments,
  type OrderDocument,
} from '@/lib/documents'

/** 06-ПІДПИС: договір і акт клієнт може ПРИЙНЯТИ (typed signature — клік + ПІБ). */
const ACCEPTABLE_TYPES = new Set(['contract', 'completion_act'])

/** Client-side: list of documents the team issued on this order + accept-флоу. */
export function DocumentsTab({ orderId }: { orderId: string }) {
  const { user } = useAuth()
  // LOW-2 (рішення власника 08.07): приймати договір/акт може лише власник компанії.
  const isOwner = user?.companies.find((c) => c.id === user.activeCompanyId)?.role === 'owner'
  const { data: documents = [], isLoading } = useOrderDocuments(orderId)
  const accept = useAcceptDocument(orderId)
  const [accepting, setAccepting] = useState<OrderDocument | null>(null)
  const [fullName, setFullName] = useState('')

  const submitAccept = () => {
    if (!accepting) return
    accept.mutate(
      { docId: accepting.id, fullName: fullName.trim() },
      {
        onSuccess: () => {
          toast.success(`${accepting.number} прийнято`)
          setAccepting(null)
          setFullName('')
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : 'Не вдалося прийняти документ'),
      }
    )
  }

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
          {/* 06-ПІДПИС: надіслані договір/акт приймає ВЛАСНИК компанії (клік + ПІБ) — LOW-2 */}
          {ACCEPTABLE_TYPES.has(d.type) && d.status === 'sent' ? (
            isOwner ? (
              <Button size="sm" variant="primary" onClick={() => setAccepting(d)}>
                Прийняти
              </Button>
            ) : (
              <span
                className="wfp-mono"
                style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}
                title="Юридичне прийняття доступне лише власнику компанії"
              >
                приймає власник
              </span>
            )
          ) : d.status === 'accepted' && d.acceptedByName ? (
            <span
              className="wfp-mono"
              style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}
              title={d.acceptedAt ? `Прийнято ${formatDate(d.acceptedAt)}` : undefined}
            >
              ✓ {d.acceptedByName}
            </span>
          ) : (
            <span />
          )}
        </div>
      ))}

      {accepting && (
        <Modal
          open
          title={`Прийняти ${DOC_TYPE_LABEL[accepting.type]} ${accepting.number}`}
          onClose={() => setAccepting(null)}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
              Введіть ваше ПІБ як підпис. Ми зафіксуємо ПІБ, час і IP-адресу прийняття — це
              підтвердження вашої згоди з документом.
            </div>
            <Input
              label="Прізвище Імʼя По батькові"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Іваненко Іван Іванович"
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setAccepting(null)}>
                Скасувати
              </Button>
              <Button
                variant="primary"
                loading={accept.isPending}
                disabled={fullName.trim().length < 3}
                onClick={submitAccept}
              >
                ✓ Прийняти документ
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
