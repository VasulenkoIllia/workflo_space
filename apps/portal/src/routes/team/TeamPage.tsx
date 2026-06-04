import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Card, EmptyState, Input } from '@workflo/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

const EMAIL_RE = /^\S+@\S+\.\S+$/

export function TeamPage() {
  const { user } = useAuth()
  const company = user?.companies.find((c) => c.id === user.activeCompanyId) ?? user?.companies[0]
  const isOwner = company?.role === 'owner'
  const [email, setEmail] = useState('')

  const invite = useMutation({
    mutationFn: (value: string) => api.post('/company/members/invite', { email: value }),
    onSuccess: () => {
      toast.success('Запрошення надіслано')
      setEmail('')
    },
  })

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Учасники</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
      >
        // {company?.name ?? '—'}
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
        <EmptyState
          title="Список учасників — скоро"
          description="Перегляд складу команди та керування правами зʼявиться разом із біллінгом (S5)."
        />
      </Card>
    </div>
  )
}
