import { useState } from 'react'
import { Button, Card, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { TICKET_CATEGORY_LABEL, type TicketCategory } from '@workflo/types'
import { Select } from '@/components/Select'
import { useTeam } from '@/lib/payouts'
import { formatDateTime } from '@/lib/format'
import {
  useWsReplyTicket,
  useWsTicket,
  useWsTicketStream,
  useWsTickets,
  usePatchTicket,
  type WsTicket,
} from '@/lib/support'

const STATUS_META: Record<
  string,
  { tone: 'accent' | 'warning' | 'success' | 'muted'; label: string }
> = {
  open: { tone: 'accent', label: 'Відкрито' },
  pending: { tone: 'warning', label: 'Очікує клієнта' },
  resolved: { tone: 'success', label: 'Вирішено' },
  closed: { tone: 'muted', label: 'Закрито' },
}
const PRIORITY_LABEL: Record<string, string> = {
  low: 'низький',
  normal: 'звичайний',
  high: 'високий',
  urgent: 'терміновий',
}
const STATUS_OPTS = [
  { value: '', label: 'Усі статуси' },
  { value: 'open', label: 'Відкриті' },
  { value: 'pending', label: 'Очікують клієнта' },
  { value: 'resolved', label: 'Вирішені' },
  { value: 'closed', label: 'Закриті' },
]
const ASSIGNEE_OPTS = [
  { value: '', label: 'Усі' },
  { value: 'me', label: 'Мої' },
  { value: 'unassigned', label: 'Без виконавця' },
]

export function SupportPage() {
  const [status, setStatus] = useState('')
  const [assignee, setAssignee] = useState('')
  const { data: tickets, isLoading } = useWsTickets({ status, assignee })
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Підтримка</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // тікети клієнтів — звернення поза замовленням
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, maxWidth: 480 }}>
        <div style={{ flex: 1 }}>
          <Select label="Статус" value={status} onChange={setStatus} options={STATUS_OPTS} />
        </div>
        <div style={{ flex: 1 }}>
          <Select
            label="Виконавець"
            value={assignee}
            onChange={setAssignee}
            options={ASSIGNEE_OPTS}
          />
        </div>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 16 }}
      >
        <div>
          {isLoading ? (
            <Skeleton style={{ height: 200 }} />
          ) : (tickets ?? []).length === 0 ? (
            <EmptyState title="Тікетів немає" description="За цим фільтром звернень немає." />
          ) : (
            <Card>
              {(tickets ?? []).map((t) => (
                <TicketRow
                  key={t.id}
                  t={t}
                  active={selected === t.id}
                  onOpen={() => setSelected(t.id)}
                />
              ))}
            </Card>
          )}
        </div>
        <div>
          {selected ? (
            <TicketDetail id={selected} />
          ) : (
            <Card>
              <div style={{ padding: 20, color: 'var(--wf-fg-muted)', fontSize: 13 }}>
                Оберіть тікет ліворуч.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function TicketRow({ t, active, onOpen }: { t: WsTicket; active: boolean; onOpen: () => void }) {
  const meta = STATUS_META[t.status] ?? { tone: 'accent' as const, label: t.status }
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 8px',
        borderBottom: '1px solid var(--wf-border)',
        background: active ? 'var(--wf-surface)' : 'none',
        border: 'none',
        borderBottomStyle: 'solid',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontWeight: 600,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {t.subject}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          <StatusDot tone={meta.tone} /> {meta.label}
        </span>
      </div>
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 3 }}>
        {t.source === 'email' ? '📧 email · ' : ''}
        {t.company?.name ?? 'без компанії'} ·{' '}
        {t.category
          ? `${TICKET_CATEGORY_LABEL[t.category as TicketCategory] ?? t.category} · `
          : ''}
        {PRIORITY_LABEL[t.priority] ?? t.priority} · {formatDateTime(t.updatedAt)}
      </div>
    </button>
  )
}

function TicketDetail({ id }: { id: string }) {
  const { data, isLoading } = useWsTicket(id)
  const reply = useWsReplyTicket(id)
  const patch = usePatchTicket(id)
  const { data: team } = useTeam()
  useWsTicketStream(id)
  const [text, setText] = useState('')
  const [internal, setInternal] = useState(false)

  if (isLoading || !data) return <Skeleton style={{ height: 300 }} />
  const t = data.ticket

  const assigneeOpts = [
    { value: '', label: 'Без виконавця' },
    ...(team?.members ?? []).map((m) => ({ value: m.profileId, label: m.name })),
  ]

  return (
    <Card title={t.subject} aux={STATUS_META[t.status]?.label ?? t.status}>
      {t.source === 'email' && (
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
        >
          📧 Створено з email-скриньки
        </div>
      )}
      {/* Керування */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}
      >
        <Select
          label="Статус"
          value={t.status}
          onChange={(v) => patch.mutate({ status: v })}
          options={[
            { value: 'open', label: 'Відкрито' },
            { value: 'pending', label: 'Очікує клієнта' },
            { value: 'resolved', label: 'Вирішено' },
            { value: 'closed', label: 'Закрито' },
          ]}
        />
        <Select
          label="Пріоритет"
          value={t.priority}
          onChange={(v) => patch.mutate({ priority: v })}
          options={Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Select
          label="Виконавець"
          value={t.assignedToId ?? ''}
          onChange={(v) => patch.mutate({ assignedToId: v || null })}
          options={assigneeOpts}
        />
      </div>

      {/* Тред */}
      <div
        style={{ display: 'grid', gap: 10, maxHeight: 340, overflowY: 'auto', marginBottom: 12 }}
      >
        {data.messages.map((m) => (
          <div
            key={m.id}
            style={{
              padding: 10,
              borderRadius: 'var(--wf-radius)',
              background: m.isInternal
                ? 'var(--wf-warning-bg, rgba(255,180,0,0.08))'
                : 'var(--wf-surface)',
              border: `1px solid ${m.isInternal ? 'var(--wf-warning)' : 'var(--wf-border)'}`,
            }}
          >
            <div
              className="wfp-mono"
              style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 4 }}
            >
              {m.author.kind === 'team' ? m.author.name : `${m.author.name} (клієнт)`} ·{' '}
              {formatDateTime(m.createdAt)}
              {m.isInternal ? ' · 🔒 внутрішня нотатка' : ''}
            </div>
            <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.content}</div>
          </div>
        ))}
      </div>

      {/* Відповідь */}
      {t.status !== 'closed' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={internal ? 'Внутрішня нотатка (клієнт не бачить)…' : 'Відповідь клієнту…'}
            style={{
              minHeight: 60,
              background: 'var(--wf-surface)',
              color: 'var(--wf-fg)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: 10,
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              Внутрішня нотатка
            </label>
            <Button
              variant="primary"
              size="sm"
              loading={reply.isPending}
              disabled={text.trim().length === 0}
              onClick={() =>
                reply.mutate(
                  { content: text.trim(), isInternal: internal },
                  { onSuccess: () => setText('') }
                )
              }
            >
              Надіслати
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
