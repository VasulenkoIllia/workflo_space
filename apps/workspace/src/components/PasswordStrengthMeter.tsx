import { passwordStrength } from '@/lib/password'

const COLORS: [string, string, string, string, string] = [
  'var(--wf-destructive)',
  'var(--wf-destructive)',
  'var(--wf-warning)',
  'var(--wf-success)',
  'var(--wf-accent)',
]

export function PasswordStrengthMeter({ value }: { value: string }) {
  if (!value) return null
  const { score, label } = passwordStrength(value)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= score ? COLORS[score] : 'var(--wf-border)',
            }}
          />
        ))}
      </div>
      <span className="wfp-field-hint" style={{ color: COLORS[score] }}>
        {label}
      </span>
    </div>
  )
}
