// skeletons.jsx — reusable skeleton loaders (brief §11: skeletons over spinners).
// Pure presentational shimmer blocks + a few composed page-loading states.
// Exported to window for use in the brandbook + loading-state artboards.

function Skel({ kind = 'line', w, h, style }) {
  const cls = {
    line: 'wf-skel wf-skel--line',
    title: 'wf-skel wf-skel--title',
    chip: 'wf-skel wf-skel--chip',
    circle: 'wf-skel wf-skel--circle',
    btn: 'wf-skel wf-skel--btn',
    block: 'wf-skel',
  }[kind] || 'wf-skel';
  const s = { ...style };
  if (w != null) s.width = typeof w === 'number' ? `${w}px` : w;
  if (h != null) s.height = typeof h === 'number' ? `${h}px` : h;
  return <span className={cls} style={s} />;
}

// a single list row skeleton (avatar + two lines + trailing)
function SkelRow({ avatar = true }) {
  return (
    <div className="wf-skel-row">
      {avatar && <Skel kind="circle" w={34} h={34} />}
      <div className="wf-skel-row-main">
        <Skel kind="line" w="42%" />
        <Skel kind="line" w="68%" style={{ opacity: 0.6 }} />
      </div>
      <Skel kind="chip" />
    </div>
  );
}

// stats row skeleton (4 cells)
function SkelStats({ n = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 12, marginBottom: 18 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div className="wf-skel-stat" key={i}>
          <Skel kind="line" w="50%" h={9} style={{ opacity: 0.6 }} />
          <Skel kind="title" w="60%" h={24} />
          <Skel kind="line" w="40%" h={8} style={{ opacity: 0.5 }} />
        </div>
      ))}
    </div>
  );
}

// table skeleton
function SkelTable({ rows = 6, cols = 5 }) {
  return (
    <div style={{ border: '1px solid var(--wf-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${cols - 1}, 1fr)`, gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--wf-border)', background: 'color-mix(in oklab, var(--wf-fg) 2%, transparent)' }}>
        {Array.from({ length: cols }).map((_, i) => <Skel key={i} kind="line" w="60%" h={9} style={{ opacity: 0.6 }} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${cols - 1}, 1fr)`, gap: 16, padding: '14px 16px', borderBottom: r < rows - 1 ? '1px solid var(--wf-border)' : 0, alignItems: 'center' }}>
          <Skel kind="line" w={`${55 + (r * 7) % 35}%`} />
          {Array.from({ length: cols - 1 }).map((_, c) => <Skel key={c} kind="line" w={`${40 + (c * 13 + r * 5) % 45}%`} style={{ opacity: 0.7 }} />)}
        </div>
      ))}
    </div>
  );
}

// card grid skeleton
function SkelCards({ n = 4, cols = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div className="wf-skel-card" key={i}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Skel kind="circle" w={40} h={40} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Skel kind="line" w="55%" />
              <Skel kind="line" w="35%" h={9} style={{ opacity: 0.6 }} />
            </div>
          </div>
          <Skel kind="line" w="90%" style={{ opacity: 0.7 }} />
          <Skel kind="line" w="75%" style={{ opacity: 0.55 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Skel kind="chip" w={52} /><Skel kind="chip" w={68} /><Skel kind="chip" w={44} />
          </div>
        </div>
      ))}
    </div>
  );
}

// composed: workspace dashboard loading
function DashboardSkeleton() {
  return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skel kind="title" w={200} h={22} />
          <Skel kind="line" w={300} h={10} style={{ opacity: 0.6 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}><Skel kind="btn" /><Skel kind="btn" w={130} /></div>
      </div>
      <SkelStats n={4} />
      <SkelTable rows={6} cols={5} />
    </div>
  );
}

// composed: inbox/list loading
function ListSkeleton({ rows = 7 }) {
  return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        <Skel kind="title" w={160} h={22} />
        <Skel kind="line" w={260} h={10} style={{ opacity: 0.6 }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => <SkelRow key={i} />)}
    </div>
  );
}

Object.assign(window, { Skel, SkelRow, SkelStats, SkelTable, SkelCards, DashboardSkeleton, ListSkeleton });
