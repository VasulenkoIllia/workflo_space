// app.jsx — single Terminal artboard + color-scheme picker on canvas + tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "lang": "ua",
  "theme": "light",
  "wordmark": "bracket",
  "h1Variant": 0,
  "accent": "lime",
  "crtGlow": false
}/*EDITMODE-END*/;

// ─────────── Curated color schemes ───────────
// Each is a bundle: theme + accent + glow. Click a preview → applies all 3.
const COLOR_SCHEMES = [
  { id: 'default-light',   name: 'Default Light',  sub: 'Brand · Lime',         theme: 'light', accent: 'lime',    glow: false },
  { id: 'default-dark',    name: 'Default Dark',   sub: 'Brand · Lime · Dark',  theme: 'dark',  accent: 'lime',    glow: false },
  { id: 'lime-glow',       name: 'Lime Glow',      sub: 'CRT lime · phosphor',  theme: 'dark',  accent: 'lime',    glow: true  },
  { id: 'amber-crt',       name: 'Amber CRT',      sub: 'VT100 vibes',          theme: 'dark',  accent: 'amber',   glow: true  },
  { id: 'amber-light',     name: 'Amber Day',      sub: 'Warm coffee',          theme: 'light', accent: 'amber',   glow: false },
  { id: 'phosphor-green',  name: 'Phosphor Green', sub: 'Apple ][ green',       theme: 'dark',  accent: 'green',   glow: true  },
  { id: 'cyan-bsd',        name: 'Cyan BSD',       sub: 'Plan9 daylight',       theme: 'light', accent: 'cyan',    glow: false },
  { id: 'cyan-dark',       name: 'Cyan Deep',      sub: 'IRC night',            theme: 'dark',  accent: 'cyan',    glow: true  },
  { id: 'synthwave',       name: 'Synthwave',      sub: 'Magenta night',        theme: 'dark',  accent: 'magenta', glow: true  },
  { id: 'sunset',          name: 'Sunset',         sub: 'Light · orange',       theme: 'light', accent: 'orange',  glow: false },
];

// ─────────── Mini-terminal preview tile ───────────
function MiniTerminalPreview({ scheme }) {
  const preset = ACCENT_PRESETS[scheme.accent] || ACCENT_PRESETS.lime;
  const accentColor = scheme.theme === 'dark' ? preset.dark : preset.light;
  const accentBg = preset.dark;
  const accentSoft = scheme.theme === 'dark' ? preset.softDark : preset.soft;
  const bg = scheme.theme === 'dark' ? '#0A0A0A' : '#FAFAF9';

  return (
    <div
      className={`wf-root wf-v-terminal-pro${scheme.glow ? ' wf-tm-glow' : ''}`}
      data-theme={scheme.theme}
      data-accent={scheme.accent}
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        '--wf-accent': accentColor,
        '--wf-accent-bg': accentBg,
        '--wf-accent-soft': accentSoft,
      }}
    >
      <div className="wf-tm-wrap" style={{ padding: 14, minHeight: 0 }}>
        <div className="wf-tm-window" style={{ height: '100%' }}>
          {/* mini titlebar */}
          <div className="wf-tm-titlebar" style={{ padding: '8px 12px' }}>
            <div className="wf-tm-traffic">
              <span className="wf-tm-traffic-dot" style={{ width: 8, height: 8 }} />
              <span className="wf-tm-traffic-dot" style={{ width: 8, height: 8 }} />
              <span className="wf-tm-traffic-dot" style={{ width: 8, height: 8 }} />
            </div>
            <div className="wf-tm-titlebar-title" style={{ fontSize: 10 }}>~ — bash</div>
            <div />
          </div>
          {/* mini body */}
          <div className="wf-tm-body" style={{ padding: '14px 18px', fontSize: 11, lineHeight: 1.55, flex: 1 }}>
            <div className="wf-tm-prompt" style={{ fontSize: 11 }}>
              <span className="wf-tm-user">illia</span>
              <span className="wf-tm-at">@</span>
              <span className="wf-tm-host">workflo</span>
              <span className="wf-tm-sigil" style={{ margin: '0 6px 0 4px' }}>$</span>
              <span className="wf-tm-cmd">./hello.sh</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--wf-fg)', marginTop: 10, lineHeight: 1.3 }}>
              <div style={{ display: 'block' }}>
                <span style={{ color: 'var(--wf-accent)', fontWeight: 500 }}>{'> '}</span>
                <span>Я Ілля.</span>
              </div>
              <div style={{ display: 'block' }}>
                <span style={{ color: 'var(--wf-accent)', fontWeight: 500 }}>{'> '}</span>
                <span>Будую автоматизації.</span>
                <span className="wf-tm-cursor" style={{ width: '0.45em', height: '0.9em', marginLeft: 3 }} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 6 }}>
              // Lutsk · Ukraine
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <span className="wf-tm-btn wf-tm-btn--primary" style={{ padding: '4px 8px', fontSize: 10 }}>[ start → ]</span>
              <span className="wf-tm-btn" style={{ padding: '4px 8px', fontSize: 10 }}>[ work ]</span>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 9, color: 'var(--wf-fg-muted)',
              borderLeft: '2px solid var(--wf-border)', paddingLeft: 8,
              marginTop: 12,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--wf-accent)',
                boxShadow: '0 0 0 2px color-mix(in oklab, var(--wf-accent) 30%, transparent)',
              }} />
              <span>// зараз: writing case study · 12m ago</span>
            </div>
          </div>
          {/* mini status bar */}
          <div className="wf-tm-statusbar" style={{ padding: '5px 12px', fontSize: 9 }}>
            <div className="wf-tm-statusbar-left">
              <span className="wf-tm-sb-branch">
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--wf-accent)',
                }} />
                main
              </span>
            </div>
            <div className="wf-tm-statusbar-right">
              <span>{preset.name} · {scheme.theme}{scheme.glow ? ' · glow' : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── Tweaks panel ───────────
function WfTweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Content" />
      <TweakRadio
        label="Мова"
        value={tweaks.lang}
        options={['ua', 'en']}
        onChange={(v) => setTweak('lang', v)}
      />
      <TweakRadio
        label="Theme"
        value={tweaks.theme}
        options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        onChange={(v) => setTweak('theme', v)}
      />
      <TweakSelect
        label="H1 варіант"
        value={tweaks.h1Variant}
        options={[
          { value: 0, label: 'A · «що виросли з Excel»' },
          { value: 1, label: 'B · «що команда робить руками»' },
          { value: 2, label: 'C · «менше клацань»' },
        ]}
        onChange={(v) => setTweak('h1Variant', Number(v))}
      />
      <TweakSection label="Color" />
      <TweakSelect
        label="Accent"
        value={tweaks.accent}
        options={[
          { value: 'lime',    label: '● Lime · default' },
          { value: 'amber',   label: '● Amber CRT' },
          { value: 'green',   label: '● Phosphor green' },
          { value: 'cyan',    label: '● Cyan' },
          { value: 'magenta', label: '● Magenta' },
          { value: 'orange',  label: '● Orange' },
        ]}
        onChange={(v) => setTweak('accent', v)}
      />
      <TweakToggle
        label="CRT glow"
        value={tweaks.crtGlow}
        onChange={(v) => setTweak('crtGlow', v)}
      />
      <TweakSection label="Branding" />
      <TweakSelect
        label="Wordmark"
        value={tweaks.wordmark}
        options={WORDMARK_LIST.map((w) => ({ value: w.value, label: `${w.label} · ${w.sub}` }))}
        onChange={(v) => setTweak('wordmark', v)}
      />
    </TweaksPanel>
  );
}

const ARTBOARD_W = 1200;
const ARTBOARD_H = 6400;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const applyScheme = (s) => {
    setTweak({ theme: s.theme, accent: s.accent, crtGlow: s.glow });
  };
  const isActiveScheme = (s) =>
    tweaks.theme === s.theme && tweaks.accent === s.accent && !!tweaks.crtGlow === s.glow;

  return (
    <div className="wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ minHeight: '100vh' }}>
      <EcoNav active="landing" theme={tweaks.theme} accent={tweaks.accent} localTabs={[]} />
      <DesignCanvas>
        <DCSection
          id="landings"
          title="01 · Головна сторінка"
          subtitle="Вибрана схема застосована до повного лендингу. Tweaks внизу праворуч — додаткова тонка настройка."
        >
          <DCArtboard
            id="terminal"
            label="C · Terminal · mono-heavy · scan-lines · ASCII"
            width={ARTBOARD_W}
            height={ARTBOARD_H}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <TerminalLanding
              initLang={tweaks.lang}
              initTheme={tweaks.theme}
              wordmark={tweaks.wordmark}
              h1Variant={tweaks.h1Variant}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
        </DCSection>

        <DCSection
          id="site-pages"
          title="02 · Сторінки сайту"
          subtitle="Публічні сторінки в порядку навігації: Блог (список → порожній стан → стаття), Тарифи, Умови, Конфіденційність. Той самий термінальний chrome; light/dark + UA/EN керуються Tweaks. Фільтри, перемикач валюти й FAQ — клікабельні."
        >
          <DCArtboard id="services-index" label="/services · каталог послуг" width={1100} height={1400} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <ServicesIndex initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="service-detail" label="/services/:slug · послуга · проблема + deliverables + стек" width={1100} height={1700} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <ServicePage slug="integrations" initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="blog-index" label="/blog · список статей + фільтр за тегом" width={1100} height={2200} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <BlogIndex initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="blog-empty" label="/blog · порожній стан (тег без статей)" width={1100} height={860} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <BlogIndex initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} forceEmpty />
          </DCArtboard>
          <DCArtboard id="blog-article" label="/blog/:slug · стаття · TOC + long-read" width={1100} height={3200} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <BlogArticle slug="excel-to-crm-without-pain" initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="cases-index" label="/cases · кейси з результатами (grid)" width={1100} height={1500} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <CaseIndex initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="case-detail" label="/cases/:slug · кейс · метрики + факти + long-read" width={1100} height={2600} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <CasePage slug="brunky-crm-1c" initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="pricing" label="/pricing · тарифи + порівняння + FAQ" width={1100} height={2400} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <PricingPage initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="legal-terms" label="/terms · умови надання послуг" width={1100} height={2000} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <LegalPage kind="terms" initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="legal-privacy" label="/privacy · політика конфіденційності" width={1100} height={1850} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <LegalPage kind="privacy" initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="legal-cookies" label="/legal/cookies · політика cookie" width={1100} height={1500} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <LegalPage kind="cookies" initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="about" label="/about · команда + принципи" width={1100} height={1900} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <AboutPage initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="contact" label="/contact · форма + канали" width={1100} height={1500} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <ContactPage initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="error-500" label="/500 · внутрішня помилка" width={1100} height={760} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <Error500 initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="book" label="/book/illia · публічний запис (Phase-2) — вибір слоту" width={1100} height={1280} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <BookingPage initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="book-confirmed" label="/book/illia · підтверджено" width={1100} height={840} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <BookingPage initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} confirmed />
          </DCArtboard>
        </DCSection>

        <DCSection
          id="pages"
          title="03 · Кейси та компанії"
        >
          <DCArtboard
            id="project-retail-1c"
            label="/work/retail-1c-integration · Brunky"
            width={1100}
            height={3400}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <ProjectPage
              slug="retail-1c-integration"
              initLang={tweaks.lang}
              theme={tweaks.theme}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard
            id="project-ai-support"
            label="/work/ai-support-agent · EduForge"
            width={1100}
            height={3400}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <ProjectPage
              slug="ai-support-agent"
              initLang={tweaks.lang}
              theme={tweaks.theme}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard
            id="company-brunky"
            label="/companies/brunky"
            width={1100}
            height={2400}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <CompanyPage
              slug="brunky"
              initLang={tweaks.lang}
              theme={tweaks.theme}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard
            id="company-trasa"
            label="/companies/trasa-logistics"
            width={1100}
            height={2200}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <CompanyPage
              slug="trasa-logistics"
              initLang={tweaks.lang}
              theme={tweaks.theme}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard
            id="company-eduforge"
            label="/companies/eduforge"
            width={1100}
            height={2200}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <CompanyPage slug="eduforge" initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard
            id="company-nordstream"
            label="/companies/nordstream"
            width={1100}
            height={2400}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <CompanyPage slug="nordstream" initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard
            id="company-tably"
            label="/companies/tably"
            width={1100}
            height={2200}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <CompanyPage slug="tably" initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
        </DCSection>

        <DCSection
          id="responsive"
          title="04 · Адаптив · phone + tablet"
          subtitle="Той самий контент і компоненти — рендер через container queries. Phone 375px, tablet 768px. Колірна схема та tweaks з нижнього блоку синхронізовані."
        >
          <DCArtboard
            id="terminal-phone"
            label="iPhone · Terminal landing · 375px"
            width={375}
            height={5400}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <TerminalLanding
              initLang={tweaks.lang}
              initTheme={tweaks.theme}
              wordmark={tweaks.wordmark}
              h1Variant={tweaks.h1Variant}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard
            id="terminal-tablet"
            label="iPad · Terminal landing · 768px"
            width={768}
            height={5400}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <TerminalLanding
              initLang={tweaks.lang}
              initTheme={tweaks.theme}
              wordmark={tweaks.wordmark}
              h1Variant={tweaks.h1Variant}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard
            id="project-phone"
            label="iPhone · Project page · 375px"
            width={375}
            height={3000}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <ProjectPage
              slug="retail-1c-integration"
              initLang={tweaks.lang}
              theme={tweaks.theme}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard
            id="project-tablet"
            label="iPad · Project page · 768px"
            width={768}
            height={3000}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <ProjectPage
              slug="retail-1c-integration"
              initLang={tweaks.lang}
              theme={tweaks.theme}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard
            id="company-phone"
            label="iPhone · Company page · 375px"
            width={375}
            height={2400}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <CompanyPage
              slug="brunky"
              initLang={tweaks.lang}
              theme={tweaks.theme}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard
            id="404-phone"
            label="iPhone · 404 · 375px"
            width={375}
            height={780}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <Terminal404
              initLang={tweaks.lang}
              theme={tweaks.theme}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
          <DCArtboard id="blog-phone" label="iPhone · Blog index · 375px" width={375} height={2400} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <BlogIndex initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
          <DCArtboard id="pricing-phone" label="iPhone · Pricing · 375px" width={375} height={2700} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <PricingPage initLang={tweaks.lang} theme={tweaks.theme} accent={tweaks.accent} crtGlow={tweaks.crtGlow} />
          </DCArtboard>
        </DCSection>

        <DCSection
          id="extras"
          title="05 · Стани"
          subtitle="404 з ASCII-котом та підказками — використовує активну колірну схему згори."
        >
          <DCArtboard
            id="404"
            label="404 · page not found"
            width={900}
            height={620}
            style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
            <Terminal404
              initLang={tweaks.lang}
              theme={tweaks.theme}
              accent={tweaks.accent}
              crtGlow={tweaks.crtGlow}
            />
          </DCArtboard>
        </DCSection>

        <DCSection
          id="schemes"
          title="06 · Колірні схеми"
          subtitle="10 готових комбінацій theme + accent + glow. Клік на картку → застосовує до лендингу нижче. Активна підсвічена."
        >
          {COLOR_SCHEMES.map((s) => {
            const active = isActiveScheme(s);
            return (
              <DCArtboard
                key={s.id}
                id={`scheme-${s.id}`}
                label={`${s.name} · ${s.sub}`}
                width={360}
                height={290}
                style={{ background: s.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}
              >
                <div
                  onClick={() => applyScheme(s)}
                  style={{
                    height: '100%',
                    width: '100%',
                    cursor: 'pointer',
                    position: 'relative',
                    outline: active ? `2px solid ${ACCENT_PRESETS[s.accent].dark}` : '2px solid transparent',
                    outlineOffset: -2,
                    boxSizing: 'border-box',
                  }}
                >
                  <MiniTerminalPreview scheme={s} />
                  {active && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8, right: 8,
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                        fontSize: 10,
                        background: ACCENT_PRESETS[s.accent].dark,
                        color: '#0C0A09',
                        padding: '3px 8px',
                        borderRadius: 999,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        zIndex: 10,
                      }}
                    >
                      active
                    </div>
                  )}
                </div>
              </DCArtboard>
            );
          })}
        </DCSection>
      </DesignCanvas>
      <WfTweaks tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
