import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, EmptyState, Input, Modal, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import {
  LEAVE_STATUS_BADGE,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  useCancelLeave,
  useCreateLeave,
  useDecideLeave,
  useLeaveBalance,
  useLeaves,
  type LeaveRequest,
  type LeaveType,
} from '@/lib/leave'

/**
 * S13-04/05 LEAVE (дизайн calendar-plus WsLeaves): відсутності команди.
 * Всі internal-члени подають заявки і бачать свій баланс; owner/manager бачать
 * усіх + чергу погодження (approve / reject з причиною).
 */
export function LeavePage() {
  const { data, isLoading } = useLeaves()
  const balance = useLeaveBalance()
  const decide = useDecideLeave()
  const cancel = useCancelLeave()
  const [creating, setCreating] = useState(false)
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null)

  const leaves = data?.leaves ?? []
  const canReview = data?.canReview ?? false
  const pending = useMemo(() => leaves.filter((l) => l.status === 'pending'), [leaves])
  const nowOff = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return leaves.filter(
      (l) =>
        l.status === 'approved' &&
        l.startDate.slice(0, 10) <= today &&
        l.endDate.slice(0, 10) >= today
    ).length
  }, [leaves])
  const b = balance.data?.balance

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Відсутності</div>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 20 }}
          >
            // відпустки · лікарняні · відгули — робочі дні пн–пт
          </div>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Заявка
        </Button>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 18 }}>
        {b && (
          <>
            <div className="wfp-stat">
              <div className="wfp-stat-k">мій баланс відпустки</div>
              <div className="wfp-stat-v">
                {b.balanceDays}{' '}
                <span style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                  з {b.accruedDays} дн.
                </span>
              </div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">використано / на погодженні</div>
              <div className="wfp-stat-v">
                {b.usedDays} · {b.pendingDays}
              </div>
            </div>
          </>
        )}
        {canReview && (
          <>
            <div className="wfp-stat">
              <div className="wfp-stat-k">на погодження</div>
              <div className="wfp-stat-v">{pending.length}</div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">відсутні зараз</div>
              <div className="wfp-stat-v">{nowOff}</div>
            </div>
          </>
        )}
      </div>

      {canReview && pending.length > 0 && (
        <Card title="Черга погодження">
          <div style={{ display: 'grid', gap: 2 }}>
            {pending.map((l) => (
              <LeaveRow key={l.id} l={l} showName>
                <Button
                  size="sm"
                  variant="primary"
                  loading={decide.isPending && decide.variables?.id === l.id}
                  onClick={() =>
                    decide.mutate(
                      { id: l.id, action: 'approve' },
                      {
                        onSuccess: () => toast.success('Погоджено'),
                        onError: (err) =>
                          toast.error(err instanceof ApiError ? err.message : 'Не вдалося'),
                      }
                    )
                  }
                >
                  Погодити
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(l)}>
                  Відхилити
                </Button>
              </LeaveRow>
            ))}
          </div>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Card title={canReview ? 'Усі заявки' : 'Мої заявки'}>
          {isLoading ? (
            <Skeleton style={{ height: 160 }} />
          ) : leaves.length === 0 ? (
            <EmptyState
              glyph="// 🌴"
              title="Заявок ще немає"
              description="Подай першу — власник або менеджер погодить."
            />
          ) : (
            <div style={{ display: 'grid', gap: 2 }}>
              {leaves.map((l) => (
                <LeaveRow key={l.id} l={l} showName={canReview}>
                  {l.status === 'pending' && !canReview && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        cancel.mutate(l.id, { onSuccess: () => toast.success('Скасовано') })
                      }
                    >
                      Скасувати
                    </Button>
                  )}
                  {l.status === 'rejected' && l.rejectReason && (
                    <span
                      className="wfp-mono"
                      style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}
                      title={l.rejectReason}
                    >
                      // {l.rejectReason}
                    </span>
                  )}
                </LeaveRow>
              ))}
            </div>
          )}
        </Card>
      </div>

      {creating && <CreateLeaveModal onClose={() => setCreating(false)} />}
      {rejecting && <RejectModal leave={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}

function LeaveRow({
  l,
  showName,
  children,
}: {
  l: LeaveRequest
  showName?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showName ? '1fr auto auto auto auto' : '1fr auto auto auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 8px',
        borderBottom: '1px solid var(--wf-border)',
      }}
    >
      <span style={{ minWidth: 0 }}>
        {showName && <div style={{ fontSize: 14, fontWeight: 500 }}>{l.profile.name}</div>}
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
          {formatDate(l.startDate)} – {formatDate(l.endDate)} · {l.days} роб. дн.
          {l.reason ? ` · ${l.reason}` : ''}
        </div>
      </span>
      <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        {LEAVE_TYPE_LABEL[l.type]}
      </span>
      <span className={`wfp-badge wfp-badge--${LEAVE_STATUS_BADGE[l.status]}`}>
        {LEAVE_STATUS_LABEL[l.status]}
      </span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{children}</span>
    </div>
  )
}

function CreateLeaveModal({ onClose }: { onClose: () => void }) {
  const create = useCreateLeave()
  const [type, setType] = useState<LeaveType>('vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)

  return (
    <Modal
      open
      title="Заявка на відсутність"
      onClose={onClose}
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
                { type, startDate, endDate, reason: reason.trim() || undefined },
                {
                  onSuccess: () => {
                    toast.success('Заявку подано — очікує погодження')
                    onClose()
                  },
                  onError: (err) =>
                    toast.error(err instanceof ApiError ? err.message : 'Не вдалося подати'),
                }
              )
            }
          >
            Подати
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Select
          label="Тип"
          value={type}
          onChange={(v) => setType(v as LeaveType)}
          options={(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => ({
            value: t,
            label: LEAVE_TYPE_LABEL[t],
          }))}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="З"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="По (включно)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Input
          label="Коментар (необов'язково)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
          // рахуються лише робочі дні (пн–пт) · vacation списується з балансу при погодженні
        </div>
      </div>
    </Modal>
  )
}

function RejectModal({ leave, onClose }: { leave: LeaveRequest; onClose: () => void }) {
  const decide = useDecideLeave()
  const [reason, setReason] = useState('')
  return (
    <Modal
      open
      title={`Відхилити заявку · ${leave.profile.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={decide.isPending}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={decide.isPending}
            disabled={reason.trim().length < 3}
            onClick={() =>
              decide.mutate(
                { id: leave.id, action: 'reject', reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success('Відхилено')
                    onClose()
                  },
                  onError: (err) =>
                    toast.error(err instanceof ApiError ? err.message : 'Не вдалося'),
                }
              )
            }
          >
            Відхилити
          </Button>
        </>
      }
    >
      <Input
        label="Причина (побачить заявник)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Modal>
  )
}
