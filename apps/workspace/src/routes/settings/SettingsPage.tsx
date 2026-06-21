import { useState } from 'react'
import { Button, Card, Input, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import {
  usePaymentSettings,
  useReferralSettings,
  useSavePaymentSettings,
  useSaveReferralSettings,
  type PaymentSettings,
  type PaymentSettingsInput,
  type ReferralSettings,
} from '@/lib/settings'

function PaymentForm({ initial }: { initial: PaymentSettings | null }) {
  const save = useSavePaymentSettings()
  const [bankName, setBankName] = useState(initial?.bankName ?? '')
  const [accountName, setAccountName] = useState(initial?.accountName ?? '')
  const [iban, setIban] = useState(initial?.iban ?? '')
  const [cryptoUsdt, setCryptoUsdt] = useState(initial?.cryptoUsdt ?? '')
  const [currency, setCurrency] = useState(initial?.invoiceCurrency ?? 'USD')
  const [terms, setTerms] = useState(initial?.paymentTermsDays?.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const submit = () => {
    const body: PaymentSettingsInput = {
      bankName: bankName.trim() || null,
      accountName: accountName.trim() || null,
      iban: iban.trim() || null,
      cryptoUsdt: cryptoUsdt.trim() || null,
      invoiceCurrency: currency,
      paymentTermsDays: terms.trim() === '' ? null : Number(terms),
      notes: notes.trim() || null,
    }
    save.mutate(body)
  }

  return (
    <Card title="Платіжні реквізити">
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // це бачить клієнт у розділі «Як оплатити»
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Банк" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <Input
            label="Отримувач"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </div>
        <Input label="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="USDT-гаманець"
            value={cryptoUsdt}
            onChange={(e) => setCryptoUsdt(e.target.value)}
          />
          <Select
            label="Валюта рахунків"
            value={currency}
            onChange={setCurrency}
            options={['USD', 'UAH', 'EUR'].map((c) => ({ value: c, label: c }))}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <Input
            label="Строк оплати, днів"
            type="number"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
          <Input label="Примітка" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={submit}>
          Зберегти реквізити
        </Button>
        {save.isSuccess && (
          <span style={{ fontSize: 12, color: 'var(--wf-accent)' }}>Збережено ✓</span>
        )}
        {save.isError && (
          <span style={{ fontSize: 12, color: 'var(--wf-destructive)' }}>Не вдалося зберегти.</span>
        )}
      </div>
    </Card>
  )
}

function ReferralForm({ initial }: { initial: ReferralSettings }) {
  const save = useSaveReferralSettings()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [employeePct, setEmployeePct] = useState(initial.employeeReferralPercent.toString())
  const [tiers, setTiers] = useState(
    initial.tiers.map((t) => ({
      minPaidUsd: t.minPaidUsd.toString(),
      percent: t.percent.toString(),
    }))
  )

  const setTier = (i: number, key: 'minPaidUsd' | 'percent', v: string) =>
    setTiers((prev) => prev.map((t, j) => (j === i ? { ...t, [key]: v } : t)))
  const addTier = () => setTiers((prev) => [...prev, { minPaidUsd: '', percent: '' }])
  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, j) => j !== i))

  const submit = () => {
    const parsedTiers = tiers
      .map((t) => ({ minPaidUsd: Number(t.minPaidUsd), percent: Number(t.percent) }))
      .filter((t) => Number.isFinite(t.minPaidUsd) && Number.isFinite(t.percent))
      .sort((a, b) => a.minPaidUsd - b.minPaidUsd)
    save.mutate({
      enabled,
      employeeReferralPercent: Number(employeePct) || 0,
      tiers: parsedTiers,
    })
  }

  return (
    <Card title="Реферальна програма">
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // % бонусу рефереру за тіром обороту приведеного клієнта
      </div>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Програма активна
      </label>

      <div style={{ marginTop: 14 }}>
        <div
          className="wfp-mono"
          style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
        >
          // тіри: від суми оплат ($) → % бонусу
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {tiers.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <Input
                placeholder="від $, напр. 5000"
                type="number"
                value={t.minPaidUsd}
                onChange={(e) => setTier(i, 'minPaidUsd', e.target.value)}
              />
              <Input
                placeholder="%, напр. 7"
                type="number"
                value={t.percent}
                onChange={(e) => setTier(i, 'percent', e.target.value)}
              />
              <Button variant="ghost" size="sm" onClick={() => removeTier(i)}>
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={addTier} style={{ marginTop: 8 }}>
          + Додати тір
        </Button>
      </div>

      <div style={{ marginTop: 14, maxWidth: 280 }}>
        <Input
          label="Реферал-бонус працівника, %"
          type="number"
          value={employeePct}
          onChange={(e) => setEmployeePct(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={submit}>
          Зберегти програму
        </Button>
        {save.isSuccess && (
          <span style={{ fontSize: 12, color: 'var(--wf-accent)' }}>Збережено ✓</span>
        )}
        {save.isError && (
          <span style={{ fontSize: 12, color: 'var(--wf-destructive)' }}>Не вдалося зберегти.</span>
        )}
      </div>
    </Card>
  )
}

export function SettingsPage() {
  const payment = usePaymentSettings()
  const referral = useReferralSettings()

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Налаштування</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // реквізити для оплати та реферальна програма
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {payment.isLoading ? (
          <Skeleton style={{ height: 200 }} />
        ) : (
          <PaymentForm initial={payment.data?.settings ?? null} />
        )}
        {referral.isLoading ? (
          <Skeleton style={{ height: 200 }} />
        ) : referral.data ? (
          <ReferralForm initial={referral.data} />
        ) : null}
      </div>
    </div>
  )
}
