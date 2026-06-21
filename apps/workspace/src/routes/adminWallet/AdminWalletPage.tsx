import { useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { formatDate, formatMoney } from '@/lib/format'
import {
  num,
  useAdjustWallet,
  useCompanyWalletTxns,
  useWalletCompanies,
  type WalletCompany,
} from '@/lib/adminWallet'

const SOURCE_LABEL: Record<string, string> = {
  referral_bonus: 'Реферальний бонус',
  manual_adjustment: 'Коригування',
  invoice_payment: 'Оплата рахунку',
  refund: 'Повернення',
}

function CompanyModal({ company, onClose }: { company: WalletCompany; onClose: () => void }) {
  const txns = useCompanyWalletTxns(company.id)
  const adjust = useAdjustWallet()
  const [type, setType] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const amountInvalid = !(Number(amount) > 0)
  const noteInvalid = note.trim() === ''

  const submit = () => {
    if (amountInvalid || noteInvalid) return
    adjust.mutate(
      { companyId: company.id, type, amount: Number(amount), note: note.trim() },
      {
        onSuccess: () => {
          setAmount('')
          setNote('')
        },
      }
    )
  }

  const list = txns.data?.transactions ?? []

  return (
    <Modal
      open
      onClose={onClose}
      title={company.name}
      aux={`бонуси ${formatMoney(num(company.bonusBalance))}`}
      size="lg"
    >
      <div
        style={{
          border: '1px solid var(--wf-border)',
          borderRadius: 'var(--wf-radius)',
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div
          className="wfp-mono"
          style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 8 }}
        >
          // ручне коригування бонусного балансу
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, alignItems: 'end' }}
        >
          <Select
            label="Тип"
            value={type}
            onChange={(v) => setType(v as 'credit' | 'debit')}
            options={[
              { value: 'credit', label: 'Нарахувати' },
              { value: 'debit', label: 'Списати' },
            ]}
          />
          <Input
            label="Сума"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amount !== '' && amountInvalid ? '> 0' : undefined}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <Input
            label="Причина (обовʼязково)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={note !== '' && noteInvalid ? 'Вкажіть причину' : undefined}
          />
        </div>
        {adjust.isError && (
          <div style={{ color: 'var(--wf-destructive)', fontSize: 12, marginTop: 8 }}>
            Не вдалося — можливо, недостатньо балансу для списання.
          </div>
        )}
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <Button
            variant="primary"
            size="sm"
            loading={adjust.isPending}
            onClick={submit}
            disabled={amountInvalid || noteInvalid}
          >
            Застосувати
          </Button>
        </div>
      </div>

      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 8 }}
      >
        // останні операції
      </div>
      {txns.isLoading ? (
        <Skeleton />
      ) : list.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>Операцій ще немає.</div>
      ) : (
        <div>
          {list.map((t) => {
            const credit = t.type === 'credit'
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--wf-border)',
                  fontSize: 13,
                }}
              >
                <div>
                  {SOURCE_LABEL[t.source] ?? t.source}
                  <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                    {' '}
                    {formatDate(t.createdAt)}
                  </span>
                  {t.note ? <span style={{ color: 'var(--wf-fg-muted)' }}> · {t.note}</span> : null}
                </div>
                <div
                  style={{ fontWeight: 600, color: credit ? 'var(--wf-accent)' : 'var(--wf-fg)' }}
                >
                  {credit ? '+' : '−'}
                  {formatMoney(num(t.amount))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export function AdminWalletPage() {
  const [search, setSearch] = useState('')
  const companies = useWalletCompanies(search)
  const [selected, setSelected] = useState<WalletCompany | null>(null)

  const list = companies.data?.companies ?? []

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Бонусні гаманці</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // баланси клієнтів і ручні коригування
      </div>

      <div style={{ maxWidth: 320, marginBottom: 14 }}>
        <Input
          placeholder="Пошук компанії…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {companies.isLoading ? (
        <Skeleton />
      ) : list.length === 0 ? (
        <EmptyState title="Компаній не знайдено" description="Змініть запит пошуку." />
      ) : (
        <Card>
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid var(--wf-border)',
                background: 'none',
                border: 'none',
                borderBottomColor: 'var(--wf-border)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span style={{ display: 'flex', gap: 18 }}>
                <span style={{ color: 'var(--wf-accent)', fontWeight: 600 }}>
                  {formatMoney(num(c.bonusBalance))}
                </span>
                <span
                  style={{
                    color:
                      (num(c.moneyBalance) ?? 0) < 0 ? 'var(--wf-warning)' : 'var(--wf-fg-muted)',
                    fontWeight: 600,
                    minWidth: 70,
                    textAlign: 'right',
                  }}
                >
                  {formatMoney(num(c.moneyBalance))} {c.currency}
                </span>
              </span>
            </button>
          ))}
        </Card>
      )}

      {/* Re-read the selected company from the live query so the header balance reflects an
          adjustment immediately (the prop snapshot would otherwise go stale). */}
      {selected && (
        <CompanyModal
          company={list.find((c) => c.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
