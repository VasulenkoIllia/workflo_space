import { useState } from 'react'
import { toast } from 'sonner'
import { useTwoFactorStatus } from '@workflo/app-core'
import { Button, Input, Modal } from '@workflo/ui'
import { useVaultStepUp } from '@/lib/credentials'

/** Step-up gate before revealing a vault secret (17-А, portal twin). TOTP-first (рішення
 * 05.07): with 2FA enabled the proof is a 6-digit authenticator code (or a backup code);
 * without 2FA the password fallback stays. On success a 5-min grant is cached (lib) and
 * `onSuccess` runs the pending reveal. */
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
  const { data: tfa } = useTwoFactorStatus()
  const useCode = tfa?.enabled === true
  const [value, setValue] = useState('')

  const submit = () => {
    if (value === '') {
      toast.error(useCode ? 'Введіть код' : 'Введіть пароль')
      return
    }
    stepUp.mutate(useCode ? { code: value } : { password: value }, {
      onSuccess: () => {
        setValue('')
        onSuccess()
      },
    })
  }

  const close = () => {
    setValue('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={useCode ? 'Підтвердьте код 2FA' : 'Підтвердьте пароль'}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          {useCode
            ? '// щоб показати секрет, введіть код з автентифікатора (або резервний код). Діє 5 хв.'
            : '// щоб показати секрет, підтвердьте, що це ви. Діє 5 хв.'}
        </div>
        <Input
          label={useCode ? 'Код автентифікатора' : 'Ваш пароль'}
          type={useCode ? 'text' : 'password'}
          inputMode={useCode ? 'numeric' : undefined}
          placeholder={useCode ? '000000' : undefined}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
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
