import { useNavigate } from 'react-router-dom'
import { EmptyState, Skeleton } from '@workflo/ui'
import { useClients } from '@/lib/clients'
import { formatMoney } from '@/lib/format'

/**
 * Owner — client list derived from orders (grouped by company). Full client
 * profiles (names, loyalty, payments, debt) arrive with the clients module (S5/28).
 */
export function ClientsPage() {
  const navigate = useNavigate()
  const { clients, isLoading, isError } = useClients()

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Клієнти</h1>
          <div className="wfp-ph-sub">// {clients.length} компаній із замовленнями</div>
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
        // профілі клієнтів (назви, лояльність, платежі, борг) — з модулем «Клієнти» (S5)
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
          description="Клієнти зʼявляться тут, коли в компаній будуть замовлення."
        />
      ) : (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Компанія</th>
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
                    Клієнт · {c.companyId.slice(0, 8)}
                  </span>
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
