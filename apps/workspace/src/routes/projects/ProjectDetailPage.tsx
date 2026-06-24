import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card, EmptyState, Skeleton } from '@workflo/ui'
import { formatMoney } from '@/lib/format'
import { useClientMargin } from '@/lib/margin'
import { useLegalEntities } from '@/lib/legalEntities'
import {
  num,
  useCloseCycle,
  useCompanies,
  useProject,
  useSetProjectLegalEntity,
  type FinProject,
} from '@/lib/projects'
import { ProjectModal } from './ProjectsPage'

const MODEL_LABEL: Record<string, string> = {
  fixed_monthly_advance: 'Абонплата (аванс)',
  hourly_prepaid: 'Погодинно (аванс)',
  hourly_postpaid: 'Погодинно (факт)',
}
const CYCLE_LABEL: Record<string, string> = {
  monthly_day_n: 'Щомісяця',
  weekly_day_x: 'Щотижня',
  manual: 'Вручну',
}
const MODE_LABEL: Record<string, string> = {
  none: 'Без погодження',
  upfront: 'Перед стартом',
  on_actuals: 'Перед рахунком',
}
const APPROVER_LABEL: Record<string, string> = { client: 'Клієнт', internal: 'Команда' }

const controlStyle = {
  background: 'var(--wf-surface)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 'var(--wf-radius)',
  padding: '8px 10px',
  fontSize: 14,
  width: '100%',
} as const

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '7px 0',
        borderBottom: '1px solid var(--wf-border)',
      }}
    >
      <span
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase' }}
      >
        {k}
      </span>
      <span style={{ fontSize: 13, textAlign: 'right' }}>{v}</span>
    </div>
  )
}

function LegalEntityCard({ project }: { project: FinProject }) {
  const { entities } = useLegalEntities()
  const setLE = useSetProjectLegalEntity(project.id)
  return (
    <Card title="Юр-особа">
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
      >
        // від кого виставляються документи проєкту · порожньо → дефолтна агенції
      </div>
      <select
        value={project.legalEntityId ?? ''}
        onChange={(e) => setLE.mutate(e.target.value || null)}
        disabled={setLE.isPending}
        style={controlStyle}
      >
        <option value="">Дефолтна агенції</option>
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {e.isDefault ? ' (дефолтна)' : ''}
          </option>
        ))}
      </select>
      {setLE.isError && (
        <div style={{ color: 'var(--wf-destructive)', fontSize: 12, marginTop: 8 }}>
          Не вдалося змінити юр-особу.
        </div>
      )}
      {setLE.isSuccess && (
        <div style={{ color: 'var(--wf-accent)', fontSize: 12, marginTop: 8 }}>Збережено ✓</div>
      )}
    </Card>
  )
}

function MarginCard({ project }: { project: FinProject }) {
  const now = new Date()
  const q = useClientMargin(project.companyId, `${now.getFullYear()}-01-01`, isoDay(now))
  const pm = q.data?.margin.projects.find((x) => x.projectId === project.id)
  return (
    <Card title="Маржа · рік">
      {q.isLoading ? (
        <Skeleton style={{ height: 90 }} />
      ) : !pm ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // ще немає даних за період
        </div>
      ) : (
        <div>
          <Row k="Дохід" v={`${formatMoney(num(pm.revenueUsd))} $`} />
          <Row k="Собівартість" v={`${formatMoney(num(pm.costUsd))} $`} />
          <Row
            k="Маржа"
            v={
              <span style={{ color: 'var(--wf-success)' }}>
                {formatMoney(num(pm.marginUsd))} $ · {pm.marginPct}%
              </span>
            }
          />
          <Row k="Оплачено" v={`${formatMoney(num(pm.paidUsd))} $ · ${pm.paidPct}%`} />
        </div>
      )}
    </Card>
  )
}

function CloseCycleCard({ id }: { id: string }) {
  const close = useCloseCycle(id)
  const today = isoDay(new Date())
  const [start, setStart] = useState(`${today.slice(0, 8)}01`)
  const [end, setEnd] = useState(today)
  return (
    <Card title="Закрити цикл · вручну">
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
      >
        // згенерувати нарахування за період
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ВІД
          </span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={controlStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ДО
          </span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={controlStyle}
          />
        </label>
      </div>
      <Button
        variant="primary"
        size="sm"
        loading={close.isPending}
        onClick={() => close.mutate({ periodStart: start, periodEnd: end })}
        style={{ marginTop: 12 }}
      >
        Закрити цикл
      </Button>
      {close.isError && (
        <div style={{ color: 'var(--wf-destructive)', fontSize: 12, marginTop: 8 }}>
          Не вдалося — перевірте період і тип циклу.
        </div>
      )}
      {close.isSuccess && (
        <div style={{ color: 'var(--wf-accent)', fontSize: 12, marginTop: 8 }}>
          Готово ✓ нарахувань: {close.data.created}
        </div>
      )}
    </Card>
  )
}

/**
 * Project detail (05/22, slice №2). Backend-backed subset of the design's project360:
 * billing config + per-project margin + legal-entity selector + manual cycle close.
 * Tasks/team-hours-plan/client-view from the full mockup need backend not yet built.
 */
export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const { data, isLoading, isError } = useProject(id)
  const companies = useCompanies()
  const [editing, setEditing] = useState(false)

  if (isLoading) return <Skeleton style={{ height: 320 }} />
  if (isError || !data) {
    return (
      <div>
        <Link to="/projects" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
          ← проєкти
        </Link>
        <EmptyState
          glyph="// 404"
          title="Проєкт не знайдено"
          description="Можливо, його видалено."
        />
      </div>
    )
  }

  const p = data.project
  const companyName = companies.data?.companies.find((c) => c.id === p.companyId)?.name ?? '—'
  const isFixed = p.billingModel === 'fixed_monthly_advance'

  return (
    <div>
      <Link to="/projects" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
        ← проєкти
      </Link>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginTop: 8,
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {p.name}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: p.active ? 'var(--wf-success)' : 'var(--wf-fg-muted)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: p.active ? 'var(--wf-success)' : 'var(--wf-fg-muted)',
                }}
              />
              {p.active ? 'активний' : 'неактивний'}
            </span>
          </div>
          <div
            className="wfp-mono"
            style={{ fontSize: 12, color: 'var(--wf-fg-muted)', marginTop: 4 }}
          >
            // {companyName} · {MODEL_LABEL[p.billingModel]} · {CYCLE_LABEL[p.billingCycle]}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Редагувати
        </Button>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          alignItems: 'start',
        }}
      >
        <Card title="Білінг">
          <Row k="Модель" v={MODEL_LABEL[p.billingModel]} />
          <Row
            k={isFixed ? 'Абонплата' : 'Ставка'}
            v={`${formatMoney(num(isFixed ? p.abonAmount : p.clientHourlyRate))} ${p.currency}${isFixed ? '/міс' : '/год'}`}
          />
          <Row k="Цикл" v={CYCLE_LABEL[p.billingCycle]} />
          {p.includedHoursCap != null && (
            <Row k="Включені години" v={`${num(p.includedHoursCap)} год`} />
          )}
          <Row
            k="Строк оплати"
            v={p.paymentTermsDays != null ? `${p.paymentTermsDays} дн` : 'успадковано'}
          />
          <Row k="Погодження" v={p.approvalMode ? MODE_LABEL[p.approvalMode] : 'успадковано'} />
          {p.invoiceApprover && <Row k="Погоджує" v={APPROVER_LABEL[p.invoiceApprover]} />}
        </Card>

        <LegalEntityCard project={p} />
        <MarginCard project={p} />
        {p.billingCycle === 'manual' && <CloseCycleCard id={p.id} />}
      </div>

      {editing && (
        <ProjectModal
          project={p}
          companies={companies.data?.companies ?? []}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
