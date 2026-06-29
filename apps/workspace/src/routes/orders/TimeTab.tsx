import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, EmptyState, Icon, Input } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateTimeLog, useDeleteTimeLog, useTimeLogs, type TimeLog } from '@/lib/orderDetail'
import { formatElapsed, useActiveTimer, useStartTimer, useStopTimer } from '@/lib/timer'
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
      <OrderTimerControl orderId={orderId} />

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

/** Prominent start/stop timer for this order (02-orders T2, фінд.#3 «помітність таймера»).
 * Shows the live-ticking elapsed when this order's timer runs; starting auto-stops any other. */
function OrderTimerControl({ orderId }: { orderId: string }) {
  const { data: timer } = useActiveTimer()
  const start = useStartTimer()
  const stop = useStopTimer()
  const [now, setNow] = useState(() => Date.now())

  const runningHere = Boolean(timer?.startedAt && timer.orderId === orderId)
  const runningElsewhere = Boolean(timer?.startedAt && timer.orderId !== orderId)

  useEffect(() => {
    if (!runningHere) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [runningHere])

  return (
    <div className="wfp-wod-sec">
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <div className="wfp-wod-sec-h" style={{ margin: 0 }}>
          // таймер
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {runningHere && timer?.startedAt && (
            <span className="wfp-mono" style={{ fontSize: 16, fontWeight: 600 }}>
              {formatElapsed(timer.startedAt, now)}
            </span>
          )}
          {runningHere ? (
            <Button
              variant="primary"
              loading={stop.isPending}
              onClick={() =>
                stop.mutate(undefined, {
                  onSuccess: (r) =>
                    toast.success(r.timer ? `Час записано: ${r.timer.hours} год` : 'Зупинено'),
                  onError: () => toast.error('Не вдалося зупинити таймер'),
                })
              }
            >
              Зупинити
            </Button>
          ) : (
            <Button
              variant="secondary"
              loading={start.isPending}
              onClick={() =>
                start.mutate(orderId, {
                  onSuccess: () => toast.success('Таймер запущено'),
                  onError: () => toast.error('Не вдалося запустити таймер'),
                })
              }
            >
              Засікти час
            </Button>
          )}
        </div>
      </div>
      {runningElsewhere && (
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 8 }}
        >
          // біжить інший таймер — старт зупинить його й запише час
        </div>
      )}
    </div>
  )
}
