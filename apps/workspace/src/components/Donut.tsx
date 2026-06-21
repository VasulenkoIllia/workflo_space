/** Minimal dependency-free SVG donut (design-v2 finance overview). Segments are drawn as
 * stroke-dasharray arcs on concentric circles; the caller supplies {label, value, color}. */
export interface DonutSegment {
  label: string
  value: number
  color: string
}

export function Donut({
  data,
  size = 132,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  data: DonutSegment[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((s, d) => s + (d.value > 0 ? d.value : 0), 0)
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {total === 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--wf-border)"
              strokeWidth={thickness}
            />
          ) : (
            data
              .filter((d) => d.value > 0)
              .map((d, i) => {
                const len = (d.value / total) * circ
                const el = (
                  <circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={d.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${len} ${circ - len}`}
                    strokeDashoffset={-offset}
                  />
                )
                offset += len
                return el
              })
          )}
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        {centerValue != null && (
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--wf-fg)' }}>{centerValue}</div>
        )}
        {centerLabel != null && (
          <div className="wfp-mono" style={{ fontSize: 9, color: 'var(--wf-fg-muted)' }}>
            {centerLabel}
          </div>
        )}
      </div>
    </div>
  )
}
