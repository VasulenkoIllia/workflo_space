import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Avatar, Button, Card, EmptyState, Input, Skeleton } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { useSetCapacity, useTeam, type TeamMember } from '@/lib/payouts'
import { formatDate } from '@/lib/format'

const EMAIL_RE = /^\S+@\S+\.\S+$/

const ROLE_LABEL: Record<string, string> = {
  owner: 'власник',
  manager: 'менеджер',
  executor: 'виконавець',
}

/** Owner — agency team: invite executors + roster with roles, join dates and (owner-only) rates. */
export function TeamPage() {
  const [email, setEmail] = useState('')
  const { isOwner } = useAuth()
  const { data, isLoading } = useTeam()
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
              <MemberRow key={m.profileId} member={m} canEdit={isOwner} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function MemberRow({ member, canEdit }: { member: TeamMember; canEdit: boolean }) {
  const rate = member.rate
  const setCapacity = useSetCapacity()
  const [cap, setCap] = useState(member.weeklyCapacityHours?.toString() ?? '')

  const saveCapacity = () => {
    const trimmed = cap.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next === (member.weeklyCapacityHours ?? null)) return
    if (next != null && (!Number.isFinite(next) || next < 0 || next > 168)) {
      toast.error('Норма: 0–168 год/тиж')
      setCap(member.weeklyCapacityHours?.toString() ?? '')
      return
    }
    setCapacity.mutate(
      { profileId: member.profileId, weeklyCapacityHours: next },
      {
        onSuccess: () => toast.success('Норму збережено'),
        onError: () => toast.error('Не вдалося зберегти норму'),
      }
    )
  }

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
        з {formatDate(member.joinedAt)}
      </span>
      {canEdit ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            onBlur={saveCapacity}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            inputMode="numeric"
            placeholder="40"
            title="Норма годин/тиждень"
            style={{
              width: 48,
              background: 'var(--wf-surface)',
              color: 'var(--wf-fg)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: '4px 6px',
              fontSize: 12,
            }}
          />
          <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            год/тиж
          </span>
        </span>
      ) : (
        <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}>
          {member.weeklyCapacityHours != null ? `${member.weeklyCapacityHours} год/тиж` : '—'}
        </span>
      )}
      <span className="wfp-mono" style={{ fontSize: 12, textAlign: 'right' }}>
        {rate
          ? `${rate.monthlySalary ? `${Number(rate.monthlySalary)} ${rate.currency}/міс` : '—'}${
              Number(rate.commissionPercent) ? ` · ${Number(rate.commissionPercent)}%` : ''
            }`
          : '—'}
      </span>
    </div>
  )
}
