import { useState } from 'react'
import { toast } from 'sonner'
import { Button, EmptyState, Icon, Input } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateTimeLog, useDeleteTimeLog, useTimeLogs, type TimeLog } from '@/lib/orderDetail'
import { formatDate } from '@/lib/format'

/** YYYY-MM-DD for the date input default (local time). */
function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function TimeTab({ orderId }: { orderId: string }) {
  const { user } = useAuth()
  const myId = user?.profile.id
  const { data, isLoading } = useTimeLogs(orderId)
  const create = useCreateTimeLog(orderId)
  const del = useDeleteTimeLog(orderId)

  const [hours, setHours] = useState('')
  const [date, setDate] = useState(today())
  const [comment, setComment] = useState('')

  const logs = data?.logs ?? []
  const total = data?.totalHours ?? 0

  const submit = () => {
    const h = Number(hours.replace(',', '.'))
    if (!Number.isFinite(h) || h <= 0 || h > 24) {
      toast.error('Години: число від 0 до 24')
      return
    }
    create.mutate(
      { hours: h, date, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setHours('')
          setComment('')
        },
      }
    )
  }

  return (
    <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="wfp-wod-sec">
        <div className="wfp-wod-sec-h">// додати час</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 90 }}>
            <Input
              label="Годин"
              inputMode="decimal"
              placeholder="2.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div style={{ width: 150 }}>
            <Input
              label="Дата"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Input
              label="Коментар"
              placeholder="що зроблено (необовʼязково)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
          </div>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            <Icon name="plus" size={13} />
            Додати
          </Button>
        </div>
      </div>

      <div className="wfp-wod-sec">
        <div className="wfp-wod-sec-h">// тайм-лог · {total} год</div>
        {isLoading ? (
          <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
            // завантаження…
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="Записів ще немає" description="Залогуйте перші години роботи вище." />
        ) : (
          logs.map((t) => (
            <TimeRow
              key={t.id}
              log={t}
              canDelete={t.executorId === myId}
              onDelete={() => del.mutate(t.id)}
              deleting={del.isPending && del.variables === t.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TimeRow({
  log,
  canDelete,
  onDelete,
  deleting,
}: {
  log: TimeLog
  canDelete: boolean
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="wfp-timelog-row">
      <span className="wfp-timelog-date">{formatDate(log.date)}</span>
      <span className="wfp-timelog-hrs">{log.hours}h</span>
      <span className="wfp-timelog-desc">{log.comment || '—'}</span>
      {canDelete && (
        <button
          type="button"
          className="wfp-iconbtn"
          title="Видалити запис"
          onClick={onDelete}
          disabled={deleting}
          style={{ marginLeft: 'auto' }}
        >
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  )
}
