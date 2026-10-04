import { BillingType, OrderClientStatus } from '@workflo/types'
import { Button, EmptyState, Icon, StatusDot, type StatusTone } from '@workflo/ui'
import type { OrderDetail } from '@/lib/orderDetail'
import { formatMoney } from '@/lib/format'

// DSN-4: постійний таб «Кошторис» (design-v2 portal-client-p1.jsx → PortalEstimate). Єдине
// місце дій погодження: банер угорі сторінки лише веде сюди (без дубля кнопок).

const APPROVAL_META: Record<
  'pending' | 'approved' | 'rejected',
  { label: string; tone: StatusTone }
> = {
  pending: { label: 'чекає погодження', tone: 'warning' },
  approved: { label: 'погоджено', tone: 'success' },
  rejected: { label: 'відхилено', tone: 'danger' },
}

export function EstimateTab({
  order,
  canDecide,
  deciding,
  failed,
  onApprove,
  onRequestChanges,
}: {
  order: OrderDetail
  /** PORTAL-MEMBER: власник компанії або учасник з can_approve_estimates. */
  canDecide: boolean
  deciding: boolean
  failed: boolean
  onApprove: () => void
  onRequestChanges: () => void
}) {
  const hourly = order.billingType === BillingType.HOURLY
  const lines = order.estimateLines
  const linesTotal = lines.reduce((a, l) => a + (l.qty ?? 1) * (l.unitPrice ?? 0), 0)
  const total = order.totalAmount ?? (lines.length > 0 ? linesTotal : null)
  const awaiting = order.clientStatus === OrderClientStatus.PENDING_APPROVAL
  const status = order.approvalStatus ? APPROVAL_META[order.approvalStatus] : null

  if (total == null && lines.length === 0) {
    return (
      <div style={{ padding: '14px 0' }}>
        <EmptyState
          glyph="// кошторис"
          title="Кошторис ще готується"
          description="Команда оцінить задачу й надішле кошторис — зазвичай протягом доби. Ви отримаєте сповіщення."
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 0', display: 'grid', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // {hourly ? 'hourly · оцінка годин' : 'fixed price'}
        </span>
        {status && (
          <span className="wfp-order-status">
            <StatusDot tone={status.tone} /> {status.label}
          </span>
        )}
      </div>

      {lines.length > 0 && (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Позиція</th>
              <th className="wfp-num">К-сть</th>
              <th className="wfp-num">Ціна</th>
              <th className="wfp-num">Сума</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td className="wfp-num">{l.qty ?? 1}</td>
                <td className="wfp-num">{formatMoney(l.unitPrice)}</td>
                <td className="wfp-num" style={{ fontWeight: 600 }}>
                  {formatMoney((l.qty ?? 1) * (l.unitPrice ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            width: 280,
            maxWidth: '100%',
            border: '1px solid var(--wf-border)',
            borderRadius: 10,
            padding: '14px 16px',
            background: 'var(--wf-subtle)',
          }}
        >
          <TotalRow k="позицій" v={String(lines.length)} />
          {hourly && order.estimatedHours != null && (
            <TotalRow
              k="оцінка годин"
              v={`${order.estimatedHours} × ${formatMoney(order.hourlyRate)}`}
            />
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: 8,
              paddingTop: 10,
              borderTop: '1.5px solid var(--wf-fg)',
            }}
          >
            <span style={{ fontWeight: 600 }}>{hourly ? 'орієнтовно' : 'до сплати'}</span>
            <span className="wfp-mono" style={{ fontSize: hourly ? 15 : 20, fontWeight: 700 }}>
              {formatMoney(total)} {order.currency}
            </span>
          </div>
          {hourly && (
            <div
              className="wfp-mono"
              style={{ fontSize: 10, color: 'var(--wf-fg-subtle)', marginTop: 6 }}
            >
              // фінальна сума — за фактом годин
            </div>
          )}
        </div>
      </div>

      {awaiting && !canDecide && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--wf-subtle)',
            fontSize: 13,
            color: 'var(--wf-fg-secondary)',
          }}
        >
          Кошторис погоджує власник компанії або учасник із правом погодження.
        </div>
      )}
      {awaiting && canDecide && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '14px 16px',
            border: '1px solid var(--wf-accent)',
            borderRadius: 12,
            background: 'var(--wf-accent-soft)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 240px', fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
            {hourly
              ? `Це погодинна оцінка${order.estimatedHours != null ? ` (~${order.estimatedHours} год)` : ''}. Погодження = згода на ставку ${formatMoney(order.hourlyRate)}/год; фінальна сума — за фактом.`
              : 'Погодьте кошторис, щоб ми почали роботу. Сума фіксована.'}
          </div>
          <Button variant="ghost" disabled={deciding} onClick={onRequestChanges}>
            Запросити правки
          </Button>
          <Button
            variant="primary"
            loading={deciding}
            leftIcon={<Icon name="check" size={14} />}
            onClick={onApprove}
          >
            {hourly ? 'Погодити ставку' : 'Погодити'}
          </Button>
          {failed && (
            <div className="wfp-field-hint wfp-field-hint--error" style={{ flexBasis: '100%' }}>
              Не вдалося — оновіть сторінку й спробуйте ще раз.
            </div>
          )}
        </div>
      )}
      {!awaiting && order.approvalStatus === 'approved' && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: 'color-mix(in oklab, var(--wf-success) 10%, transparent)',
            fontSize: 13,
            color: 'var(--wf-fg-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
          }}
        >
          <span style={{ color: 'var(--wf-success)', display: 'inline-flex' }}>
            <Icon name="check" size={16} />
          </span>
          Кошторис погоджено — команда працює за ним.
        </div>
      )}
      {!awaiting && order.approvalStatus === 'rejected' && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--wf-subtle)',
            fontSize: 13,
            color: 'var(--wf-fg-secondary)',
          }}
        >
          Ви запросили правки{order.approvalComment ? `: «${order.approvalComment}»` : ''} —
          менеджер звʼяжеться з вами й надішле оновлений кошторис.
        </div>
      )}
    </div>
  )
}

function TotalRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        color: 'var(--wf-fg-muted)',
        marginTop: 6,
      }}
    >
      <span>{k}</span>
      <span>{v}</span>
    </div>
  )
}
