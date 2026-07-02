/** Labelled native select styled via design tokens (no Select primitive in @workflo/ui yet). */
export function Select({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {label.toUpperCase()}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          background: 'var(--wf-surface)',
          color: 'var(--wf-fg)',
          border: '1px solid var(--wf-border)',
          borderRadius: 'var(--wf-radius)',
          padding: '8px 10px',
          fontSize: 14,
          ...(disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
