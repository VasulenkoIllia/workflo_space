import { Button, Card, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { formatMoney } from '@/lib/format'
import { usePortalSummary } from '@/lib/billing'
import { useLoyaltyTiers, type LoyaltyTier } from '@/lib/loyalty'

const TIER_LABEL: Record<LoyaltyTier, string> = {
  new: 'Новий',
  regular: 'Постійний',
  partner: 'Партнер',
  vip: 'VIP',
}
const TIER_RANK: Record<LoyaltyTier, number> = { new: 0, regular: 1, partner: 2, vip: 3 }

export function LoyaltyPage() {
  const tiers = useLoyaltyTiers()
  const summary = usePortalSummary()

  if (tiers.isLoading || summary.isLoading) {
    return (
      <div>
        <Skeleton variant="title" />
        <div style={{ marginTop: 16 }}>
          <Skeleton />
          <Skeleton />
        </div>
      </div>
    )
  }
  if (tiers.isError || !tiers.data) {
    return (
      <EmptyState
        title="Не вдалося завантажити рівні лояльності"
        action={<Button onClick={() => void tiers.refetch()}>Оновити</Button>}
      />
    )
  }

  const hasSummary = !!summary.data
  const current = summary.data?.loyaltyTier as LoyaltyTier | undefined
  const discount = summary.data?.discountPercent ?? 0
  const ladder = [...tiers.data.tiers].sort((a, b) => a.thresholdUsd - b.thresholdUsd)
  const currentRank = current ? TIER_RANK[current] : -1
  // Only surface a "next tier" when we actually know the current tier — otherwise a failed
  // summary would falsely point at the first rung.
  const next = current ? ladder.find((t) => TIER_RANK[t.tier] === currentRank + 1) : undefined

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Лояльність</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // ваш рівень росте з сумою оплат — більший рівень = більша знижка
      </div>

      <div className="wfp-stats" style={{ marginBottom: 18 }}>
        <div className="wfp-stat">
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--wf-accent)' }}>
            {current ? TIER_LABEL[current] : '—'}
          </div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ваш рівень
          </div>
        </div>
        <div className="wfp-stat">
          <div style={{ fontSize: 22, fontWeight: 600 }}>{hasSummary ? `−${discount}%` : '—'}</div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ваша знижка
          </div>
        </div>
        {next && (
          <div className="wfp-stat">
            <div style={{ fontSize: 22, fontWeight: 600 }}>{TIER_LABEL[next.tier]}</div>
            <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              наступний від {formatMoney(next.thresholdUsd)}
            </div>
          </div>
        )}
      </div>

      <Card title="Рівні">
        <div style={{ display: 'grid', gap: 2 }}>
          {ladder.map((t) => {
            const active = t.tier === current
            return (
              <div
                key={t.tier}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--wf-border)',
                  opacity: TIER_RANK[t.tier] <= currentRank || active ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusDot tone={active ? 'success' : 'muted'} />
                  <span style={{ fontWeight: active ? 700 : 500 }}>{TIER_LABEL[t.tier]}</span>
                  {active && (
                    <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-accent)' }}>
                      // ви тут
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
                    від {formatMoney(t.thresholdUsd)}
                  </span>
                  <span style={{ fontWeight: 600, minWidth: 44, textAlign: 'right' }}>
                    −{t.discountPercent}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
