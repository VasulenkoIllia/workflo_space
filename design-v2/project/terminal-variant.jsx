// terminal-variant.jsx — fully-developed Terminal variation
// Wraps the entire landing in one large terminal window with a titlebar,
// command-prompt section dividers, git-log-style cases, ASCII process,
// and a bottom status bar. All content monospace, accent = lime/phosphor.

const { useState: _ts, useEffect: _te } = React;

// ─────── Typewriter hook ───────────────────────────────────
// Types each line of `lines` sequentially with per-char delay.
// Returns { visible: string[], activeLine: number, done: boolean }
// — visible[i] is what's currently revealed for line i.
function useTypewriter(lines, opts = {}) {
  const { charDelay = 32, lineDelay = 280, startDelay = 250 } = opts;
  const safeLines = (lines || []).filter((x) => x != null);
  const key = safeLines.join('||');
  const [progress, setProgress] = React.useState({ line: -1, char: 0 });

  // Reset when input lines change (lang / H1 variant switch)
  React.useEffect(() => {
    setProgress({ line: -1, char: 0 });
    const t = setTimeout(() => setProgress({ line: 0, char: 0 }), startDelay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, startDelay]);

  React.useEffect(() => {
    if (progress.line < 0 || progress.line >= safeLines.length) return;
    const curr = safeLines[progress.line] || '';
    if (progress.char < curr.length) {
      const t = setTimeout(() => setProgress((p) => ({ ...p, char: p.char + 1 })), charDelay);
      return () => clearTimeout(t);
    }
    if (progress.line < safeLines.length - 1) {
      const t = setTimeout(() => setProgress({ line: progress.line + 1, char: 0 }), lineDelay);
      return () => clearTimeout(t);
    }
    // last line complete — stay done
  }, [progress, key, charDelay, lineDelay]);

  const visible = safeLines.map((line, i) => {
    if (i < progress.line) return line;
    if (i === progress.line) return line.slice(0, progress.char);
    return '';
  });
  const done = progress.line >= safeLines.length - 1 && progress.char >= (safeLines[safeLines.length - 1] || '').length;
  return { visible, activeLine: progress.line, done };
}

// ─────── Accent color presets ──────────────────────────────
// Each preset has light + dark + soft variants used as CSS vars.
const ACCENT_PRESETS = {
  lime:    { name: 'Lime',       light: '#A3D90D', dark: '#C5F82A', soft: '#ECFCC4', softDark: '#3F4F0F' },
  amber:   { name: 'Amber CRT',  light: '#D97706', dark: '#FFB000', soft: '#FEF3C7', softDark: '#3F2A0F' },
  green:   { name: 'Phosphor',   light: '#16A34A', dark: '#4AFF52', soft: '#DCFCE7', softDark: '#0F3F1F' },
  cyan:    { name: 'Cyan',       light: '#0891B2', dark: '#00E5FF', soft: '#CFFAFE', softDark: '#0F3F4F' },
  magenta: { name: 'Magenta',    light: '#C026D3', dark: '#FF4DD4', soft: '#FAE8FF', softDark: '#4F0F3F' },
  orange:  { name: 'Orange',     light: '#EA580C', dark: '#FF6B35', soft: '#FED7AA', softDark: '#4F1F0F' },
};

// ─────── Real-time clock hook ──────────────────────────────
function useClock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtTime(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; }

// ─────── Boot Sequence (loading state) ─────────────────────
// Plays once on mount — shows mock progress bars before hero.
function BootSequence({ onDone, isUa }) {
  const lines = isUa
    ? [
      { p: 12, l: 'loading config from ~/.workflo' },
      { p: 38, l: 'fetching workflows...' },
      { p: 71, l: 'warming up agents · 12 integrations' },
      { p: 100, l: 'ready · 0 errors · 0 warnings ✓' },
    ]
    : [
      { p: 12, l: 'loading config from ~/.workflo' },
      { p: 38, l: 'fetching workflows...' },
      { p: 71, l: 'warming up agents · 12 integrations' },
      { p: 100, l: 'ready · 0 errors · 0 warnings ✓' },
    ];
  const [stage, setStage] = React.useState(0);
  React.useEffect(() => {
    if (stage > lines.length) { onDone && onDone(); return; }
    const delay = stage === 0 ? 150 : 280;
    const id = setTimeout(() => setStage((s) => s + 1), delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <div className="wf-tm-boot" aria-hidden="true">
      <TermPrompt cmd="./boot.sh" />
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

// ─────── Helpers ────────────────────────────────────────────

function TermPrompt({ user = 'illia', host = 'workflo', cwd = '~', cmd, lambda = '$' }) {
  return (
    <div className="wf-tm-prompt">
      <span className="wf-tm-user">{user}</span>
      <span className="wf-tm-at">@</span>
      <span className="wf-tm-host">{host}</span>
      <span className="wf-tm-colon">:</span>
      <span className="wf-tm-cwd">{cwd}</span>
      <span className="wf-tm-sigil">{lambda}</span>
      <span className="wf-tm-cmd">{cmd}</span>
    </div>
  );
}

function TermDivider({ section, cmd }) {
  return (
    <div className="wf-tm-divider">
      <div className="wf-tm-divider-line" data-section={section} />
      <TermPrompt cmd={cmd} />
    </div>
  );
}

function StatusDot({ accent }) {
  return (
    <span className="wf-tm-status-dot" style={{ background: accent }} />
  );
}

// ASCII art logo for hero — minimal, our cat sitting next to the wordmark.
const HERO_ASCII = `   /\\_/\\        workflo.space
  ( ●.o )       ────────────────
   > ^ <        automation · ai · integrations`;

// ─────── Section: Hero ──────────────────────────────────────

function TerminalHero({ t, h1Variant = 0, live }) {
  const h1 = (t.hero.h1_options[h1Variant] || t.hero.h1_options[0]).filter((s) => s);
  const tw = useTypewriter(h1, { charDelay: 34, lineDelay: 260, startDelay: 350 });
  return (
    <section className="wf-tm-section wf-tm-hero" data-screen-label="hero">
      <pre className="wf-tm-ascii-art" aria-hidden="true">{HERO_ASCII}</pre>
      <TermPrompt cmd="./hello.sh" />
      <div className="wf-tm-output">
          {/* H1 */}
          <h1 className="wf-tm-h1" aria-label={h1.join(' ')}>
            {h1.map((line, i) => {
              const visible = tw.visible[i] || '';
              const isActive = tw.activeLine === i && !tw.done;
              const isLastDone = tw.done && i === h1.length - 1;
              return (
                <span key={i} className="wf-tm-h1-line" aria-hidden={i === tw.activeLine ? 'false' : 'true'}>
                  <span className="wf-tm-h1-typed">{visible || ' '}</span>
                  {(isActive || isLastDone) && <span className="wf-tm-cursor" />}
                </span>
              );
            })}
          </h1>
          {typeof AsciiPortrait === 'function' && (
            <div className="wf-tm-hero-portrait-slot"><AsciiPortrait name="illia" /></div>
          )}
        <div className="wf-tm-sub">// {t.hero.sub}</div>
        <div className="wf-tm-ctas">
          <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">[ {t.cta_primary} → ]</a>
          <a className="wf-tm-btn" href="#sec-1">[ {t.cta_secondary} ]</a>
        </div>
        <div className="wf-tm-live">
          <StatusDot accent="var(--wf-accent)" />
          <span className="wf-tm-live-l">{t.live_label}</span>
          <span className="wf-tm-live-t">{live.text}</span>
          <span className="wf-tm-live-sep">·</span>
          <span className="wf-tm-live-a">{live.ago}</span>
        </div>
      </div>
    </section>
  );
}

// ─────── Section: Services (man-page / ls -la style) ────────

function TerminalServices({ t }) {
  return (
    <section className="wf-tm-section" id="services" data-screen-label="services">
      <TermDivider section="services" cmd="ls ~/services" />
      <div className="wf-tm-output">
        <div className="wf-tm-ls-head">total {t.services.items.length}</div>
        {t.services.items.map((it, i) => (
          <div key={i} className="wf-tm-service">
            <div className="wf-tm-service-row">
              <span className="wf-tm-service-perm">drwx</span>
              <span className="wf-tm-service-num">[{it.num}]</span>
              <span className="wf-tm-service-name">{it.name.toLowerCase().replace(/[ ·&]+/g, '-').replace(/[^\w\-]/g, '')}</span>
              <span className="wf-tm-service-title">— {it.name}</span>
            </div>
            <div className="wf-tm-service-line">
              <span className="wf-tm-key">desc</span>
              <span className="wf-tm-val">{it.line}</span>
            </div>
            <div className="wf-tm-service-line">
              <span className="wf-tm-key">examples</span>
              <span className="wf-tm-val">{it.examples}</span>
            </div>
            <div className="wf-tm-service-line">
              <span className="wf-tm-key">tools</span>
              <span className="wf-tm-val">{it.tools.map((tool, j) => (
                <React.Fragment key={j}>
                  {j > 0 && <span className="wf-tm-bullet"> · </span>}
                  <span className="wf-tm-tool">{tool}</span>
                </React.Fragment>
              ))}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────── Section: Cases (git log --oneline style) ───────────

function TerminalCases({ t }) {
  // Resolve company slug per project so the case head shows "partner/branch".
  const projectBySlug = (slug) => (window.WF_LOOKUPS && window.WF_LOOKUPS.projectBySlug(slug));
  return (
    <section className="wf-tm-section" id="work" data-screen-label="work">
      <TermDivider section="work" cmd="git log --by-partner --oneline" />
      <div className="wf-tm-output">
        <p className="wf-tm-section-intro">// {t.cases.items.length} public case studies · click a card to read full →</p>
        <div className="wf-tm-case-grid">
        {t.cases.items.map((c, i) => {
          const proj = c.slug && window.WF_LOOKUPS && window.WF_LOOKUPS.projectBySlug(c.slug);
          const companySlug = proj ? proj.company : (c.num === '05' ? 'workflo' : 'main');
          const projSlug = c.slug || (c.num === '05' ? 'workflo' : c.name.toLowerCase().replace(/[^\w]+/g, '-').slice(0, 36));
          const heroMetric = c.metrics[0] || '';
          const otherMetrics = c.metrics.slice(1);
          const arrowMatch = heroMetric.match(/^(.+?\s*→\s*\d+\S*)\s+(.+)$/);
          let heroV, heroL;
          if (arrowMatch) { heroV = arrowMatch[1]; heroL = arrowMatch[2]; }
          else {
            const sp = heroMetric.indexOf(' ');
            heroV = sp > 0 ? heroMetric.slice(0, sp) : heroMetric;
            heroL = sp > 0 ? heroMetric.slice(sp + 1) : '';
          }
          return (
            <article key={i} className="wf-tm-case-card">
              <div className="wf-tm-case-card-top">
                <a className="wf-tm-case-partner-chip" href={`#company-${companySlug}`}>{companySlug}</a>
                <span className="wf-tm-case-card-meta">{c.year} · {c.duration}</span>
              </div>
              <h3 className="wf-tm-case-card-title">{c.name}</h3>
              <div className="wf-tm-case-card-metric">
                <div className="wf-tm-case-card-metric-v">{heroV}</div>
                <div className="wf-tm-case-card-metric-l">{heroL}</div>
              </div>
              <p className="wf-tm-case-card-context">{c.context}</p>
              {otherMetrics.length > 0 && (
                <ul className="wf-tm-case-card-others">
                  {otherMetrics.map((m, j) => (
                    <li key={j}><span className="wf-tm-case-plus">+</span> {m}</li>
                  ))}
                </ul>
              )}
              <div className="wf-tm-case-card-stack">
                {c.stack.slice(0, 5).map((s, j) => (
                  <span key={j} className="wf-tm-stack-chip">{s}</span>
                ))}
                {c.stack.length > 5 && <span className="wf-tm-stack-chip wf-tm-stack-chip--more">+{c.stack.length - 5}</span>}
              </div>
              {proj ? (
                <a className="wf-tm-case-card-readmore" href={`#project-${proj.slug}`}>
                  <span>$ cat ~/work/{proj.slug}.md</span>
                  <span className="wf-tm-case-card-readmore-arrow">→</span>
                </a>
              ) : (
                <div className="wf-tm-case-card-readmore wf-tm-case-card-readmore--disabled">
                  <span>$ ./workflo --in-development</span>
                  <span className="wf-tm-case-card-readmore-arrow">●</span>
                </div>
              )}
            </article>
          );
        })}
        </div>
      </div>
    </section>
  );
}

// ─────── Section: Process (ASCII pipeline) ──────────────────

function TerminalProcess({ t }) {
  return (
    <section className="wf-tm-section" id="process" data-screen-label="process">
      <TermDivider section="process" cmd="man workflo-flow" />
      <div className="wf-tm-output">
        <pre className="wf-tm-pipeline" aria-hidden="true">
{t.process.items.map((s) => `[${s.num}]`).join(' ──→ ')}
        </pre>
        <div className="wf-tm-steps">
          {t.process.items.map((s, i) => (
            <div key={s.num} className="wf-tm-step">
              <div className="wf-tm-step-marker">
                <span className="wf-tm-step-num">[{s.num}]</span>
                {i < t.process.items.length - 1 && <span className="wf-tm-step-line">│</span>}
              </div>
              <div className="wf-tm-step-body">
                <div className="wf-tm-step-name">{s.name}</div>
                <div className="wf-tm-step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────── Section: Workflo Spotlight ─────────────────────────

function TerminalSpotlight({ t }) {
  const [email, setEmail] = _ts('');
  const [done, setDone] = _ts(false);
  return (
    <section className="wf-tm-section" id="spotlight" data-screen-label="spotlight">
      <TermDivider section="spotlight" cmd="cat workflo/README.md" />
      <div className="wf-tm-output">
        <div className="wf-tm-spotlight">
          <div className="wf-tm-spotlight-head">
            <h2 className="wf-tm-md-h1"># {t.spotlight.name}</h2>
            <div className="wf-tm-spotlight-status">
              <StatusDot accent="var(--wf-accent)" />
              <span>{t.spotlight.status}</span>
            </div>
          </div>
          <p className="wf-tm-md-body">{t.spotlight.desc}</p>
          <p className="wf-tm-md-body wf-tm-md-muted">{t.spotlight.market}</p>
          <div className="wf-tm-md-section">
            <div className="wf-tm-md-h2">## subscribe</div>
            <form className="wf-tm-spotlight-form" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
              <span className="wf-tm-sigil">$</span>
              <input
                className="wf-tm-input"
                type="email"
                placeholder={t.spotlight.cta_email_ph}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="wf-tm-btn wf-tm-btn--primary">[ {done ? 'subscribed ✓' : 'subscribe →'} ]</button>
            </form>
          </div>
          <div className="wf-tm-md-section">
            <div className="wf-tm-md-h2">## source</div>
            <a className="wf-tm-link" href="#">$ gh repo clone VasulenkoIllia/workflo →</a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────── Section: About (profile output) ────────────────────

function TerminalAbout({ t, isUa }) {
  const rows = t.about.label === '// who'
    ? [
      ['user',     'illia'],
      ['location', 'lutsk, ua'],
      ['since',    '2018'],
      ['focus',    isUa ? 'автоматизація для команд, що виросли з Excel' : 'automation for teams who outgrew Excel'],
      ['stack',    'TypeScript · Python · React · Postgres · LLMs'],
      ['status',   isUa ? 'available · приймаю проєкти Q3 2026' : 'available · taking projects Q3 2026'],
    ]
    : [];
  return (
    <section className="wf-tm-section" id="who" data-screen-label="who">
      <TermDivider section="who" cmd="whoami && cat ~/profile.md" />
      <div className="wf-tm-output">
        <div className="wf-tm-profile">
          {rows.map(([k, v]) => (
            <div key={k} className="wf-tm-profile-row">
              <span className="wf-tm-profile-key">{k}</span>
              <span className="wf-tm-profile-val">{v}</span>
            </div>
          ))}
        </div>
        <div className="wf-tm-md-section">
          <div className="wf-tm-md-h2">## why</div>
          <div className="wf-tm-about-body">
            {t.about.body.map((p, i) => {
              if (p === '') return <div key={i} style={{ height: 6 }} />;
              const isHeader = p.endsWith(':');
              const isEmph = p === 'Я роблю так, щоб цього не було.' || p === "I make sure that doesn't happen.";
              if (isHeader) return null; // labels integrated above
              return (
                <p key={i} className={isEmph ? 'wf-tm-emph' : ''}>
                  {isEmph && <span className="wf-tm-emph-prefix">{'>>>'}</span>}
                  {p}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────── Section: Contact ───────────────────────────────────

function TerminalContact({ t }) {
  const [form, setForm] = _ts({ name: '', contact: '', message: '' });
  const [sent, setSent] = _ts(false);
  return (
    <section className="wf-tm-section" id="contact" data-screen-label="contact">
      <TermDivider section="contact" cmd="contact --interactive" />
      <div className="wf-tm-output">
        <div className="wf-tm-contact-head">
          <div className="wf-tm-md-h1">{t.contact.h2}</div>
          <p className="wf-tm-md-body">// {t.contact.sub}</p>
        </div>
        <form className="wf-tm-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <div className="wf-tm-form-row">
            <label>name<span className="wf-tm-req">*</span></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="—" />
          </div>
          <div className="wf-tm-form-row">
            <label>contact<span className="wf-tm-req">*</span></label>
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="@tg / email" />
          </div>
          <div className="wf-tm-form-row wf-tm-form-row--block">
            <label>message<span className="wf-tm-req">*</span></label>
            <textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="—" />
          </div>
          <div className="wf-tm-form-row wf-tm-form-row--submit">
            <button type="submit" className="wf-tm-btn wf-tm-btn--primary wf-tm-btn--big">[ {sent ? 'sent ✓' : t.contact.send + ' →'} ]</button>
          </div>
        </form>
        <div className="wf-tm-channels-head"># {t.contact.or}</div>
        <div className="wf-tm-channels">
          {t.contact.channels.map((c) => (
            <div key={c.kind} className="wf-tm-channel">
              <span className="wf-tm-channel-kind">{c.kind.toLowerCase()}</span>
              <span className="wf-tm-channel-arrow">→</span>
              <span className="wf-tm-channel-value">{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────── Section: Partners (5 companies as ls -la rows) ──────
function TerminalPartners({ t, lang }) {
  const companies = window.WF_COMPANIES || [];
  const ua = lang === 'ua';
  const totalProjects = (window.WF_PROJECTS || []).length;
  return (
    <section className="wf-tm-section" id="partners" data-screen-label="partners">
      <TermDivider section="partners" cmd="ls -la ~/partners" />
      <div className="wf-tm-output">
        <p className="wf-tm-section-intro">// {companies.length} {ua ? 'партнерів' : 'partners'} · {totalProjects} {ua ? 'проєктів' : 'projects'} · {ua ? 'довгострокові партнерства' : 'long-term engagements'}</p>
        <div className="wf-tm-partner-grid">
          {companies.map((c, i) => {
            const industry = c.industry[lang] || c.industry.ua;
            const size = c.size[lang] || c.size.ua;
            const bio = (c.bio[lang] || c.bio.ua)[0];
            const projectsCount = (c.projects || []).length;
            return (
              <a key={c.slug} className="wf-tm-partner-card" href={`#company-${c.slug}`}>
                <div className="wf-tm-partner-card-top">
                  <div className="wf-tm-partner-logo-lg" style={{ background: c.accent }}>{c.logo_glyph}</div>
                  <span className="wf-tm-partner-card-arrow">↗</span>
                </div>
                <div className="wf-tm-partner-card-body">
                  <div className="wf-tm-partner-card-name">{c.name}</div>
                  <div className="wf-tm-partner-card-industry">{industry}</div>
                  <p className="wf-tm-partner-card-bio">{bio}</p>
                </div>
                <div className="wf-tm-partner-card-foot">
                  <span className="wf-tm-partner-card-stat"><span className="wf-tm-accent">{projectsCount}</span> {ua ? (projectsCount === 1 ? 'проєкт' : 'проєкти') : (projectsCount === 1 ? 'project' : 'projects')}</span>
                  <span className="wf-tm-sb-sep">·</span>
                  <span>since {c.since}</span>
                  <span className="wf-tm-sb-sep">·</span>
                  <span>{c.location}</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────── Section: Scale (stats + NDA list) ─────────────────
function TerminalScale({ t, lang }) {
  const s = t.scale;
  if (!s) return null;
  return (
    <section className="wf-tm-section" id="scale" data-screen-label="scale">
      <TermDivider section="scale" cmd="stats --all" />
      <div className="wf-tm-output">
        <p className="wf-tm-md-body" style={{ marginBottom: 16 }}>// {s.subtitle}</p>
        {/* Stats grid */}
        <div className="wf-tm-scale-grid">
          {s.stats.map((it, i) => (
            <div key={i} className="wf-tm-scale-cell">
              <div className="wf-tm-scale-v">{it.v}</div>
              <div className="wf-tm-scale-k">{it.k}</div>
            </div>
          ))}
        </div>
        {/* NDA list */}
        <div className="wf-tm-md-section">
          <div className="wf-tm-md-h2">{s.nda_head}</div>
          <p className="wf-tm-md-body" style={{ color: 'var(--wf-fg-muted)', fontSize: 12, marginBottom: 12 }}>// {s.nda_hint}</p>
          <div className="wf-tm-nda-grid">
            {s.nda.map((p, i) => (
              <div key={i} className="wf-tm-nda-card">
                <div className="wf-tm-nda-card-top">
                  <span className="wf-tm-nda-tag">[{p.tag}]</span>
                  <span className="wf-tm-nda-badge"><span className="wf-tm-nda-lock">▒</span> NDA</span>
                </div>
                <h4 className="wf-tm-nda-card-name">{p.name}</h4>
                <div className="wf-tm-nda-card-meta">{p.year} · {p.duration}</div>
                <p className="wf-tm-nda-card-summary">{p.summary}</p>
                <ul className="wf-tm-nda-card-impacts">
                  {p.impact.map((m, j) => (
                    <li key={j}><span className="wf-tm-case-plus">+</span> {m}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────── Section: Status bar (bottom of terminal window) ───────

function TerminalStatusBar({ t, lang, onLang, theme, onTheme, accent, soundOn, setSoundOn }) {
  const time = useClock();
  const preset = ACCENT_PRESETS[accent] || ACCENT_PRESETS.lime;
  return (
    <div className="wf-tm-statusbar">
      <div className="wf-tm-statusbar-left">
        <span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> main</span>
        <span className="wf-tm-sb-sep">·</span>
        <span>UTF-8</span>
        <span className="wf-tm-sb-sep">·</span>
        <span className="wf-tm-sb-clock">{fmtTime(time)}</span>
        <span className="wf-tm-sb-sep">·</span>
        <span>{preset.name.toLowerCase()}</span>
        {typeof VisitorCounter === 'function' && (
          <React.Fragment>
            <span className="wf-tm-sb-sep">·</span>
            <VisitorCounter isUa={lang === 'ua'} />
          </React.Fragment>
        )}
      </div>
      <div className="wf-tm-statusbar-right">
        {typeof SoundToggle === 'function' && setSoundOn && (
          <React.Fragment>
            <SoundToggle enabled={!!soundOn} onChange={setSoundOn} />
            <span className="wf-tm-sb-sep">·</span>
          </React.Fragment>
        )}
        <span className="wf-tm-sb-help" title="press ? for shortcuts">?</span>
        <span className="wf-tm-sb-sep">·</span>
        <div className="wf-tm-sb-toggle">
          <button data-on={lang === 'ua'} onClick={() => onLang('ua')}>ua</button>
          <span>/</span>
          <button data-on={lang === 'en'} onClick={() => onLang('en')}>en</button>
        </div>
        <span className="wf-tm-sb-sep">·</span>
        <div className="wf-tm-sb-toggle">
          <button data-on={theme === 'light'} onClick={() => onTheme('light')}>☀</button>
          <span>/</span>
          <button data-on={theme === 'dark'} onClick={() => onTheme('dark')}>☾</button>
        </div>
      </div>
    </div>
  );
}

// ─────── Nav (rendered inside the terminal titlebar area) ──

function TerminalNav({ t, lang, onLang, theme, onTheme, wordmark, catStyle }) {
  const hrefs = t.nav_hrefs || t.nav.map((_, i) => `#sec-${i}`);
  return (
    <header className="wf-tm-nav">
      <div className="wf-tm-nav-left">
        <a href="#top">
          <Wordmark style={wordmark} accent="var(--wf-accent)" color="var(--wf-fg)" size={18} catStyle={catStyle} />
        </a>
        <nav className="wf-tm-nav-links">
          {t.nav.map((n, i) => (
            <a key={i} href={hrefs[i]}>{n.toLowerCase()}</a>
          ))}
        </nav>
      </div>
      <div className="wf-tm-nav-right">
        <a className="wf-tm-btn wf-tm-portal-btn" href="https://app.workflo.space" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11 V 7 a 5 5 0 0 1 10 0 v 4" />
          </svg>
          <span>{t.cta_portal || 'Portal'}</span>
        </a>
        <a className="wf-tm-btn wf-tm-btn--sm wf-tm-btn--primary" href="#contact">[ {t.cta_primary} → ]</a>
      </div>
    </header>
  );
}

// ─────── Main: TerminalLanding ─────────────────────────────

function TerminalLanding({
  initLang = 'ua',
  initTheme = 'light',
  catStyle = 'ascii',
  wordmark = 'bracket',
  h1Variant = 0,
  accent = 'lime',
  crtGlow = false,
}) {
  const [lang, setLang] = _ts(initLang);
  const [theme, setTheme] = _ts(initTheme);
  const [liveIdx, setLiveIdx] = _ts(0);
  _te(() => setLang(initLang), [initLang]);
  _te(() => setTheme(initTheme), [initTheme]);
  _te(() => {
    const id = setInterval(() => setLiveIdx((i) => (i + 1) % 4), 6000);
    return () => clearInterval(id);
  }, []);

  const t = window.WF_CONTENT[lang];
  const live = { text: t.live[liveIdx], ago: t.live_ago[liveIdx] };
  const [booted, setBooted] = _ts(false);

  // Item 13: opt-in sound effects on click
  const [soundOn, setSoundOn] = (typeof useSoundEnabled === 'function' ? useSoundEnabled() : [false, () => {}]);
  if (typeof useGlobalClickSound === 'function') useGlobalClickSound(soundOn);
  const toggleTheme = () => setTheme((th) => th === 'light' ? 'dark' : 'light');

  // Resolve accent based on theme
  const accentPreset = ACCENT_PRESETS[accent] || ACCENT_PRESETS.lime;
  const accentColor = theme === 'dark' ? accentPreset.dark : accentPreset.light;
  const accentBg = accentPreset.dark; // bright fill works in both themes
  const accentSoft = theme === 'dark' ? accentPreset.softDark : accentPreset.soft;

  const cssVars = {
    '--wf-accent': accentColor,
    '--wf-accent-bg': accentBg,
    '--wf-accent-soft': accentSoft,
  };

  return (
    <div className={`wf-root wf-v-terminal-pro${crtGlow ? ' wf-tm-glow' : ''}`} data-theme={theme} data-accent={accent} id="top" style={cssVars}>
      <div className="wf-tm-wrap">
        <div className="wf-tm-window">
          {/* Title bar */}
          <div className="wf-tm-titlebar">
            <div className="wf-tm-traffic">
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
            </div>
            <div className="wf-tm-titlebar-title">~/illia/workflo — bash · 80×24</div>
            <div className="wf-tm-titlebar-spacer" />
          </div>

          {/* Nav inside the terminal */}
          <TerminalNav t={t} lang={lang} onLang={setLang} theme={theme} onTheme={setTheme} wordmark={wordmark} catStyle={catStyle} />

          {/* All sections flow as terminal output */}
          <div className="wf-tm-body">
          {/* Boot sequence v2 (locale + time aware) */}
          {!booted && (typeof BootSequenceV2 === 'function'
            ? <BootSequenceV2 onDone={() => setBooted(true)} isUa={lang === 'ua'} />
            : <BootSequence onDone={() => setBooted(true)} isUa={lang === 'ua'} />)}
          {booted && (
            <React.Fragment>
              {typeof AsciiLogoBanner === 'function' && <AsciiLogoBanner />}
              {typeof LiveCommandStrip === 'function' && <LiveCommandStrip />}
              <TerminalHero t={t} h1Variant={h1Variant} live={live} />
              {typeof CurrentlySection === 'function' && <CurrentlySection isUa={lang === 'ua'} />}
              <TerminalPartners t={t} lang={lang} />
              <TerminalCases t={t} />
              <TerminalScale t={t} lang={lang} />
              <TerminalServices t={t} />
              <TerminalProcess t={t} />
              <TerminalSpotlight t={t} />
              <TerminalAbout t={t} isUa={lang === 'ua'} />
              <TerminalContact t={t} />
              <div className="wf-tm-eof">
                <TermPrompt cmd="" />
                <span className="wf-tm-cursor" />
              </div>
            </React.Fragment>
          )}
          </div>

          {/* Status bar */}
          <TerminalStatusBar t={t} lang={lang} onLang={setLang} theme={theme} onTheme={setTheme} accent={accent} soundOn={soundOn} setSoundOn={setSoundOn} />
          {typeof KeyboardShortcuts === 'function' && <KeyboardShortcuts isUa={lang === 'ua'} onToggleTheme={toggleTheme} />}
        </div>
      </div>
    </div>
  );
}

// ─────── 404 page ──────────────────────────────────────────
// Renders a small terminal window showing "no such file or directory"
// + ASCII cat + tipps. Standalone screen (no rotating live widget etc).
function Terminal404({
  initLang = 'ua',
  theme = 'light',
  accent = 'lime',
  crtGlow = false,
}) {
  const t = window.WF_CONTENT[initLang] || window.WF_CONTENT.ua;
  const preset = ACCENT_PRESETS[accent] || ACCENT_PRESETS.lime;
  const accentColor = theme === 'dark' ? preset.dark : preset.light;
  const accentBg = preset.dark;
  const accentSoft = theme === 'dark' ? preset.softDark : preset.soft;
  const cssVars = {
    '--wf-accent': accentColor,
    '--wf-accent-bg': accentBg,
    '--wf-accent-soft': accentSoft,
  };
  const isUa = initLang === 'ua';

  return (
    <div className={`wf-root wf-v-terminal-pro${crtGlow ? ' wf-tm-glow' : ''}`} data-theme={theme} data-accent={accent} style={cssVars}>
      <div className="wf-tm-wrap">
        <div className="wf-tm-window">
          <div className="wf-tm-titlebar">
            <div className="wf-tm-traffic">
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
            </div>
            <div className="wf-tm-titlebar-title">~/illia/workflo — bash · 404</div>
            <div />
          </div>

          <div className="wf-tm-body wf-tm-404-body">
            <div className="wf-tm-404-wrap">
              <TermPrompt cmd="cd /pages/this-doesnt-exist" />
              <div className="wf-tm-404-err">
                bash: cd: /pages/this-doesnt-exist: <span className="wf-tm-404-err-msg">No such file or directory</span>
              </div>

              <pre className="wf-tm-404-ascii" aria-hidden="true">
{`       /\\___/\\
      ( -    - )       404
       >  ^  <         /pages/this-doesnt-exist
      ──────────
       u     u`}
              </pre>

              <div className="wf-tm-404-tag">
                <StatusDot accent="var(--wf-accent)" />
                <span>{isUa ? 'статус: page not found' : 'status: page not found'}</span>
              </div>

              <div className="wf-tm-404-headline">
                {isUa
                  ? <>цієї сторінки немає. <span className="wf-tm-404-yet">поки що.</span></>
                  : <>this page doesn't exist. <span className="wf-tm-404-yet">yet.</span></>}
              </div>

              <div className="wf-tm-404-suggest">
                <div className="wf-tm-404-suggest-head"># {isUa ? 'спробуйте натомість:' : 'try instead:'}</div>
                <div className="wf-tm-404-suggest-list">
                  <a href="#top" className="wf-tm-404-link">
                    <span className="wf-tm-sigil">$</span>
                    <span className="wf-tm-cmd">cd ~</span>
                    <span className="wf-tm-bullet">→</span>
                    <span>{isUa ? 'на головну' : 'home'}</span>
                  </a>
                  <a href="#sec-1" className="wf-tm-404-link">
                    <span className="wf-tm-sigil">$</span>
                    <span className="wf-tm-cmd">ls ~/work</span>
                    <span className="wf-tm-bullet">→</span>
                    <span>{isUa ? 'кейси з реальними цифрами' : 'case studies with real numbers'}</span>
                  </a>
                  <a href="#sec-0" className="wf-tm-404-link">
                    <span className="wf-tm-sigil">$</span>
                    <span className="wf-tm-cmd">cat ~/services</span>
                    <span className="wf-tm-bullet">→</span>
                    <span>{isUa ? 'що я роблю' : 'what I do'}</span>
                  </a>
                  <a href="#contact" className="wf-tm-404-link">
                    <span className="wf-tm-sigil">$</span>
                    <span className="wf-tm-cmd">contact --help</span>
                    <span className="wf-tm-bullet">→</span>
                    <span>{isUa ? 'написати напряму' : 'reach out directly'}</span>
                  </a>
                </div>
              </div>

              <div className="wf-tm-404-ctas">
                <a className="wf-tm-btn wf-tm-btn--primary" href="#top">[ ← {isUa ? 'на головну' : 'go home'} ]</a>
                <a className="wf-tm-btn" href="#contact">[ {isUa ? 'написати' : 'contact'} → ]</a>
              </div>

              <div className="wf-tm-404-eof">
                <TermPrompt cmd="" />
                <span className="wf-tm-cursor" />
              </div>
            </div>
          </div>

          <div className="wf-tm-statusbar">
            <div className="wf-tm-statusbar-left">
              <span className="wf-tm-sb-branch" style={{ color: '#DC2626' }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#DC2626',
                  boxShadow: '0 0 0 3px rgba(220,38,38,0.25)',
                }} />
                404
              </span>
              <span className="wf-tm-sb-sep">·</span>
              <span>page not found</span>
            </div>
            <div className="wf-tm-statusbar-right">
              <span>{t.footer.built}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TerminalLanding, Terminal404, ACCENT_PRESETS });
