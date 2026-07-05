import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Input, Modal } from '@workflo/ui'
import { useVaultStepUp } from '@/lib/credentials'

/** Password re-entry gate before revealing a vault secret (17-А, 2FA-on-reveal — portal
 * twin of the workspace modal). On success a 5-min grant is cached (lib) and `onSuccess`
 * runs the pending reveal. */
export function VaultStepUpModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const stepUp = useVaultStepUp()
  const [password, setPassword] = useState('')

  const submit = () => {
    if (password === '') {
      toast.error('Введіть пароль')
      return
    }
    stepUp.mutate(password, {
      onSuccess: () => {
        setPassword('')
        onSuccess()
      },
    })
  }

  const close = () => {
    setPassword('')
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title="Підтвердьте пароль">
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // щоб показати секрет, підтвердьте, що це ви. Діє 5 хв.
        </div>
        <Input
          label="Ваш пароль"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" loading={stepUp.isPending} onClick={submit}>
            Підтвердити
          </Button>
          <Button variant="ghost" onClick={close}>
            Скасувати
          </Button>
        </div>
      </div>
    </Modal>
  )
}
