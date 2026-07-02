import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Avatar, Button, Card, EmptyState, Input, Modal, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import {
  num,
  useSetCapacity,
  useSetRate,
  useSetRole,
  useSetZeroCost,
  useTeam,
  type TeamMember,
} from '@/lib/payouts'
import { formatDate } from '@/lib/format'

const EMAIL_RE = /^\S+@\S+\.\S+$/

const ROLE_LABEL: Record<string, string> = {
  owner: 'власник',
  manager: 'менеджер',
  executor: 'виконавець',
}

/** Owner — agency team: invite executors + roster; усі правки учасника — в EditMemberModal. */
export function TeamPage() {
  const [email, setEmail] = useState('')
  const { isOwner } = useAuth()
  const { data, isLoading } = useTeam()
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const members = data?.members ?? []

  const invite = useMutation({
    mutationFn: (value: string) => api.post('/workspace/team/invite', { email: value }),
    onSuccess: () => {
      toast.success('Запрошення виконавцю надіслано')
      setEmail('')
    },
  })

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Команда</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
      >
        // {members.length} {members.length === 1 ? 'учасник' : 'учасників'} · виконавці агенції
      </div>

      <Card title="Запросити виконавця" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Email"
              type="email"
              placeholder="executor@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            loading={invite.isPending}
            disabled={!EMAIL_RE.test(email.trim())}
            onClick={() => invite.mutate(email.trim())}
          >
            Запросити
          </Button>
        </div>
      </Card>

      <Card title="Склад команди">
        {isLoading ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <Skeleton style={{ height: 40 }} />
            <Skeleton style={{ height: 40 }} />
            <Skeleton style={{ height: 40 }} />
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            title="Поки лише ви"
            description="Запросіть виконавців вище — вони зʼявляться тут після прийняття."
          />
        ) : (
          <div style={{ display: 'grid', gap: 2 }}>
            {members.map((m) => (
              <MemberRow key={m.profileId} member={m} canEdit={isOwner} onEdit={setEditing} />
            ))}
          </div>
        )}
      </Card>

      {editing && <EditMemberModal member={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function MemberRow({
  member,
  canEdit,
  onEdit,
}: {
  member: TeamMember
  canEdit: boolean
  onEdit: (m: TeamMember) => void
}) {
  const rate = member.rate

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1.2fr 1.1fr auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 8px',
        borderBottom: '1px solid var(--wf-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Avatar name={member.name} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {member.name}
          </div>
          <div
            className="wfp-mono"
            style={{
              fontSize: 11,
              color: 'var(--wf-fg-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {member.email}
          </div>
        </div>
      </div>
      <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
        {ROLE_LABEL[member.role] ?? member.role}
      </span>
      <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}>
        з {formatDate(member.joinedAt)} ·{' '}
        {member.weeklyCapacityHours != null
          ? `${member.weeklyCapacityHours} год/тиж`
          : '40 год/тиж'}
      </span>
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
        }}
      >
        <span className="wfp-mono" style={{ fontSize: 12, textAlign: 'right' }}>
          {rate
            ? `${rate.monthlySalary ? `${Number(rate.monthlySalary)} ${rate.currency}/міс` : '—'}${
                Number(rate.commissionPercent) ? ` · ${Number(rate.commissionPercent)}%` : ''
              }`
            : '—'}
        </span>
        {rate?.zeroCostDefault && (
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            без собівартості
          </span>
        )}
      </span>
      {canEdit ? (
        <Button size="sm" variant="ghost" onClick={() => onEdit(member)}>
          Редагувати
        </Button>
      ) : (
        <span />
      )}
    </div>
  )
}

/**
 * 12-EDITMEMBER (design workspace-admin.jsx EditMemberModal, чесний субсет без
 * підрозділів/керівника — їх нема в API): роль + компенсація + норма + zeroCost
 * в ОДНОМУ місці. Save виконує лише мутації змінених груп: роль (PATCH role),
 * компенсація (POST rates → нове вікно), норма (PATCH capacity), прапорець
 * (PATCH zero-cost).
 */
function EditMemberModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const rate = member.rate
  const isOwnerRow = member.role === 'owner'
  const setRole = useSetRole()
  const setRate = useSetRate()
  const setCapacity = useSetCapacity()
  const setZeroCost = useSetZeroCost()

  const [role, setRoleValue] = useState(member.role)
  const [salary, setSalary] = useState(rate?.monthlySalary ?? '')
  const [hourly, setHourly] = useState(rate?.hourlyRate ?? '')
  const [commission, setCommission] = useState(rate?.commissionPercent ?? '')
  const [currency, setCurrency] = useState(rate?.currency ?? 'USD')
  const [capacity, setCapacityValue] = useState(member.weeklyCapacityHours?.toString() ?? '')
  const [zeroCost, setZeroCostValue] = useState(rate?.zeroCostDefault ?? false)
  const [saving, setSaving] = useState(false)

  const compChanged =
    (num(salary || null) ?? null) !== (num(rate?.monthlySalary ?? null) ?? null) ||
    (num(hourly || null) ?? null) !== (num(rate?.hourlyRate ?? null) ?? null) ||
    (num(commission || null) ?? null) !== (num(rate?.commissionPercent ?? null) ?? null) ||
    currency !== (rate?.currency ?? 'USD')
  const compEmpty = !(Number(salary) > 0) && !(Number(commission) > 0) && !(Number(hourly) > 0)
  const capParsed = capacity.trim() === '' ? null : Number(capacity)
  const capInvalid =
    capParsed != null && (!Number.isFinite(capParsed) || capParsed < 0 || capParsed > 168)

  const save = async () => {
    if (capInvalid || (compChanged && compEmpty)) return
    setSaving(true)
    // СТРОГО послідовно: rates-POST і zero-cost-PATCH обидва закривають/відкривають
    // вікно ExecutorRate — паралельний виклик може лишити ДВА відкриті вікна (гонка
    // read→close→create). Порядок: спершу компенсація (переносить старий прапорець),
    // потім прапорець (закриє щойно створене вікно, якщо змінився).
    const jobs: (() => Promise<unknown>)[] = []
    if (!isOwnerRow && role !== member.role && (role === 'manager' || role === 'executor')) {
      jobs.push(() => setRole.mutateAsync({ profileId: member.profileId, role }))
    }
    if (compChanged && !compEmpty) {
      jobs.push(() =>
        setRate.mutateAsync({
          executorId: member.profileId,
          ...(Number(salary) > 0 ? { monthlySalary: Number(salary) } : {}),
          ...(Number(hourly) > 0 ? { hourlyRate: Number(hourly) } : {}),
          ...(Number(commission) > 0 ? { commissionPercent: Number(commission) } : {}),
          currency,
        })
      )
    }
    if (zeroCost !== (rate?.zeroCostDefault ?? false)) {
      jobs.push(() =>
        setZeroCost.mutateAsync({ profileId: member.profileId, zeroCostDefault: zeroCost })
      )
    }
    if (capParsed !== (member.weeklyCapacityHours ?? null)) {
      jobs.push(() =>
        setCapacity.mutateAsync({ profileId: member.profileId, weeklyCapacityHours: capParsed })
      )
    }
    if (jobs.length === 0) {
      setSaving(false)
      onClose()
      return
    }
    try {
      for (const job of jobs) await job()
      toast.success('Зміни збережено')
      onClose()
    } catch {
      toast.error('Не всі зміни збереглися — перевірте значення')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={member.name}
      aux="edit member"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={capInvalid || (compChanged && compEmpty)}
            onClick={() => void save()}
          >
            Зберегти
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: -6 }}
        >
          {member.email} · з {formatDate(member.joinedAt)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Select
              label="Роль"
              value={role}
              onChange={setRoleValue}
              disabled={isOwnerRow}
              options={
                isOwnerRow
                  ? [{ value: 'owner', label: 'власник' }]
                  : [
                      { value: 'executor', label: 'виконавець' },
                      { value: 'manager', label: 'менеджер' },
                    ]
              }
            />
            {isOwnerRow && (
              <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                // роль власника — лише передачею власності
              </div>
            )}
          </div>
          <Input
            label="Норма, год/тиж"
            type="number"
            placeholder="40"
            value={capacity}
            onChange={(e) => setCapacityValue(e.target.value)}
            error={capInvalid ? '0–168' : undefined}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Input
            label="Оклад / міс"
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
          <Input
            label="Собівартість, $/год"
            type="number"
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
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
        {compChanged && (
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            // зміна компенсації відкриє нове вікно ставки (історія зберігається)
          </div>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            cursor: 'pointer',
            padding: '10px 12px',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius)',
          }}
        >
          <input
            type="checkbox"
            checked={zeroCost}
            onChange={(e) => setZeroCostValue(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--wf-accent)' }}
          />
          <span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Без собівартості (zeroCost)</span>
            <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              весь дохід проєктів цієї людини = дохід агенції
            </div>
          </span>
        </label>
      </div>
    </Modal>
  )
}
