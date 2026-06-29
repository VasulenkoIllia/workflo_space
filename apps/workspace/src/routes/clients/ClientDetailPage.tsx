import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { LoyaltyTier, OrderInternalStatus } from '@workflo/types'
import { Button, Card, EmptyState, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useAuth } from '@/contexts/AuthContext'
import { INTERNAL_STATUS_META, useOrders } from '@/lib/orders'
import { useOrder } from '@/lib/orderDetail'
import { type CompanyLoyalty, useCompanyLoyalty, useSetLoyaltyOverride } from '@/lib/loyalty'
import { useClientMargin } from '@/lib/margin'
import { useClientRequisites } from '@/lib/requisites'
import { useCompanyProjects } from '@/lib/projects'
import { type WsCharge, useCompanyCharges } from '@/lib/billing'
import {
  type ClientDocument,
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  openDocumentPdf,
  useClientDocuments,
} from '@/lib/documents'
import { isoDay } from '@/lib/finance'
import { deadlineMeta, formatDate, formatMoney } from '@/lib/format'

const LEGAL_TYPE_LABEL: Record<string, string> = {
  fop: 'ФОП',
  tov: 'ТОВ',
  individual: 'Фізособа',
  foreign: 'Іноземна',
}

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

const TIER_LABEL: Record<LoyaltyTier, string> = {
  [LoyaltyTier.NEW]: 'Новий',
  [LoyaltyTier.REGULAR]: 'Постійний',
  [LoyaltyTier.PARTNER]: 'Партнер',
  [LoyaltyTier.VIP]: 'VIP',
}

const fmtUsd = (v: string | number | null | undefined): string =>
  `$${Number(v ?? 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })}`

/** Owner — a single client (company): its orders + aggregate stats. Name resolved
 * from one order's detail (no companies endpoint yet — S5). */
export function ClientDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useOrders({ companyId: id, limit: 100 })
  const orders = data?.orders ?? []
  const firstId = orders[0]?.id ?? ''
  const { data: sample } = useOrder(firstId)
  const name = sample?.company?.name ?? `Клієнт · ${id.slice(0, 8)}`
  const { isManager } = useAuth()
  const [tab, setTab] = useState('overview')

  if (isLoading) return <Skeleton style={{ height: 280 }} />
  if (isError) {
    return (
      <EmptyState
        glyph="// error"
        title="Не вдалося завантажити клієнта"
        description="Спробуйте оновити сторінку."
      />
    )
  }

  const active = orders.filter(
    (o) =>
      o.internalStatus !== OrderInternalStatus.DONE &&
      o.internalStatus !== OrderInternalStatus.CANCELLED
  ).length
  const totalValue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0)

  // Projects/Finance/Requisites are internal-non-manager on the backend → a manager sees
  // only Огляд (the rest would 403). People/Документи/Секрети/Активність tabs from the
  // design are backend-blocked (no per-client members/docs/vault/activity API yet) → omitted.
  const ALL_TABS = [
    { id: 'overview', label: 'Огляд' },
    { id: 'projects', label: 'Проєкти' },
    { id: 'finance', label: 'Фінанси' },
    { id: 'docs', label: 'Документи' },
    { id: 'requisites', label: 'Реквізити' },
  ]
  const visibleTabs = isManager ? ALL_TABS.filter((t) => t.id === 'overview') : ALL_TABS
  const safeTab = visibleTabs.some((t) => t.id === tab) ? tab : 'overview'

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">
            //{' '}
            <Link to="/clients" className="wfp-link">
              клієнти
            </Link>{' '}
            / {name}
          </div>
          <h1 className="wfp-ph-h1">{name}</h1>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Tabs items={visibleTabs} value={safeTab} onChange={setTab} />
      </div>

      {safeTab === 'overview' && (
        <>
          <OverviewAttention companyId={id} />
          <div className="wfp-stats" style={{ marginBottom: 20 }}>
            <div className="wfp-stat">
              <div className="wfp-stat-k">усього замовлень</div>
              <div className="wfp-stat-v">{orders.length}</div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">активних</div>
              <div className="wfp-stat-v wfp-stat-v--accent">{active}</div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">сумарна вартість</div>
              <div className="wfp-stat-v">{formatMoney(totalValue)}</div>
            </div>
          </div>

          {orders.length === 0 ? (
            <EmptyState
              title="Немає замовлень"
              description="У цього клієнта поки немає замовлень."
              action={
                <Link to="/clients">
                  <Button variant="secondary">← До клієнтів</Button>
                </Link>
              }
            />
          ) : (
            <table className="wfp-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Назва</th>
                  <th>Статус</th>
                  <th>Дедлайн</th>
                  <th className="wfp-num">Сума</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const meta = o.internalStatus ? INTERNAL_STATUS_META[o.internalStatus] : null
                  const dl = deadlineMeta(o.dueDate)
                  return (
                    <tr
                      key={o.id}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/orders/${o.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/orders/${o.id}`)
                        }
                      }}
                    >
                      <td className="wfp-mono">
                        <span className="wfp-link">#{o.id.slice(0, 6)}</span>
                      </td>
                      <td>{o.title}</td>
                      <td>
                        {meta ? (
                          <span className="wfp-order-status">
                            <StatusDot tone={meta.tone} /> {meta.label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className="wfp-mono"
                        style={{ color: dl.tone === 'over' ? 'var(--wf-destructive)' : undefined }}
                      >
                        {formatDate(o.dueDate)}
                      </td>
                      <td className="wfp-num">{formatMoney(o.totalAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {safeTab === 'projects' && <ProjectsSection companyId={id} />}
      {safeTab === 'finance' && (
        <>
          <LoyaltySection companyId={id} />
          <MarginSection companyId={id} />
        </>
      )}
      {safeTab === 'docs' && <DocumentsSection companyId={id} />}
      {safeTab === 'requisites' && <RequisitesSection companyId={id} />}
    </div>
  )
}

const DOC_STATUS_COLOR: Record<string, string> = {
  draft: 'var(--wf-fg-muted)',
  generated: 'var(--wf-fg-subtle)',
  sent: 'var(--wf-accent)',
}

/** Документи tab (28-Б): all of the client's documents across orders. Internal-non-manager
 * (backend 403s managers → hidden). PDF opens via the Bearer-authed blob fetch. */
function DocumentsSection({ companyId }: { companyId: string }) {
  const { isManager } = useAuth()
  const { data: docs, isLoading } = useClientDocuments(companyId, !isManager)
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 120 }} />
  const documents = docs ?? []

  const open = (d: ClientDocument) => {
    if (!d.order) return
    openDocumentPdf(d.order.id, d).catch(() => toast.error('Не вдалося відкрити документ'))
  }

  return (
    <Card title="Документи" aux={`${documents.length}`}>
      {documents.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // ще немає документів — генеруються з замовлення
        </div>
      ) : (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Тип</th>
              <th>Замовлення</th>
              <th>Статус</th>
              <th>Дата</th>
              <th className="wfp-num">PDF</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td className="wfp-mono">{d.number}</td>
                <td>{DOC_TYPE_LABEL[d.type]}</td>
                <td>
                  {d.order ? (
                    <Link to={`/orders/${d.order.id}`} className="wfp-link">
                      {d.order.title}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <span style={{ color: DOC_STATUS_COLOR[d.status], fontSize: 13 }}>
                    {DOC_STATUS_LABEL[d.status]}
                  </span>
                </td>
                <td className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                  {formatDate(d.generatedAt)}
                </td>
                <td className="wfp-num">
                  {d.order ? (
                    <button className="wfp-link" type="button" onClick={() => open(d)}>
                      відкрити
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

/** "Needs attention" strip for the Overview tab — overdue charges + drafts awaiting release,
 * derived from the client's charges (internal-non-manager). Renders nothing when all clear. */
function OverviewAttention({ companyId }: { companyId: string }) {
  const { isManager } = useAuth()
  const { data } = useCompanyCharges(companyId, !isManager)
  if (isManager) return null
  const charges = data?.charges ?? []
  const now = Date.now()
  const isOpen = (c: WsCharge) => c.status !== 'paid' && c.status !== 'written_off'
  const overdue = charges.filter(
    (c) => isOpen(c) && c.dueDate != null && new Date(c.dueDate).getTime() < now
  )
  const pending = charges.filter((c) => c.approvalStatus === 'pending')
  if (overdue.length === 0 && pending.length === 0) return null

  const overdueSum = overdue.reduce((s, c) => s + Number(c.totalAmount ?? c.amount), 0)
  const cur = overdue[0]?.currency ?? ''

  const dot = (color: string) => (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )

  return (
    <Card title="Потребує уваги" style={{ marginBottom: 20 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {overdue.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            {dot('var(--wf-destructive)')}
            <span>
              {overdue.length} прострочених рахунків · {overdueSum.toLocaleString('uk-UA')} {cur}
            </span>
            <Link to="/billing" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
              розглянути →
            </Link>
          </div>
        )}
        {pending.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            {dot('var(--wf-accent)')}
            <span>{pending.length} нарахувань на погодженні (чернетки)</span>
            <Link to="/billing" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
              черга →
            </Link>
          </div>
        )}
      </div>
    </Card>
  )
}

/** Loyalty tier panel for a client (S5-09). Read for team (owner/executor), hidden for
 * managers (the backend 403s them). Owner can override the tier (audit-logged). */
function LoyaltySection({ companyId }: { companyId: string }) {
  const { isManager, isOwner } = useAuth()
  const { data, isLoading } = useCompanyLoyalty(companyId, !isManager)
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 120, marginBottom: 20 }} />
  if (!data) return null
  return <LoyaltyPanel companyId={companyId} data={data} canOverride={isOwner} />
}

function LoyaltyPanel({
  companyId,
  data,
  canOverride,
}: {
  companyId: string
  data: CompanyLoyalty
  canOverride: boolean
}) {
  const serverOverride: string = data.tierOverride ?? ''
  const [draft, setDraft] = useState<string>(serverOverride)
  const setOverride = useSetLoyaltyOverride(companyId)
  const dirty = draft !== serverOverride

  const save = () =>
    setOverride.mutate(draft === '' ? null : (draft as LoyaltyTier), {
      onSuccess: () => toast.success('Тір оновлено'),
      onError: () => toast.error('Не вдалося оновити тір'),
    })

  const lifetime = Number(data.lifetimePaidUsd)
  const threshold = data.progress.nextThresholdUsd
  const fillPct = threshold ? Math.min(100, Math.round((lifetime / threshold) * 100)) : 100

  return (
    <Card title="Лояльність" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{TIER_LABEL[data.effectiveTier]}</span>
        <span className="wfp-mono" style={{ color: 'var(--wf-accent)' }}>
          −{data.discountPercent}% на рахунки
        </span>
        {data.tierOverride != null && (
          <span
            className="wfp-mono"
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 'var(--wf-radius)',
              border: '1px solid var(--wf-border)',
              color: 'var(--wf-fg-muted)',
            }}
          >
            ручний override · зароблено: {TIER_LABEL[data.earnedTier]}
          </span>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          className="wfp-mono"
          style={{
            fontSize: 12,
            color: 'var(--wf-fg-muted)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>сплачено за весь час: {fmtUsd(data.lifetimePaidUsd)}</span>
          {data.progress.nextTier ? (
            <span>
              ще {fmtUsd(data.progress.remainingUsd)} до «{TIER_LABEL[data.progress.nextTier]}»
            </span>
          ) : (
            <span>максимальний рівень 🎉</span>
          )}
        </div>
        <div
          style={{
            marginTop: 6,
            height: 6,
            borderRadius: 999,
            background: 'var(--wf-border)',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${fillPct}%`, height: '100%', background: 'var(--wf-accent)' }} />
        </div>
      </div>

      {canOverride && (
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 220 }}>
            <Select
              label="Ручний тір (override)"
              value={draft}
              onChange={setDraft}
              options={[
                { value: '', label: 'Авто (за витратами)' },
                { value: LoyaltyTier.NEW, label: TIER_LABEL[LoyaltyTier.NEW] },
                { value: LoyaltyTier.REGULAR, label: TIER_LABEL[LoyaltyTier.REGULAR] },
                { value: LoyaltyTier.PARTNER, label: TIER_LABEL[LoyaltyTier.PARTNER] },
                { value: LoyaltyTier.VIP, label: TIER_LABEL[LoyaltyTier.VIP] },
              ]}
            />
          </div>
          <Button
            variant="primary"
            disabled={!dirty}
            loading={setOverride.isPending}
            onClick={save}
          >
            Зберегти
          </Button>
        </div>
      )}

      {data.history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
          >
            // ІСТОРІЯ ТІРІВ
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {data.history.map((h, i) => (
              <div
                key={i}
                className="wfp-mono"
                style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}
              >
                {formatDate(h.createdAt)} · {TIER_LABEL[h.fromTier]} → {TIER_LABEL[h.toTier]}
                {h.reason ? ` (${h.reason})` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/** Year-to-date margin for the client (S5.6 P-9). Owner-only — the backend 403s
 * everyone else. A compact roll-up; the full /margin screen has period controls + per-executor. */
function MarginSection({ companyId }: { companyId: string }) {
  const { isOwner } = useAuth()
  const range = useMemo(() => {
    const d = new Date()
    return { from: `${d.getFullYear()}-01-01`, to: isoDay(d) }
  }, [])
  const { data, isLoading } = useClientMargin(isOwner ? companyId : '', range.from, range.to)
  if (!isOwner) return null
  if (isLoading) return <Skeleton style={{ height: 110, marginBottom: 20 }} />
  const m = data?.margin
  if (!m) return null

  const marginPct = Number(m.marginPct)
  const marginTone = marginPct >= 0 ? 'var(--wf-accent)' : 'var(--wf-destructive)'

  return (
    <Card title="Маржа · з початку року (USD)" style={{ marginBottom: 20 }}>
      <div className="wfp-stats">
        <div className="wfp-stat">
          <div className="wfp-stat-k">дохід</div>
          <div className="wfp-stat-v">{fmtUsd(m.revenueUsd)}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">собівартість</div>
          <div className="wfp-stat-v">{fmtUsd(m.costUsd)}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">маржа</div>
          <div className="wfp-stat-v" style={{ color: marginTone }}>
            {fmtUsd(m.marginUsd)} · {marginPct.toFixed(0)}%
          </div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">сплачено</div>
          <div className="wfp-stat-v">{Number(m.paidPct).toFixed(0)}%</div>
        </div>
      </div>

      {m.projects.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
          >
            // ЗА ПРОЄКТАМИ
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {m.projects.map((p) => (
              <div
                key={p.projectId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto',
                  gap: 12,
                  fontSize: 13,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--wf-border)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.projectName}
                </span>
                <span className="wfp-mono" style={{ textAlign: 'right' }}>
                  {fmtUsd(p.revenueUsd)}
                </span>
                <span className="wfp-mono" style={{ textAlign: 'right' }}>
                  {fmtUsd(p.costUsd)}
                </span>
                <span
                  className="wfp-mono"
                  style={{
                    textAlign: 'right',
                    color: Number(p.marginPct) >= 0 ? 'var(--wf-accent)' : 'var(--wf-destructive)',
                  }}
                >
                  {Number(p.marginPct).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <Link to="/margin" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
          → повний звіт маржі (період, за виконавцями)
        </Link>
      </div>
    </Card>
  )
}

/** Client legal requisites (06-Б, P-3) — the document "to" party. Read-only for the team
 * (the client edits in Portal; agency edit-on-behalf is 28-Б). Managers are 403'd → hidden. */
function RequisitesSection({ companyId }: { companyId: string }) {
  const { isManager } = useAuth()
  const { data, isLoading } = useClientRequisites(companyId, !isManager)
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 110, marginBottom: 20 }} />
  const r = data?.requisites
  if (!r) return null

  const rows: { k: string; v: string | null }[] = [
    { k: 'Тип', v: r.legalType ? (LEGAL_TYPE_LABEL[r.legalType] ?? r.legalType) : null },
    { k: 'Юр. назва', v: r.legalName },
    { k: 'ЄДРПОУ/ІПН', v: r.taxId },
    { k: 'ПДВ', v: r.vatPayer ? `Платник${r.vatId ? ` · ${r.vatId}` : ''}` : null },
    { k: 'Юр. адреса', v: r.legalAddress },
    { k: 'Банк', v: r.bankName },
    { k: 'IBAN', v: r.iban },
    {
      k: 'Підписант',
      v: r.signerName ? `${r.signerName}${r.signerTitle ? `, ${r.signerTitle}` : ''}` : null,
    },
    {
      k: 'Email для документів',
      v: r.documentEmail
        ? `${r.documentEmail}${r.documentEmailCc ? ` (cc: ${r.documentEmailCc})` : ''}`
        : null,
    },
  ].filter((row) => row.v)

  return (
    <Card
      title="Реквізити"
      style={{ marginBottom: 20 }}
      aux={r.legalIsComplete ? '✓ повні' : 'неповні'}
    >
      {rows.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // клієнт ще не заповнив реквізити — документи виставити не можна
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {rows.map((row) => (
            <div
              key={row.k}
              style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, fontSize: 13 }}
            >
              <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                {row.k}
              </span>
              <span>{row.v}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** Client's financial projects (05-ПРОЕКТИ / P-1). Internal team, manager-blocked → hidden.
 * Read-only list here; full config (create/edit/close-cycle) lives on /projects/:id. */
function ProjectsSection({ companyId }: { companyId: string }) {
  const navigate = useNavigate()
  const { isManager } = useAuth()
  const { data, isLoading } = useCompanyProjects(companyId, !isManager)
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 110, marginBottom: 20 }} />
  const projects = data?.projects ?? []

  return (
    <Card
      title="Проєкти"
      style={{ marginBottom: 20 }}
      aux={`${projects.length}`}
      actions={
        <Link to="/projects" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
          + проєкт
        </Link>
      }
    >
      {projects.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // у клієнта ще немає фін-проєктів
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {projects.map((p) => {
            const amount =
              p.billingModel === 'fixed_monthly_advance'
                ? p.abonAmount
                  ? `${Number(p.abonAmount)} ${p.currency}/міс`
                  : '—'
                : p.clientHourlyRate
                  ? `${Number(p.clientHourlyRate)} ${p.currency}/год`
                  : '—'
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/projects/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/projects/${p.id}`)
                  }
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.4fr 1.2fr auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 8px',
                  borderBottom: '1px solid var(--wf-border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span className="wfp-link" style={{ fontWeight: 500 }}>
                    {p.name}
                  </span>
                  {!p.active && (
                    <span
                      className="wfp-mono"
                      style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginLeft: 8 }}
                    >
                      (неактивний)
                    </span>
                  )}
                </div>
                <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                  {MODEL_LABEL[p.billingModel] ?? p.billingModel}
                </span>
                <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}>
                  {CYCLE_LABEL[p.billingCycle] ?? p.billingCycle}
                </span>
                <span className="wfp-mono" style={{ fontSize: 12, textAlign: 'right' }}>
                  {amount}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
