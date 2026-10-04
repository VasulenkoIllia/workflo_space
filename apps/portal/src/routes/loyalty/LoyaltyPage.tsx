import { Button, Card, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { formatMoney } from '@/lib/format'
import { num, usePortalSummary } from '@/lib/billing'
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

  // totalPaid (lifetime, from the summary) drives the progress meter toward the next threshold.
  const paid = num(summary.data?.totalPaid) ?? 0
  const remaining = next ? Math.max(0, next.thresholdUsd - paid) : 0
  const progress =
    next && next.thresholdUsd > 0 ? Math.min(100, (paid / next.thresholdUsd) * 100) : 100

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

      {hasSummary && next && (
        <Card title="Прогрес до наступного рівня">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            <span>
              Сплачено: <strong>{formatMoney(paid)}</strong>
            </span>
            <span style={{ color: 'var(--wf-fg-muted)' }}>
              ще {formatMoney(remaining)} до «{TIER_LABEL[next.tier]}»
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: 'var(--wf-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'var(--wf-accent)',
                borderRadius: 4,
                transition: 'width .3s',
              }}
            />
          </div>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 6 }}
          >
            {progress.toFixed(0)}% до знижки −{next.discountPercent}%
          </div>
        </Card>
      )}

      {hasSummary && !next && current === 'vip' && (
        <Card>
          <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot tone="success" /> Ви на максимальному рівні — VIP зі знижкою −{discount}%. 🎉
          </div>
        </Card>
      )}

      <div style={{ height: 18 }} />

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
          marginTop: 18,
        }}
      >
        <RuleCard
          title="Платіть більше — рівень росте"
          text="Сума оплат піднімає ваш рівень лояльності."
        />
        <RuleCard
          title="Рівень = знижка"
          text="Чим вищий рівень, тим більша знижка на всі майбутні рахунки."
        />
        <RuleCard
          title="Нічого робити не треба"
          text="Рівень перераховується щоночі, а знижка застосовується автоматично."
        />
      </div>
    </div>
  )
}

function RuleCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="wfp-card">
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>{text}</div>
    </div>
  )
}
