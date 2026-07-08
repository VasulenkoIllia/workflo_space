import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  openPortalDocument,
  useAcceptDocument,
  usePortalDocuments,
  type PortalDocument,
} from '@/lib/documents'

/**
 * 06-SEND: усі документи клієнта одним екраном (був Placeholder). Клієнт бачить
 * лише надіслані/прийняті документи своїх компаній: рахунки, акти, договори
 * (вкл. зовнішні), специфікації, місячні звіти. Договір/акт можна прийняти тут же.
 */
const ACCEPTABLE_TYPES = new Set(['contract', 'completion_act'])

export function DocumentsPage() {
  const { user } = useAuth()
  // LOW-2 (рішення власника 08.07): приймати договір/акт (юр. підпис) може лише власник компанії.
  const isOwner = user?.companies.find((c) => c.id === user.activeCompanyId)?.role === 'owner'
  const { data: documents = [], isLoading } = usePortalDocuments()
  const accept = useAcceptDocument('') // інвалідовує portal-documents
  const [accepting, setAccepting] = useState<PortalDocument | null>(null)
  const [fullName, setFullName] = useState('')

  const open = (d: PortalDocument) => {
    void openPortalDocument(d).catch((err) =>
      toast.error(err instanceof Error ? err.message : 'Не вдалося відкрити документ')
    )
  }

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

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Документи</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 20 }}
      >
        // рахунки · акти · договори · специфікації · місячні звіти
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 220 }} />
      ) : documents.length === 0 ? (
        <EmptyState
          glyph="// docs"
          title="Документів ще немає"
          description="Щойно агенція надішле рахунок, акт чи договір — вони зʼявляться тут."
        />
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {documents.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1.5fr 1fr auto auto',
                alignItems: 'center',
                gap: 12,
                padding: '10px 8px',
                borderBottom: '1px solid var(--wf-border)',
              }}
            >
              <button
                type="button"
                className="wfp-mono"
                title="Переглянути"
                onClick={() => open(d)}
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span className="wfp-doc-type-pill" data-t={d.type}>
                  {DOC_TYPE_CODE[d.type]}
                </span>
                <span
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {DOC_TYPE_LABEL[d.type]}
                  {d.signedExternally ? ' · зовнішній' : ''}
                </span>
              </span>
              <span style={{ minWidth: 0, fontSize: 13 }}>
                {d.order ? (
                  <Link to={`/orders/${d.order.id}`} style={{ color: 'var(--wf-fg-secondary)' }}>
                    {d.order.title}
                  </Link>
                ) : (
                  <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                    —
                  </span>
                )}
              </span>
              <span className={`wfp-badge wfp-badge--${DOC_STATUS_BADGE[d.status]}`}>
                {DOC_STATUS_LABEL[d.status]}
              </span>
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
                <span
                  className="wfp-mono"
                  style={{ fontSize: 11, color: 'var(--wf-fg-muted)', whiteSpace: 'nowrap' }}
                >
                  {formatDate(d.generatedAt)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {accepting && (
        <Modal
          open
          title={`Прийняти ${DOC_TYPE_LABEL[accepting.type]} ${accepting.number}`}
          onClose={() => setAccepting(null)}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
              Введіть ваше ПІБ як підпис. Ми зафіксуємо ПІБ, час і IP-адресу прийняття.
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
