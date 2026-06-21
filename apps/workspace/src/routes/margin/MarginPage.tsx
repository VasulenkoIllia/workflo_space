import { useState } from 'react'
import { Card, EmptyState, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { formatMoney } from '@/lib/format'
import { isoDay } from '@/lib/finance'
import { useCompanies } from '@/lib/projects'
import { num, useClientMargin, type ProjectMargin } from '@/lib/margin'

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

function marginTone(pct: number | null): 'accent' | 'warn' {
  return (pct ?? 0) < 0 ? 'warn' : 'accent'
}

function ProjectRow({ p }: { p: ProjectMargin }) {
  const mpct = num(p.marginPct)
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--wf-border)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{p.projectName}</div>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          дохід {formatMoney(num(p.revenueUsd))} · собівартість {formatMoney(num(p.costUsd))} ·
          оплачено {p.paidPct}%
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontWeight: 600,
            color: (mpct ?? 0) < 0 ? 'var(--wf-warning)' : 'var(--wf-accent)',
          }}
        >
          {formatMoney(num(p.marginUsd))}
        </div>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          маржа {p.marginPct}%
        </div>
      </div>
    </div>
  )
}

export function MarginPage() {
  const companies = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const [range] = useState(() => {
    const now = new Date()
    return { from: `${now.getFullYear()}-01-01`, to: isoDay(now) }
  })
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const margin = useClientMargin(companyId, from, to)

  const companyOptions = [
    { value: '', label: '— оберіть клієнта —' },
    ...(companies.data?.companies ?? []).map((c) => ({ value: c.id, label: c.name })),
  ]

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

  const m = margin.data?.margin

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Маржа</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // дохід − собівартість по клієнту й проєктах (лише власник)
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <div style={{ minWidth: 240 }}>
          <Select
            label="Клієнт"
            value={companyId}
            onChange={setCompanyId}
            options={companyOptions}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dateInput(from, setFrom)}
          <span style={{ color: 'var(--wf-fg-muted)' }}>—</span>
          {dateInput(to, setTo)}
        </div>
      </div>

      {companyId === '' ? (
        <EmptyState
          title="Оберіть клієнта"
          description="Маржа рахується по обраному клієнту за вказаний період."
        />
      ) : margin.isLoading ? (
        <Skeleton style={{ height: 120 }} />
      ) : margin.isError || !m ? (
        <EmptyState
          title="Не вдалося порахувати маржу"
          description="Перевірте діапазон дат або спробуйте ще раз."
        />
      ) : (
        <>
          <div className="wfp-stats" style={{ marginBottom: 18 }}>
            <Stat k="дохід" v={formatMoney(num(m.revenueUsd))} />
            <Stat k="собівартість" v={formatMoney(num(m.costUsd))} />
            <Stat
              k={`маржа · ${m.marginPct}%`}
              v={formatMoney(num(m.marginUsd))}
              tone={marginTone(num(m.marginPct))}
            />
            <Stat k="оплачено" v={`${m.paidPct}%`} />
          </div>

          {m.projects.length === 0 ? (
            <EmptyState
              title="Немає активних проєктів у періоді"
              description="За цей діапазон у клієнта не було доходу чи витрат."
            />
          ) : (
            <Card title="Проєкти">
              {m.projects.map((p) => (
                <ProjectRow key={p.projectId} p={p} />
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
