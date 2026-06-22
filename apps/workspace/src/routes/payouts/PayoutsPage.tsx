import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusDot } from '@workflo/ui'
import { Select } from '@/components/Select'
import { formatMoney } from '@/lib/format'
import {
  num,
  useGeneratePayouts,
  usePayouts,
  usePayoutTransition,
  useSetRate,
  useTeam,
  type Payout,
  type PayoutStatus,
  type RateInput,
  type TeamMember,
} from '@/lib/payouts'

const STATUS: Record<PayoutStatus, { tone: 'muted' | 'warning' | 'success'; label: string }> = {
  draft: { tone: 'muted', label: 'чернетка' },
  approved: { tone: 'warning', label: 'погоджено' },
  paid: { tone: 'success', label: 'виплачено' },
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function RateModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const setRate = useSetRate()
  const [salary, setSalary] = useState(member.rate?.monthlySalary ?? '')
  const [commission, setCommission] = useState(member.rate?.commissionPercent ?? '')
  const [currency, setCurrency] = useState(member.rate?.currency ?? 'USD')

  const invalid = !(Number(salary) > 0) && !(Number(commission) > 0)

  const submit = () => {
    if (invalid) return
    const body: RateInput = { executorId: member.profileId, currency }
    if (Number(salary) > 0) body.monthlySalary = Number(salary)
    if (Number(commission) > 0) body.commissionPercent = Number(commission)
    setRate.mutate(body, { onSuccess: onClose })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Ставка — ${member.name}`}
      aux="нова ставка діє з сьогодні"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={setRate.isPending}>
            Скасувати
          </Button>
          <Button variant="primary" loading={setRate.isPending} onClick={submit} disabled={invalid}>
            Зберегти
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Оклад / міс"
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
          <Input
            label="Комісія, %"
            type="number"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
          />
        </div>
        <Select
          label="Валюта"
          value={currency}
          onChange={setCurrency}
          options={['USD', 'UAH', 'EUR'].map((c) => ({ value: c, label: c }))}
        />
        {invalid && (
          <div style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
            Вкажіть оклад та/або комісію більше 0.
          </div>
        )}
        {setRate.isError && (
          <div style={{ color: 'var(--wf-destructive)', fontSize: 12 }}>Не вдалося зберегти.</div>
        )}
      </div>
    </Modal>
  )
}

function PayoutRow({ p, name }: { p: Payout; name: string }) {
  const transition = usePayoutTransition()
  const s = STATUS[p.status]
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--wf-border)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{name}</div>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          оклад {formatMoney(num(p.baseSalary))} · комісія {formatMoney(num(p.commissionAmount))}
          {num(p.referralBonusAmount) ? ` · реф ${formatMoney(num(p.referralBonusAmount))}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <StatusDot tone={s.tone} /> {s.label}
        </span>
        <div style={{ fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
          {formatMoney(num(p.total))} {p.currency}
        </div>
        {p.status === 'draft' && (
          <Button
            size="sm"
            variant="primary"
            loading={transition.isPending}
            onClick={() => transition.mutate({ id: p.id, action: 'approve' })}
          >
            Погодити
          </Button>
        )}
        {p.status === 'approved' && (
          <Button
            size="sm"
            variant="secondary"
            loading={transition.isPending}
            onClick={() => transition.mutate({ id: p.id, action: 'mark-paid' })}
          >
            Виплачено
          </Button>
        )}
      </div>
    </div>
  )
}

const MONTHS_UK = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
]
/** 'YYYY-MM' → 'Місяць РІК' (UK), independent of the OS locale a native month-input would use. */
function monthLabelUk(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${MONTHS_UK[(m || 1) - 1] ?? ''} ${y}`
}
function shiftMonth(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function PayoutsPage() {
  const [period, setPeriod] = useState(currentMonth())
  const team = useTeam()
  const payouts = usePayouts(period)
  const generate = useGeneratePayouts()
  const [rateFor, setRateFor] = useState<TeamMember | null>(null)

  const nameOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of team.data?.members ?? []) m.set(t.profileId, t.name)
    return (id: string) => m.get(id) ?? id.slice(0, 8)
  }, [team.data])

  const list = payouts.data?.payouts ?? []
  const members = team.data?.members ?? []

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Виплати команді</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // оклад + комісія + реферал-бонус за період
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              background: 'var(--wf-surface)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: '2px 4px',
            }}
          >
            <button
              type="button"
              aria-label="Попередній місяць"
              onClick={() => setPeriod(shiftMonth(period, -1))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--wf-fg-secondary)',
                cursor: 'pointer',
                fontSize: 16,
                padding: '2px 8px',
                lineHeight: 1,
              }}
            >
              ‹
            </button>
            <span
              className="wfp-mono"
              style={{ fontSize: 13, minWidth: 130, textAlign: 'center', color: 'var(--wf-fg)' }}
            >
              {monthLabelUk(period)}
            </span>
            <button
              type="button"
              aria-label="Наступний місяць"
              onClick={() => setPeriod(shiftMonth(period, 1))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--wf-fg-secondary)',
                cursor: 'pointer',
                fontSize: 16,
                padding: '2px 8px',
                lineHeight: 1,
              }}
            >
              ›
            </button>
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={generate.isPending}
            onClick={() => generate.mutate(period)}
          >
            Згенерувати
          </Button>
        </div>
      </div>

      {payouts.isLoading ? (
        <Skeleton />
      ) : list.length === 0 ? (
        <EmptyState
          title="Виплат за цей період немає"
          description="Натисніть «Згенерувати», щоб порахувати виплати команди."
        />
      ) : (
        <Card>
          {list.map((p) => (
            <PayoutRow key={p.id} p={p} name={nameOf(p.executorId)} />
          ))}
        </Card>
      )}

      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 12 }}>
        Команда та ставки
      </div>
      {team.isLoading ? (
        <Skeleton />
      ) : members.length === 0 ? (
        <EmptyState
          title="Команда порожня"
          description="Запросіть виконавців у розділі «Команда»."
        />
      ) : (
        <Card>
          {members.map((m) => (
            <div
              key={m.profileId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid var(--wf-border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  {m.rate
                    ? `${formatMoney(num(m.rate.monthlySalary))}/міс · ${m.rate.commissionPercent}% · ${m.rate.currency}`
                    : 'ставку не задано'}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setRateFor(m)}>
                Ставка
              </Button>
            </div>
          ))}
        </Card>
      )}

      {rateFor && <RateModal member={rateFor} onClose={() => setRateFor(null)} />}
    </div>
  )
}
