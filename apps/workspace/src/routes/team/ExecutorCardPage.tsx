import { Link, useParams } from 'react-router-dom'
import { Avatar, Card, EmptyState, Skeleton } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/format'
import { useTeam } from '@/lib/payouts'
import { useExecutorKpi } from '@/lib/teams'

/**
 * 12-В KPI-картка виконавця (owner/manager): /team/:profileId.
 * Профіль (роль·команда·з дати) + KPI за поточний місяць (години/прийняті/нетто-виручка/
 * активні замовлення/задачі/вчасність) + компенсація (owner — ставки owner-only в ростері).
 */
const ROLE_LABEL: Record<string, string> = {
  owner: 'власник',
  manager: 'тімлід',
  executor: 'виконавець',
}

export function ExecutorCardPage() {
  const { profileId = '' } = useParams()
  const { isOwner } = useAuth()
  const { data: team, isLoading: teamLoading } = useTeam()
  const { data: kpi, isLoading: kpiLoading } = useExecutorKpi(profileId)

  const member = team?.members.find((m) => m.profileId === profileId)

  if (teamLoading) return <Skeleton style={{ height: 320 }} />
  if (!member) {
    return (
      <EmptyState
        glyph="// 404"
        title="Члена команди не знайдено"
        action={
          <Link to="/team" className="wfp-link">
            ← до команди
          </Link>
        }
      />
    )
  }

  const rate = member.rate

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">
            <Link to="/team" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
              ← команда
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <Avatar name={member.name} size={40} />
            <div>
              <h1 className="wfp-ph-h1" style={{ marginBottom: 2 }}>
                {member.name}
              </h1>
              <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                {member.email} · {ROLE_LABEL[member.role] ?? member.role}
                {member.team ? (
                  <span style={{ color: member.team.color ?? undefined }}>
                    {' '}
                    · {member.team.name}
                  </span>
                ) : null}{' '}
                · з {formatDate(member.joinedAt)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI за поточний місяць (12-В: вчасність · години · виручка) */}
      <Card title="KPI · поточний місяць" style={{ marginBottom: 16 }}>
        {kpiLoading || !kpi ? (
          <Skeleton style={{ height: 80 }} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi k="залоговано" v={`${kpi.hoursLogged} год`} />
            <Kpi k="прийнято (оплатні)" v={`${kpi.hoursAccepted} год`} accent />
            <Kpi k="нетто-виручка" v={`$${kpi.revenueUsd}`} />
            <Kpi k="активні замовлення" v={String(kpi.activeOrders)} />
            <Kpi k="задач закрито" v={String(kpi.tasksDone)} />
            <Kpi
              k="вчасність"
              v={kpi.onTimePct != null ? `${kpi.onTimePct}%` : '—'}
              sub={
                kpi.onTimeBase > 0 ? `з ${kpi.onTimeBase} з дедлайном` : 'без прийнятих з дедлайном'
              }
            />
          </div>
        )}
      </Card>

      {/* Компенсація — owner-only (ставки owner-only і в ростері) */}
      {isOwner && (
        <Card title="Компенсація" style={{ marginBottom: 16 }}>
          {rate ? (
            <div className="wfp-side">
              {rate.monthlySalary && (
                <Row k="оклад/міс" v={`${rate.monthlySalary} ${rate.currency}`} />
              )}
              {rate.hourlyRate && (
                <Row k="ставка/год (собівар.=оплата)" v={`${rate.hourlyRate} ${rate.currency}`} />
              )}
              {rate.commissionPercent && <Row k="комісія" v={`${rate.commissionPercent}%`} />}
              {rate.zeroCostDefault && <Row k="собівартість" v="0 (zero-cost)" />}
              {member.hireDate && <Row k="дата найму" v={formatDate(member.hireDate)} />}
              <Row
                k="норма"
                v={
                  member.weeklyCapacityHours != null
                    ? `${member.weeklyCapacityHours} год/тиж`
                    : '40 год/тиж (дефолт)'
                }
              />
            </div>
          ) : (
            <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
              // ставку ще не задано — задай у «Команда → редагувати»
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function Kpi({ k, v, sub, accent }: { k: string; v: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {k}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: accent ? 'var(--wf-accent)' : 'var(--wf-fg)',
        }}
      >
        {v}
      </div>
      {sub && (
        <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="wfp-side-row">
      <div className="wfp-side-k">{k}</div>
      <div className="wfp-side-v">{v}</div>
    </div>
  )
}
