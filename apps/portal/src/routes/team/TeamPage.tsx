import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Avatar, Button, Card, EmptyState, Input, Skeleton } from '@workflo/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/format'

const EMAIL_RE = /^\S+@\S+\.\S+$/

interface CompanyMember {
  profileId: string
  name: string
  email: string
  role: 'owner' | 'member'
  joinedAt: string
}

const ROLE_LABEL: Record<string, string> = { owner: 'власник', member: 'учасник' }

export function TeamPage() {
  const { user } = useAuth()
  const myId = user?.profile.id
  const company = user?.companies.find((c) => c.id === user.activeCompanyId) ?? user?.companies[0]
  const isOwner = company?.role === 'owner'
  const [email, setEmail] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['portal-company-members'],
    queryFn: () => api.get<{ members: CompanyMember[] }>('/portal/company/members'),
  })
  const members = data?.members ?? []

  const invite = useMutation({
    mutationFn: (value: string) => api.post('/company/members/invite', { email: value }),
    onSuccess: () => {
      toast.success('Запрошення надіслано')
      setEmail('')
      void qc.invalidateQueries({ queryKey: ['portal-company-members'] })
    },
  })

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Учасники</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
      >
        // {company?.name ?? '—'} · {members.length}{' '}
        {members.length === 1 ? 'учасник' : 'учасників'}
      </div>

      {isOwner && (
        <Card title="Запросити учасника" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Email"
                type="email"
                placeholder="colleague@brunky.ua"
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
      )}

      <Card title="Склад команди">
        {isLoading ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <Skeleton style={{ height: 40 }} />
            <Skeleton style={{ height: 40 }} />
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            title="Поки лише ви"
            description="Запросіть колег вище — вони зʼявляться тут після прийняття запрошення."
          />
        ) : (
          <div style={{ display: 'grid', gap: 2 }}>
            {members.map((m) => (
              <div
                key={m.profileId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1.2fr',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 8px',
                  borderBottom: '1px solid var(--wf-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar name={m.name} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>
                      {m.name}
                      {m.profileId === myId && (
                        <span
                          className="wfp-mono"
                          style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginLeft: 6 }}
                        >
                          (ви)
                        </span>
                      )}
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
                      {m.email}
                    </div>
                  </div>
                </div>
                <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
                <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}>
                  з {formatDate(m.joinedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
