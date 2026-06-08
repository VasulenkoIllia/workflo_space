import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Card, EmptyState, Input } from '@workflo/ui'
import { api } from '@/lib/api'

const EMAIL_RE = /^\S+@\S+\.\S+$/

/** Owner — invite executors to the agency team. Member roster lands with billing (S5). */
export function TeamPage() {
  const [email, setEmail] = useState('')

  const invite = useMutation({
    mutationFn: (value: string) => api.post('/workspace/team/invite', { email: value }),
    onSuccess: () => {
      toast.success('Запрошення виконавцю надіслано')
      setEmail('')
    },
  })

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Команда</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
      >
        // виконавці агенції
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
        <EmptyState
          title="Список виконавців — скоро"
          description="Перегляд складу команди, ставок і прав зʼявиться разом із біллінгом (S5)."
        />
      </Card>
    </div>
  )
}
