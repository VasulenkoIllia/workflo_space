import { useMemo, useState } from 'react'
import { Card, EmptyState, Skeleton, Tabs } from '@workflo/ui'
import { formatMoney } from '@/lib/format'
import { isoDay } from '@/lib/finance'
import { useCompanies } from '@/lib/projects'
import { useTeam } from '@/lib/payouts'
import { num, useAllClientMargins } from '@/lib/margin'

type Group = 'clients' | 'projects' | 'executors'

interface ExecRow {
  executorId: string
  hours: number
  cost: number
  pct: number
}

const EXEC_COLS = '1.6fr repeat(3, minmax(80px, 1fr))'

function ExecutorTable({ rows, nameOf }: { rows: ExecRow[]; nameOf: (id: string) => string }) {
  const totalHours = rows.reduce((s, r) => s + r.hours, 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  return (
    <Card>
      <div
        className="wfp-mono"
        style={{
          display: 'grid',
          gridTemplateColumns: EXEC_COLS,
          gap: 8,
          fontSize: 11,
          color: 'var(--wf-fg-muted)',
          paddingBottom: 8,
          borderBottom: '1px solid var(--wf-border)',
        }}
      >
        <span>ВИКОНАВЕЦЬ</span>
        <span style={{ textAlign: 'right' }}>ГОДИНИ</span>
        <span style={{ textAlign: 'right' }}>СОБІВАРТ.</span>
        <span style={{ textAlign: 'right' }}>% СОБІВ.</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.executorId}
          style={{
            display: 'grid',
            gridTemplateColumns: EXEC_COLS,
            gap: 8,
            fontSize: 13,
            padding: '10px 0',
            borderBottom: '1px solid var(--wf-border)',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflow: 'hidden',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nameOf(r.executorId)}
            </span>
            {r.cost === 0 && r.hours > 0 && (
              <span
                className="wfp-mono"
                title="Без прямої собівартості — години йдуть у маржу повністю"
                style={{
                  fontSize: 9,
                  padding: '0 5px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                  background: 'color-mix(in oklab, var(--wf-accent) 16%, transparent)',
                  color: 'var(--wf-fg)',
                }}
              >
                0-cost
              </span>
            )}
          </span>
          <span style={{ textAlign: 'right' }}>{r.hours.toFixed(1)}</span>
          <span style={{ textAlign: 'right', color: 'var(--wf-fg-muted)' }}>
            {formatMoney(r.cost)}
          </span>
          <span style={{ textAlign: 'right', color: 'var(--wf-fg-muted)' }}>
            {r.pct.toFixed(0)}%
          </span>
        </div>
      ))}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: EXEC_COLS,
          gap: 8,
          fontSize: 13,
          padding: '12px 0 2px',
          fontWeight: 700,
        }}
      >
        <span>Разом</span>
        <span style={{ textAlign: 'right' }}>{totalHours.toFixed(1)}</span>
        <span style={{ textAlign: 'right', color: 'var(--wf-fg-muted)' }}>
          {formatMoney(totalCost)}
        </span>
        <span style={{ textAlign: 'right' }}>100%</span>
      </div>
      {rows.some((r) => r.cost === 0 && r.hours > 0) && (
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 10 }}
        >
          // 0-cost виконавці (напр. власник) не мають прямої собівартості — їхні години йдуть у
          маржу повністю
        </div>
      )}
    </Card>
  )
}

interface Row {
  key: string
  name: string
  sub?: string
  revenue: number
  cost: number
  margin: number
  marginPct: number
  paid: number
  paidPct: number
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: 'accent' | 'warn' }) {
  const color =
    tone === 'warn' ? 'var(--wf-warning)' : tone === 'accent' ? 'var(--wf-accent)' : 'var(--wf-fg)'
  return (
    <div className="wfp-stat">
      <div style={{ fontSize: 22, fontWeight: 600, color }}>{v}</div>
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {k}
      </div>
    </div>
  )
}

const COLS = '1.6fr repeat(5, minmax(68px, 1fr))'

export function MarginPage() {
  const companies = useCompanies()
  const team = useTeam()
  const [group, setGroup] = useState<Group>('clients')
  const [range] = useState(() => {
    const d = new Date()
    return { from: `${d.getFullYear()}-01-01`, to: isoDay(d) }
  })
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const all = useAllClientMargins(companies.data?.companies ?? [], from, to)
  const isExec = group === 'executors'

  const nameOf = (id: string) =>
    team.data?.members.find((m) => m.profileId === id)?.name ?? id.slice(0, 8)

  // Per-executor cost breakdown: executors have hours+cost (no revenue/margin — that
  // lives per project/client). Aggregate byExecutor across all projects.
  const execRows = useMemo<ExecRow[]>(() => {
    const map = new Map<string, { hours: number; cost: number }>()
    for (const r of all.rows) {
      if (!r.margin) continue
      for (const p of r.margin.projects) {
        for (const e of p.byExecutor) {
          const cur = map.get(e.executorId) ?? { hours: 0, cost: 0 }
          cur.hours += num(e.hours) ?? 0
          cur.cost += num(e.costUsd) ?? 0
          map.set(e.executorId, cur)
        }
      }
    }
    const totalCost = [...map.values()].reduce((s, x) => s + x.cost, 0)
    return [...map.entries()]
      .map(([executorId, v]) => ({
        executorId,
        hours: v.hours,
        cost: v.cost,
        pct: totalCost ? (v.cost / totalCost) * 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost)
  }, [all.rows])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const r of all.rows) {
      if (!r.margin) continue
      if (group === 'clients') {
        out.push({
          key: r.company.id,
          name: r.company.name,
          revenue: num(r.margin.revenueUsd) ?? 0,
          cost: num(r.margin.costUsd) ?? 0,
          margin: num(r.margin.marginUsd) ?? 0,
          marginPct: num(r.margin.marginPct) ?? 0,
          paid: num(r.margin.paidUsd) ?? 0,
          paidPct: num(r.margin.paidPct) ?? 0,
        })
      } else {
        for (const p of r.margin.projects) {
          out.push({
            key: p.projectId,
            name: p.projectName,
            sub: r.company.name,
            revenue: num(p.revenueUsd) ?? 0,
            cost: num(p.costUsd) ?? 0,
            margin: num(p.marginUsd) ?? 0,
            marginPct: num(p.marginPct) ?? 0,
            paid: num(p.paidUsd) ?? 0,
            paidPct: num(p.paidPct) ?? 0,
          })
        }
      }
    }
    return out.sort((a, b) => b.margin - a.margin)
  }, [all.rows, group])

  const totals = useMemo(() => {
    const rev = rows.reduce((s, r) => s + r.revenue, 0)
    const cost = rows.reduce((s, r) => s + r.cost, 0)
    const paid = rows.reduce((s, r) => s + r.paid, 0)
    const margin = rev - cost
    const losses = rows.filter((r) => r.margin < 0).length
    return {
      rev,
      cost,
      paid,
      margin,
      marginPct: rev ? (margin / rev) * 100 : 0,
      paidPct: rev ? (paid / rev) * 100 : 0,
      losses,
    }
  }, [rows])

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

  const loading = companies.isLoading || all.isLoading
  const noClients = !companies.isLoading && (companies.data?.companies.length ?? 0) === 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Маржа</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // дохід − собівартість, по всіх клієнтах і проєктах (лише власник)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dateInput(from, setFrom)}
          <span style={{ color: 'var(--wf-fg-muted)' }}>—</span>
          {dateInput(to, setTo)}
        </div>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 16 }}>
        <Stat k="дохід усього" v={formatMoney(totals.rev)} />
        <Stat
          k={`маржа · ${totals.marginPct.toFixed(1)}%`}
          v={formatMoney(totals.margin)}
          tone={totals.margin < 0 ? 'warn' : 'accent'}
        />
        <Stat k="оплачено" v={`${totals.paidPct.toFixed(0)}%`} />
        <Stat
          k="збиткових"
          v={String(totals.losses)}
          tone={totals.losses > 0 ? 'warn' : undefined}
        />
      </div>

      <Tabs
        items={[
          { id: 'clients', label: 'За клієнтами' },
          { id: 'projects', label: 'За проєктами' },
          { id: 'executors', label: 'За виконавцями' },
        ]}
        value={group}
        onChange={(id) => setGroup(id as Group)}
      />

      <div style={{ marginTop: 16 }}>
        {noClients ? (
          <EmptyState
            title="Клієнтів ще немає"
            description="Маржа зʼявиться, коли будуть клієнти."
          />
        ) : loading ? (
          <Skeleton style={{ height: 200 }} />
        ) : isExec ? (
          execRows.length === 0 ? (
            <EmptyState
              title="Немає даних за період"
              description="За цей діапазон виконавці не логували годин."
            />
          ) : (
            <ExecutorTable rows={execRows} nameOf={nameOf} />
          )
        ) : rows.length === 0 ? (
          <EmptyState
            title="Немає даних за період"
            description="За цей діапазон не було доходу чи витрат."
          />
        ) : (
          <Card>
            <div
              className="wfp-mono"
              style={{
                display: 'grid',
                gridTemplateColumns: COLS,
                gap: 8,
                fontSize: 11,
                color: 'var(--wf-fg-muted)',
                paddingBottom: 8,
                borderBottom: '1px solid var(--wf-border)',
              }}
            >
              <span>{group === 'clients' ? 'КЛІЄНТ' : 'ПРОЄКТ'}</span>
              <span style={{ textAlign: 'right' }}>ДОХІД</span>
              <span style={{ textAlign: 'right' }}>СОБІВАРТ.</span>
              <span style={{ textAlign: 'right' }}>МАРЖА</span>
              <span style={{ textAlign: 'right' }}>МАРЖА%</span>
              <span style={{ textAlign: 'right' }}>ОПЛАЧ.%</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  gap: 8,
                  fontSize: 13,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--wf-border)',
                  alignItems: 'center',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                  >
                    {r.name}
                  </span>
                  {r.sub != null && (
                    <span
                      className="wfp-mono"
                      style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}
                    >
                      {r.sub}
                    </span>
                  )}
                </span>
                <span style={{ textAlign: 'right' }}>{formatMoney(r.revenue)}</span>
                <span style={{ textAlign: 'right', color: 'var(--wf-fg-muted)' }}>
                  {formatMoney(r.cost)}
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    color: r.margin < 0 ? 'var(--wf-warning)' : 'var(--wf-accent)',
                  }}
                >
                  {formatMoney(r.margin)}
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    color: r.margin < 0 ? 'var(--wf-warning)' : undefined,
                  }}
                >
                  {r.marginPct.toFixed(1)}%
                </span>
                <span style={{ textAlign: 'right', color: 'var(--wf-fg-muted)' }}>
                  {r.paidPct.toFixed(0)}%
                </span>
              </div>
            ))}
            {/* Totals row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: COLS,
                gap: 8,
                fontSize: 13,
                padding: '12px 0 2px',
                fontWeight: 700,
              }}
            >
              <span>Разом</span>
              <span style={{ textAlign: 'right' }}>{formatMoney(totals.rev)}</span>
              <span style={{ textAlign: 'right', color: 'var(--wf-fg-muted)' }}>
                {formatMoney(totals.cost)}
              </span>
              <span
                style={{
                  textAlign: 'right',
                  color: totals.margin < 0 ? 'var(--wf-warning)' : 'var(--wf-accent)',
                }}
              >
                {formatMoney(totals.margin)}
              </span>
              <span style={{ textAlign: 'right' }}>{totals.marginPct.toFixed(1)}%</span>
              <span style={{ textAlign: 'right', color: 'var(--wf-fg-muted)' }}>
                {totals.paidPct.toFixed(0)}%
              </span>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
