import { useMemo, useState } from 'react'
import { Card, EmptyState, Skeleton } from '@workflo/ui'
import { isoDay } from '@/lib/finance'
import { type HoursReport, useHoursReport } from '@/lib/reports'

/** Colour for a plan-vs-actual variance: over estimate = destructive, under/at = accent. */
function varianceColor(v: number | null): string | undefined {
  if (v == null) return 'var(--wf-fg-muted)'
  if (v > 0) return 'var(--wf-destructive)'
  return 'var(--wf-accent)'
}
const fmtH = (n: number | null): string => (n == null ? '—' : `${n} год`)
const fmtVar = (v: number | null): string => (v == null ? '—' : `${v > 0 ? '+' : ''}${v} год`)

function buildCsv(r: HoursReport): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines = ['Замовлення,Проєкт,Оцінка,Факт,Відхилення']
  for (const o of r.byOrder)
    lines.push(
      [
        esc(o.title),
        esc(o.projectName ?? '—'),
        o.estimatedHours ?? '',
        o.loggedHours,
        o.variance ?? '',
      ].join(',')
    )
  lines.push(
    ['РАЗОМ', '', r.totals.estimatedHours, r.totals.loggedHours, r.totals.variance].join(',')
  )
  lines.push('', 'Виконавець,Факт')
  for (const e of r.byExecutor) lines.push([esc(e.name), e.loggedHours].join(','))
  return lines.join('\n')
}

const dateInput = (value: string, onChange: (v: string) => void) => (
  <input
    type="date"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      background: 'var(--wf-surface)',
      color: 'var(--wf-fg)',
      border: '1px solid var(--wf-border)',
      borderRadius: 'var(--wf-radius)',
      padding: '6px 8px',
      fontSize: 13,
    }}
  />
)

/** Звіти — hours plan-vs-actual (19, 12-ПЛАН-ФАКТ). Owner-only (route-gated). */
export function ReportsPage() {
  const range = useMemo(() => {
    const d = new Date()
    return { from: `${d.getFullYear()}-01-01`, to: isoDay(d) }
  }, [])
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const { data, isLoading } = useHoursReport(from, to)

  const exportCsv = () => {
    if (!data) return
    const url = URL.createObjectURL(new Blob([buildCsv(data)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `hours_${from}_${to}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">// години · план-факт</div>
          <h1 className="wfp-ph-h1">Звіти</h1>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 20px' }}>
        {dateInput(from, setFrom)}
        <span className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>
          —
        </span>
        {dateInput(to, setTo)}
        <button
          type="button"
          className="wfp-link wfp-mono"
          style={{ marginLeft: 'auto', fontSize: 12 }}
          onClick={exportCsv}
          disabled={!data || data.byOrder.length === 0}
        >
          Експорт CSV
        </button>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 280 }} />
      ) : !data || (data.byOrder.length === 0 && data.byExecutor.length === 0) ? (
        <EmptyState
          title="Немає залогованих годин"
          description="За обраний період ще немає записів часу."
        />
      ) : (
        <>
          <div className="wfp-stats" style={{ marginBottom: 20 }}>
            <div className="wfp-stat">
              <div className="wfp-stat-k">оцінка (план)</div>
              <div className="wfp-stat-v">{data.totals.estimatedHours} год</div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">факт</div>
              <div className="wfp-stat-v">{data.totals.loggedHours} год</div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">відхилення</div>
              <div className="wfp-stat-v" style={{ color: varianceColor(data.totals.variance) }}>
                {fmtVar(data.totals.variance)}
              </div>
            </div>
          </div>

          <Card title="План-факт по замовленнях" style={{ marginBottom: 20 }}>
            {data.byOrder.length === 0 ? (
              <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                // немає замовлень із залогованим часом
              </div>
            ) : (
              <table className="wfp-table">
                <thead>
                  <tr>
                    <th>Замовлення</th>
                    <th>Проєкт</th>
                    <th className="wfp-num">Оцінка</th>
                    <th className="wfp-num">Факт</th>
                    <th className="wfp-num">Відхилення</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byOrder.map((o) => (
                    <tr key={o.orderId}>
                      <td>{o.title}</td>
                      <td
                        className="wfp-mono"
                        style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}
                      >
                        {o.projectName ?? '—'}
                      </td>
                      <td className="wfp-num">{fmtH(o.estimatedHours)}</td>
                      <td className="wfp-num">{o.loggedHours} год</td>
                      <td className="wfp-num" style={{ color: varianceColor(o.variance) }}>
                        {fmtVar(o.variance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Години по виконавцях">
            {data.byExecutor.length === 0 ? (
              <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                // немає записів
              </div>
            ) : (
              <table className="wfp-table">
                <thead>
                  <tr>
                    <th>Виконавець</th>
                    <th className="wfp-num">Факт</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byExecutor.map((e) => (
                    <tr key={e.executorId}>
                      <td>{e.name}</td>
                      <td className="wfp-num">{e.loggedHours} год</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
