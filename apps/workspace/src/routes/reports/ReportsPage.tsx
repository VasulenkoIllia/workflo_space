import { useMemo, useState } from 'react'
import { Card, EmptyState, Skeleton } from '@workflo/ui'
import { isoDay } from '@/lib/finance'
import { type HoursReport, useHoursReport } from '@/lib/reports'
import { type ExportTable } from '@/lib/exportTable'
import { ExportButtons } from '@/components/ExportButtons'

/** Colour for a plan-vs-actual variance: over estimate = destructive, under/at = accent. */
function varianceColor(v: number | null): string | undefined {
  if (v == null) return 'var(--wf-fg-muted)'
  if (v > 0) return 'var(--wf-destructive)'
  return 'var(--wf-accent)'
}
const fmtH = (n: number | null): string => (n == null ? '—' : `${n} год`)
const fmtVar = (v: number | null): string => (v == null ? '—' : `${v > 0 ? '+' : ''}${v} год`)

/** Two tables → two XLSX sheets (orders plan-vs-actual + per-executor hours). */
function buildHoursTables(r: HoursReport): ExportTable[] {
  return [
    {
      sheet: 'Замовлення',
      headers: ['Замовлення', 'Проєкт', 'Оцінка', 'Факт', 'Відхилення'],
      rows: [
        ...r.byOrder.map((o) => [
          o.title,
          o.projectName ?? '—',
          o.estimatedHours,
          o.loggedHours,
          o.variance,
        ]),
        ['РАЗОМ', null, r.totals.estimatedHours, r.totals.loggedHours, r.totals.variance],
      ],
    },
    {
      sheet: 'Виконавці',
      headers: ['Виконавець', 'Факт'],
      rows: r.byExecutor.map((e) => [e.name, e.loggedHours]),
    },
  ]
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
        <span style={{ marginLeft: 'auto' }}>
          <ExportButtons
            getTables={() => buildHoursTables(data as HoursReport)}
            filename={`hours_${from}_${to}`}
            disabled={!data || data.byOrder.length === 0}
          />
        </span>
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
                    <th className="wfp-num">Норма</th>
                    <th className="wfp-num">Завантаження</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byExecutor.map((e) => (
                    <tr key={e.executorId}>
                      <td>{e.name}</td>
                      <td className="wfp-num">{e.loggedHours} год</td>
                      <td className="wfp-num" style={{ color: 'var(--wf-fg-muted)' }}>
                        {Math.round(e.capacityHours)} год
                      </td>
                      <td
                        className="wfp-num"
                        style={{
                          color:
                            e.utilizationPct == null
                              ? 'var(--wf-fg-muted)'
                              : e.utilizationPct > 100
                                ? 'var(--wf-destructive)'
                                : 'var(--wf-accent)',
                        }}
                      >
                        {e.utilizationPct == null ? '—' : `${e.utilizationPct}%`}
                      </td>
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
