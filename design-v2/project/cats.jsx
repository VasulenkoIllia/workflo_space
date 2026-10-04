// cats.jsx — 5 stylistic directions for the workflo cat totem
// All built only with: lines, circles, polygons, and (for ASCII) <text>.
// Each variant has ONE lime-accent detail per brief §2.3.
//
// API: <Cat style="monoline|stamp|abstract|character|ascii"
//           color accent strokeWidth size pose />
// Default color/accent/strokeWidth come from CSS vars when not passed.

const _useId2 = () => React.useId();

// ─────── A. Monoline iconic ────────────────────────────────
// One continuous outline. Single 1.8px stroke. Sitting cat archetype.
// Lime accent: a single eye glow.
function CatMonoline({ color = 'currentColor', accent = '#A3D90D', strokeWidth = 1.8, size = 240, pose = 'sit' }) {
  // Sitting outline: ears → head top → head side → body side → bottom → other side
  const outline = pose === 'stretch'
    // long stretch pose for variety
    ? 'M 25 145 Q 25 130 40 128 Q 60 120 80 122 L 130 122 Q 150 122 168 132 L 180 90 L 175 80 L 158 96 Q 170 80 178 60 L 168 56 L 154 96 Q 158 122 175 122 L 192 122 Q 200 128 200 142 L 200 158 Q 200 168 188 170 L 35 170 Q 25 168 25 158 Z'
    // default sit
    : 'M 50 60 L 65 18 L 90 50 Q 110 44 130 50 L 155 18 L 170 60 Q 178 100 178 150 Q 178 210 170 222 Q 110 232 50 222 Q 42 210 42 150 Q 42 100 50 60 Z';

  if (pose === 'stretch') {
    return (
      <svg viewBox="0 0 220 200" width={size} height={size * 200 / 220} role="img" aria-label="cat stretching">
        <path d={outline} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {/* face on right side */}
        <circle cx={172} cy={138} r={2} fill={color} />
        <circle cx={172} cy={138} r={1.4} fill={accent} />
        <circle cx={184} cy={142} r={1.8} fill={color} />
        {/* tail */}
        <path d="M 25 145 Q 5 130 10 100" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 240" width={size} height={size * 240 / 220} role="img" aria-label="cat sitting">
      {/* single-line outline */}
      <path d={outline} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {/* eyes — small filled dots */}
      <circle cx={88} cy={102} r={3.2} fill={color} />
      <circle cx={132} cy={102} r={3.2} fill={color} />
      {/* lime accent — left eye glow */}
      <circle cx={88} cy={102} r={2.2} fill={accent} />
      {/* nose tiny triangle */}
      <path d={`M 105 118 L 115 118 L 110 124 Z`} fill={color} stroke="none" />
      {/* mouth — tiny W */}
      <path d="M 110 124 v 4 M 110 128 q -4 4 -7 2 M 110 128 q 4 4 7 2"
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {/* whiskers */}
      <g stroke={color} strokeWidth={strokeWidth * 0.7} strokeLinecap="round">
        <line x1="84" y1="124" x2="60" y2="120" />
        <line x1="84" y1="130" x2="60" y2="134" />
        <line x1="136" y1="124" x2="160" y2="120" />
        <line x1="136" y1="130" x2="160" y2="134" />
      </g>
      {/* tail curving */}
      <path d="M 175 175 Q 210 168 210 130 Q 208 108 195 112"
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* paw separators at bottom */}
      <g stroke={color} strokeWidth={strokeWidth * 0.7} strokeLinecap="round">
        <line x1="75" y1="222" x2="75" y2="232" />
        <line x1="105" y1="222" x2="105" y2="234" />
        <line x1="135" y1="222" x2="135" y2="232" />
      </g>
    </svg>
  );
}

// ─────── B. Stamp / graphic ────────────────────────────────
// Filled silhouette inside a square frame. Hanko / mid-century vibe.
// Lime accent: ONE eye left as a lime circle.
function CatStamp({ color = 'currentColor', accent = '#A3D90D', size = 240 }) {
  return (
    <svg viewBox="0 0 220 220" width={size} height={size} role="img" aria-label="cat stamp">
      {/* outer stamp frame */}
      <rect x="10" y="10" width="200" height="200" rx="6" fill="none" stroke={color} strokeWidth="2" />
      <rect x="18" y="18" width="184" height="184" rx="3" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
      {/* cat silhouette (filled) */}
      <path d="M 56 70 L 70 32 L 90 60 Q 110 56 130 60 L 150 32 L 164 70 Q 172 102 172 150 Q 172 184 168 196 L 52 196 Q 48 184 48 150 Q 48 102 56 70 Z" fill={color} />
      {/* eyes — knockout (bg-colored) */}
      <circle cx={92} cy={104} r={6} fill="var(--wf-bg, #FAFAF9)" />
      <circle cx={128} cy={104} r={6} fill="var(--wf-bg, #FAFAF9)" />
      {/* lime accent eye */}
      <circle cx={92} cy={104} r={4} fill={accent} />
      <circle cx={128} cy={104} r={4} fill="var(--wf-bg, #FAFAF9)" />
      <circle cx={128} cy={104} r={2.4} fill={color} />
      {/* nose (knockout) */}
      <path d="M 104 124 L 116 124 L 110 132 Z" fill="var(--wf-bg, #FAFAF9)" />
      {/* signature stamp dot bottom-right */}
      <circle cx={186} cy={188} r={5} fill={accent} />
    </svg>
  );
}

// ─────── C. Geometric abstraction ──────────────────────────
// Bauhaus / Polish poster school. Primitives only: triangles, circles, lines.
// Lime accent: nose triangle.
function CatAbstract({ color = 'currentColor', accent = '#A3D90D', size = 240 }) {
  return (
    <svg viewBox="0 0 220 220" width={size} height={size} role="img" aria-label="cat geometric">
      {/* ears: solid triangles */}
      <path d="M 58 58 L 50 14 L 92 50 Z" fill={color} />
      <path d="M 162 58 L 170 14 L 128 50 Z" fill={color} />
      {/* head: perfect circle */}
      <circle cx={110} cy={100} r={56} fill={color} />
      {/* body chunk: ellipse below */}
      <ellipse cx={110} cy={186} rx={70} ry={32} fill={color} />
      {/* horizon line */}
      <line x1="14" y1="206" x2="206" y2="206" stroke={color} strokeWidth="2" />
      {/* eyes: tiny knockout */}
      <circle cx={88} cy={94} r={4} fill="var(--wf-bg, #FAFAF9)" />
      <circle cx={132} cy={94} r={4} fill="var(--wf-bg, #FAFAF9)" />
      {/* lime nose */}
      <path d="M 103 116 L 117 116 L 110 124 Z" fill={accent} />
      {/* tail bar */}
      <rect x={165} y={146} width={10} height={50} rx={4} fill={color} transform="rotate(-30 170 170)" />
    </svg>
  );
}

// ─────── D. Lineart character ──────────────────────────────
// Slightly more elaborate line drawing with multiple poses.
// 'sit' | 'sleep' | 'watch' (looking up)
function CatCharacter({ color = 'currentColor', accent = '#A3D90D', strokeWidth = 1.8, size = 240, pose = 'sit' }) {
  if (pose === 'sleep') {
    return (
      <svg viewBox="0 0 240 160" width={size} height={size * 160 / 240} role="img" aria-label="cat sleeping">
        {/* curled cat */}
        <path d="M 30 120 Q 30 60 110 60 Q 200 60 210 110 Q 215 140 180 142 Q 90 145 35 138 Q 25 132 30 120 Z"
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {/* tail wraps */}
        <path d="M 180 142 Q 220 130 205 100 Q 195 90 188 100"
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        {/* ear on top of head */}
        <path d="M 60 70 L 50 50 L 78 64" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {/* closed eye */}
        <path d="M 65 90 q 8 4 16 0" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        {/* lime z (dream) */}
        <text x="30" y="48" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="600" fill={accent}>z</text>
        <text x="20" y="32" fontFamily="JetBrains Mono, monospace" fontSize="10" fontWeight="600" fill={accent}>z</text>
      </svg>
    );
  }
  if (pose === 'watch') {
    return (
      <svg viewBox="0 0 220 240" width={size} height={size * 240 / 220} role="img" aria-label="cat looking up">
        <path d="M 50 70 L 65 18 L 90 60 Q 110 50 130 60 L 155 18 L 170 70 Q 178 110 178 165 Q 178 215 170 224 Q 110 234 50 224 Q 42 215 42 165 Q 42 110 50 70 Z"
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {/* looking up eyes */}
        <ellipse cx={88} cy={96} rx={3.2} ry={5} fill={color} />
        <ellipse cx={132} cy={96} rx={3.2} ry={5} fill={color} />
        <circle cx={88} cy={94} r={2.4} fill={accent} />
        {/* nose */}
        <path d="M 105 120 L 115 120 L 110 126 Z" fill={color} />
        {/* tail */}
        <path d="M 175 180 Q 212 174 212 134 Q 210 110 195 116" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        {/* looking at lime dot above */}
        <circle cx="110" cy="14" r="4" fill={accent} />
      </svg>
    );
  }
  // sit (default — slightly more detail than monoline)
  return (
    <svg viewBox="0 0 220 240" width={size} height={size * 240 / 220} role="img" aria-label="cat sitting">
      <path d="M 50 70 L 65 18 L 90 60 Q 110 50 130 60 L 155 18 L 170 70 Q 178 110 178 165 Q 178 215 170 224 Q 110 234 50 224 Q 42 215 42 165 Q 42 110 50 70 Z"
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {/* ear inner lines */}
      <path d="M 70 50 L 80 58" fill="none" stroke={color} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" />
      <path d="M 150 50 L 140 58" fill="none" stroke={color} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" />
      {/* eyes — small almonds */}
      <ellipse cx={88} cy={104} rx={3.2} ry={6} fill={color} />
      <ellipse cx={132} cy={104} rx={3.2} ry={6} fill={color} />
      {/* lime accent — left eye */}
      <ellipse cx={88} cy={104} rx={2} ry={4} fill={accent} />
      {/* nose */}
      <path d="M 105 122 L 115 122 L 110 128 Z" fill={color} stroke="none" />
      {/* mouth */}
      <path d="M 110 128 v 4 M 110 132 q -4 4 -7 2 M 110 132 q 4 4 7 2"
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {/* whiskers */}
      <g stroke={color} strokeWidth={strokeWidth * 0.7} strokeLinecap="round">
        <line x1="84" y1="128" x2="58" y2="124" />
        <line x1="84" y1="134" x2="58" y2="138" />
        <line x1="136" y1="128" x2="162" y2="124" />
        <line x1="136" y1="134" x2="162" y2="138" />
      </g>
      {/* body inner partition (chest) */}
      <path d="M 110 130 Q 88 160 88 215" fill="none" stroke={color} strokeWidth={strokeWidth * 0.7} strokeLinecap="round" opacity="0.5" />
      {/* tail */}
      <path d="M 175 180 Q 212 174 212 134 Q 210 110 195 116"
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* paw separators */}
      <g stroke={color} strokeWidth={strokeWidth * 0.7} strokeLinecap="round">
        <line x1="75" y1="224" x2="75" y2="234" />
        <line x1="105" y1="224" x2="105" y2="236" />
        <line x1="135" y1="224" x2="135" y2="234" />
      </g>
    </svg>
  );
}

// ─────── E. ASCII art ──────────────────────────────────────
// Pure mono text. The lime accent: one eye replaced with accent-colored char.
function CatAscii({ color = 'currentColor', accent = '#A3D90D', size = 240 }) {
  // Render text as text. viewBox in tspan units.
  const fs = 22;
  return (
    <svg viewBox="0 0 220 140" width={size} height={size * 140 / 220} role="img" aria-label="ascii cat">
      <g fontFamily="JetBrains Mono, Geist Mono, ui-monospace, monospace" fontSize={fs} fontWeight="600" fill={color} style={{ letterSpacing: '0.02em' }}>
        <text x="50" y="38">{`  /\\_/\\`}</text>
        <text x="50" y="68">{`( `}<tspan fill={accent}>●</tspan>{` . o )`}</text>
        <text x="50" y="98">{` > ^ <`}</text>
        <text x="50" y="124" fontSize="11" fill={color} opacity="0.5">workflo.space</text>
      </g>
    </svg>
  );
}

// ─────── Dispatcher ────────────────────────────────────────
const CAT_STYLES = {
  monoline:  CatMonoline,
  stamp:     CatStamp,
  abstract:  CatAbstract,
  character: CatCharacter,
  ascii:     CatAscii,
};

const CAT_LIST = [
  { value: 'monoline',  label: 'Monoline',  sub: 'Один штрих, 1.8px · iconic' },
  { value: 'stamp',     label: 'Stamp',     sub: 'Японський hanko · силует' },
  { value: 'abstract',  label: 'Abstract',  sub: 'Bauhaus · примітиви' },
  { value: 'character', label: 'Character', sub: 'Lineart · має пози' },
  { value: 'ascii',     label: 'ASCII',     sub: 'Mono · text-art' },
];

function Cat({ style = 'monoline', ...rest }) {
  const C = CAT_STYLES[style] || CatMonoline;
  return <C {...rest} />;
}

// ─────── Small variants ────────────────────────────────────
// Favicon-sized monoline cat — for nav, footer, fav.
function CatMark({ color = 'currentColor', accent = '#A3D90D', size = 28, style = 'monoline' }) {
  // Use the same dispatcher with a small fixed size.
  return <Cat style={style} color={color} accent={accent} size={size} strokeWidth={2.2} />;
}

Object.assign(window, {
  Cat, CatMark, CAT_STYLES, CAT_LIST,
  CatMonoline, CatStamp, CatAbstract, CatCharacter, CatAscii,
});
