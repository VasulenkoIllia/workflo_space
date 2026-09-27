import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, EmptyState, Icon, Input, Modal, Skeleton, StatusDot } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { CLIENT_STATUS_META } from '@/lib/orders'
import {
  DOC_STATUS_BADGE,
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  openPortalDocument,
  useAcceptDocument,
  usePortalDocuments,
  type DocumentType,
  type PortalDocument,
} from '@/lib/documents'

/**
 * 06-SEND → DSN-5 (design-v2 portal-client-p1.jsx PortalDocsHub): документи клієнта
 * згруповані ПО ЗАМОВЛЕННЯХ (статус замовлення + «Відкрити замовлення») + сегмент «Договори».
 * Inline-дії: «Оплатити» неоплаченого рахунку (→ замовлення, де «Як оплатити»), «Прийняти»
 * договір/акт (лише власник компанії, LOW-2), перегляд / завантаження PDF.
 * «Сформувати документ» (06-Б self-service) — backend-blocked, свідомо не показуємо.
 */
const ACCEPTABLE_TYPES = new Set<DocumentType>(['contract', 'completion_act'])
const INVOICE_TYPES = new Set<DocumentType>(['invoice', 'advance_invoice'])

const DOC_ICON: Record<DocumentType, 'receipt' | 'check' | 'file' | 'list'> = {
  invoice: 'receipt',
  advance_invoice: 'receipt',
  completion_act: 'check',
  specification: 'list',
  reconciliation_act: 'file',
  contract: 'file',
  monthly_report: 'list',
}

type View = 'orders' | 'contracts'

interface OrderGroup {
  order: NonNullable<PortalDocument['order']>
  docs: PortalDocument[]
}

export function DocumentsPage() {
  const { user } = useAuth()
  // LOW-2 (рішення власника 08.07): приймати договір/акт (юр. підпис) може лише власник компанії.
  const isOwner = user?.companies.find((c) => c.id === user.activeCompanyId)?.role === 'owner'
  const { data: documents = [], isLoading, isError } = usePortalDocuments()
  const accept = useAcceptDocument('') // інвалідовує portal-documents
  const [accepting, setAccepting] = useState<PortalDocument | null>(null)
  const [fullName, setFullName] = useState('')
  const [view, setView] = useState<View>('orders')

  const { groups, loose, contracts } = useMemo(() => {
    const byOrder = new Map<string, OrderGroup>()
    const loose: PortalDocument[] = []
    for (const d of documents) {
      if (!d.order) {
        if (d.type !== 'contract') loose.push(d) // рамкові договори — у сегменті «Договори»
        continue
      }
      const g = byOrder.get(d.order.id)
      if (g) g.docs.push(d)
      else byOrder.set(d.order.id, { order: d.order, docs: [d] })
    }
    // documents уже відсортовані за generatedAt desc → групи в порядку найсвіжішого документа
    return {
      groups: [...byOrder.values()],
      loose,
      contracts: documents.filter((d) => d.type === 'contract'),
    }
  }, [documents])

  const act = (d: PortalDocument, download = false) => {
    void openPortalDocument(d, { download }).catch((err) =>
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

  const rowProps = { isOwner, onOpen: act, onAccept: setAccepting }

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Документи</h1>
          <div className="wfp-ph-sub">
            // всі документи, що надсилаються клієнту — в одному місці
          </div>
        </div>
      </div>

      <div className="wff-seg" role="tablist" style={{ marginBottom: 20 }}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'orders'}
          className="wff-seg-opt"
          data-on={view === 'orders' || undefined}
          onClick={() => setView('orders')}
        >
          По замовленнях
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'contracts'}
          className="wff-seg-opt"
          data-on={view === 'contracts' || undefined}
          onClick={() => setView('contracts')}
        >
          Договори{contracts.length > 0 ? ` · ${contracts.length}` : ''}
        </button>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 220 }} />
      ) : isError ? (
        <EmptyState
          glyph="// помилка"
          title="Не вдалося завантажити документи"
          description="Оновіть сторінку. Якщо повториться — напишіть у підтримку."
        />
      ) : documents.length === 0 ? (
        <EmptyState
          glyph="// docs"
          title="Документів ще немає"
          description="Щойно агенція надішле рахунок, акт чи договір — вони зʼявляться тут."
        />
      ) : view === 'contracts' ? (
        <>
          <div className="wfc-sec-h">
            <span className="wfc-sec-h-t">Договори та угоди</span>
            <span className="wfc-sec-h-s">// рамкові · діють на всі замовлення</span>
          </div>
          {contracts.length === 0 ? (
            <EmptyState
              glyph="// договори"
              title="Договорів ще немає"
              description="Коли агенція надішле договір — він зʼявиться тут, і ви зможете його прийняти."
            />
          ) : (
            contracts.map((d) => <DocRow key={d.id} d={d} showOrder {...rowProps} />)
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((g) => {
            const meta = CLIENT_STATUS_META[g.order.clientStatus]
            return (
              <section key={g.order.id} className="wfp-card" style={{ padding: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '13px 16px',
                    borderBottom: '1px solid var(--wf-border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: 'var(--wf-fg-muted)', display: 'inline-flex' }}>
                    <Icon name="kanban" size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.order.title}</div>
                    <div
                      className="wfp-mono"
                      style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}
                    >
                      #{g.order.id.slice(0, 6)} · {g.docs.length} док.
                    </div>
                  </div>
                  {meta && (
                    <span className="wfp-order-status">
                      <StatusDot tone={meta.tone} /> {meta.label}
                    </span>
                  )}
                  <Link to={`/orders/${g.order.id}`} className="wfp-btn wfp-btn--ghost wfp-btn--sm">
                    Відкрити замовлення →
                  </Link>
                </div>
                <div style={{ padding: '4px 0' }}>
                  {g.docs.map((d) => (
                    <DocLine key={d.id} d={d} {...rowProps} />
                  ))}
                </div>
              </section>
            )
          })}
          {loose.length > 0 && (
            <div>
              <div className="wfc-sec-h" style={{ marginTop: 8 }}>
                <span className="wfc-sec-h-t">Інші документи</span>
                <span className="wfc-sec-h-s">// без замовлення · звіти, акти звірки</span>
              </div>
              {loose.map((d) => (
                <DocRow key={d.id} d={d} {...rowProps} />
              ))}
            </div>
          )}
          {groups.length === 0 && loose.length === 0 && (
            <EmptyState
              glyph="// docs"
              title="Документів по замовленнях ще немає"
              description="Договори — у сегменті «Договори» вище."
            />
          )}
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

interface RowProps {
  d: PortalDocument
  isOwner: boolean
  onOpen: (d: PortalDocument, download?: boolean) => void
  onAccept: (d: PortalDocument) => void
}

/** Рядок документа всередині групи замовлення (компактний, як у дизайні). */
function DocLine({ d, ...p }: RowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
        borderTop: '1px solid var(--wf-border)',
        flexWrap: 'wrap',
      }}
    >
      <span className="wfc-doc-ico">
        <Icon name={DOC_ICON[d.type] ?? 'file'} size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div
          style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {DOC_TYPE_LABEL[d.type] ?? d.type}
          <span
            className="wfp-mono"
            style={{ fontSize: 10.5, color: 'var(--wf-accent)', fontWeight: 400 }}
          >
            {d.number}
          </span>
        </div>
        <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>
          {formatDate(d.sentAt ?? d.generatedAt)}
          {d.signedExternally ? ' · зовнішній' : ''}
        </div>
      </div>
      <DocActions d={d} {...p} />
    </div>
  )
}

/** Окремий рядок-картка (сегмент «Договори» / «Інші документи»). */
function DocRow({ d, showOrder, ...p }: RowProps & { showOrder?: boolean }) {
  return (
    <div className="wfc-doc-row">
      <span className="wfc-doc-ico">
        <Icon name={DOC_ICON[d.type] ?? 'file'} size={16} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="wfc-doc-name">
          {DOC_TYPE_LABEL[d.type] ?? d.type} {d.number}
        </div>
        <div className="wfc-doc-meta">
          {formatDate(d.sentAt ?? d.generatedAt)}
          {d.signedExternally ? ' · зовнішній' : ''}
          {showOrder && d.order ? (
            <>
              {' · '}
              <Link to={`/orders/${d.order.id}`} style={{ color: 'var(--wf-fg-secondary)' }}>
                {d.order.title}
              </Link>
            </>
          ) : null}
        </div>
      </div>
      <span />
      <DocActions d={d} {...p} />
    </div>
  )
}

function DocActions({ d, isOwner, onOpen, onAccept }: RowProps) {
  const navigate = useNavigate()
  const orderId = d.order?.id
  const unpaidInvoice =
    INVOICE_TYPES.has(d.type) && d.status === 'sent' && d.order != null && d.order.paidAt == null
  const awaitingAccept = ACCEPTABLE_TYPES.has(d.type) && d.status === 'sent'
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {unpaidInvoice && orderId && (
        <Button size="sm" variant="primary" onClick={() => navigate(`/orders/${orderId}`)}>
          Оплатити
        </Button>
      )}
      {awaitingAccept &&
        (isOwner ? (
          <Button size="sm" variant="primary" onClick={() => onAccept(d)}>
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
        ))}
      {d.status === 'accepted' && d.acceptedByName ? (
        <span
          className="wfp-mono"
          style={{ fontSize: 10, color: 'var(--wf-success)' }}
          title={d.acceptedAt ? `Прийнято ${formatDate(d.acceptedAt)}` : undefined}
        >
          ✓ {d.acceptedByName}
        </span>
      ) : (
        !unpaidInvoice &&
        !awaitingAccept && (
          <span className={`wfp-badge wfp-badge--${DOC_STATUS_BADGE[d.status]}`}>
            {INVOICE_TYPES.has(d.type) && d.order?.paidAt ? 'оплачено' : DOC_STATUS_LABEL[d.status]}
          </span>
        )
      )}
      <button
        type="button"
        className="wfp-iconbtn"
        title="Переглянути"
        aria-label={`Переглянути ${d.number}`}
        onClick={() => onOpen(d)}
      >
        <Icon name="search" size={14} />
      </button>
      <button
        type="button"
        className="wfp-iconbtn"
        title="Завантажити"
        aria-label={`Завантажити ${d.number}`}
        onClick={() => onOpen(d, true)}
      >
        <Icon name="download" size={14} />
      </button>
    </div>
  )
}
