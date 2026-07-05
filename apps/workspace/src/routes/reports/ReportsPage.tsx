import { useMemo, useState } from 'react'
import { Card, EmptyState, Skeleton } from '@workflo/ui'
import { isoDay } from '@/lib/finance'
import {
  type HoursReport,
  type LeadSourceRow,
  type SlaSideStats,
  useHoursReport,
  useLeadSourceReport,
  useSlaReport,
} from '@/lib/reports'
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

/** «92% · 11/12 вчасно» — компактне подання SLA-сторони; pending не тягне % вниз. */
function slaCell(s: SlaSideStats) {
  const judged = s.met + s.late
  const color =
    s.compliancePct == null
      ? 'var(--wf-fg-muted)'
      : s.compliancePct >= 90
        ? 'var(--wf-accent)'
        : s.compliancePct >= 70
          ? 'var(--wf-warning)'
          : 'var(--wf-destructive)'
  return (
    <span>
      <span style={{ color, fontWeight: 600 }}>
        {s.compliancePct == null ? '—' : `${s.compliancePct}%`}
      </span>
      <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        {judged > 0 ? ` · ${s.met}/${judged} вчасно` : ''}
        {s.pending > 0 ? ` · ${s.pending} в очік.` : ''}
      </span>
    </span>
  )
}

const fmtMoneyBag = (bag: Record<string, number>): string => {
  const parts = Object.entries(bag).map(([cur, amt]) => `${amt} ${cur}`)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

const SOURCE_KIND_LABEL: Record<LeadSourceRow['kind'], string> = {
  utm: 'utm',
  manual: 'вручну',
  none: '—',
}

/** SLA-compliance блок (S11): загальні % + розріз по виконавцях + список порушень. */
function SlaSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useSlaReport(from, to)
  if (isLoading) return <Skeleton style={{ height: 200 }} />
  if (!data || data.total === 0) {
    return (
      <Card title="SLA-виконання" style={{ marginBottom: 20 }}>
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // за період немає замовлень із SLA (політики → налаштування, штампуються при створенні)
        </div>
      </Card>
    )
  }
  return (
    <Card title={`SLA-виконання · ${data.total} замовл. із SLA`} style={{ marginBottom: 20 }}>
      <div className="wfp-stats" style={{ marginBottom: 14 }}>
        <div className="wfp-stat">
          <div className="wfp-stat-k">перша відповідь</div>
          <div className="wfp-stat-v">{slaCell(data.firstResponse)}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">розв’язання</div>
          <div className="wfp-stat-v">{slaCell(data.resolution)}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">порушення</div>
          <div
            className="wfp-stat-v"
            style={{
              color: data.breachedOrders.length > 0 ? 'var(--wf-destructive)' : 'var(--wf-accent)',
            }}
          >
            {data.breachedOrders.length}
          </div>
        </div>
      </div>
      {data.byAssignee.length > 0 && (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Виконавець</th>
              <th className="wfp-num">Замовлень</th>
              <th>Перша відповідь</th>
              <th>Розв’язання</th>
            </tr>
          </thead>
          <tbody>
            {data.byAssignee.map((r) => (
              <tr key={r.assigneeId ?? '(none)'}>
                <td>{r.name}</td>
                <td className="wfp-num">{r.total}</td>
                <td>{slaCell(r.firstResponse)}</td>
                <td>{slaCell(r.resolution)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.breachedOrders.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
          >
            // останні порушення
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {data.breachedOrders.slice(0, 8).map((b) => (
              <div key={`${b.orderId}-${b.kind}`} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                <span
                  className="wfp-mono"
                  style={{ fontSize: 11, color: 'var(--wf-destructive)', width: 120 }}
                >
                  {b.kind === 'first_response' ? 'відповідь' : 'розв’язання'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{b.title}</span>
                <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  {b.assigneeName ?? 'без виконавця'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/** Джерела лідів (S11): utm-source → воронка → гроші (per-currency, без зшивання курсів). */
function LeadSourcesSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useLeadSourceReport(from, to)
  if (isLoading) return <Skeleton style={{ height: 200 }} />
  if (!data || data.totalLeads === 0) {
    return (
      <Card title="Джерела лідів" style={{ marginBottom: 20 }}>
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // за період лідів немає
        </div>
      </Card>
    )
  }
  return (
    <Card title={`Джерела лідів · ${data.totalLeads} за період`} style={{ marginBottom: 20 }}>
      <table className="wfp-table">
        <thead>
          <tr>
            <th>Джерело</th>
            <th className="wfp-num">Лідів</th>
            <th className="wfp-num">Виграно</th>
            <th className="wfp-num">Конверсія</th>
            <th className="wfp-num">Виставлено</th>
            <th className="wfp-num">Оплачено</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.source}>
              <td>
                {r.source}{' '}
                <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                  {SOURCE_KIND_LABEL[r.kind]}
                </span>
              </td>
              <td className="wfp-num">{r.leads}</td>
              <td className="wfp-num">
                {r.won}
                {r.lost > 0 && (
                  <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                    {' '}
                    / −{r.lost}
                  </span>
                )}
              </td>
              <td className="wfp-num">{r.conversionPct == null ? '—' : `${r.conversionPct}%`}</td>
              <td className="wfp-num">{fmtMoneyBag(r.revenue)}</td>
              <td className="wfp-num" style={{ color: 'var(--wf-accent)' }}>
                {fmtMoneyBag(r.paidRevenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.campaigns.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
          >
            // топ-кампанії (utm_campaign)
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {data.campaigns.map((c) => (
              <div
                key={`${c.source}-${c.campaign}`}
                style={{ display: 'flex', gap: 8, fontSize: 13 }}
              >
                <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  {c.source} /
                </span>
                <span style={{ flex: 1 }}>{c.campaign}</span>
                <span className="wfp-mono" style={{ fontSize: 11 }}>
                  {c.leads} лідів · {c.won} won
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/** Звіти — hours plan-vs-actual (19, 12-ПЛАН-ФАКТ) + SLA + джерела лідів (S11). Owner-only (route-gated). */
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

      <SlaSection from={from} to={to} />
      <LeadSourcesSection from={from} to={to} />

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
