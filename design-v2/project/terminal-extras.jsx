// terminal-extras.jsx — brand uniqueness features
// 1) Big ASCII logo banner   2) Live command typewriter
// 3) Locale-aware boot v2    4) ASCII portrait
// 7) Currently working on    14) Keyboard shortcuts overlay
// 13) Sound effects (opt-in) 15) Visitor counter

const { useState: _ex_ts, useEffect: _ex_te, useRef: _ex_tr } = React;

/* ─── 1. Big ASCII logo (figlet-style "workflo.space") ─── */
// Using array+join so backticks/dollar-signs inside the art can't break the
// template literal parser.
const ASCII_LOGO_BIG = [
  '                            __ _',
  ' _    _  ___  _ __ _  __  / _| | ___      ___ _ __   __ _  ___ ___',
  '| |  | |/ _ \\| \'__| |/ /| |_| |/ _ \\   / __| \'_ \\ / _` |/ __/ _ \\',
  '| |/\\| | (_) | |  |   < |  _| | (_) |  \\__ \\ |_) | (_| | (_|  __/',
  '|__/\\__|\\___/|_|  |_|\\_\\|_| |_|\\___/   |___/ .__/ \\__,_|\\___\\___|',
  '                                            |_|',
].join('\n');

function AsciiLogoBanner({ accent }) {
  // Reverted to the info-row layout (no stat tiles). Cat is now a proper
  // monoline SVG drawing (not text), so it renders cleanly at any font/zoom.
  return (
    <div className="wf-tm-neo" aria-label="workflo.space identity">
      <svg className="wf-tm-neo-svg" viewBox="0 0 180 180" aria-hidden="true">
        {/* Soft drop shadow */}
        <rect x="8" y="14" width="166" height="158" rx="11" fill="currentColor" opacity="0.10" />
        {/* Window */}
        <rect x="2" y="6" width="166" height="158" rx="11" fill="var(--wf-bg)" stroke="var(--wf-fg)" strokeWidth="1.5" />
        {/* Titlebar */}
        <rect x="2" y="6" width="166" height="24" rx="11" fill="var(--wf-fg)" />
        <rect x="2" y="20" width="166" height="10" fill="var(--wf-fg)" />
        <circle cx="14" cy="18" r="3.4" fill="#ff5f57" />
        <circle cx="25" cy="18" r="3.4" fill="#febc2e" />
        <circle cx="36" cy="18" r="3.4" fill="#28c840" />
        <text x="85" y="22" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8.5" fill="var(--wf-bg)" opacity="0.55">~ — bash</text>

        {/* ASCII cat — even spacing, monospace, lime accent eye */}
        <g fontFamily="JetBrains Mono, Geist Mono, ui-monospace, monospace" fontSize="13" fill="var(--wf-fg)" fontWeight="500" textAnchor="middle" style={{ whiteSpace: 'pre' }}>
          <text x="85" y="68" xmlSpace="preserve"> /\_/\ </text>
          <text x="85" y="86" xmlSpace="preserve">( <tspan fill="var(--wf-accent)" fontWeight="700">●</tspan> . o )</text>
          <text x="85" y="104" xmlSpace="preserve"> {'>'} ^ {'<'} </text>
        </g>

        {/* Status line under cat */}
        <line x1="14" y1="124" x2="156" y2="124" stroke="var(--wf-border)" strokeDasharray="2 3" />
        <text x="14" y="142" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--wf-fg-muted)">
          <tspan fill="var(--wf-accent)" fontWeight="600">$</tspan>
          <tspan dx="4" fill="var(--wf-fg)">echo $cat</tspan>
        </text>
        <text x="14" y="156" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="var(--wf-fg-muted)">
          <tspan fill="var(--wf-accent)">{'>'}</tspan>
          <tspan dx="4">workflo · cat v1.0</tspan>
        </text>
      </svg>

      <div className="wf-tm-neo-info">
        <div className="wf-tm-neo-title">
          <span className="wf-tm-neo-name">illia</span>
          <span className="wf-tm-neo-at">@</span>
          <span className="wf-tm-neo-host">workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space</span>
        </div>
        <div className="wf-tm-neo-sep">────────────────────────────</div>
        <div className="wf-tm-neo-row"><span className="wf-tm-neo-k">role</span><span className="wf-tm-neo-arrow">→</span><span className="wf-tm-neo-v">automation + ai engineer</span></div>
        <div className="wf-tm-neo-row"><span className="wf-tm-neo-k">based</span><span className="wf-tm-neo-arrow">→</span><span className="wf-tm-neo-v">lutsk · ua · gmt+2</span></div>
        <div className="wf-tm-neo-row"><span className="wf-tm-neo-k">uptime</span><span className="wf-tm-neo-arrow">→</span><span className="wf-tm-neo-v">4 yrs · <span className="wf-tm-neo-accent">12</span> shipped · <span className="wf-tm-neo-accent">7</span> partners</span></div>
        <div className="wf-tm-neo-row"><span className="wf-tm-neo-k">stack</span><span className="wf-tm-neo-arrow">→</span><span className="wf-tm-neo-v">ts · py · react · postgres · llms</span></div>
        <div className="wf-tm-neo-row"><span className="wf-tm-neo-k">status</span><span className="wf-tm-neo-arrow">→</span><span className="wf-tm-neo-v"><span className="wf-tm-status-dot wf-tm-neo-dot" /> accepting projects · Q3 2026</span></div>
      </div>
    </div>
  );
}

/* ─── 2. Live command typewriter (rotates commands) ─── */
const ROTATING_COMMANDS_UA = [
  './serve --port 3000',
  'npm run build && deploy',
  'git push origin main',
  'pytest tests/integration',
  'tail -f logs/workflo.log',
  'docker compose up -d',
  'open https://workflo.space',
];

function LiveCommandStrip() {
  const [idx, setIdx] = _ex_ts(0);
  const [shown, setShown] = _ex_ts('');
  const [phase, setPhase] = _ex_ts('type'); // 'type' | 'hold' | 'erase'

  _ex_te(() => {
    const cmd = ROTATING_COMMANDS_UA[idx];
    let timer;
    if (phase === 'type') {
      if (shown.length < cmd.length) {
        timer = setTimeout(() => setShown(cmd.slice(0, shown.length + 1)), 60);
      } else {
        timer = setTimeout(() => setPhase('hold'), 2200);
      }
    } else if (phase === 'hold') {
      timer = setTimeout(() => setPhase('erase'), 800);
    } else {
      if (shown.length > 0) {
        timer = setTimeout(() => setShown(shown.slice(0, -1)), 25);
      } else {
        setPhase('type');
        setIdx((i) => (i + 1) % ROTATING_COMMANDS_UA.length);
      }
    }
    return () => clearTimeout(timer);
  }, [shown, phase, idx]);

  return (
    <div className="wf-tm-livecmd">
      <span className="wf-tm-sigil">$</span>
      <span className="wf-tm-livecmd-text">{shown}</span>
      <span className="wf-tm-cursor wf-tm-cursor--inline" />
    </div>
  );
}

/* ─── 3. Boot sequence v2 (locale + time aware) ─── */
function getBootGreeting(isUa) {
  const now = new Date();
  const h = now.getHours();
  const timeOfDay = h < 5 ? (isUa ? 'ніч' : 'late night')
                : h < 12 ? (isUa ? 'ранок' : 'morning')
                : h < 18 ? (isUa ? 'день' : 'afternoon')
                : (isUa ? 'вечір' : 'evening');
  const time = `${String(h).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let tz = 'UTC';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) { /* noop */ }
  const city = tz.split('/').pop().replace(/_/g, ' ');
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  return { timeOfDay, time, city, lang, h };
}

function BootSequenceV2({ onDone, isUa }) {
  const greet = React.useMemo(() => getBootGreeting(isUa), [isUa]);
  const lines = isUa ? [
    { p: 8,   l: `detecting locale · ${greet.lang} · ${greet.city}` },
    { p: 28,  l: `loading config from ~/.workflo` },
    { p: 54,  l: `warming up agents · 12 integrations` },
    { p: 82,  l: `it's ${greet.time} ${greet.timeOfDay} in ${greet.city.toLowerCase()}` },
    { p: 100, l: `welcome ✓ · 0 errors · 0 warnings` },
  ] : [
    { p: 8,   l: `detecting locale · ${greet.lang} · ${greet.city}` },
    { p: 28,  l: `loading config from ~/.workflo` },
    { p: 54,  l: `warming up agents · 12 integrations` },
    { p: 82,  l: `it's ${greet.time} ${greet.timeOfDay} in ${greet.city.toLowerCase()}` },
    { p: 100, l: `welcome ✓ · 0 errors · 0 warnings` },
  ];

  const [stage, setStage] = _ex_ts(0);
  _ex_te(() => {
    if (stage > lines.length) { onDone && onDone(); return; }
    const delay = stage === 0 ? 120 : 260;
    const id = setTimeout(() => setStage((s) => s + 1), delay);
    return () => clearTimeout(id);
  }, [stage]);

  return (
    <div className="wf-tm-boot" aria-hidden="true">
      <div className="wf-tm-prompt"><span className="wf-tm-user">illia</span><span className="wf-tm-at">@</span><span className="wf-tm-host">workflo</span><span className="wf-tm-colon">:</span><span className="wf-tm-cwd">~</span><span className="wf-tm-sigil">$</span><span className="wf-tm-cmd">./boot.sh --greet</span></div>
      <div className="wf-tm-boot-lines">
        {lines.slice(0, stage).map((it, i) => {
          const filled = Math.round(it.p / 10);
          const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
          return (
            <div key={i} className="wf-tm-boot-line">
              <span className="wf-tm-boot-bar">[{bar}]</span>
              <span className="wf-tm-boot-pct">{String(it.p).padStart(3, ' ')}%</span>
              <span className="wf-tm-boot-text">{it.l}</span>
            </div>
          );
        })}
        {stage <= lines.length && stage > 0 && (
          <div className="wf-tm-boot-cursor"><span className="wf-tm-cursor" /></div>
        )}
      </div>
    </div>
  );
}

/* ─── 4. ASCII portrait ─── */
// Stylized character portrait. Array+join to be safe.
const ASCII_PORTRAIT = [
  '       .--::==--..',
  '      /:\'         \':\\',
  '     /  __    __    \\',
  '    | (▓▓)  (▓▓)    |',
  '    |    ___        |',
  '    |   \'___\'       |',
  '     \\   \'___\'     /',
  '      \'._        _.\'',
  '        \'-.____.-\'',
  '      __/        \\__',
  '   __/   |||||||   \\__',
  '  /  \'. /||||||| .\'  \\',
].join('\n');

function AsciiPortrait({ name = 'illia' }) {
  // SVG avatar — bigger (200×200) so it fills the right-side hero area
  // properly and doesn't read as a tiny decorative dot.
  return (
    <div className="wf-tm-portrait">
      <svg viewBox="0 0 120 120" width="280" height="280" aria-label={name}>
        {/* Outer rounded square frame (like a polaroid corner) */}
        <rect x="2" y="2" width="116" height="116" rx="58" fill="var(--wf-bg)" stroke="var(--wf-fg)" strokeWidth="1.5" />
        <rect x="2" y="2" width="116" height="116" rx="58" fill="color-mix(in oklab, var(--wf-accent) 6%, transparent)" />
        {/* Corner brackets */}
        <g stroke="var(--wf-fg)" strokeWidth="1.5" fill="none">
          <path d="M 8 18 L 8 8 L 18 8" />
          <path d="M 112 18 L 112 8 L 102 8" />
          <path d="M 8 102 L 8 112 L 18 112" />
          <path d="M 112 102 L 112 112 L 102 112" />
        </g>
        {/* Hair top */}
        <path d="M 35 50 Q 38 30 60 28 Q 82 30 85 50 L 85 56 Q 80 42 60 42 Q 40 42 35 56 Z"
              fill="var(--wf-fg)" />
        {/* Face oval */}
        <ellipse cx="60" cy="62" rx="22" ry="26" fill="color-mix(in oklab, var(--wf-fg) 8%, var(--wf-bg))" stroke="var(--wf-fg)" strokeWidth="1.4" />
        {/* Eyes */}
        <circle cx="51" cy="62" r="1.8" fill="var(--wf-fg)" />
        <circle cx="69" cy="62" r="1.8" fill="var(--wf-fg)" />
        {/* Lime accent — small dot on left like a glint */}
        <circle cx="51" cy="61" r="0.7" fill="var(--wf-accent)" />
        {/* Eyebrows */}
        <line x1="47" y1="55" x2="55" y2="55" stroke="var(--wf-fg)" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="65" y1="55" x2="73" y2="55" stroke="var(--wf-fg)" strokeWidth="1.4" strokeLinecap="round" />
        {/* Nose */}
        <path d="M 60 64 v 6" stroke="var(--wf-fg)" strokeWidth="1.2" strokeLinecap="round" />
        {/* Smile */}
        <path d="M 53 76 q 7 4 14 0" stroke="var(--wf-fg)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* Shoulders */}
        <path d="M 18 116 Q 30 92 60 92 Q 90 92 102 116" fill="var(--wf-fg)" />
        {/* Lime accent collar */}
        <path d="M 56 92 L 60 96 L 64 92 L 64 100 L 56 100 Z" fill="var(--wf-accent)" stroke="var(--wf-fg)" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <div className="wf-tm-portrait-cap">
        <span className="wf-tm-sigil" style={{ color: 'var(--wf-fg-muted)' }}>{'>'}</span>
        <span><span style={{ color: 'var(--wf-fg)' }}>{name}</span> · lutsk, ua</span>
      </div>
    </div>
  );
}

/* ─── 7. Currently working on ─── */
const CURRENTLY = {
  ua: [
    { state: 'in_progress', name: 'workflo.space platform',     pct: 67, eta: 'Q3 2026' },
    { state: 'in_progress', name: 'case study · retail · 1c integration deep-dive', pct: 30, eta: 'May 2026' },
    { state: 'planned',     name: 'q2 newsletter · автоматизація для не-розробників',  pct: 0,  eta: 'Jun 2026' },
    { state: 'done',        name: 'eduforge support agent · v2 release',  pct: 100, eta: 'Apr 2026' },
  ],
  en: [
    { state: 'in_progress', name: 'workflo.space platform',     pct: 67, eta: 'Q3 2026' },
    { state: 'in_progress', name: 'case study · retail · 1c integration deep-dive', pct: 30, eta: 'May 2026' },
    { state: 'planned',     name: 'q2 newsletter · automation for non-developers',  pct: 0,  eta: 'Jun 2026' },
    { state: 'done',        name: 'eduforge support agent · v2 release',  pct: 100, eta: 'Apr 2026' },
  ],
};
const STATE_GLYPH = { in_progress: '●', planned: '○', done: '✓' };

function CurrentlySection({ isUa }) {
  const items = CURRENTLY[isUa ? 'ua' : 'en'];
  return (
    <section className="wf-tm-section" id="currently" data-screen-label="currently">
      <div className="wf-tm-divider">
        <div className="wf-tm-divider-line" data-section="currently" />
        <div className="wf-tm-prompt">
          <span className="wf-tm-user">illia</span><span className="wf-tm-at">@</span><span className="wf-tm-host">workflo</span><span className="wf-tm-colon">:</span><span className="wf-tm-cwd">~</span><span className="wf-tm-sigil">$</span>
          <span className="wf-tm-cmd">cat ~/now.md</span>
        </div>
      </div>
      <div className="wf-tm-output">
        <p className="wf-tm-section-intro">// {isUa ? 'над чим зараз працюю · оновлюється щотижня' : 'what I am working on · updated weekly'}</p>
        <div className="wf-tm-currently-list">
          {items.map((it, i) => {
            const filled = Math.round(it.pct / 10);
            const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
            return (
              <div key={i} className={`wf-tm-currently-row wf-tm-currently-${it.state}`}>
                <span className="wf-tm-currently-glyph">[{STATE_GLYPH[it.state]}]</span>
                <span className="wf-tm-currently-name">{it.name}</span>
                <span className="wf-tm-currently-bar">[{bar}]</span>
                <span className="wf-tm-currently-pct">{String(it.pct).padStart(3, ' ')}%</span>
                <span className="wf-tm-currently-eta">eta {it.eta}</span>
              </div>
            );
          })}
        </div>
        <p className="wf-tm-currently-leg">// <span style={{ color: 'var(--wf-accent)' }}>[●]</span> in progress · <span>[○]</span> planned · <span style={{ color: 'var(--wf-fg-muted)' }}>[✓]</span> shipped</p>
      </div>
    </section>
  );
}

/* ─── 13. Sound effects (opt-in click) ─── */
const SOUND_KEY = 'wf-sound';
function useSoundEnabled() {
  const [on, setOn] = _ex_ts(() => {
    try { return localStorage.getItem(SOUND_KEY) === '1'; } catch (e) { return false; }
  });
  const setEnabled = (v) => {
    setOn(v);
    try { localStorage.setItem(SOUND_KEY, v ? '1' : '0'); } catch (e) { /* noop */ }
  };
  return [on, setEnabled];
}
let _audioCtx = null;
function playClick(kind = 'click') {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    if (kind === 'click') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(2200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      osc.start(); osc.stop(ctx.currentTime + 0.07);
    } else if (kind === 'tap') {
      osc.type = 'triangle';
      osc.frequency.value = 1600;
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      osc.start(); osc.stop(ctx.currentTime + 0.05);
    }
  } catch (e) { /* noop */ }
}
function SoundToggle({ enabled, onChange }) {
  return (
    <button
      className="wf-tm-sound-toggle"
      onClick={() => { const next = !enabled; onChange(next); if (next) playClick('click'); }}
      title={enabled ? 'mute sound' : 'enable click sounds'}
    >
      {enabled ? '♪' : '♪̸'} sound:{enabled ? 'on' : 'off'}
    </button>
  );
}
// Global delegate: on any wf-tm-btn click, play if sound enabled
function useGlobalClickSound(enabled) {
  _ex_te(() => {
    if (!enabled) return;
    const handler = (e) => {
      const t = e.target.closest('.wf-tm-btn, .wf-tm-case-partner-chip, .wf-tm-partner-card, .wf-tm-case-card-readmore, .wf-tm-portal-btn');
      if (t) playClick(t.classList.contains('wf-tm-btn--primary') ? 'click' : 'tap');
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [enabled]);
}

/* ─── 14. Keyboard shortcuts overlay ─── */
const SHORTCUTS = [
  { keys: ['g', 'h'], label_ua: 'на головну', label_en: 'go home', target: '#top' },
  { keys: ['g', 'p'], label_ua: 'до партнерів', label_en: 'partners', target: '#partners' },
  { keys: ['g', 'w'], label_ua: 'до робіт', label_en: 'work', target: '#work' },
  { keys: ['g', 's'], label_ua: 'до сервісів', label_en: 'services', target: '#services' },
  { keys: ['g', 'c'], label_ua: 'до контактів', label_en: 'contact', target: '#contact' },
  { keys: ['g', 'n'], label_ua: 'до now', label_en: 'currently', target: '#currently' },
  { keys: ['t'], label_ua: 'переключити тему', label_en: 'toggle theme', action: 'theme' },
  { keys: ['?'], label_ua: 'показати/сховати ці підказки', label_en: 'show/hide help', action: 'help' },
];

function KeyboardShortcuts({ isUa, onToggleTheme }) {
  const [open, setOpen] = _ex_ts(false);
  const [pending, setPending] = _ex_ts(null);
  _ex_te(() => {
    let pendingKey = null;
    let pendingTimer = null;
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };
    const handler = (e) => {
      if (isTyping()) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); setOpen((o) => !o); return; }
      if (e.key === 'Escape') { setOpen(false); pendingKey = null; setPending(null); return; }
      if (e.key === 't' && !pendingKey) { onToggleTheme && onToggleTheme(); return; }
      if (e.key === 'g') {
        pendingKey = 'g'; setPending('g');
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pendingKey = null; setPending(null); }, 1000);
        return;
      }
      if (pendingKey === 'g') {
        const match = SHORTCUTS.find((s) => s.keys.length === 2 && s.keys[0] === 'g' && s.keys[1] === e.key);
        if (match && match.target) {
          const el = document.querySelector(match.target);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        pendingKey = null; setPending(null);
        clearTimeout(pendingTimer);
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); clearTimeout(pendingTimer); };
  }, [onToggleTheme]);

  return (
    <React.Fragment>
      {pending === 'g' && (
        <div className="wf-tm-keyhint">
          <span className="wf-tm-key-chip">g</span>
          <span style={{ color: 'var(--wf-fg-muted)' }}>+ ?</span>
        </div>
      )}
      {open && (
        <div className="wf-tm-shortcuts-overlay" onClick={() => setOpen(false)}>
          <div className="wf-tm-shortcuts-panel" onClick={(e) => e.stopPropagation()}>
            <div className="wf-tm-shortcuts-head">
              <span>{isUa ? '⌨️ shortcuts' : '⌨️ shortcuts'}</span>
              <button className="wf-tm-shortcuts-close" onClick={() => setOpen(false)}>esc</button>
            </div>
            <div className="wf-tm-shortcuts-list">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="wf-tm-shortcuts-row">
                  <div className="wf-tm-shortcuts-keys">
                    {s.keys.map((k, j) => (
                      <React.Fragment key={j}>
                        <span className="wf-tm-key-chip">{k}</span>
                        {j < s.keys.length - 1 && <span className="wf-tm-key-sep">then</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="wf-tm-shortcuts-label">{isUa ? s.label_ua : s.label_en}</span>
                </div>
              ))}
            </div>
            <div className="wf-tm-shortcuts-foot">{isUa ? 'натисни ? щоб закрити' : 'press ? to close'}</div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

/* ─── 15. Visitor counter (animated, deterministic per session) ─── */
function VisitorCounter({ isUa }) {
  // Generate stable-feeling numbers based on current minute so it drifts slowly
  const base = React.useMemo(() => {
    const now = new Date();
    const seed = now.getDate() * 137 + now.getHours() * 17 + now.getMinutes();
    const concurrent = 2 + (seed % 6); // 2..7
    const hourly = 22 + (seed % 53);  // 22..74
    return { concurrent, hourly };
  }, []);
  const [n, setN] = _ex_ts(base.concurrent);
  _ex_te(() => {
    const id = setInterval(() => {
      // small random walk ±1, clamp 2..8
      setN((v) => Math.max(2, Math.min(8, v + (Math.random() < 0.5 ? -1 : 1))));
    }, 9000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="wf-tm-visitors" title={isUa ? 'хто зараз тут' : 'who is here now'}>
      <span className="wf-tm-status-dot" style={{ width: 6, height: 6 }} />
      <span>{n} {isUa ? (n === 1 ? 'читач' : 'читачі') : (n === 1 ? 'reader' : 'readers')}</span>
      <span className="wf-tm-sb-sep">·</span>
      <span>{base.hourly}/{isUa ? 'год' : 'hr'}</span>
    </span>
  );
}

Object.assign(window, {
  AsciiLogoBanner, ASCII_LOGO_BIG,
  LiveCommandStrip, BootSequenceV2,
  AsciiPortrait, CurrentlySection,
  SoundToggle, useSoundEnabled, useGlobalClickSound,
  KeyboardShortcuts, VisitorCounter,
});
