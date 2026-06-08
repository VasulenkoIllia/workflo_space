import { EmptyState } from '@workflo/ui'

/** Generic placeholder for nav sections whose backend/screen lands in a later phase. */
export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
      >
        // скоро
      </div>
      <EmptyState
        title="Розділ у розробці"
        description="Цей екран зʼявиться в наступному спринті."
      />
    </div>
  )
}
