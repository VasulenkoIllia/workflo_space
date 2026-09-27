import { Card, EmptyState, Skeleton } from '@workflo/ui'
import { LoadError } from '@workflo/app-core'
import type { PortalCharge } from '@/lib/billing'
import { formatDate, formatMoney } from '@/lib/format'
import { usePortalProjects, type ClientProject } from '@/lib/projects'

const CYCLE_LABEL: Record<ClientProject['billingCycle'], string> = {
  monthly_day_n: 'міс',
  weekly_day_x: 'тиждень',
  manual: 'за домовленістю',
}

/**
 * DSN-6 · design-v2 portal-screens.jsx → BillingRecurring. «Регулярні» = проєкти з
 * абонплатою (fixed_monthly_advance): run-rate, наступне списання, таблиця підписок.
 * Кнопок «Призупинити/Відновити» немає: зміни абонплати — через менеджера (договір).
 */
export function RecurringTab({ charges }: { charges: PortalCharge[] }) {
  const { data, isLoading, isError, refetch } = usePortalProjects()
  if (isLoading) return <Skeleton style={{ height: 220 }} />
  if (isError) return <LoadError what="підписки" onRetry={() => void refetch()} />

  const recurring = (data?.projects ?? []).filter(
    (p) => p.billingModel === 'fixed_monthly_advance' && p.abonAmount != null
  )
  if (recurring.length === 0) {
    return (
      <EmptyState
        glyph="// ↻"
        title="Регулярних послуг немає"
        description="Абонплата за супровід чи підтримку зʼявиться тут, щойно агенція її налаштує."
      />
    )
  }

  const active = recurring.filter((p) => p.active)
  // run-rate — по валютах (не складаємо USD з EUR)
  const runRate = new Map<string, number>()
  for (const p of active) {
    if (p.billingCycle !== 'monthly_day_n') continue
    runRate.set(p.currency, (runRate.get(p.currency) ?? 0) + Number(p.abonAmount))
  }
  const next = active
    .filter((p) => p.nextCycleAt)
    .sort((a, b) => (a.nextCycleAt ?? '').localeCompare(b.nextCycleAt ?? ''))[0]
  const nextSame = next ? active.filter((p) => p.nextCycleAt === next.nextCycleAt) : []
  const invoiced = (id: string) => charges.filter((c) => c.projectId === id).length

  return (
    <div style={{ display: 'grid', gap: 12, paddingTop: 12 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        <Card>
          <div className="wfp-card-h-aux">// місячний run-rate</div>
          <div className="wfp-money-big" style={{ marginTop: 4 }}>
            {runRate.size === 0
              ? '—'
              : [...runRate].map(([cur, sum]) => `${formatMoney(sum)} ${cur}`).join(' + ')}
            <span
              style={{ fontSize: 14, fontWeight: 400, color: 'var(--wf-fg-muted)', marginLeft: 6 }}
            >
              / міс
            </span>
          </div>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 4 }}
          >
            {active.length} активних підписок
          </div>
        </Card>
        <Card>
          <div className="wfp-card-h-aux">// наступне списання</div>
          <div className="wfp-mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
            {next?.nextCycleAt ? formatDate(next.nextCycleAt) : '—'}
          </div>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 4 }}
          >
            {nextSame.length > 0
              ? nextSame.map((p) => `«${p.name}»`).join(' + ')
              : 'за домовленістю'}
          </div>
        </Card>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Послуга</th>
              <th>Старт</th>
              <th className="wfp-num">Сума / період</th>
              <th>Наступне списання</th>
              <th className="wfp-num">Виставлено</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {recurring.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                </td>
                <td className="wfp-mono">{formatDate(p.createdAt)}</td>
                <td className="wfp-num">
                  {formatMoney(Number(p.abonAmount))} {p.currency}
                  <span style={{ color: 'var(--wf-fg-muted)' }}>
                    {' '}
                    / {CYCLE_LABEL[p.billingCycle]}
                  </span>
                </td>
                <td className="wfp-mono">
                  {p.active && p.nextCycleAt ? formatDate(p.nextCycleAt) : '—'}
                </td>
                <td className="wfp-num">{invoiced(p.id)}</td>
                <td>
                  <span className={`wfp-badge wfp-badge--${p.active ? 'paid' : 'soft'}`}>
                    {p.active ? 'активна' : 'призупинено'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="wfp-mono"
        style={{
          padding: '10px 14px',
          border: '1px solid var(--wf-border)',
          borderRadius: 6,
          fontSize: 11,
          color: 'var(--wf-fg-muted)',
        }}
      >
        // рахунок за абонплатою виставляється на початку циклу · змінити чи призупинити послугу —
        через вашого менеджера в чаті
      </div>
    </div>
  )
}
