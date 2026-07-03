// wordmark.jsx — workflo logotype variations
// Each takes { color, accent, size?, catStyle? } and renders as inline HTML
// (NOT inside an SVG) so type rendering stays clean and the layout flows.
// Use `size` to control the font size in px.

function WfPlain({ color = 'currentColor', accent = '#A3D90D', size = 22 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 0,
      fontFamily: 'Geist, system-ui, sans-serif',
      fontWeight: 600,
      fontSize: size,
      letterSpacing: '-0.04em',
      color,
      lineHeight: 1,
    }}>
      <span>workflo</span>
      <span style={{ color: accent, fontSize: size * 1.1, lineHeight: 0.8, marginLeft: 1 }}>.</span>
    </span>
  );
}

function WfLive({ color = 'currentColor', accent = '#A3D90D', size = 22 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: size * 0.36,
      fontFamily: 'Geist, system-ui, sans-serif',
      fontWeight: 600,
      fontSize: size,
      letterSpacing: '-0.04em',
      color,
      lineHeight: 1,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: size * 0.36, height: size * 0.36, borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 0 ${size * 0.18}px color-mix(in oklab, ${accent} 35%, transparent)`,
          animation: 'wf-pulse-live 1.8s infinite',
        }} />
      </span>
      <span>workflo</span>
    </span>
  );
}

function WfCat({ color = 'currentColor', accent = '#A3D90D', size = 22, catStyle = 'monoline' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: size * 0.36,
      fontFamily: 'Geist, system-ui, sans-serif',
      fontWeight: 600,
      fontSize: size,
      letterSpacing: '-0.04em',
      color,
      lineHeight: 1,
    }}>
      <CatMark color={color} accent={accent} size={size * 1.4} style={catStyle} />
      <span>workflo</span>
    </span>
  );
}

function WfMono({ color = 'currentColor', accent = '#A3D90D', size = 20 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: size * 0.34,
      fontFamily: 'JetBrains Mono, Geist Mono, ui-monospace, monospace',
      fontWeight: 600,
      fontSize: size,
      letterSpacing: '-0.02em',
      color,
      lineHeight: 1,
    }}>
      <span style={{ color: 'color-mix(in oklab, currentColor 55%, transparent)' }}>{'//'}</span>
      <span>workflo</span>
      <span style={{ color: accent }}>_space</span>
    </span>
  );
}

function WfBracket({ color = 'currentColor', accent = '#A3D90D', size = 22 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 1,
      fontFamily: 'Geist, system-ui, sans-serif',
      fontWeight: 600,
      fontSize: size,
      letterSpacing: '-0.04em',
      color,
      lineHeight: 1,
    }}>
      <span style={{ color: accent, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, marginRight: 2 }}>[</span>
      <span>workflo</span>
      <span style={{ color: accent, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, marginLeft: 2 }}>]</span>
    </span>
  );
}

const WORDMARK_STYLES = {
  plain:   WfPlain,
  live:    WfLive,
  cat:     WfCat,
  mono:    WfMono,
  bracket: WfBracket,
};

const WORDMARK_LIST = [
  { value: 'plain',   label: 'Plain',   sub: 'Geist 600 + lime dot' },
  { value: 'live',    label: 'Live',    sub: 'Пульсуючий lime prefix' },
  { value: 'cat',     label: 'Cat',     sub: 'Monoline cat + workflo' },
  { value: 'mono',    label: 'Mono',    sub: '// workflo_space · code comment' },
  { value: 'bracket', label: 'Bracket', sub: '[workflo] — terminal' },
];

function Wordmark({ style = 'plain', ...rest }) {
  const C = WORDMARK_STYLES[style] || WfPlain;
  return <C {...rest} />;
}

// Live status widget — `[●] зараз: <text> · <time ago>`
function LiveWidget({ accent = '#A3D90D', muted = '#78716C', label = 'зараз:', text = '—', ago = '—', size = 13 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontFamily: 'JetBrains Mono, Geist Mono, ui-monospace, monospace',
      fontSize: size,
      color: muted,
      letterSpacing: '0.005em',
      fontFeatureSettings: '"tnum"',
    }}>
      <span style={{
        width: size * 0.55, height: size * 0.55, borderRadius: '50%',
        background: accent,
        boxShadow: `0 0 0 ${size * 0.25}px color-mix(in oklab, ${accent} 30%, transparent)`,
        animation: 'wf-pulse-live 1.8s infinite',
        flexShrink: 0,
      }} />
      <span style={{ color: muted }}>{label}</span>
      <span style={{ color: 'var(--wf-fg-secondary, #44403C)' }}>{text}</span>
      <span style={{ color: muted, opacity: 0.7 }}>·</span>
      <span style={{ color: muted, opacity: 0.7 }}>{ago}</span>
    </div>
  );
}

// Inject the pulse keyframes once
if (typeof document !== 'undefined' && !document.getElementById('wf-live-keyframes')) {
  const s = document.createElement('style');
  s.id = 'wf-live-keyframes';
  s.textContent = `
    @keyframes wf-pulse-live {
      0%   { box-shadow: 0 0 0 0 color-mix(in oklab, currentColor 0%, transparent); opacity: 1; }
      50%  { opacity: 0.7; }
      100% { box-shadow: 0 0 0 8px transparent; opacity: 1; }
    }
    @keyframes wf-cursor-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { Wordmark, WORDMARK_STYLES, WORDMARK_LIST, LiveWidget });
