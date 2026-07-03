// brandbook.jsx — workflo.space design system documentation
// Comprehensive, implementation-ready brandbook. Every value, class name,
// and HTML structure needed to build a workflo.space page from scratch.
// Pairs with brandbook-extras.jsx (heavier sections: forms, cards, templates).

const { useState: _bb_ts, useMemo: _bb_tm } = React;

/* ─────────────────────── Reusable atoms ─────────────────────── */

function BBSection({ id, num, title, sub, children }) {
  return (
    <section className="bb-section" id={id}>
      <header className="bb-secthead">
        <div className="bb-sectnum">{num}</div>
        <div>
          <h2 className="bb-secttitle">{title}</h2>
          {sub && <div className="bb-sectsub">{sub}</div>}
        </div>
      </header>
      <div className="bb-sectbody">{children}</div>
    </section>
  );
}

function BBH3({ children }) { return <h3 className="bb-h3">{children}</h3>; }
function BBProse({ children }) { return <p className="bb-prose">{children}</p>; }

function Swatch({ color, name, hex, fg }) {
  return (
    <div className="bb-swatch">
      <div className="bb-swatch-chip" style={{ background: color }} />
      <div className="bb-swatch-meta">
        <div className="bb-swatch-name">{name}</div>
        <div className="bb-swatch-hex">{hex}</div>
        {fg && <div className="bb-swatch-fg">fg: {fg}</div>}
      </div>
    </div>
  );
}

function TypeRow({ size, weight, family, sample, usage, cssClass }) {
  return (
    <div className="bb-typerow">
      <div className="bb-typerow-sample" style={{ fontSize: size, fontWeight: weight, fontFamily: family, lineHeight: 1.15 }}>{sample}</div>
      <div className="bb-typerow-meta">
        <div className="bb-typerow-stat">{size}px · {weight} · {family.split(',')[0].replace(/['"]/g, '')}</div>
        <div className="bb-typerow-usage">{usage}</div>
        {cssClass && <div className="bb-typerow-class">{cssClass}</div>}
      </div>
    </div>
  );
}

function SpacingRow({ token, px, usage }) {
  return (
    <div className="bb-spacingrow">
      <div className="bb-spacingrow-token">{token}</div>
      <div className="bb-spacingrow-vis" style={{ width: px }} />
      <div className="bb-spacingrow-px">{px}px</div>
      <div className="bb-spacingrow-usage">{usage}</div>
    </div>
  );
}

function ShadowRow({ name, value, usage, demoStyle }) {
  return (
    <div className="bb-shadowrow">
      <div className="bb-shadow-demo" style={{ boxShadow: value, ...demoStyle }} />
      <div className="bb-shadow-meta">
        <div className="bb-shadow-name">{name}</div>
        <div className="bb-shadow-val">{value}</div>
        <div className="bb-shadow-usage">{usage}</div>
      </div>
    </div>
  );
}

function MotionRow({ name, value, demo }) {
  return (
    <div className="bb-motionrow">
      <div className="bb-motion-name">{name}</div>
      <div className="bb-motion-val">{value}</div>
      <div className="bb-motion-demo">{demo}</div>
    </div>
  );
}

function Code({ children, lang = 'html' }) {
  return (
    <pre className="bb-code"><code data-lang={lang}>{children}</code></pre>
  );
}

function Token({ name, value }) {
  return (
    <div className="bb-token">
      <span className="bb-token-name">{name}</span>
      <span className="bb-token-sep">→</span>
      <span className="bb-token-val">{value}</span>
    </div>
  );
}

function CheatRow({ cls, what }) {
  return (
    <div className="bb-cheat-row">
      <code className="bb-cheat-cls">.{cls}</code>
      <span className="bb-cheat-what">{what}</span>
    </div>
  );
}

/* Expose atoms to extras file */
Object.assign(window, { BBSection, BBH3, BBProse, Swatch, TypeRow, SpacingRow, ShadowRow, MotionRow, Code, Token, CheatRow });

/* ────────────────────────── Main page ────────────────────────── */

function BrandbookHero() {
  return (
        <header className="bb-hero">
          <div className="bb-hero-top">
            <div className="bb-hero-tag">// brandbook · v2.0 · may 2026 · implementation-ready</div>
            <div className="bb-hero-meta">
              <span><span style={{ color: 'var(--wf-accent)' }}>●</span> live</span>
              <span className="bb-sep">·</span>
              <span>maintained by illia</span>
            </div>
          </div>
          <h1 className="bb-hero-h1">workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space</h1>
          <p className="bb-hero-sub">
            Це не маркетинговий гайд — це <strong>робочий довідник</strong> з усіма параметрами,
            CSS-класами та готовими HTML-snippets. Достатньо, щоб реалізувати лендінг
            від нуля без додаткових питань.
          </p>
          <nav className="bb-toc">
            <a href="#bb-brand">01 / Brand</a>
            <a href="#bb-color">02 / Color</a>
            <a href="#bb-type">03 / Type</a>
            <a href="#bb-space">04 / Spacing</a>
            <a href="#bb-radii">05 / Radii</a>
            <a href="#bb-shadows">06 / Shadows</a>
            <a href="#bb-motion">07 / Motion</a>
            <a href="#bb-icons">08 / Icons</a>
            <a href="#bb-layout">09 / Layout & Grid</a>
            <a href="#bb-chrome">10 / Window Chrome</a>
            <a href="#bb-nav">11 / Navigation</a>
            <a href="#bb-terminal">12 / Terminal Atoms</a>
            <a href="#bb-buttons">13 / Buttons</a>
            <a href="#bb-forms">14 / Forms</a>
            <a href="#bb-chips">15 / Chips & Badges</a>
            <a href="#bb-cards">16 / Cards</a>
            <a href="#bb-metrics">17 / Metrics</a>
            <a href="#bb-effects">18 / Effects</a>
            <a href="#bb-templates">19 / Page Templates</a>
            <a href="#bb-voice">20 / Voice & Tone</a>
            <a href="#bb-cheat">21 / Class Cheatsheet</a>
          </nav>
        </header>
  );
}

function BrandbookSectionsA() {
  return (
    <React.Fragment>
        {/* 01 BRAND */}
        <BBSection num="01" id="bb-brand" title="Brand" sub="Хто. Що. Як говоримо.">
          <div className="bb-brand-grid">
            <div className="bb-brand-mark">
              <svg viewBox="0 0 180 180" width="180" height="180">
                <rect x="6" y="14" width="166" height="158" rx="11" fill="#0C0A09" opacity="0.10" />
                <rect x="2" y="6" width="166" height="158" rx="11" fill="#FAFAF9" stroke="#0C0A09" strokeWidth="1.5" />
                <rect x="2" y="6" width="166" height="24" rx="11" fill="#0C0A09" />
                <rect x="2" y="20" width="166" height="10" fill="#0C0A09" />
                <circle cx="14" cy="18" r="3.4" fill="#ff5f57" />
                <circle cx="25" cy="18" r="3.4" fill="#febc2e" />
                <circle cx="36" cy="18" r="3.4" fill="#28c840" />
                <g fontFamily="JetBrains Mono, monospace" fontSize="13" fill="#0C0A09" fontWeight="500" textAnchor="middle">
                  <text x="85" y="68" xmlSpace="preserve"> /\_/\ </text>
                  <text x="85" y="86" xmlSpace="preserve">( <tspan fill="#A3D90D" fontWeight="700">●</tspan> . o )</text>
                  <text x="85" y="104" xmlSpace="preserve"> {'>'} ^ {'<'} </text>
                </g>
                <line x1="14" y1="124" x2="156" y2="124" stroke="#E7E5E4" strokeDasharray="2 3" />
                <text x="14" y="142" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#78716C"><tspan fill="#A3D90D" fontWeight="600">$</tspan><tspan dx="4" fill="#0C0A09">echo $cat</tspan></text>
                <text x="14" y="156" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#78716C"><tspan fill="#A3D90D">{'>'}</tspan><tspan dx="4">workflo · cat v1.0</tspan></text>
              </svg>
            </div>
            <div className="bb-brand-facts">
              <div className="bb-fact"><div className="bb-fact-k">name</div><div className="bb-fact-v">workflo<span style={{ color: '#A3D90D' }}>.</span>space</div></div>
              <div className="bb-fact"><div className="bb-fact-k">tagline</div><div className="bb-fact-v">automation for teams who outgrew Excel</div></div>
              <div className="bb-fact"><div className="bb-fact-k">archetype</div><div className="bb-fact-v">engineer's-cut · terminal-native</div></div>
              <div className="bb-fact"><div className="bb-fact-k">mascot</div><div className="bb-fact-v">workflo cat · monoline · lime-eye accent</div></div>
              <div className="bb-fact"><div className="bb-fact-k">voice</div><div className="bb-fact-v">direct · technical · self-aware · low-jargon</div></div>
              <div className="bb-fact"><div className="bb-fact-k">do</div><div className="bb-fact-v">prompt-style markers, file paths, git-log lists, mono CTAs in [ brackets ]</div></div>
              <div className="bb-fact"><div className="bb-fact-k">don't</div><div className="bb-fact-v">gradient backgrounds, emoji, marketing fluff, pure black/white</div></div>
              <div className="bb-fact"><div className="bb-fact-k">root class</div><div className="bb-fact-v"><code>.wf-root.wf-v-terminal-pro</code></div></div>
              <div className="bb-fact"><div className="bb-fact-k">data attrs</div><div className="bb-fact-v"><code>data-theme="light|dark"</code> · <code>data-accent="lime|amber|green|cyan|magenta|orange"</code></div></div>
            </div>
          </div>
        </BBSection>

        {/* 02 COLOR */}
        <BBSection num="02" id="bb-color" title="Color" sub="Усі токени як CSS-змінні. Перемикаються через data-theme/data-accent на корені.">
          <BBH3>Light theme · neutrals</BBH3>
          <div className="bb-swatches">
            <Swatch color="#FAFAF9" name="--wf-bg"            hex="#FAFAF9" />
            <Swatch color="#FFFFFF" name="--wf-surface"       hex="#FFFFFF" />
            <Swatch color="#F5F5F4" name="--wf-subtle"        hex="#F5F5F4" />
            <Swatch color="#E7E5E4" name="--wf-border"        hex="#E7E5E4" />
            <Swatch color="#D6D3D1" name="--wf-border-strong" hex="#D6D3D1" />
            <Swatch color="#A8A29E" name="--wf-fg-subtle"     hex="#A8A29E" />
            <Swatch color="#78716C" name="--wf-fg-muted"      hex="#78716C" />
            <Swatch color="#44403C" name="--wf-fg-secondary"  hex="#44403C" />
            <Swatch color="#0C0A09" name="--wf-fg"            hex="#0C0A09" />
          </div>

          <BBH3>Dark theme · neutrals</BBH3>
          <div className="bb-swatches bb-swatches--dark">
            <Swatch color="#0A0A0A" name="--wf-bg"            hex="#0A0A0A" />
            <Swatch color="#161616" name="--wf-surface"       hex="#161616" />
            <Swatch color="#1C1917" name="--wf-subtle"        hex="#1C1917" />
            <Swatch color="#2A2A2A" name="--wf-border"        hex="#2A2A2A" />
            <Swatch color="#45454A" name="--wf-border-strong" hex="#45454A" />
            <Swatch color="#78716C" name="--wf-fg-subtle"     hex="#78716C" />
            <Swatch color="#B3ADA4" name="--wf-fg-muted"      hex="#B3ADA4" />
            <Swatch color="#E2DED4" name="--wf-fg-secondary"  hex="#E2DED4" />
            <Swatch color="#FAFAF9" name="--wf-fg"            hex="#FAFAF9" />
          </div>

          <BBH3>Accent · Lime (brand default)</BBH3>
          <div className="bb-swatches">
            <Swatch color="#A3D90D" name="--wf-accent (light theme)" hex="#A3D90D" />
            <Swatch color="#C5F82A" name="--wf-accent-bg / dark theme accent" hex="#C5F82A" />
            <Swatch color="#ECFCC4" name="--wf-accent-soft (light bg fills)"  hex="#ECFCC4" />
            <Swatch color="#3F4F0F" name="--wf-accent-soft (dark bg fills)"   hex="#3F4F0F" />
          </div>
          <BBProse>Текст на lime-fill — <strong>завжди --wf-fg</strong> (темний). Інші акценти (cyan, magenta, orange) — текст <code>--wf-bg</code>.</BBProse>

          <BBH3>Alternate accents (presets)</BBH3>
          <div className="bb-swatches">
            <Swatch color="#D97706" name="amber"     hex="#D97706" />
            <Swatch color="#16A34A" name="phosphor"  hex="#16A34A" />
            <Swatch color="#0891B2" name="cyan"      hex="#0891B2" />
            <Swatch color="#C026D3" name="magenta"   hex="#C026D3" />
            <Swatch color="#EA580C" name="orange"    hex="#EA580C" />
          </div>

          <BBH3>Semantic</BBH3>
          <div className="bb-swatches">
            <Swatch color="#059669" name="--wf-success"     hex="#059669" />
            <Swatch color="#D97706" name="--wf-warning"     hex="#D97706" />
            <Swatch color="#DC2626" name="--wf-destructive" hex="#DC2626" />
          </div>

          <BBH3>Macos traffic dots (fixed)</BBH3>
          <div className="bb-swatches">
            <Swatch color="#ff5f57" name="close"    hex="#ff5f57" />
            <Swatch color="#febc2e" name="minimize" hex="#febc2e" />
            <Swatch color="#28c840" name="maximize" hex="#28c840" />
          </div>

          <BBH3>color-mix utilities</BBH3>
          <div className="bb-prose bb-mono">
            <div>tint surface     <span className="bb-muted">→</span> <code>color-mix(in oklab, var(--wf-fg) 2.5%, transparent)</code></div>
            <div>tint stronger    <span className="bb-muted">→</span> <code>color-mix(in oklab, var(--wf-fg) 4%, var(--wf-bg))</code></div>
            <div>accent fill 10%  <span className="bb-muted">→</span> <code>color-mix(in oklab, var(--wf-accent) 10%, transparent)</code></div>
            <div>focus ring       <span className="bb-muted">→</span> <code>0 0 0 3px color-mix(in oklab, var(--wf-accent) 22%, transparent)</code></div>
            <div>status dot halo  <span className="bb-muted">→</span> <code>0 0 0 3px color-mix(in oklab, var(--wf-accent) 30%, transparent)</code></div>
          </div>
        </BBSection>

        {/* 03 TYPE */}
        <BBSection num="03" id="bb-type" title="Type" sub="Дві сім'ї. JetBrains Mono — за замовчуванням. Geist — для прози.">
          <BBProse>
            <strong>Geist</strong> для прози (problem/solution paragraphs) — читабельна на довгій формі.
            <strong> JetBrains Mono</strong> для решти — UI, заголовки, код, метрики. Sans-serif —
            виняток; mono — норма.
          </BBProse>
          <div className="bb-prose bb-mono">
            <div>font-feature-settings <span className="bb-muted">→</span> <code>'ss01', 'cv11'</code> (Geist) · <code>'tnum'</code> (всі числа в UI)</div>
            <div>antialiasing <span className="bb-muted">→</span> <code>-webkit-font-smoothing: antialiased</code></div>
            <div>text-rendering <span className="bb-muted">→</span> <code>optimizeLegibility</code></div>
          </div>

          <BBH3>Type scale</BBH3>
          <div className="bb-types">
            <TypeRow size={44} weight={600} family="JetBrains Mono, monospace" sample="Я Ілля." usage="hero H1 · один на сторінку" cssClass=".wf-tm-h1 / .bb-hero-h1" />
            <TypeRow size={32} weight={600} family="JetBrains Mono, monospace" sample="# Page title" usage="project / company page H1" cssClass=".wf-tm-page-h1" />
            <TypeRow size={26} weight={600} family="JetBrains Mono, monospace" sample="## section title" usage="hero card titles · spotlight name" cssClass=".bb-secttitle / .wf-tm-md-h1" />
            <TypeRow size={22} weight={600} family="JetBrains Mono, monospace" sample="card heading" usage="case card · partner name" cssClass=".wf-tm-case-card-title / .wf-tm-partner-card-name" />
            <TypeRow size={18} weight={500} family="JetBrains Mono, monospace" sample="$ command" usage="prompt lines · service names" cssClass=".wf-tm-service-name" />
            <TypeRow size={15} weight={400} family="'Geist', sans-serif" sample="Я з Луцька. Програмую з 2018-го." usage="prose paragraphs · summaries" cssClass=".wf-tm-prose-p" />
            <TypeRow size={13} weight={400} family="JetBrains Mono, monospace" sample="meta · context · stack" usage="default body / UI text" cssClass="(default)" />
            <TypeRow size={11} weight={500} family="JetBrains Mono, monospace" sample="LABEL / KEY" usage="profile keys · tile labels · chips" cssClass=".wf-tm-key / .wf-tm-meta-key" />
          </div>

          <BBH3>Letter-spacing & line-height</BBH3>
          <div className="bb-prose bb-mono">
            <div>display (32–80px) <span className="bb-muted">→</span> <code>letter-spacing: -0.02em … -0.045em</code> · <code>line-height: 1.0–1.2</code></div>
            <div>body (13–16px)    <span className="bb-muted">→</span> <code>letter-spacing: 0</code> · <code>line-height: 1.5</code> (Geist) · <code>1.65</code> (mono body)</div>
            <div>labels uppercase  <span className="bb-muted">→</span> <code>letter-spacing: 0.04–0.06em</code> · <code>text-transform: uppercase</code></div>
          </div>

          <BBH3>Imports</BBH3>
          <Code lang="html">{`<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=JetBrains+Mono:wght@400..600&display=swap" rel="stylesheet" />`}</Code>
        </BBSection>

        {/* 04 SPACING */}
        <BBSection num="04" id="bb-space" title="Spacing" sub="4px-base scale. Використовується через CSS-padding/margin/gap.">
          <div className="bb-spacings">
            <SpacingRow token="space-1"  px={4}   usage="icon ↔ text · inline chips" />
            <SpacingRow token="space-2"  px={8}   usage="form rows · button gap" />
            <SpacingRow token="space-3"  px={12}  usage="section internal gaps · card gap" />
            <SpacingRow token="space-4"  px={16}  usage="card padding (compact)" />
            <SpacingRow token="space-5"  px={20}  usage="card padding (default)" />
            <SpacingRow token="space-6"  px={24}  usage="card padding (large) · hero padding" />
            <SpacingRow token="space-7"  px={28}  usage="terminal window inner padding" />
            <SpacingRow token="space-8"  px={32}  usage="section block gap · wrap padding" />
            <SpacingRow token="space-10" px={48}  usage="page horizontal gutter" />
            <SpacingRow token="space-12" px={64}  usage="section ↔ section vertical" />
            <SpacingRow token="space-16" px={96}  usage="page top padding · hero" />
          </div>
          <BBH3>Container widths</BBH3>
          <div className="bb-prose bb-mono">
            <div>landing root        <span className="bb-muted">→</span> <code>width: 1200px</code> (artboard)</div>
            <div>brandbook wrap      <span className="bb-muted">→</span> <code>max-width: 1080px · padding: 48px 60px 80px</code></div>
            <div>landing container   <span className="bb-muted">→</span> <code>max-width: 1104px · padding: 0 48px</code></div>
            <div>terminal wrap       <span className="bb-muted">→</span> <code>padding: 32px</code> (outer) · <code>28px</code> (inner body)</div>
            <div>prose max-width     <span className="bb-muted">→</span> <code>720px</code> (Geist body) · <code>600px</code> (md-body)</div>
          </div>
        </BBSection>

        {/* 05 RADII */}
        <BBSection num="05" id="bb-radii" title="Radii" sub="Скупа шкала. Більше — це лоу-фай. Менше — terminal-feel.">
          <div className="bb-radii">
            <div className="bb-radius" style={{ borderRadius: 3 }}>3px<br/><small>chips inner · code</small></div>
            <div className="bb-radius" style={{ borderRadius: 4 }}>4px<br/><small>inputs · small buttons · pills · chips</small></div>
            <div className="bb-radius" style={{ borderRadius: 6 }}>6px<br/><small>primary buttons · cards inner · radius-btn</small></div>
            <div className="bb-radius" style={{ borderRadius: 8 }}>8px<br/><small>default cards · spotlight · radius</small></div>
            <div className="bb-radius" style={{ borderRadius: 10 }}>10px<br/><small>neo identity card</small></div>
            <div className="bb-radius" style={{ borderRadius: 12 }}>12px<br/><small>terminal window outer</small></div>
            <div className="bb-radius" style={{ borderRadius: 999 }}>999px<br/><small>badges · status pills · partner chips</small></div>
          </div>
          <div className="bb-prose bb-mono">
            <div>--wf-radius     <span className="bb-muted">→</span> <code>8px</code> (default cards)</div>
            <div>--wf-radius-btn <span className="bb-muted">→</span> <code>6px</code> (buttons, inputs)</div>
          </div>
        </BBSection>

        {/* 06 SHADOWS */}
        <BBSection num="06" id="bb-shadows" title="Shadows & Elevation" sub="Майже немає. Картки лежать на 1px-бордерах. Тінь — лише на window та hover.">
          <div className="bb-shadows">
            <ShadowRow
              name="window (light)"
              value="0 1px 0 color-mix(in oklab, var(--wf-fg) 4%, transparent), 0 12px 40px color-mix(in oklab, var(--wf-fg) 10%, transparent)"
              usage=".wf-tm-window — лежить на фоні; double-shadow дає глибину без різкого drop"
            />
            <ShadowRow
              name="window (dark)"
              value="0 12px 40px rgba(0,0,0,0.6)"
              usage=".wf-tm-window[data-theme=dark] — глибша тінь, бо немає світлого фону"
            />
            <ShadowRow
              name="card hover lift"
              value="0 6px 24px color-mix(in oklab, var(--wf-fg) 6%, transparent)"
              usage="cards on hover (var. asymmetric); transform: translateY(-2px)"
            />
            <ShadowRow
              name="overlay"
              value="0 24px 60px rgba(0,0,0,0.3)"
              usage="shortcuts panel, modals"
            />
            <ShadowRow
              name="keyhint"
              value="0 4px 16px rgba(0,0,0,0.2)"
              usage="floating keyboard hint"
            />
            <ShadowRow
              name="focus ring"
              value="0 0 0 3px color-mix(in oklab, var(--wf-accent) 22%, transparent)"
              usage="input:focus, textarea:focus"
              demoStyle={{ background: '#FAFAF9', border: '1px solid #A3D90D' }}
            />
            <ShadowRow
              name="status dot halo"
              value="0 0 0 3px color-mix(in oklab, var(--wf-accent) 30%, transparent)"
              usage=".wf-tm-status-dot — пульсуючий аура-халоу"
              demoStyle={{ width: 12, height: 12, background: '#A3D90D', borderRadius: '50%' }}
            />
            <ShadowRow
              name="(rest)"
              value="none"
              usage="cards, buttons, inputs, sections — БЕЗ тіні в стані спокою"
            />
          </div>
        </BBSection>

        {/* 07 MOTION */}
        <BBSection num="07" id="bb-motion" title="Motion" sub="Швидко. Стримано. Як термінал.">
          <BBH3>Durations</BBH3>
          <div className="bb-prose bb-mono">
            <Token name="instant"      value="0.12s · колір, фон, бордер, opacity на hover" />
            <Token name="quick"        value="0.15s · transition за замовчуванням" />
            <Token name="quick-slow"   value="0.2s · підняття картки (translateY)" />
            <Token name="boot"         value="2.4s · ціла boot-sequence (із паузою)" />
            <Token name="typewriter"   value="35–60ms/char · h1 typewriter, live-cmd strip" />
          </div>

          <BBH3>Easing</BBH3>
          <div className="bb-prose bb-mono">
            <Token name="default"    value="ease-out · усі UI transitions" />
            <Token name="cursor"     value="steps(1, end) · cursor-blink (1s)" />
            <Token name="pulse-live" value="cubic-bezier(.4, 0, .2, 1) · status dot pulse (1.8s)" />
          </div>

          <BBH3>Keyframes</BBH3>
          <Code lang="css">{`@keyframes wf-cursor-blink {
  0%, 50%  { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}
@keyframes wf-pulse-live {
  0%   { box-shadow: 0 0 0 0 color-mix(in oklab, var(--wf-accent) 50%, transparent); }
  70%  { box-shadow: 0 0 0 8px color-mix(in oklab, var(--wf-accent) 0%,  transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--wf-accent) 0%,  transparent); }
}
@keyframes wf-fade-up { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
@keyframes wf-fade-in { from { opacity: 0; } to { opacity: 1; } }`}</Code>

          <BBH3>Hover patterns</BBH3>
          <div className="bb-prose bb-mono">
            <div>card     <span className="bb-muted">→</span> <code>border-color: accent</code> + <code>translateY(-2px)</code></div>
            <div>row      <span className="bb-muted">→</span> <code>background: fg 2.5–3%</code> + <code>border-color: border</code></div>
            <div>btn      <span className="bb-muted">→</span> <code>invert (fg ↔ bg)</code></div>
            <div>link     <span className="bb-muted">→</span> <code>color: muted → accent</code></div>
            <div>nav link <span className="bb-muted">→</span> prepend <code>{'"> "'}</code> з accent</div>
            <div>icon row <span className="bb-muted">→</span> arrow <code>translate(2px, -2px)</code> + opacity 1</div>
          </div>
        </BBSection>

        {/* 08 ICONS */}
        <BBSection num="08" id="bb-icons" title="Iconography" sub="Lucide-style. 1.8px stroke. currentColor. 14–22px.">
          <BBProse>
            Усі іконки моноліній, <strong>stroke-width: 1.8px</strong>, без fill. Усі succeed
            <code>currentColor</code> — колір береться з контексту (.wf-tm-key, .wf-tm-fg-muted тощо).
            Соц-іконки (website / instagram / tiktok / youtube / linkedin / x) — на company-сторінках.
          </BBProse>
          <div className="bb-icons">
            {[
              { n: 'lock', svg: (<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11 V 7 a 5 5 0 0 1 10 0 v 4" /></>) },
              { n: 'arrow-up-right', svg: <path d="M 7 17 L 17 7 M 9 7 L 17 7 L 17 15" /> },
              { n: 'arrow-right', svg: <path d="M 5 12 L 19 12 M 13 6 L 19 12 L 13 18" /> },
              { n: 'check', svg: <path d="M 4 12 l 5 5 l 12 -12" /> },
              { n: 'cursor', svg: <path d="M 5 3 L 19 13 L 13 14 L 11 21 L 5 3 Z" /> },
              { n: 'plus', svg: <path d="M 12 5 L 12 19 M 5 12 L 19 12" /> },
              { n: 'minus', svg: <path d="M 5 12 L 19 12" /> },
              { n: 'x', svg: <path d="M 6 6 L 18 18 M 18 6 L 6 18" /> },
              { n: 'instagram', svg: (<><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor"/></>) },
              { n: 'globe', svg: (<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2 a 15 15 0 0 1 0 20 a 15 15 0 0 1 0 -20"/></>) },
              { n: 'github', svg: <path d="M 9 19 c -5 1.5 -5 -2.5 -7 -3 m 14 6 v -3.87 a 3.37 3.37 0 0 0 -0.94 -2.61 c 3.14 -0.35 6.44 -1.54 6.44 -7 A 5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1 s -1.18 -0.35 -3.91 1.48 a 13.38 13.38 0 0 0 -7 0 C 6.27 0.65 5.09 1 5.09 1 A 5.07 5.07 0 0 0 5 4.77 a 5.44 5.44 0 0 0 -1.5 3.78 c 0 5.42 3.3 6.61 6.44 7 A 3.37 3.37 0 0 0 9 18.13 V 22" /> },
              { n: 'mail', svg: (<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M 3 7 L 12 13 L 21 7" /></>) },
              { n: 'send', svg: <path d="M 22 2 L 11 13 M 22 2 L 15 22 L 11 13 L 2 9 L 22 2 Z" /> },
              { n: 'terminal', svg: (<><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>) },
              { n: 'play', svg: <polygon points="5 3 19 12 5 21 5 3" /> },
              { n: 'pause', svg: (<><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>) },
            ].map((ic) => (
              <div key={ic.n} className="bb-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ic.svg}</svg>
                <span>{ic.n}</span>
              </div>
            ))}
          </div>
          <BBH3>SVG attrs (copy-paste)</BBH3>
          <Code lang="html">{`<svg viewBox="0 0 24 24" width="16" height="16" fill="none"
     stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <!-- path -->
</svg>`}</Code>
        </BBSection>

        {/* 09 LAYOUT */}
        <BBSection num="09" id="bb-layout" title="Layout & Grid" sub="Усе на CSS Grid + Flex з gap. Жодних inline-flow.">
          <BBH3>Page width</BBH3>
          <div className="bb-prose bb-mono">
            <div>artboard width   <span className="bb-muted">→</span> <code>1200px</code></div>
            <div>terminal wrap    <span className="bb-muted">→</span> <code>padding: 32px</code> навколо вікна</div>
            <div>window body      <span className="bb-muted">→</span> <code>padding: 12px 28px</code></div>
            <div>section padding  <span className="bb-muted">→</span> <code>24px 0 32px</code></div>
          </div>

          <BBH3>Grid templates (готові)</BBH3>
          <div className="bb-grids">
            <div className="bb-grid-row">
              <div className="bb-grid-name">2-col cards</div>
              <div className="bb-grid-vis bb-grid-vis-2"><span/><span/></div>
              <code>grid-template-columns: repeat(2, 1fr); gap: 14px;</code>
              <span className="bb-muted">.wf-tm-case-grid · .wf-tm-partner-grid</span>
            </div>
            <div className="bb-grid-row">
              <div className="bb-grid-name">3-col stats</div>
              <div className="bb-grid-vis bb-grid-vis-3"><span/><span/><span/></div>
              <code>grid-template-columns: repeat(3, 1fr); gap: 14px;</code>
              <span className="bb-muted">.wf-tm-tldr · .wf-tm-meta-strip</span>
            </div>
            <div className="bb-grid-row">
              <div className="bb-grid-name">4-col metrics</div>
              <div className="bb-grid-vis bb-grid-vis-4"><span/><span/><span/><span/></div>
              <code>grid-template-columns: repeat(4, 1fr); gap: 1px; bg: var(--wf-border);</code>
              <span className="bb-muted">.wf-tm-metrics-grid · .wf-tm-company-hero-stats</span>
            </div>
            <div className="bb-grid-row">
              <div className="bb-grid-name">6-col scale</div>
              <div className="bb-grid-vis bb-grid-vis-6"><span/><span/><span/><span/><span/><span/></div>
              <code>grid-template-columns: repeat(6, 1fr); gap: 1px;</code>
              <span className="bb-muted">.wf-tm-scale-grid (homepage stats)</span>
            </div>
            <div className="bb-grid-row">
              <div className="bb-grid-name">git-log case</div>
              <div className="bb-grid-vis bb-grid-vis-glog"><span/><span/></div>
              <code>grid-template-columns: 16px 1fr; gap: 0;</code>
              <span className="bb-muted">.wf-tm-case-body (gutter + bar)</span>
            </div>
            <div className="bb-grid-row">
              <div className="bb-grid-name">key/value row</div>
              <div className="bb-grid-vis bb-grid-vis-kv"><span/><span/><span/></div>
              <code>grid-template-columns: 100px 1fr; · 70px 14px 1fr (with arrow)</code>
              <span className="bb-muted">.wf-tm-service-line · .wf-tm-neo-row</span>
            </div>
            <div className="bb-grid-row">
              <div className="bb-grid-name">currently</div>
              <div className="bb-grid-vis bb-grid-vis-curr"><span/><span/><span/><span/><span/></div>
              <code>grid-template-columns: 32px 1fr 140px 50px 110px;</code>
              <span className="bb-muted">.wf-tm-currently-row</span>
            </div>
          </div>

          <BBH3>Composition rule</BBH3>
          <BBProse>
            <strong>Завжди Flex/Grid з gap.</strong> Ніколи inline-block + margin.
            Це робить редагування в DOM передбачуваним і легким.
          </BBProse>
        </BBSection>

        {/* 10 WINDOW CHROME */}
        <BBSection num="10" id="bb-chrome" title="Window Chrome" sub="macOS-style вікно — обгортка всього лендінгу.">
          <BBH3>Anatomy</BBH3>
          <div className="bb-chrome-demo">
            <div className="bb-chrome-block">
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'color-mix(in oklab, #0C0A09 4%, #FAFAF9)', borderBottom: '1px solid #E7E5E4', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
                </div>
                <span style={{ fontSize: 12, color: '#78716C' }}>illia@workflo:~ — bash · 80×24</span>
                <span style={{ fontSize: 12, color: 'transparent' }}>spacer</span>
              </div>
              <div style={{ padding: '14px 28px', minHeight: 80, fontSize: 13 }}>
                <span style={{ color: '#A3D90D' }}>illia</span>
                <span style={{ color: '#A8A29E' }}>@</span>
                <span style={{ color: '#44403C' }}>workflo</span>
                <span style={{ color: '#A8A29E' }}>:</span>
                <span style={{ color: '#A3D90D' }}>~</span>
                <span style={{ color: '#0C0A09', margin: '0 6px', fontWeight: 600 }}>$</span>
                <span style={{ color: '#0C0A09' }}>./hello.sh</span>
                <div style={{ marginTop: 8, color: '#0C0A09', fontWeight: 600 }}><span style={{ color: '#A3D90D' }}>{'> '}</span>body content here</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 18px', background: 'color-mix(in oklab, #0C0A09 4%, #FAFAF9)', borderTop: '1px solid #E7E5E4', fontSize: 11, color: '#78716C' }}>
                <span><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A3D90D', display: 'inline-block', marginRight: 6 }} />main</span>
                <span>14:32 · UA · Light</span>
              </div>
            </div>
          </div>
          <BBH3>Tokens</BBH3>
          <div className="bb-prose bb-mono">
            <div>window radius     <span className="bb-muted">→</span> <code>12px</code></div>
            <div>window border     <span className="bb-muted">→</span> <code>1px solid var(--wf-border-strong)</code></div>
            <div>titlebar height   <span className="bb-muted">→</span> <code>~44px</code> (padding 12px 16px)</div>
            <div>titlebar bg       <span className="bb-muted">→</span> <code>color-mix(in oklab, var(--wf-fg) 4%, var(--wf-bg))</code></div>
            <div>traffic dot       <span className="bb-muted">→</span> <code>12px × 12px</code> circle</div>
            <div>statusbar height  <span className="bb-muted">→</span> <code>~30px</code> (padding 8px 18px)</div>
            <div>statusbar font    <span className="bb-muted">→</span> <code>11px · tnum · muted</code></div>
          </div>
          <BBH3>Markup</BBH3>
          <Code lang="html">{`<div class="wf-tm-window">
  <div class="wf-tm-titlebar">
    <div class="wf-tm-traffic">
      <span class="wf-tm-traffic-dot"></span>
      <span class="wf-tm-traffic-dot"></span>
      <span class="wf-tm-traffic-dot"></span>
    </div>
    <div class="wf-tm-titlebar-title">illia@workflo:~ — bash · 80×24</div>
    <div></div>
  </div>
  <div class="wf-tm-body"><!-- nav + sections --></div>
  <div class="wf-tm-statusbar">
    <div class="wf-tm-statusbar-left"><span class="wf-tm-sb-branch">● main</span></div>
    <div class="wf-tm-statusbar-right">14:32 · UA · Light</div>
  </div>
</div>`}</Code>
        </BBSection>

        {/* 11 NAV */}
        <BBSection num="11" id="bb-nav" title="Navigation" sub="Усередині вікна. Зліва — wordmark + посилання, справа — portal + CTA.">
          <BBH3>Demo</BBH3>
          <div className="bb-nav-demo">
            <div style={{ padding: '14px 28px', borderBottom: '1px solid #E7E5E4', background: 'color-mix(in oklab, #0C0A09 2%, #FAFAF9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>workflo<span style={{ color: '#A3D90D' }}>.</span>space</span>
                <a className="bb-demo-navlink">work</a>
                <a className="bb-demo-navlink">services</a>
                <a className="bb-demo-navlink">process</a>
                <a className="bb-demo-navlink">about</a>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <a className="wf-tm-portal-btn">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11 V 7 a 5 5 0 0 1 10 0 v 4" />
                  </svg>
                  <span>Мій кабінет</span>
                </a>
                <button className="wf-tm-btn wf-tm-btn--sm wf-tm-btn--primary">[ contact ]</button>
              </div>
            </div>
          </div>
          <BBH3>Link hover</BBH3>
          <BBProse>На hover — колір <code>--wf-accent</code> + префікс <code>"&gt; "</code> через <code>::before</code> з opacity transition.</BBProse>
          <Code lang="css">{`.wf-tm-nav-links a::before { content: ""; opacity: 0; }
.wf-tm-nav-links a:hover::before {
  content: "> ";
  opacity: 1;
  color: var(--wf-accent);
}`}</Code>
        </BBSection>

        {/* 12 TERMINAL ATOMS */}
        <BBSection num="12" id="bb-terminal" title="Terminal Atoms" sub="Спільні цеглинки: prompt, divider, cursor, ASCII.">
          <BBH3>Prompt</BBH3>
          <div className="bb-prose bb-mono">
            <span className="wf-tm-user">illia</span>
            <span className="wf-tm-at">@</span>
            <span className="wf-tm-host">workflo</span>
            <span className="wf-tm-colon">:</span>
            <span className="wf-tm-cwd">~</span>
            <span className="wf-tm-sigil">$</span>
            <span className="wf-tm-cmd">./command</span>
          </div>
          <Code lang="html">{`<div class="wf-tm-prompt">
  <span class="wf-tm-user">illia</span>
  <span class="wf-tm-at">@</span>
  <span class="wf-tm-host">workflo</span>
  <span class="wf-tm-colon">:</span>
  <span class="wf-tm-cwd">~</span>
  <span class="wf-tm-sigil">$</span>
  <span class="wf-tm-cmd">./command</span>
</div>`}</Code>

          <BBH3>Section divider</BBH3>
          <BBProse>Пунктир + tag <code># section-name</code> у tooltip-стилі.</BBProse>
          <div style={{ position: 'relative', padding: '18px 0' }}>
            <div className="wf-tm-divider-line" data-section="section-name" />
          </div>
          <Code lang="html">{`<div class="wf-tm-divider-line" data-section="services"></div>`}</Code>

          <BBH3>Cursor</BBH3>
          <div className="bb-prose bb-mono" style={{ fontSize: 18 }}>
            <span>typing</span>
            <span className="wf-tm-cursor" style={{ width: '0.55em', height: '1em', verticalAlign: '-0.1em' }} />
          </div>
          <Code lang="html">{`<span class="wf-tm-cursor"></span>
<!-- size from context font-size · animation: wf-cursor-blink 1s steps(1,end) infinite -->`}</Code>

          <BBH3>Section command pattern</BBH3>
          <div className="bb-prose bb-mono">
            <div>partners <span className="bb-muted">→</span> <code>ls -la ~/partners</code></div>
            <div>work     <span className="bb-muted">→</span> <code>git log --by-partner --oneline</code></div>
            <div>services <span className="bb-muted">→</span> <code>ls ~/services</code></div>
            <div>process  <span className="bb-muted">→</span> <code>man workflo-flow</code></div>
            <div>about    <span className="bb-muted">→</span> <code>whoami && cat ~/profile.md</code></div>
            <div>contact  <span className="bb-muted">→</span> <code>contact --interactive</code></div>
            <div>scale    <span className="bb-muted">→</span> <code>stats --all</code></div>
            <div>currently <span className="bb-muted">→</span> <code>cat ~/now.md</code></div>
          </div>

          <BBH3>ASCII pipeline (process)</BBH3>
          <Code lang="text">{`brief → discovery → prototype → ship → support
  │       │           │           │      │
  1d      3d          5–10d       2w     1mo`}</Code>

          <BBH3>Markdown-style headers (page bodies)</BBH3>
          <div className="bb-prose bb-mono">
            <div><span style={{ color: 'var(--wf-fg)', fontWeight: 600 }}># Page H1</span></div>
            <div><span style={{ color: 'var(--wf-fg-muted)', fontWeight: 500 }}>## section h2</span></div>
            <div><span style={{ color: 'var(--wf-fg-muted)', fontWeight: 500 }}>### sub-section h3</span></div>
          </div>
        </BBSection>

        {/* 13 BUTTONS */}
        <BBSection num="13" id="bb-buttons" title="Buttons" sub="Усі CTA — текст у [ brackets ]. Primary — lime fill з темним текстом. Ghost — borderonly.">
          <BBH3>Variants</BBH3>
          <div className="bb-btn-row">
            <button className="wf-tm-btn wf-tm-btn--primary">[ Обговорити проєкт → ]</button>
            <button className="wf-tm-btn">[ Подивитись роботи ]</button>
            <button className="wf-tm-btn wf-tm-btn--sm">[ small action ]</button>
            <button className="wf-tm-btn wf-tm-btn--sm wf-tm-btn--primary">[ small primary ]</button>
            <button className="wf-tm-btn wf-tm-btn--big wf-tm-btn--primary">[ big · CTA → ]</button>
            <a className="wf-tm-portal-btn">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11 V 7 a 5 5 0 0 1 10 0 v 4" />
              </svg>
              <span>Мій кабінет</span>
            </a>
          </div>

          <BBH3>Sizes</BBH3>
          <div className="bb-prose bb-mono">
            <Token name="--sm"  value="padding 6px 10px · font 12px · h ~28px" />
            <Token name="(default)" value="padding 8px 14px · font 13px · h ~36px" />
            <Token name="--big" value="padding 12px 22px · font 14px · h ~44px" />
          </div>

          <BBH3>State</BBH3>
          <div className="bb-prose bb-mono">
            <div>primary  <span className="bb-muted">→</span> bg <code>--wf-accent-bg</code> · color <code>--wf-fg</code></div>
            <div>ghost    <span className="bb-muted">→</span> bg <code>transparent</code> · border <code>--wf-border-strong</code></div>
            <div>:hover   <span className="bb-muted">→</span> invert (bg = --wf-fg, color = --wf-bg) — і primary, і ghost</div>
            <div>disabled <span className="bb-muted">→</span> <code>opacity: 0.5; pointer-events: none</code></div>
          </div>

          <BBH3>Markup</BBH3>
          <Code lang="html">{`<button class="wf-tm-btn wf-tm-btn--primary">[ Обговорити проєкт → ]</button>
<button class="wf-tm-btn">[ Подивитись роботи ]</button>
<button class="wf-tm-btn wf-tm-btn--sm">[ ls work ]</button>
<a class="wf-tm-portal-btn"><svg/* lock 13×13 *//><span>Мій кабінет</span></a>`}</Code>

          <BBH3>Copy patterns</BBH3>
          <div className="bb-prose bb-mono">
            <div>action <span className="bb-muted">→</span> <code>[ Обговорити проєкт → ]</code></div>
            <div>nav    <span className="bb-muted">→</span> <code>[ work ]</code></div>
            <div>shell  <span className="bb-muted">→</span> <code>[ $ contact --book ]</code></div>
            <div>file   <span className="bb-muted">→</span> <code>[ cat ~/work/example.md ]</code></div>
          </div>
        </BBSection>

    </React.Fragment>
  );
}

function BrandbookFoot() {
  return (
    <footer className="bb-foot">
      <span>workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space brandbook</span>
      <span className="bb-sep">·</span>
      <span>v2.0 · may 2026</span>
      <span className="bb-sep">·</span>
      <span>maintained by illia · vasulenkoillia@</span>
    </footer>
  );
}

function Brandbook({ theme = 'light' }) {
  const Extras = window.BrandbookSectionsB;
  return (
    <div className="bb-root wf-root wf-v-terminal-pro" data-theme={theme} data-accent="lime">
      <div className="bb-wrap">
        <BrandbookHero />
        <BrandbookSectionsA />
        {Extras ? <Extras /> : null}
        <BrandbookFoot />
      </div>
    </div>
  );
}

Object.assign(window, { Brandbook, BrandbookHero, BrandbookSectionsA, BrandbookFoot });
