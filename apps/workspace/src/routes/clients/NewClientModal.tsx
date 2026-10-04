import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Input, Modal } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useCreateClient } from '@/lib/clients'

const EMAIL_RE = /^\S+@\S+\.\S+$/
const CURRENCIES = ['USD', 'EUR', 'UAH'] as const

/**
 * CORE-FLOWS (D4): «+ Клієнт» — агенція заводить компанію-клієнта сама (раніше компанія
 * зʼявлялась лише після самореєстрації клієнта). Контакт опційно запрошується в портал —
 * перший, хто прийме, стає власником компанії.
 */
export function NewClientModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const create = useCreateClient()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<string>('USD')
  const [email, setEmail] = useState('')
  const emailOk = email.trim() === '' || EMAIL_RE.test(email.trim())

  const submit = () =>
    create.mutate(
      {
        name: name.trim(),
        currency,
        ...(email.trim() ? { contactEmail: email.trim().toLowerCase() } : {}),
      },
      {
        onSuccess: ({ company, invited }) => {
          toast.success(
            email.trim() && !invited
              ? 'Клієнта створено; запрошення не надіслано — спробуйте з вкладки «Люди»'
              : invited
                ? `Клієнта створено · запрошення надіслано на ${email.trim()}`
                : 'Клієнта створено'
          )
          onClose()
          navigate(`/clients/${company.id}`)
        },
      }
    )

  return (
    <Modal
      open
      onClose={onClose}
      title="Новий клієнт"
      aux="// компанія-клієнт агенції"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={name.trim() === '' || !emailOk}
            onClick={submit}
          >
            Створити клієнта
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Input
          label="Назва компанії"
          value={name}
          autoFocus
          placeholder="напр. ТОВ «Ромашка»"
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="Валюта розрахунків"
          value={currency}
          onChange={setCurrency}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <Input
          label="Email контактної особи (опційно)"
          type="email"
          value={email}
          placeholder="director@company.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <div style={{ fontSize: 12, color: 'var(--wf-fg-muted)', lineHeight: 1.5 }}>
          {email.trim()
            ? 'Надішлемо запрошення в клієнтський портал — людина стане власником компанії й зможе додати колег.'
            : 'Без контакту компанія зʼявиться лише у вашому списку; запросити людей можна пізніше з вкладки «Люди».'}
        </div>
      </div>
    </Modal>
  )
}
