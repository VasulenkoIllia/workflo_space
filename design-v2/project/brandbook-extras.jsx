// brandbook-extras.jsx — sections 14–21 of the workflo.space brandbook.
// Loaded after brandbook.jsx so it can use atoms from window.

const { BBSection, BBH3, BBProse, Swatch, Code, Token, CheatRow } = window;

function BrandbookSectionsB() {
  return (
    <React.Fragment>

      {/* 14 FORMS */}
      <BBSection num="14" id="bb-forms" title="Forms" sub="Inputs, textareas. Mono labels. Accent focus-ring.">
        <BBH3>Field anatomy</BBH3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 720 }}>
          <div className="wf-field">
            <label>name</label>
            <input placeholder="Ім'я" defaultValue="" />
          </div>
          <div className="wf-field">
            <label>email</label>
            <input placeholder="@" />
          </div>
          <div className="wf-field wf-field--wide" style={{ gridColumn: '1 / -1' }}>
            <label>brief</label>
            <textarea placeholder="Опиши задачу в 2-3 реченнях" rows={4} />
          </div>
        </div>

        <BBH3>Tokens</BBH3>
        <div className="bb-prose bb-mono">
          <div>label    <span className="bb-muted">→</span> mono · <code>11px</code> · upper · letter-spacing <code>0.04em</code> · color <code>--wf-fg-muted</code></div>
          <div>input bg <span className="bb-muted">→</span> <code>--wf-surface</code> · border <code>1px solid --wf-border</code> · radius <code>6px</code></div>
          <div>padding  <span className="bb-muted">→</span> <code>12px 14px</code> · font <code>15px</code> · color <code>--wf-fg</code></div>
          <div>:focus   <span className="bb-muted">→</span> border <code>--wf-accent</code> · ring <code>0 0 0 3px accent/22%</code></div>
          <div>::placeholder <span className="bb-muted">→</span> <code>--wf-fg-subtle</code></div>
        </div>

        <BBH3>Markup</BBH3>
        <Code lang="html">{`<div class="wf-form">
  <div class="wf-field">
    <label>name</label>
    <input type="text" placeholder="Ім'я" />
  </div>
  <div class="wf-field">
    <label>email</label>
    <input type="email" placeholder="@" />
  </div>
  <div class="wf-field wf-field--wide">
    <label>brief</label>
    <textarea rows="4" placeholder="..."></textarea>
  </div>
</div>`}</Code>

        <BBH3>Terminal-style input (in spotlight)</BBH3>
        <div style={{ display: 'flex', gap: 8, maxWidth: 540 }}>
          <input className="wf-tm-input" placeholder="email@" />
          <button className="wf-tm-btn wf-tm-btn--primary">[ → ]</button>
        </div>
      </BBSection>

      {/* 15 CHIPS & BADGES */}
      <BBSection num="15" id="bb-chips" title="Chips, Badges & Status" sub="Дрібні мітки. Розпізнавані з пів-погляду.">
        <BBH3>Stack chips · <code>.wf-tm-stack-chip</code></BBH3>
        <div className="bb-chip-row">
          <span className="wf-tm-stack-chip">TypeScript</span>
          <span className="wf-tm-stack-chip">Python</span>
          <span className="wf-tm-stack-chip">React</span>
          <span className="wf-tm-stack-chip">Postgres</span>
          <span className="wf-tm-stack-chip">Anthropic</span>
          <span className="wf-tm-stack-chip wf-tm-stack-chip--more">+4</span>
        </div>
        <BBProse>Mono · 12px · padding 5px 10px · радіус 4px · border-color <code>--wf-border</code>. На hover — border + color <code>--wf-accent</code>. Варіант <code>--more</code>: пунктирний border, muted color.</BBProse>

        <BBH3>Partner chip · <code>.wf-tm-case-partner-chip</code></BBH3>
        <div className="bb-chip-row">
          <span className="wf-tm-case-partner-chip">brunky</span>
          <span className="wf-tm-case-partner-chip">eduforge</span>
          <span className="wf-tm-case-partner-chip">trasa-logistics</span>
        </div>
        <BBProse>Pill (radius 999) · accent-tinted bg <code>accent 12%</code> · accent text. lowercase. Hover — solid accent fill.</BBProse>

        <BBH3>NDA badge · <code>.wf-tm-nda-badge</code></BBH3>
        <div className="bb-chip-row">
          <span className="wf-tm-nda-badge"><span className="wf-tm-nda-lock">▒</span> NDA</span>
          <span className="wf-tm-nda-badge"><span className="wf-tm-nda-lock">▒</span> CONFIDENTIAL</span>
        </div>

        <BBH3>Status dot · <code>.wf-tm-status-dot</code></BBH3>
        <div className="bb-chip-row">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
            <span className="wf-tm-status-dot" /> online · accepting projects
          </span>
        </div>
        <BBProse>8×8 коло, accent fill + halo 3px (30% accent). Анімація <code>wf-pulse-live 1.8s infinite</code>.</BBProse>

        <BBH3>Key-chip (keyboard shortcut) · <code>.wf-tm-key-chip</code></BBH3>
        <div className="bb-chip-row">
          <span className="wf-tm-key-chip">g</span>
          <span style={{ color: 'var(--wf-fg-subtle)', fontSize: 10 }}>then</span>
          <span className="wf-tm-key-chip">w</span>
          <span style={{ color: 'var(--wf-fg-secondary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>→ go to Work</span>
        </div>

        <BBH3>Industry pill (company)</BBH3>
        <div className="bb-chip-row">
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RETAIL · BAKERY</span>
        </div>
      </BBSection>

      {/* 16 CARDS */}
      <BBSection num="16" id="bb-cards" title="Cards" sub="1px border. 8px радіус. Без тіні. На hover — accent border + lift.">
        <BBH3>Case card · <code>.wf-tm-case-card</code></BBH3>
        <div style={{ maxWidth: 440 }}>
          <article className="wf-tm-case-card">
            <div className="wf-tm-case-card-top">
              <span className="wf-tm-case-partner-chip">brunky</span>
              <span className="wf-tm-case-card-meta">2025 · 4 weeks</span>
            </div>
            <h3 className="wf-tm-case-card-title">Retail · 1C → POS sync</h3>
            <div className="wf-tm-case-card-metric">
              <div className="wf-tm-case-card-metric-v">−87%</div>
              <div className="wf-tm-case-card-metric-l">ручної звірки в день</div>
            </div>
            <p className="wf-tm-case-card-context">Pекарня з 6 точок. Менеджер 6 годин/день звіряв залишки. Зробив 2-way sync 1C ↔ POS.</p>
            <ul className="wf-tm-case-card-others">
              <li><span className="wf-tm-case-plus">+</span> 15 хв замість 6 год / день</li>
              <li><span className="wf-tm-case-plus">+</span> 0 розсинхрону за 4 місяці</li>
            </ul>
            <div className="wf-tm-case-card-stack">
              <span className="wf-tm-stack-chip">Next.js</span>
              <span className="wf-tm-stack-chip">Postgres</span>
              <span className="wf-tm-stack-chip">1C-API</span>
              <span className="wf-tm-stack-chip wf-tm-stack-chip--more">+4</span>
            </div>
            <div className="wf-tm-case-card-readmore">
              <span>$ cat ~/work/retail-1c.md</span>
              <span className="wf-tm-case-card-readmore-arrow">→</span>
            </div>
          </article>
        </div>

        <BBH3>Anatomy</BBH3>
        <div className="bb-prose bb-mono">
          <div>top      <span className="bb-muted">→</span> partner-chip ← → meta (year · weeks)</div>
          <div>title    <span className="bb-muted">→</span> mono 20px · 600 · -0.015em</div>
          <div>metric   <span className="bb-muted">→</span> hero number 36px accent + label (left-bar 3px accent)</div>
          <div>context  <span className="bb-muted">→</span> Geist 13px secondary · 2-3 lines</div>
          <div>others   <span className="bb-muted">→</span> bg fg/2.5% · 12px · "+ ..." list</div>
          <div>stack    <span className="bb-muted">→</span> chip row + "+N" stub</div>
          <div>readmore <span className="bb-muted">→</span> shell command + arrow (inverts on hover)</div>
        </div>

        <BBH3>Markup</BBH3>
        <Code lang="html">{`<article class="wf-tm-case-card">
  <div class="wf-tm-case-card-top">
    <span class="wf-tm-case-partner-chip">brunky</span>
    <span class="wf-tm-case-card-meta">2025 · 4 weeks</span>
  </div>
  <h3 class="wf-tm-case-card-title">Retail · 1C → POS sync</h3>
  <div class="wf-tm-case-card-metric">
    <div class="wf-tm-case-card-metric-v">−87%</div>
    <div class="wf-tm-case-card-metric-l">ручної звірки в день</div>
  </div>
  <p class="wf-tm-case-card-context">...</p>
  <ul class="wf-tm-case-card-others">
    <li><span class="wf-tm-case-plus">+</span> ...</li>
  </ul>
  <div class="wf-tm-case-card-stack">
    <span class="wf-tm-stack-chip">Next.js</span>
    <span class="wf-tm-stack-chip wf-tm-stack-chip--more">+4</span>
  </div>
  <a class="wf-tm-case-card-readmore" href="...">
    <span>$ cat ~/work/retail-1c.md</span>
    <span class="wf-tm-case-card-readmore-arrow">→</span>
  </a>
</article>`}</Code>

        <BBH3>Partner card · <code>.wf-tm-partner-card</code></BBH3>
        <BBProse>Логотип 44×44 (color fill, white text) у верхньому лівому. Назва (20/600), industry (uppercase 12 muted), bio (Geist 13, 3 lines clamp), foot (size · projects · since · social).</BBProse>

        <BBH3>NDA card · <code>.wf-tm-nda-card</code></BBH3>
        <BBProse>Пунктирний border. Tag + NDA badge згори, name (16/600), summary (12 secondary), impacts list. Hover — solid border + lighter bg.</BBProse>

        <BBH3>Hover (всі картки)</BBH3>
        <Code lang="css">{`.wf-tm-*-card:hover {
  border-color: var(--wf-accent);
  transform: translateY(-2px);
  background: color-mix(in oklab, var(--wf-fg) 2%, var(--wf-bg));
  transition: border-color 0.15s, transform 0.15s, background 0.15s;
}`}</Code>
      </BBSection>

      {/* 17 METRICS */}
      <BBSection num="17" id="bb-metrics" title="Metrics & Stats" sub="Великі числа — це товар. Шрифт mono, accent колір, tnum.">
        <BBH3>Hero metric (in card)</BBH3>
        <div className="wf-tm-case-card-metric" style={{ maxWidth: 280 }}>
          <div className="wf-tm-case-card-metric-v">−87%</div>
          <div className="wf-tm-case-card-metric-l">ручної звірки в день</div>
        </div>

        <BBH3>4-col metrics grid · <code>.wf-tm-metrics-grid</code></BBH3>
        <div className="wf-tm-metrics-grid" style={{ marginBottom: 24 }}>
          <div className="wf-tm-metric-cell">
            <div className="wf-tm-metric-v">12</div>
            <div className="wf-tm-metric-l">проєктів</div>
          </div>
          <div className="wf-tm-metric-cell">
            <div className="wf-tm-metric-v">7</div>
            <div className="wf-tm-metric-l">компаній</div>
          </div>
          <div className="wf-tm-metric-cell">
            <div className="wf-tm-metric-v">4y</div>
            <div className="wf-tm-metric-l">досвіду</div>
          </div>
          <div className="wf-tm-metric-cell">
            <div className="wf-tm-metric-v">100%</div>
            <div className="wf-tm-metric-l">on time</div>
          </div>
        </div>

        <BBH3>TLDR bar · <code>.wf-tm-tldr</code></BBH3>
        <ul className="wf-tm-tldr" style={{ listStyle: 'none', padding: '16px 20px', margin: 0 }}>
          <li><div className="wf-tm-tldr-v">5d</div><div className="wf-tm-tldr-l">перший прототип</div></li>
          <li><div className="wf-tm-tldr-v">2w</div><div className="wf-tm-tldr-l">production-ready</div></li>
          <li><div className="wf-tm-tldr-v">30d</div><div className="wf-tm-tldr-l">support включено</div></li>
        </ul>

        <BBH3>Tokens</BBH3>
        <div className="bb-prose bb-mono">
          <Token name="hero metric"   value="mono · 36px · 600 · color accent · letter-spacing -0.03em · tnum" />
          <Token name="metric-cell-v" value="mono · 28px · 600 · accent · letter-spacing -0.02em" />
          <Token name="tldr-v"        value="mono · 22px · 600 · accent" />
          <Token name="metric label"  value="11–12px · muted · uppercase · letter-spacing 0.05em" />
        </div>
      </BBSection>

      {/* 18 EFFECTS */}
      <BBSection num="18" id="bb-effects" title="Effects" sub="CRT glow, scan-lines, vignette. Тогли в Tweaks.">
        <BBH3>Scan-lines</BBH3>
        <BBProse>Накладаються на <code>.wf-tm-wrap</code> через <code>background: repeating-linear-gradient</code>. Прозорі смужки 2px + темні 1px (fg/2.5%).</BBProse>
        <Code lang="css">{`.wf-tm-wrap {
  background: repeating-linear-gradient(to bottom,
    transparent 0,
    transparent 2px,
    color-mix(in oklab, var(--wf-fg) 2.5%, transparent) 2px,
    color-mix(in oklab, var(--wf-fg) 2.5%, transparent) 3px);
}`}</Code>

        <BBH3>CRT glow · <code>.wf-tm-glow</code> (additive)</BBH3>
        <BBProse>
          Додаткова клас-обгортка вмикає phosphor-світіння на акцентному тексті, курсорі та бордері
          вікна. Прикладається разом з <code>.wf-v-terminal-pro</code>.
        </BBProse>
        <Code lang="css">{`.wf-v-terminal-pro.wf-tm-glow .wf-tm-window {
  box-shadow:
    0 0 0 1px color-mix(in oklab, var(--wf-accent) 24%, transparent),
    0 0 24px color-mix(in oklab, var(--wf-accent) 14%, transparent),
    0 12px 40px color-mix(in oklab, var(--wf-fg) 12%, transparent);
}
.wf-v-terminal-pro.wf-tm-glow .wf-tm-cursor {
  box-shadow:
    0 0 6px var(--wf-accent),
    0 0 12px color-mix(in oklab, var(--wf-accent) 60%, transparent);
}
.wf-v-terminal-pro.wf-tm-glow .wf-tm-user,
.wf-v-terminal-pro.wf-tm-glow .wf-tm-cwd,
.wf-v-terminal-pro.wf-tm-glow .wf-tm-case-star {
  text-shadow:
    0 0 4px color-mix(in oklab, var(--wf-accent) 70%, transparent),
    0 0 12px color-mix(in oklab, var(--wf-accent) 30%, transparent);
}`}</Code>

        <BBH3>CRT vignette</BBH3>
        <BBProse>Radial-gradient overlay через <code>::after</code> на .wf-tm-window. Затемнює кути на ~18% (light) / ~50% (dark).</BBProse>

        <BBH3>Dot-grid / line-grid (variation backgrounds)</BBH3>
        <Code lang="css">{`.wf-bg-dots {
  background-image: radial-gradient(circle,
    color-mix(in oklab, var(--wf-fg-muted) 35%, transparent) 1px,
    transparent 1px);
  background-size: 24px 24px;
}
.wf-bg-lines {
  background-image:
    linear-gradient(to right, var(--wf-border) 1px, transparent 1px),
    linear-gradient(to bottom, var(--wf-border) 1px, transparent 1px);
  background-size: 80px 80px;
}`}</Code>
      </BBSection>

      {/* 19 PAGE TEMPLATES */}
      <BBSection num="19" id="bb-templates" title="Page Templates" sub="4 шаблони. Кожен — однакова обгортка, різний body.">
        <BBH3>A · Landing (home)</BBH3>
        <BBProse>Послідовність секцій:</BBProse>
        <ol className="bb-recipes">
          <li><code>identity card</code> — neofetch-style: SVG cat + key/value rows</li>
          <li><code>live-cmd</code> — typewriter strip "$ what-im-doing-now"</li>
          <li><code>hero</code> — typed h1 + sub + CTAs + portrait</li>
          <li><code>currently</code> — in_progress/planned/done table</li>
          <li><code>partners</code> — 2-col cards (ls ~/partners)</li>
          <li><code>work</code> — case cards 2-col + NDA list (git log)</li>
          <li><code>scale</code> — 6-col stats grid</li>
          <li><code>services</code> — ls-la list (4 services)</li>
          <li><code>process</code> — ASCII pipeline + 5 steps</li>
          <li><code>spotlight</code> — markdown card (current focus)</li>
          <li><code>about</code> — whoami + cat profile.md</li>
          <li><code>contact</code> — interactive form</li>
          <li><code>EOF</code> — empty prompt + blinking cursor</li>
        </ol>

        <BBH3>B · Project page (/work/&lt;slug&gt;)</BBH3>
        <ol className="bb-recipes">
          <li>Breadcrumb <code>~/work/&lt;slug&gt;</code></li>
          <li>Project hero — H1 + summary + key metric</li>
          <li>Meta strip — 3-col (year · weeks · partner)</li>
          <li>TLDR — 3-col metric bullets</li>
          <li>Problem / Solution — prose</li>
          <li>Approach timeline — 4 weeks</li>
          <li>Before / After — left-bar accent</li>
          <li>Metrics — 4-col grid</li>
          <li>Stack chips</li>
          <li>Testimonial</li>
          <li>Related projects (2-3)</li>
          <li>Page CTAs</li>
        </ol>

        <BBH3>C · Company page (/companies/&lt;slug&gt;)</BBH3>
        <ol className="bb-recipes">
          <li>Breadcrumb <code>~/companies/&lt;slug&gt;</code></li>
          <li>Company hero — logo + name + industry + 4-stat strip</li>
          <li>Description (prose 720px)</li>
          <li>Projects together — case cards</li>
          <li>Socials — 5-col rows (icon · kind · arrow · label · ext)</li>
          <li>Page CTAs</li>
        </ol>

        <BBH3>D · 404</BBH3>
        <ol className="bb-recipes">
          <li>Red <code>--err.404</code> message</li>
          <li>ASCII cat (404 variant)</li>
          <li>"yet" headline (underlined accent)</li>
          <li>Suggestion links (4-5 paths)</li>
          <li>CTAs: home / contact</li>
          <li>EOF prompt</li>
        </ol>

        <BBH3>Common structure (all pages)</BBH3>
        <Code lang="text">{`wf-root.wf-v-terminal-pro [data-theme] [data-accent]
└─ wf-tm-wrap (scan-lines bg)
   └─ wf-tm-window
      ├─ wf-tm-titlebar (traffic + title)
      ├─ wf-tm-page-crumb (project/company only)
      ├─ wf-tm-nav (links + portal + cta)
      ├─ wf-tm-body
      │   └─ sections separated by wf-tm-divider-line
      └─ wf-tm-statusbar (branch + clock + locale)`}</Code>
      </BBSection>

      {/* 20 VOICE */}
      <BBSection num="20" id="bb-voice" title="Voice & Tone" sub="Конкретно. Метрики цифрами. CTA — shell-команди.">
        <div className="bb-voice-grid">
          <div className="bb-voice-col">
            <div className="bb-voice-h">do</div>
            <ul className="bb-voice-list">
              <li>"Я Ілля. Будую автоматизації для команд, що виросли з Excel."</li>
              <li>"6 годин/день на ручне підтвердження → 15 хвилин."</li>
              <li>"$ cat ~/work/retail-1c.md →"</li>
              <li>"Перший прототип — через 5 днів."</li>
              <li>"Підтримка перший місяць включена. Sentry 24/7."</li>
              <li>"12 проєктів. 7 компаній. 4 роки."</li>
            </ul>
          </div>
          <div className="bb-voice-col bb-voice-dont">
            <div className="bb-voice-h">don't</div>
            <ul className="bb-voice-list">
              <li>"Інноваційне рішення для трансформації бізнесу 🚀"</li>
              <li>"Synergize your workflow today!"</li>
              <li>"Кожен бот — це 100% успіх ✨"</li>
              <li>"Зробимо ваш бізнес ефективнішим в рази!"</li>
              <li>"Революційний AI-агент нового покоління"</li>
              <li>"Best-in-class enterprise solution"</li>
            </ul>
          </div>
        </div>
        <BBH3>Tone parameters</BBH3>
        <div className="bb-prose bb-mono">
          <Token name="formality" value="ти-форма · перша особа · short sentences" />
          <Token name="numbers"   value="завжди конкретні (6 год → 15 хв · 12 проєктів)" />
          <Token name="verbs"     value="ship · build · sync · automate · own · run" />
          <Token name="avoid"     value="empower · transform · revolutionize · synergize · leverage" />
          <Token name="bilingual" value="UA primary · EN — code, commands, tech terms · перемикач у nav" />
        </div>
      </BBSection>

      {/* 21 CHEATSHEET */}
      <BBSection num="21" id="bb-cheat" title="CSS Class Cheatsheet" sub="Швидкий пошук — який клас за що відповідає.">
        <BBH3>Root & layout</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="wf-root" what="root scope · CSS variables" />
          <CheatRow cls="wf-v-terminal-pro" what="terminal variant activator" />
          <CheatRow cls="wf-tm-wrap" what="outer scan-lines wrapper" />
          <CheatRow cls="wf-tm-window" what="macOS-style window chrome" />
          <CheatRow cls="wf-tm-titlebar" what="window top bar (traffic + title)" />
          <CheatRow cls="wf-tm-statusbar" what="window bottom bar (branch + clock)" />
          <CheatRow cls="wf-tm-body" what="window content area" />
          <CheatRow cls="wf-tm-section" what="content section (padding 24px 0 32px)" />
          <CheatRow cls="wf-tm-page-crumb" what="breadcrumb (project/company pages)" />
        </div>

        <BBH3>Nav</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="wf-tm-nav" what="in-window navigation row" />
          <CheatRow cls="wf-tm-nav-left" what="brand + links cluster" />
          <CheatRow cls="wf-tm-nav-links" what="link container with hover arrow" />
          <CheatRow cls="wf-tm-portal-btn" what="ghost portal button with lock icon" />
        </div>

        <BBH3>Type & headings</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="wf-tm-h1" what="hero H1 — typed prompt-style ('> ...')" />
          <CheatRow cls="wf-tm-page-h1" what="project / company page H1 (32px)" />
          <CheatRow cls="wf-tm-md-h1" what="markdown-style H1 (22px) inside spotlight" />
          <CheatRow cls="wf-tm-md-h2" what="markdown-style H2 (13px muted)" />
          <CheatRow cls="wf-tm-prose" what="Geist body wrapper (max-width 720px)" />
          <CheatRow cls="wf-tm-prose-p" what="prose paragraph (15px secondary, 1.7)" />
        </div>

        <BBH3>Prompt & terminal atoms</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="wf-tm-prompt" what="prompt line container" />
          <CheatRow cls="wf-tm-user / -host / -cwd" what="prompt parts (accent / fg / accent)" />
          <CheatRow cls="wf-tm-sigil" what="$ glyph (fg, bold)" />
          <CheatRow cls="wf-tm-cmd" what="command text (fg)" />
          <CheatRow cls="wf-tm-cursor" what="blinking accent block" />
          <CheatRow cls="wf-tm-divider-line" what="section divider; data-section='name'" />
          <CheatRow cls="wf-tm-section-intro" what="'// optional one-liner' under divider" />
        </div>

        <BBH3>Buttons & inputs</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="wf-tm-btn" what="default button [ bracket ]" />
          <CheatRow cls="wf-tm-btn--primary" what="lime fill + fg text" />
          <CheatRow cls="wf-tm-btn--sm / --big" what="size modifiers" />
          <CheatRow cls="wf-tm-input" what="terminal input (mono, accent focus)" />
          <CheatRow cls="wf-field" what="form field group (label + input)" />
          <CheatRow cls="wf-form" what="2-col form grid" />
        </div>

        <BBH3>Chips & status</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="wf-tm-stack-chip" what="tech chip (mono 12px, border)" />
          <CheatRow cls="wf-tm-stack-chip--more" what="dashed '+N' chip" />
          <CheatRow cls="wf-tm-case-partner-chip" what="partner pill (accent tint)" />
          <CheatRow cls="wf-tm-nda-badge" what="NDA / confidential badge" />
          <CheatRow cls="wf-tm-status-dot" what="pulsing live dot" />
          <CheatRow cls="wf-tm-key-chip" what="keyboard key badge" />
        </div>

        <BBH3>Cards</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="wf-tm-case-card (+ .top / -title / -metric / -context / -others / -stack / -readmore)" what="2-col case card with hero metric" />
          <CheatRow cls="wf-tm-partner-card (+ -top / -body / -name / -industry / -bio / -foot)" what="2-col partner card with 44×44 logo" />
          <CheatRow cls="wf-tm-nda-card (+ -top / -name / -summary / -impacts)" what="dashed-border anonymous case" />
          <CheatRow cls="wf-tm-project-hero / .wf-tm-company-hero" what="page-top hero blocks" />
          <CheatRow cls="wf-tm-neo (+ -info / -row / -k / -v)" what="neofetch identity card on landing" />
        </div>

        <BBH3>Metrics & data</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="wf-tm-metrics-grid / -metric-cell" what="4-col stats grid (1px border bg)" />
          <CheatRow cls="wf-tm-scale-grid / -scale-cell" what="6-col stats grid (homepage)" />
          <CheatRow cls="wf-tm-tldr / -tldr-v / -tldr-l" what="3-col tldr bullet bar" />
          <CheatRow cls="wf-tm-meta-strip / -meta-cell" what="3-col compact key/value strip" />
          <CheatRow cls="wf-tm-currently-* " what="in_progress / planned / done row" />
          <CheatRow cls="wf-tm-approach / -row" what="project approach timeline" />
          <CheatRow cls="wf-tm-beforeafter" what="before/after block (accent left-bar)" />
          <CheatRow cls="wf-tm-testimonial" what="quote block with prefix" />
        </div>

        <BBH3>Effects</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="wf-tm-glow" what="CRT phosphor glow (additive)" />
          <CheatRow cls="wf-bg-dots / wf-bg-lines" what="dot or grid bg helpers" />
        </div>

        <BBH3>Brandbook itself</BBH3>
        <div className="bb-cheats">
          <CheatRow cls="bb-root / bb-wrap" what="brandbook page scope" />
          <CheatRow cls="bb-hero / bb-toc" what="brandbook hero + TOC" />
          <CheatRow cls="bb-section / bb-secthead / bb-sectbody" what="brandbook section anatomy" />
          <CheatRow cls="bb-swatch / bb-typerow / bb-spacingrow / bb-shadowrow" what="catalog rows" />
          <CheatRow cls="bb-code / bb-prose / bb-mono / bb-cheat-row" what="docs primitives" />
        </div>

        <BBH3>Data attributes</BBH3>
        <div className="bb-prose bb-mono">
          <div><code>data-theme="light|dark"</code> <span className="bb-muted">→</span> theme switch on <code>.wf-root</code></div>
          <div><code>data-accent="lime|amber|green|cyan|magenta|orange"</code> <span className="bb-muted">→</span> accent preset</div>
          <div><code>data-section="name"</code> <span className="bb-muted">→</span> on <code>.wf-tm-divider-line</code> — adds <code># name</code> tag</div>
          <div><code>data-on="true|false"</code> <span className="bb-muted">→</span> active state for toggle buttons</div>
        </div>
      </BBSection>

    </React.Fragment>
  );
}

Object.assign(window, { BrandbookSectionsB });
