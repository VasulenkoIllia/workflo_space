import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@workflo/ui'
import { formatElapsed, useActiveTimer, useStopTimer } from '@/lib/timer'

/** Global floating timer bar (02-orders T2). Shows the running timer with a live-ticking
 * elapsed and a Stop button; renders nothing when no timer is running. Mounted app-wide. */
export function TimerBar() {
  const { data: timer } = useActiveTimer()
  const stop = useStopTimer()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!timer?.startedAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [timer?.startedAt])

  if (!timer?.startedAt) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: 'var(--wf-surface)',
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
        maxWidth: 320,
      }}
    >
      <span
        title="таймер біжить"
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: 'var(--wf-destructive)',
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div className="wfp-mono" style={{ fontSize: 16, fontWeight: 600 }}>
          {formatElapsed(timer.startedAt, now)}
        </div>
        <Link
          to={`/orders/${timer.orderId}`}
          className="wfp-link"
          style={{
            fontSize: 11,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 200,
          }}
        >
          {timer.order?.title ?? 'замовлення'}
        </Link>
      </div>
      <Button
        size="sm"
        variant="primary"
        loading={stop.isPending}
        onClick={() =>
          stop.mutate(undefined, {
            onSuccess: (r) =>
              toast.success(r.timer ? `Час записано: ${r.timer.hours} год` : 'Таймер зупинено'),
          })
        }
      >
        Стоп
      </Button>
    </div>
  )
}
