import { useMemo } from 'react'
import { EmailChangeSection, PasswordSection, TwoFactorSection } from '@workflo/app-core'
import { Card, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/format'
import { num, useMyPayouts, type Payout, type PayoutStatus } from '@/lib/payouts'

const ROLE_LABEL: Record<string, string> = {
  owner: 'власник',
  executor: 'виконавець',
  client: 'клієнт',
}

const STATUS: Record<PayoutStatus, { tone: 'muted' | 'warning' | 'success'; label: string }> = {
  draft: { tone: 'muted', label: 'чернетка' },
  approved: { tone: 'warning', label: 'погоджено' },
  paid: { tone: 'success', label: 'виплачено' },
}

/** Профіль виконавця + власний заробіток (13-ПРОФІЛЬ). Сервер віддає не-власнику лише
 * його виплати; власнику (усі рядки команди) — фільтруємо до своїх клієнтськи. */
export function ProfilePage() {
  const { user } = useAuth()
  const p = user?.profile
  const payouts = useMyPayouts()

  const mine = useMemo<Payout[]>(
    () => (payouts.data?.payouts ?? []).filter((row) => row.executorId === p?.id),
    [payouts.data, p?.id]
  )

  const paidThisYear = useMemo(() => {
    const year = String(new Date().getFullYear())
    return mine
      .filter((row) => row.status === 'paid' && row.period.startsWith(year))
      .reduce((s, row) => s + (num(row.total) ?? 0), 0)
  }, [mine])

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Профіль</h1>
          <div className="wfp-ph-sub">// особистий кабінет виконавця</div>
        </div>
      </div>

      <Card title="Обліковий запис" style={{ marginBottom: 16 }}>
        <div className="wfp-side">
          <div className="wfp-side-row">
            <div className="wfp-side-k">імʼя</div>
            <div className="wfp-side-v">{p?.displayName ?? '—'}</div>
          </div>
          <div className="wfp-side-row">
            <div className="wfp-side-k">email</div>
            <div className="wfp-side-v">{p?.email ?? '—'}</div>
          </div>
          <div className="wfp-side-row">
            <div className="wfp-side-k">роль</div>
            <div className="wfp-side-v">{ROLE_LABEL[p?.role ?? ''] ?? p?.role ?? '—'}</div>
          </div>
        </div>
      </Card>

      {/* Безпекові секції доступні КОЖНІЙ ролі тут (/settings — owner-only), сюди ж
          ведуть банери 2FA-політики та mustChangePassword. */}
      <PasswordSection cardStyle={{ marginBottom: 16 }} />
      <EmailChangeSection
        currentEmail={p?.email ?? ''}
        pendingEmail={user?.pendingEmail}
        cardStyle={{ marginBottom: 16 }}
      />
      <div style={{ marginBottom: 16 }}>
        <TwoFactorSection app="workspace" />
      </div>

      <Card title="Заробіток">
        {payouts.isLoading ? (
          <Skeleton style={{ height: 120 }} />
        ) : mine.length === 0 ? (
          <EmptyState
            title="Виплат ще немає"
            description="Виплати за період зʼявляться тут, щойно власник їх згенерує."
          />
        ) : (
          <>
            <div
              className="wfp-mono"
              style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
            >
              // виплачено за {new Date().getFullYear()}:{' '}
              <span style={{ color: 'var(--wf-fg)' }}>{formatMoney(paidThisYear)}</span>
            </div>
            {mine.map((row) => {
              const s = STATUS[row.status]
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--wf-border)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="wfp-mono" style={{ fontWeight: 600, fontSize: 13 }}>
                      {row.period}
                    </div>
                    <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                      оклад {formatMoney(num(row.baseSalary))} · комісія{' '}
                      {formatMoney(num(row.commissionAmount))}
                      {num(row.referralBonusAmount)
                        ? ` · реф ${formatMoney(num(row.referralBonusAmount))}`
                        : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                    >
                      <StatusDot tone={s.tone} /> {s.label}
                    </span>
                    <span style={{ fontWeight: 600, minWidth: 90, textAlign: 'right' }}>
                      {formatMoney(num(row.total))} {row.currency}
                    </span>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </Card>
    </div>
  )
}
