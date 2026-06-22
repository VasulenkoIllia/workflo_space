import { useNavigate } from 'react-router-dom'
import { EmptyState, Skeleton } from '@workflo/ui'
import { useClients } from '@/lib/clients'
import { formatMoney } from '@/lib/format'

/** Loyalty-tier display (label + accent flag) — mirrors the 5-tier model (10-loyalty). */
const TIER: Record<string, { label: string; vip?: boolean }> = {
  new: { label: 'Новий' },
  regular: { label: 'Постійний' },
  silver: { label: 'Срібний' },
  partner: { label: 'Партнер', vip: true },
  vip: { label: 'VIP', vip: true },
}

function TierPill({ tier }: { tier: string | null }) {
  if (!tier) return <span style={{ color: 'var(--wf-fg-muted)' }}>—</span>
  const meta = TIER[tier] ?? { label: tier }
  return (
    <span
      className="wfp-mono"
      style={{
        fontSize: 10,
        padding: '2px 7px',
        borderRadius: 999,
        border: '1px solid var(--wf-border)',
        color: meta.vip ? 'var(--wf-accent)' : 'var(--wf-fg-secondary)',
        background: meta.vip
          ? 'color-mix(in oklab, var(--wf-accent) 10%, transparent)'
          : 'transparent',
        textTransform: 'uppercase',
      }}
    >
      {meta.label}
    </span>
  )
}

/**
 * Owner — client registry: agency companies (real names + loyalty tier from
 * GET /workspace/companies) enriched with order activity. Rich profile (LTV /
 * debt / industry / last contact) arrives with the clients module (28).
 */
export function ClientsPage() {
  const navigate = useNavigate()
  const { clients, isLoading, isError } = useClients()

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Клієнти</h1>
          <div className="wfp-ph-sub">// {clients.length} клієнтів</div>
        </div>
      </div>

      <div
        className="wfp-mono"
        style={{
          marginBottom: 16,
          padding: '8px 10px',
          background: 'color-mix(in oklab, var(--wf-accent) 8%, transparent)',
          borderRadius: 6,
          fontSize: 11,
          color: 'var(--wf-fg-secondary)',
        }}
      >
        // LTV, борг, індустрія та останній контакт — за модулем «Клієнти» (28)
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 240 }} />
      ) : isError ? (
        <EmptyState
          glyph="// error"
          title="Не вдалося завантажити клієнтів"
          description="Спробуйте оновити сторінку."
        />
      ) : clients.length === 0 ? (
        <EmptyState
          title="Поки немає клієнтів"
          description="Клієнти зʼявляться тут, коли в агенції будуть компанії."
        />
      ) : (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Компанія</th>
              <th>Тір</th>
              <th className="wfp-num">Активних</th>
              <th className="wfp-num">Усього замовлень</th>
              <th className="wfp-num">Сума</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr
                key={c.companyId}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/clients/${c.companyId}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/clients/${c.companyId}`)
                  }
                }}
              >
                <td>
                  <span className="wfp-link" style={{ fontWeight: 500 }}>
                    {c.name}
                  </span>
                </td>
                <td>
                  <TierPill tier={c.loyaltyTier} />
                </td>
                <td className="wfp-num" style={{ color: 'var(--wf-accent)' }}>
                  {c.active}
                </td>
                <td className="wfp-num">{c.total}</td>
                <td className="wfp-num">{formatMoney(c.totalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
