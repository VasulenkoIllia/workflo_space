import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { LoyaltyTier } from '@workflo/types'
import { OrderInternalStatus } from '@workflo/types'
import { Button, Card, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useAuth } from '@/contexts/AuthContext'
import { INTERNAL_STATUS_META, useOrders } from '@/lib/orders'
import { useOrder } from '@/lib/orderDetail'
import { type CompanyLoyalty, useCompanyLoyalty, useSetLoyaltyOverride } from '@/lib/loyalty'
import { deadlineMeta, formatDate, formatMoney } from '@/lib/format'

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

      <LoyaltySection companyId={id} />

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
    </div>
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
