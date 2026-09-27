import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, Input, Skeleton } from '@workflo/ui'
import {
  useRequisites,
  useSaveRequisites,
  type Requisites,
  type RequisitesInput,
} from '@/lib/requisites'

/**
 * Реквізити компанії-клієнта (06-Б) — редагує власник компанії. DEDUP C10: живуть у «Моя
 * компанія» (дім компанії: профіль · реквізити · учасники), а не в налаштуваннях акаунта.
 */

const LEGAL_TYPES = [
  { value: '', label: '—' },
  { value: 'fop', label: 'ФОП' },
  { value: 'tov', label: 'ТОВ' },
  { value: 'individual', label: 'Фізособа' },
  { value: 'foreign', label: 'Іноземна' },
]

const reqSelectStyle = {
  width: '100%',
  background: 'var(--wf-surface)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 'var(--wf-radius)',
  padding: '8px 10px',
  fontSize: 14,
} as const

export function RequisitesSection() {
  const { data, isLoading } = useRequisites()
  return (
    <Card title="Реквізити компанії" style={{ marginBottom: 16 }}>
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // юр-дані для рахунків та актів від агенції
      </div>
      {isLoading ? (
        <Skeleton style={{ height: 220 }} />
      ) : (
        <RequisitesForm initial={data?.requisites ?? null} />
      )}
    </Card>
  )
}

function RequisitesForm({ initial }: { initial: Requisites | null }) {
  const save = useSaveRequisites()
  const [legalType, setLegalType] = useState(initial?.legalType ?? '')
  const [legalName, setLegalName] = useState(initial?.legalName ?? '')
  const [taxId, setTaxId] = useState(initial?.taxId ?? '')
  const [vatPayer, setVatPayer] = useState(initial?.vatPayer ?? false)
  const [vatId, setVatId] = useState(initial?.vatId ?? '')
  const [legalAddress, setLegalAddress] = useState(initial?.legalAddress ?? '')
  const [bankName, setBankName] = useState(initial?.bankName ?? '')
  const [iban, setIban] = useState(initial?.iban ?? '')
  const [signerName, setSignerName] = useState(initial?.signerName ?? '')
  const [signerTitle, setSignerTitle] = useState(initial?.signerTitle ?? '')
  const [documentEmail, setDocumentEmail] = useState(initial?.documentEmail ?? '')
  const [documentEmailCc, setDocumentEmailCc] = useState(initial?.documentEmailCc ?? '')

  const submit = () => {
    const body: RequisitesInput = {
      legalType: legalType || null,
      legalName: legalName.trim() || null,
      taxId: taxId.trim() || null,
      vatPayer,
      vatId: vatPayer ? vatId.trim() || null : null,
      legalAddress: legalAddress.trim() || null,
      bankName: bankName.trim() || null,
      iban: iban.trim() || null,
      signerName: signerName.trim() || null,
      signerTitle: signerTitle.trim() || null,
      documentEmail: documentEmail.trim() || null,
      documentEmailCc: documentEmailCc.trim() || null,
    }
    save.mutate(body, { onSuccess: () => toast.success('Реквізити збережено') })
  }

  const complete = initial?.legalIsComplete ?? false

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: complete ? 'var(--wf-success)' : 'var(--wf-warning)' }}
      >
        {complete
          ? '✓ готово до документів'
          : '// для документів потрібні: юр-назва, ІПН/ЄДРПОУ, IBAN, підписант'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ТИП
          </span>
          <select
            value={legalType}
            onChange={(e) => setLegalType(e.target.value)}
            style={reqSelectStyle}
          >
            {LEGAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <Input label="ІПН / ЄДРПОУ" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
      </div>
      <Input
        label="Юридична назва"
        value={legalName}
        onChange={(e) => setLegalName(e.target.value)}
      />
      <Input
        label="Юридична адреса"
        value={legalAddress}
        onChange={(e) => setLegalAddress(e.target.value)}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <Input label="Банк" value={bankName} onChange={(e) => setBankName(e.target.value)} />
        <Input label="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} />
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
        <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
        Платник ПДВ
      </label>
      {vatPayer && (
        <Input label="ІПН ПДВ" value={vatId} onChange={(e) => setVatId(e.target.value)} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input
          label="Підписант"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
        />
        <Input
          label="Посада підписанта"
          value={signerTitle}
          onChange={(e) => setSignerTitle(e.target.value)}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input
          label="Email для документів"
          value={documentEmail}
          onChange={(e) => setDocumentEmail(e.target.value)}
        />
        <Input
          label="Email копія (CC)"
          value={documentEmailCc}
          onChange={(e) => setDocumentEmailCc(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
        <Button variant="primary" loading={save.isPending} onClick={submit}>
          Зберегти реквізити
        </Button>
        {save.isError && (
          <span style={{ fontSize: 12, color: 'var(--wf-destructive)' }}>
            Не вдалося зберегти — перевірте поля.
          </span>
        )}
      </div>
    </div>
  )
}
