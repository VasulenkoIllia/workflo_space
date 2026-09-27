import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, Icon, Skeleton } from '@workflo/ui'
import { LoadError } from '@workflo/app-core'
import { useAuth } from '@/contexts/AuthContext'
import { clientRisks, useClients } from '@/lib/clients'
import { NewClientModal } from './NewClientModal'
import { formatDate, formatMoney } from '@/lib/format'

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

type Filter = 'all' | 'attention' | 'active' | 'debt'

/**
 * Реєстр клієнтів (design-v2 workspace-clients.jsx · DSN-7): агрегати бекенду по ВСІХ
 * замовленнях, блок «Потребують уваги» (28-Г risk flags), пошук і фільтр-пілюлі. Сума й
 * борг — лише з billing.view. LTV/індустрія — модуль 28 (CRM rich), поза цим зрізом.
 */
export function ClientsPage() {
  const navigate = useNavigate()
  const { clients, isLoading, isError, refetch } = useClients()
  const { can } = useAuth()
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  // CORE-FLOWS (D4): агенція заводить клієнта сама — clients.manage
  const canCreate = can('clients.manage')
  const showMoney = can('billing.view')
  const addButton = canCreate ? (
    <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
      + Клієнт
    </Button>
  ) : null

  const withRisks = clients.map((c) => ({ c, risks: clientRisks(c) }))
  const attention = withRisks.filter((x) => x.risks.some((r) => r.tone !== 'muted'))
  const needle = q.trim().toLowerCase()
  const rows = withRisks.filter(({ c, risks }) => {
    if (needle && !c.name.toLowerCase().includes(needle)) return false
    if (filter === 'attention') return risks.some((r) => r.tone !== 'muted')
    if (filter === 'active') return c.active > 0
    if (filter === 'debt') return (c.debt ?? 0) > 0
    return true
  })
  const activeCount = clients.filter((c) => c.active > 0).length

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Клієнти</h1>
          <div className="wfp-ph-sub">
            // {clients.length} клієнтів · {activeCount} з відкритими замовленнями
          </div>
        </div>
        <div className="wfp-ph-r">{addButton}</div>
      </div>
      {adding && <NewClientModal onClose={() => setAdding(false)} />}

      {isLoading ? (
        <Skeleton style={{ height: 240 }} />
      ) : isError ? (
        <LoadError what="клієнтів" onRetry={() => void refetch()} />
      ) : clients.length === 0 ? (
        <EmptyState
          title="Поки немає клієнтів"
          description={
            canCreate
              ? 'Заведіть першого клієнта вручну або конвертуйте лід — клієнти також зʼявляються після самореєстрації в порталі.'
              : 'Клієнти зʼявляться тут, коли в агенції будуть компанії.'
          }
          action={addButton}
        />
      ) : (
        <>
          {/* 28-Г: потребують уваги — борг / тиша по відкритих замовленнях */}
          {attention.length > 0 && (
            <div className="wfc-attention">
              <div className="wfc-attention-h">
                <span className="wfc-attention-t">
                  <span style={{ color: 'var(--wf-warning)', display: 'inline-flex' }}>
                    <Icon name="alert" size={15} />
                  </span>
                  Потребують уваги
                </span>
                <span className="wfc-attention-cnt">{attention.length} клієнтів</span>
              </div>
              <div className="wfc-attention-grid">
                {attention.slice(0, 8).map(({ c, risks }) => (
                  <button
                    key={c.companyId}
                    type="button"
                    className="wfc-attention-card"
                    data-tone={risks.some((r) => r.tone === 'bad') ? 'bad' : 'warn'}
                    onClick={() => navigate(`/clients/${c.companyId}`)}
                    style={{ textAlign: 'left', font: 'inherit', color: 'inherit' }}
                  >
                    <div className="wfc-attention-card-h">
                      <span className="wfc-attention-name">{c.name}</span>
                      <span style={{ color: 'var(--wf-fg-muted)', display: 'inline-flex' }}>
                        <Icon name="chevron" size={12} />
                      </span>
                    </div>
                    <div className="wfc-attention-risks">
                      {risks.map((r) => (
                        <span key={r.id} className="wfc-risk" data-tone={r.tone} title={r.hint}>
                          {r.label}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="wfp-filters">
            <div className="wfp-search">
              <span style={{ color: 'var(--wf-fg-muted)', display: 'inline-flex' }}>
                <Icon name="search" size={14} />
              </span>
              <input
                placeholder="Шукати клієнта…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="wfp-pill"
              data-on={filter === 'all' || undefined}
              onClick={() => setFilter('all')}
            >
              усі
            </button>
            <button
              type="button"
              className="wfp-pill"
              data-on={filter === 'attention' || undefined}
              onClick={() => setFilter('attention')}
            >
              ⚠ потребують уваги · {attention.length}
            </button>
            <button
              type="button"
              className="wfp-pill"
              data-on={filter === 'active' || undefined}
              onClick={() => setFilter('active')}
            >
              активні
            </button>
            {showMoney && (
              <button
                type="button"
                className="wfp-pill"
                data-on={filter === 'debt' || undefined}
                onClick={() => setFilter('debt')}
              >
                з боргом
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyState title="Нікого не знайдено" description="Змініть пошук або фільтр." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="wfp-table">
                <thead>
                  <tr>
                    <th>Компанія</th>
                    <th>Тір</th>
                    <th className="wfp-num">Активних</th>
                    <th className="wfp-num">Замовлень</th>
                    {showMoney && <th className="wfp-num">Сума</th>}
                    {showMoney && <th className="wfp-num">Борг</th>}
                    <th>Остання активність</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ c, risks }) => (
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
                        {risks.slice(0, 2).map((r) => (
                          <span
                            key={r.id}
                            className="wfc-risk"
                            data-tone={r.tone}
                            title={r.hint}
                            style={{ marginLeft: 6 }}
                          >
                            {r.label}
                          </span>
                        ))}
                      </td>
                      <td>
                        <TierPill tier={c.loyaltyTier} />
                      </td>
                      <td className="wfp-num" style={{ color: 'var(--wf-accent)' }}>
                        {c.active}
                      </td>
                      <td className="wfp-num">{c.total}</td>
                      {showMoney && <td className="wfp-num">{formatMoney(c.totalValue)}</td>}
                      {showMoney && (
                        <td
                          className="wfp-num"
                          style={{
                            color: (c.debt ?? 0) > 0 ? 'var(--wf-warning)' : 'var(--wf-fg-subtle)',
                          }}
                        >
                          {(c.debt ?? 0) > 0 ? formatMoney(c.debt) : '—'}
                        </td>
                      )}
                      <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>
                        {c.lastActivityAt ? formatDate(c.lastActivityAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
