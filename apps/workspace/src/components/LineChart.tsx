/** Minimal dependency-free multi-series line chart (design-v2 P&L trend). SVG draws the lines
 * (stretched to fill width); the legend + x-axis labels are HTML so text never distorts. */
export interface LineSeries {
  label: string
  color: string
  values: number[]
}

export function LineChart({
  series,
  labels,
  height = 170,
}: {
  series: LineSeries[]
  labels: string[]
  height?: number
}) {
  const W = 600
  const padT = 10
  const padB = 10
  const innerH = height - padT - padB
  const n = labels.length
  const all = series.flatMap((s) => s.values)
  const max = Math.max(1, ...all)
  const min = Math.min(0, ...all)
  const span = max - min || 1
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v: number) => padT + (1 - (v - min) / span) * innerH

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <span
            key={s.label}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <span style={{ width: 12, height: 3, background: s.color, borderRadius: 2 }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <line
          x1={0}
          x2={W}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--wf-border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {labels.map((l, i) => (
          <span key={i} className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}
