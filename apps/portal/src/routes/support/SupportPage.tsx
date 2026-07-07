import { useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusDot } from '@workflo/ui'
import { TICKET_CATEGORY_LABEL, type TicketCategory } from '@workflo/types'
import { formatDateTime } from '@/lib/format'
import {
  useCreateTicket,
  useReplyTicket,
  useTicket,
  useTicketStream,
  useTickets,
  type SupportTicket,
} from '@/lib/support'

const STATUS_META: Record<
  string,
  { tone: 'accent' | 'warning' | 'success' | 'muted'; label: string }
> = {
  open: { tone: 'accent', label: 'Відкрито' },
  pending: { tone: 'warning', label: 'Очікує вас' },
  resolved: { tone: 'success', label: 'Вирішено' },
  closed: { tone: 'muted', label: 'Закрито' },
}
const PRIORITY_LABEL: Record<string, string> = {
  low: 'низький',
  normal: 'звичайний',
  high: 'високий',
  urgent: 'терміновий',
}

export function SupportPage() {
  const { data: tickets, isLoading } = useTickets()
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Підтримка</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // звернення поза замовленням — питання, проблема, запит
          </div>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Звернення
        </Button>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 160 }} />
      ) : (tickets ?? []).length === 0 ? (
        <EmptyState
          title="Звернень ще немає"
          description="Натисніть «+ Звернення», щоб поставити питання команді."
        />
      ) : (
        <Card>
          {(tickets ?? []).map((t) => (
            <TicketRow key={t.id} t={t} onOpen={() => setSelected(t.id)} />
          ))}
        </Card>
      )}

      {creating && <CreateTicketModal onClose={() => setCreating(false)} onCreated={setSelected} />}
      {selected && <TicketThreadModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function TicketRow({ t, onOpen }: { t: SupportTicket; onOpen: () => void }) {
  const meta = STATUS_META[t.status] ?? { tone: 'accent' as const, label: t.status }
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 0',
        borderBottom: '1px solid var(--wf-border)',
        background: 'none',
        border: 'none',
        borderBottomStyle: 'solid',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{t.subject}</div>
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 3 }}
        >
          {t.category
            ? `${TICKET_CATEGORY_LABEL[t.category as TicketCategory] ?? t.category} · `
            : ''}
          {PRIORITY_LABEL[t.priority] ?? t.priority} · {formatDateTime(t.updatedAt)}
        </div>
      </div>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <StatusDot tone={meta.tone} /> {meta.label}
      </span>
    </button>
  )
}

function CreateTicketModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const create = useCreateTicket()
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('question')
  const [priority, setPriority] = useState('normal')
  const [message, setMessage] = useState('')
  const valid = subject.trim().length >= 3 && message.trim().length >= 1

  const controlStyle = {
    width: '100%',
    background: 'var(--wf-surface)',
    color: 'var(--wf-fg)',
    border: '1px solid var(--wf-border)',
    borderRadius: 'var(--wf-radius)',
    padding: '8px 10px',
    fontSize: 13,
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Нове звернення"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={!valid}
            onClick={() =>
              create.mutate(
                { subject: subject.trim(), category, priority, message: message.trim() },
                {
                  onSuccess: (r) => {
                    onClose()
                    onCreated(r.id)
                  },
                }
              )
            }
          >
            Надіслати
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Input
          label="Тема"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Коротко про що"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              КАТЕГОРІЯ
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              style={controlStyle}
            >
              {(Object.keys(TICKET_CATEGORY_LABEL) as TicketCategory[]).map((c) => (
                <option key={c} value={c}>
                  {TICKET_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              ПРІОРИТЕТ
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={controlStyle}
            >
              {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ПОВІДОМЛЕННЯ
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Опишіть детальніше"
            style={{ ...controlStyle, minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>
      </div>
    </Modal>
  )
}

function TicketThreadModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useTicket(id)
  const reply = useReplyTicket(id)
  useTicketStream(id)
  const [text, setText] = useState('')
  const status = data?.ticket.status
  const meta = STATUS_META[status ?? 'open'] ?? { tone: 'accent' as const, label: status ?? '' }

  return (
    <Modal open onClose={onClose} title={data?.ticket.subject ?? 'Тікет'} aux={meta.label}>
      <div style={{ display: 'grid', gap: 12, maxHeight: '60vh' }}>
        <div style={{ display: 'grid', gap: 10, overflowY: 'auto', paddingRight: 4 }}>
          {isLoading ? (
            <Skeleton style={{ height: 80 }} />
          ) : (
            (data?.messages ?? []).map((m) => (
              <div
                key={m.id}
                style={{
                  padding: 10,
                  borderRadius: 'var(--wf-radius)',
                  background:
                    m.author.kind === 'team'
                      ? 'var(--wf-surface)'
                      : 'var(--wf-bg-subtle, var(--wf-surface))',
                  border: '1px solid var(--wf-border)',
                }}
              >
                <div
                  className="wfp-mono"
                  style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 4 }}
                >
                  {m.author.kind === 'team' ? 'Команда' : m.author.name} ·{' '}
                  {formatDateTime(m.createdAt)}
                </div>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))
          )}
        </div>
        {status !== 'closed' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ваша відповідь…"
              style={{
                flex: 1,
                minHeight: 44,
                background: 'var(--wf-surface)',
                color: 'var(--wf-fg)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius)',
                padding: '10px',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <Button
              variant="primary"
              loading={reply.isPending}
              disabled={text.trim().length === 0}
              onClick={() => reply.mutate(text.trim(), { onSuccess: () => setText('') })}
            >
              Надіслати
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
