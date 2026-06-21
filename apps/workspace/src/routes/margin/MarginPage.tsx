import { useMemo, useState } from 'react'
import { Card, EmptyState, Skeleton, Tabs } from '@workflo/ui'
import { formatMoney } from '@/lib/format'
import { isoDay } from '@/lib/finance'
import { useCompanies } from '@/lib/projects'
import { num, useAllClientMargins } from '@/lib/margin'

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
  const [group, setGroup] = useState<'clients' | 'projects'>('clients')
  const [range] = useState(() => {
    const d = new Date()
    return { from: `${d.getFullYear()}-01-01`, to: isoDay(d) }
  })
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const all = useAllClientMargins(companies.data?.companies ?? [], from, to)

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
        ]}
        value={group}
        onChange={(id) => setGroup(id as typeof group)}
      />

      <div style={{ marginTop: 16 }}>
        {noClients ? (
          <EmptyState
            title="Клієнтів ще немає"
            description="Маржа зʼявиться, коли будуть клієнти."
          />
        ) : loading ? (
          <Skeleton style={{ height: 200 }} />
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
