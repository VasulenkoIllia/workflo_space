import type { CSSProperties } from 'react'
import { toast } from 'sonner'
import { Button, Icon, type IconName, Input } from '@workflo/ui'
import {
  type VaultField,
  VAULT_FIELD_KINDS,
  type VaultFieldKind,
  VAULT_RESOURCE_TYPES,
} from '@workflo/types'

/**
 * 17-Д typed secret templates — shared field UI for BOTH vault surfaces (workspace SecretRow /
 * client-360 add-form and portal SecretsPage). The catalog (types, kinds, labels, icons,
 * secret-flags) lives in @workflo/types VAULT_* constants — the single substitution point when
 * the owner finalizes the type list.
 */

export const VAULT_TYPE_OPTIONS = Object.entries(VAULT_RESOURCE_TYPES).map(([value, t]) => ({
  value,
  label: t.label,
}))

const KIND_OPTIONS = Object.entries(VAULT_FIELD_KINDS).map(([value, k]) => ({
  value: value as VaultFieldKind,
  label: k.label + (k.secret ? ' 🔒' : ''),
}))

export function vaultTypeLabel(resourceType: string | null): string | null {
  if (!resourceType) return null
  return (VAULT_RESOURCE_TYPES as Record<string, { label: string }>)[resourceType]?.label ?? null
}

export function vaultTypeIcon(resourceType: string | null): IconName {
  const icon = resourceType
    ? (VAULT_RESOURCE_TYPES as Record<string, { icon: string }>)[resourceType]?.icon
    : null
  return (icon ?? 'lock') as IconName
}

const selectStyle: CSSProperties = {
  background: 'var(--wf-surface)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 'var(--wf-radius)',
  padding: '8px 10px',
  fontSize: 13,
}

/** Controlled editor of a typed card's fields: kind select + value + remove, «+ поле». */
export function VaultTypedFieldsEditor({
  fields,
  onChange,
}: {
  fields: VaultField[]
  onChange: (next: VaultField[]) => void
}) {
  const setAt = (i: number, patch: Partial<VaultField>) =>
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  const removeAt = (i: number) => onChange(fields.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {fields.map((f, i) => {
        const kindMeta = VAULT_FIELD_KINDS[f.kind]
        return (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              aria-label="Тип поля"
              style={{ ...selectStyle, width: 170, flexShrink: 0 }}
              value={f.kind}
              onChange={(e) => setAt(i, { kind: e.target.value as VaultFieldKind })}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div style={{ flex: 1 }}>
              <Input
                aria-label="Значення поля"
                type={kindMeta.secret ? 'password' : 'text'}
                placeholder={kindMeta.secret ? '•••••' : kindMeta.label}
                value={f.value}
                onChange={(e) => setAt(i, { value: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="wfp-link"
              aria-label="Прибрати поле"
              style={{ fontSize: 14, color: 'var(--wf-fg-muted)' }}
              onClick={() => removeAt(i)}
            >
              ✕
            </button>
          </div>
        )
      })}
      <div>
        <Button
          variant="ghost"
          onClick={() => onChange([...fields, { kind: 'password', value: '' }])}
        >
          + поле
        </Button>
      </div>
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        // поля з 🔒 шифруються — їх видно лише через «показати» з підтвердженням пароля
      </div>
    </div>
  )
}

function copyValue(value: string) {
  void navigator.clipboard?.writeText(value)
  toast.success('Скопійовано')
}

function FieldLine({ field, masked }: { field: VaultField; masked: boolean }) {
  const meta = VAULT_FIELD_KINDS[field.kind]
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
      <span
        className="wfp-mono"
        style={{
          fontSize: 11,
          color: 'var(--wf-fg-muted)',
          width: 130,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <Icon name={meta.icon as IconName} size={11} />
        {meta.label}
      </span>
      <code
        style={{
          background: 'var(--wf-surface)',
          border: '1px solid var(--wf-border)',
          borderRadius: 'var(--wf-radius)',
          padding: '2px 8px',
          fontSize: 12,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {masked ? '••••••••' : field.value}
      </code>
      {!masked && (
        <button
          type="button"
          className="wfp-link"
          style={{ fontSize: 11, flexShrink: 0 }}
          onClick={() => copyValue(field.value)}
        >
          копіювати
        </button>
      )}
    </div>
  )
}

/**
 * Field list of a typed card: public fields always visible (with copy), secret fields as one
 * masked hint until `secretFields` arrives from reveal — then per-field values + copy.
 */
export function VaultTypedCardFields({
  publicFields,
  secretFields,
}: {
  publicFields: VaultField[]
  secretFields: VaultField[] | null
}) {
  return (
    <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
      {publicFields.map((f, i) => (
        <FieldLine key={`p-${i}`} field={f} masked={false} />
      ))}
      {secretFields === null ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            className="wfp-mono"
            style={{
              fontSize: 11,
              color: 'var(--wf-fg-muted)',
              width: 130,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Icon name="lock" size={11} />
            Секретні поля
          </span>
          <code
            style={{
              background: 'var(--wf-surface)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: '2px 8px',
              fontSize: 12,
            }}
          >
            ••••••••
          </code>
        </div>
      ) : (
        secretFields.map((f, i) => <FieldLine key={`s-${i}`} field={f} masked={false} />)
      )}
    </div>
  )
}
