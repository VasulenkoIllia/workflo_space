import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tabs, Card, EmptyState, Input, Skeleton } from '@workflo/ui'
import { isoDay } from '@/lib/finance'
import { formatDate, formatDateTime } from '@/lib/format'
import {
  type HoursReport,
  type LeadSourceReport,
  type LeadSourceRow,
  type RevenueReport,
  type SlaReport,
  type SlaSideStats,
  useHoursReport,
  useLeadSourceReport,
  useRevenueReport,
  useRetentionReport,
  type RetentionReport,
  useSlaReport,
  useAuditReport,
  useDepartmentsReport,
  useTimesheetReport,
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

/** 19-Б: SLA-звіт → один XLSX-лист по виконавцях. */
function buildSlaTables(r: SlaReport): ExportTable[] {
  const side = (s: SlaSideStats) =>
    `${s.compliancePct == null ? '—' : `${s.compliancePct}%`} (${s.met}/${s.met + s.late})`
  return [
    {
      sheet: 'SLA по виконавцях',
      headers: ['Виконавець', 'Замовлень', 'Перша відповідь', 'Розв’язання'],
      rows: [
        ...r.byAssignee.map((a) => [a.name, a.total, side(a.firstResponse), side(a.resolution)]),
        ['РАЗОМ', r.total, side(r.firstResponse), side(r.resolution)],
      ],
    },
  ]
}

/** 19-Б: джерела лідів → XLSX. */
function buildLeadSourceTables(r: LeadSourceReport): ExportTable[] {
  return [
    {
      sheet: 'Джерела лідів',
      headers: [
        'Джерело',
        'Тип',
        'Лідів',
        'Виграно',
        'Втрачено',
        'Конверсія %',
        'Виставлено',
        'Оплачено',
      ],
      rows: r.rows.map((x) => [
        x.source,
        x.kind,
        x.leads,
        x.won,
        x.lost,
        x.conversionPct,
        fmtMoneyBag(x.revenue),
        fmtMoneyBag(x.paidRevenue),
      ]),
    },
  ]
}

/** 19-Б: виручка → три листи (місяці / клієнти / дебіторка). */
function buildRevenueTables(r: RevenueReport): ExportTable[] {
  return [
    {
      sheet: 'По місяцях',
      headers: ['Місяць', 'Виручка USD', 'Оплат', 'Нові клієнти'],
      rows: [
        ...r.byMonth.map((m) => [m.month, m.revenueUsd, m.payments, m.newClients]),
        ['РАЗОМ', r.totalRevenueUsd, r.totalPayments, r.totalNewClients],
      ],
    },
    {
      sheet: 'По клієнтах',
      headers: ['Клієнт', 'Виручка USD', 'Оплат'],
      rows: r.byClient.map((c) => [c.name, c.revenueUsd, c.payments]),
    },
    {
      sheet: 'Дебіторка',
      headers: ['Клієнт', 'Борг', 'Найстаріший, днів'],
      rows: r.debtors.map((d) => [d.name, fmtMoneyBag(d.debt), d.oldestDays]),
    },
  ]
}

/** 19-А: виручка по місяцях/клієнтах + нові клієнти + дебіторка з віком. */
const TIER_UA: Record<string, string> = {
  new: 'Нові',
  regular: 'Постійні',
  partner: 'Партнери',
  vip: 'VIP',
}

function buildRetentionTables(r: RetentionReport): ExportTable[] {
  return [
    {
      sheet: 'Retention',
      headers: ['показник', 'значення'],
      rows: [
        ['компаній усього', String(r.totalCompanies)],
        ['repeat rate %', r.repeatRatePct],
        ['медіана днів до 2-го замовлення', String(r.medianDaysToSecondOrder ?? '—')],
        ['NEW→REGULAR % (90+ днів)', r.newToRegularPct],
        [
          'активні / під ризиком / втрачені',
          `${r.activity.active} / ${r.activity.atRisk} / ${r.activity.churned}`,
        ],
      ],
    },
    {
      sheet: 'At-risk клієнти',
      headers: ['клієнт', 'тір', 'днів без активності', 'lifetime USD'],
      rows: r.atRiskClients.map((c) => [
        c.name,
        TIER_UA[c.tier] ?? c.tier,
        c.daysSince,
        c.lifetimeUsd,
      ]),
    },
  ]
}

/** S11-07: retention — життєвий цикл клієнтської бази (без вікна дат). */
function RetentionSection() {
  const { data, isLoading } = useRetentionReport()
  if (isLoading) return <Skeleton style={{ height: 240 }} />
  if (!data) return null
  const risky = data.activity.atRisk + data.activity.churned
  return (
    <Card
      title="Retention · життєвий цикл клієнтів"
      aux={
        <ExportButtons
          getTables={() => buildRetentionTables(data)}
          filename="retention"
          disabled={data.totalCompanies === 0}
        />
      }
      style={{ marginBottom: 20 }}
    >
      <div className="wfp-stats" style={{ marginBottom: 14 }}>
        <div className="wfp-stat">
          <div className="wfp-stat-k">repeat rate</div>
          <div className="wfp-stat-v" style={{ color: 'var(--wf-accent)' }}>
            {data.repeatRatePct}%
          </div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            {data.companiesWithRepeat} з {data.companiesWithOrders} замовляли повторно
          </div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">до 2-го замовлення</div>
          <div className="wfp-stat-v">
            {data.medianDaysToSecondOrder != null ? `${data.medianDaysToSecondOrder} дн.` : '—'}
          </div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            медіана
          </div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">NEW → REGULAR</div>
          <div className="wfp-stat-v">{data.newToRegularPct}%</div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            {data.convertedCompanies} з {data.matureCompanies} зрілих (90+ дн.)
          </div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">активні · ризик · втрачені</div>
          <div className="wfp-stat-v">
            {data.activity.active} ·{' '}
            <span style={{ color: 'var(--wf-warning)' }}>{data.activity.atRisk}</span> ·{' '}
            <span style={{ color: 'var(--wf-destructive)' }}>{data.activity.churned}</span>
          </div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            60 / 120 днів без активності
          </div>
        </div>
      </div>

      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
      >
        // розподіл по тірах:{' '}
        {data.tierCounts.map((t) => `${TIER_UA[t.tier] ?? t.tier} ${t.count}`).join(' · ')}
      </div>

      {risky > 0 && (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Клієнт під ризиком</th>
              <th>Тір</th>
              <th className="wfp-num">Днів без активності</th>
              <th className="wfp-num">Lifetime USD</th>
            </tr>
          </thead>
          <tbody>
            {data.atRiskClients.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/clients/${c.id}`}>{c.name}</Link>
                </td>
                <td className="wfp-mono" style={{ fontSize: 11 }}>
                  {TIER_UA[c.tier] ?? c.tier}
                </td>
                <td
                  className="wfp-num"
                  style={{
                    color: c.daysSince > 120 ? 'var(--wf-destructive)' : 'var(--wf-warning)',
                  }}
                >
                  {c.daysSince}
                </td>
                <td className="wfp-num">{c.lifetimeUsd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function RevenueSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useRevenueReport(from, to)
  if (isLoading) return <Skeleton style={{ height: 240 }} />
  if (!data) return null
  return (
    <Card
      title="Виручка"
      aux={
        <ExportButtons
          getTables={() => buildRevenueTables(data)}
          filename={`revenue_${from}_${to}`}
          disabled={data.byMonth.length === 0 && data.debtors.length === 0}
        />
      }
      style={{ marginBottom: 20 }}
    >
      <div className="wfp-stats" style={{ marginBottom: 14 }}>
        <div className="wfp-stat">
          <div className="wfp-stat-k">виручка за період</div>
          <div className="wfp-stat-v" style={{ color: 'var(--wf-accent)' }}>
            {data.totalRevenueUsd} USD
          </div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">оплат</div>
          <div className="wfp-stat-v">{data.totalPayments}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">нових клієнтів</div>
          <div className="wfp-stat-v">{data.totalNewClients}</div>
        </div>
      </div>

      {data.byMonth.length > 0 && (
        <table className="wfp-table" style={{ marginBottom: 14 }}>
          <thead>
            <tr>
              <th>Місяць</th>
              <th className="wfp-num">Виручка USD</th>
              <th className="wfp-num">Оплат</th>
              <th className="wfp-num">Нові клієнти</th>
            </tr>
          </thead>
          <tbody>
            {data.byMonth.map((m) => (
              <tr key={m.month}>
                <td className="wfp-mono" style={{ fontSize: 12 }}>
                  {m.month}
                </td>
                <td className="wfp-num">{m.revenueUsd}</td>
                <td className="wfp-num">{m.payments}</td>
                <td className="wfp-num">{m.newClients}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.byClient.length > 0 && (
        <>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', margin: '4px 0 6px' }}
          >
            // по клієнтах
          </div>
          <table className="wfp-table" style={{ marginBottom: 14 }}>
            <thead>
              <tr>
                <th>Клієнт</th>
                <th className="wfp-num">Виручка USD</th>
                <th className="wfp-num">Оплат</th>
              </tr>
            </thead>
            <tbody>
              {data.byClient.map((c) => (
                <tr key={c.companyId}>
                  <td>{c.name}</td>
                  <td className="wfp-num">{c.revenueUsd}</td>
                  <td className="wfp-num">{c.payments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', margin: '4px 0 6px' }}
      >
        // дебіторка (поточний стан, не залежить від періоду)
      </div>
      {data.debtors.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-accent)' }}>
          ✓ боргів немає
        </div>
      ) : (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Клієнт</th>
              <th className="wfp-num">Борг</th>
              <th className="wfp-num">Найстаріший, днів</th>
            </tr>
          </thead>
          <tbody>
            {data.debtors.map((d) => (
              <tr key={d.companyId}>
                <td>{d.name}</td>
                <td className="wfp-num" style={{ color: 'var(--wf-destructive)' }}>
                  {fmtMoneyBag(d.debt)}
                </td>
                <td
                  className="wfp-num"
                  style={{ color: d.oldestDays > 30 ? 'var(--wf-destructive)' : undefined }}
                >
                  {d.oldestDays}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
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
    <Card
      title={`SLA-виконання · ${data.total} замовл. із SLA`}
      aux={
        <ExportButtons
          getTables={() => buildSlaTables(data)}
          filename={`sla_${from}_${to}`}
          disabled={data.byAssignee.length === 0}
        />
      }
      style={{ marginBottom: 20 }}
    >
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
    <Card
      title={`Джерела лідів · ${data.totalLeads} за період`}
      aux={
        <ExportButtons
          getTables={() => buildLeadSourceTables(data)}
          filename={`lead_sources_${from}_${to}`}
          disabled={data.rows.length === 0}
        />
      }
      style={{ marginBottom: 20 }}
    >
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
/** DSN-2 (workspace-reports.jsx): 6-таб хаб звітів. Наявні секції розкладено по
 * табах; нові зрізи — Підрозділи · Timesheet · Audit log (owner-only роути). */
export function ReportsPage() {
  const range = useMemo(() => {
    const d = new Date()
    return { from: `${d.getFullYear()}-01-01`, to: isoDay(d) }
  }, [])
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [tab, setTab] = useState('overview')
  const { data, isLoading } = useHoursReport(from, to, tab === 'executors')

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">// аналітика агенції · owner</div>
          <h1 className="wfp-ph-h1">Звіти</h1>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Огляд' },
          { id: 'executors', label: 'Виконавці' },
          { id: 'clients', label: 'Клієнти' },
          { id: 'departments', label: 'Підрозділи' },
          { id: 'timesheet', label: 'Timesheet' },
          { id: 'audit', label: 'Audit log' },
        ]}
      />

      {tab !== 'audit' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 20px' }}>
          {dateInput(from, setFrom)}
          <span className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>
            —
          </span>
          {dateInput(to, setTo)}
          {tab === 'executors' && (
            <span style={{ marginLeft: 'auto' }}>
              <ExportButtons
                getTables={() => buildHoursTables(data as HoursReport)}
                filename={`hours_${from}_${to}`}
                disabled={!data || data.byOrder.length === 0}
              />
            </span>
          )}
        </div>
      )}

      {tab === 'overview' && (
        <>
          <RevenueSection from={from} to={to} />
          <SlaSection from={from} to={to} />
          <LeadSourcesSection from={from} to={to} />
        </>
      )}

      {tab === 'clients' && <RetentionSection />}

      {tab === 'executors' &&
        (isLoading ? (
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
        ))}

      {tab === 'departments' && <DepartmentsTab from={from} to={to} />}
      {tab === 'timesheet' && <TimesheetTab from={from} to={to} />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}

/** DSN-2: агрегація по підрозділах — години · throughput · cycle · utilization. */
function DepartmentsTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useDepartmentsReport(from, to)
  const rows = data?.departments ?? []
  if (isLoading) return <Skeleton style={{ height: 220 }} />
  if (rows.length === 0)
    return (
      <EmptyState
        title="Підрозділів ще немає"
        description="Створіть команди на «Дошці задач» або в «Команда → Підрозділи»."
      />
    )
  const totalHours = rows.reduce((s, r) => s + r.hours, 0)
  const totalDone = rows.reduce((s, r) => s + r.tasksDone, 0)
  const cycles = rows.filter((r) => r.avgCycleDays != null)
  const bottleneck = cycles.length
    ? cycles.reduce((a, b) => ((a.avgCycleDays ?? 0) > (b.avgCycleDays ?? 0) ? a : b))
    : null
  return (
    <>
      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat">
          <div className="wfp-stat-k">підрозділів</div>
          <div className="wfp-stat-v">{rows.length}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">throughput</div>
          <div className="wfp-stat-v wfp-stat-v--accent">{totalDone}</div>
          <div className="wfp-stat-sub">задач закрито за період</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">годин разом</div>
          <div className="wfp-stat-v">{Math.round(totalHours)}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">bottleneck</div>
          <div className={`wfp-stat-v${bottleneck ? ' wfp-stat-v--warn' : ''}`}>
            {bottleneck?.name ?? '—'}
          </div>
          <div className="wfp-stat-sub">
            {bottleneck?.avgCycleDays != null ? `cycle ${bottleneck.avgCycleDays}d` : ''}
          </div>
        </div>
      </div>
      <Card title="Підрозділи">
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Підрозділ</th>
              <th>Тімлід</th>
              <th className="wfp-num">Люди</th>
              <th className="wfp-num">Години</th>
              <th className="wfp-num">Закрито</th>
              <th className="wfp-num">Активні</th>
              <th className="wfp-num">Cycle</th>
              <th className="wfp-num">Завантаження</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId}>
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 9,
                      height: 9,
                      borderRadius: 99,
                      background: r.color ?? 'var(--wf-fg-muted)',
                      marginRight: 8,
                    }}
                  />
                  {r.name}
                </td>
                <td className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                  {r.leadName ? `★ ${r.leadName}` : '—'}
                </td>
                <td className="wfp-num">{r.members}</td>
                <td className="wfp-num">
                  {r.hours} год
                  <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                    {totalHours > 0 ? ` · ${Math.round((r.hours / totalHours) * 100)}%` : ''}
                  </span>
                </td>
                <td className="wfp-num">{r.tasksDone}</td>
                <td className="wfp-num">{r.tasksActive}</td>
                <td
                  className="wfp-num"
                  style={{
                    color:
                      r.avgCycleDays != null && r.avgCycleDays > 12
                        ? 'var(--wf-warning)'
                        : undefined,
                  }}
                >
                  {r.avgCycleDays != null ? `${r.avgCycleDays}d` : '—'}
                </td>
                <td
                  className="wfp-num"
                  style={{
                    color:
                      r.utilizationPct == null
                        ? 'var(--wf-fg-muted)'
                        : r.utilizationPct > 75
                          ? 'var(--wf-warning)'
                          : 'var(--wf-accent)',
                  }}
                >
                  {r.utilizationPct != null ? `${r.utilizationPct}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

/** DSN-2: timesheet — стрічка записів часу, згрупована по днях з денними підсумками. */
function TimesheetTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useTimesheetReport(from, to)
  const entries = data?.entries ?? []
  if (isLoading) return <Skeleton style={{ height: 260 }} />
  if (entries.length === 0)
    return <EmptyState title="Записів немає" description="За обраний період час не логувався." />
  const totalH = entries.reduce((s, e) => s + e.hours, 0)
  const withComment = entries.filter((e) => e.comment && e.comment.trim() !== '').length
  const days = [...new Set(entries.map((e) => e.date))]
  return (
    <>
      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat">
          <div className="wfp-stat-k">записів</div>
          <div className="wfp-stat-v">{entries.length}</div>
          <div className="wfp-stat-sub">за {days.length} днів</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">загальний час</div>
          <div className="wfp-stat-v wfp-stat-v--accent">{Math.round(totalH * 10) / 10} год</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">з коментарями</div>
          <div className="wfp-stat-v">
            {withComment}/{entries.length}
          </div>
          <div className="wfp-stat-sub">
            {Math.round((withComment / entries.length) * 100)}% — до спеки
          </div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">середня сесія</div>
          <div className="wfp-stat-v">{Math.round((totalH / entries.length) * 10) / 10} год</div>
        </div>
      </div>
      <Card title="Timesheet">
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Виконавець</th>
              <th>Задача</th>
              <th>Клієнт</th>
              <th>Коментар</th>
              <th className="wfp-num">Год</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const dayRows = entries.filter((e) => e.date === day)
              const dayTotal = dayRows.reduce((s, e) => s + e.hours, 0)
              return dayRows
                .map((e, i) => (
                  <tr key={e.id}>
                    <td className="wfp-mono" style={{ fontSize: 12 }}>
                      {i === 0 ? formatDate(day) : ''}
                    </td>
                    <td>{e.executorName}</td>
                    <td
                      style={{
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.orderTitle}
                    </td>
                    <td className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                      {e.companyName ?? 'внутр'}
                    </td>
                    <td
                      className="wfp-mono"
                      style={{
                        fontSize: 12,
                        color: e.comment ? 'var(--wf-fg-secondary)' : 'var(--wf-fg-subtle)',
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.comment || 'без коментаря'}
                    </td>
                    <td className="wfp-num">{e.hours}</td>
                  </tr>
                ))
                .concat(
                  <tr key={`${day}-total`}>
                    <td
                      colSpan={5}
                      className="wfp-mono"
                      style={{
                        fontSize: 10,
                        color: 'var(--wf-fg-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      // {formatDate(day)} разом
                    </td>
                    <td className="wfp-num" style={{ fontWeight: 600 }}>
                      {Math.round(dayTotal * 10) / 10}
                    </td>
                  </tr>
                )
            })}
          </tbody>
        </table>
      </Card>
    </>
  )
}

/** DSN-2: audit log — журнал подій агенції (read-only, останні 200). */
function AuditTab() {
  const { data, isLoading } = useAuditReport()
  const [q, setQ] = useState('')
  if (isLoading) return <Skeleton style={{ height: 260 }} />
  const events = data?.events ?? []
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? events.filter(
        (e) =>
          e.action.toLowerCase().includes(needle) ||
          e.actorName.toLowerCase().includes(needle) ||
          (e.resourceType ?? '').toLowerCase().includes(needle)
      )
    : events
  return (
    <>
      <div className="wfp-stats" style={{ margin: '12px 0 20px' }}>
        <div className="wfp-stat">
          <div className="wfp-stat-k">подій</div>
          <div className="wfp-stat-v">{data?.counts.total ?? 0}</div>
          <div className="wfp-stat-sub">останні 200</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">дії людей</div>
          <div className="wfp-stat-v wfp-stat-v--accent">{data?.counts.user ?? 0}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">system / cron</div>
          <div className="wfp-stat-v">{data?.counts.system ?? 0}</div>
        </div>
      </div>
      <Card title="Журнал подій">
        <div style={{ marginBottom: 12, maxWidth: 320 }}>
          <Input
            placeholder="Шукати (actor / action / тип)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {filtered.length === 0 ? (
          <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
            // подій не знайдено
          </div>
        ) : (
          <table className="wfp-table">
            <thead>
              <tr>
                <th>Час</th>
                <th>Актор</th>
                <th>Дія</th>
                <th>Обʼєкт</th>
                <th>Результат</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((e) => (
                <tr key={e.id}>
                  <td className="wfp-mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td
                    className="wfp-mono"
                    style={{
                      fontSize: 12,
                      color: e.isSystem ? 'var(--wf-fg-muted)' : 'var(--wf-fg)',
                    }}
                  >
                    {e.actorName}
                  </td>
                  <td className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-accent)' }}>
                    {e.action}
                  </td>
                  <td className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                    {e.resourceType ?? '—'}
                    {e.resourceId ? ` · ${e.resourceId.slice(0, 8)}` : ''}
                  </td>
                  <td
                    className="wfp-mono"
                    style={{
                      fontSize: 11,
                      color: e.result === 'allowed' ? 'var(--wf-accent)' : 'var(--wf-destructive)',
                    }}
                  >
                    {e.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
