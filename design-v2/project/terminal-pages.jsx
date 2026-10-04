// terminal-pages.jsx — ProjectPage + CompanyPage (full case-study screens)
// Renders in the same terminal-window chrome as TerminalLanding so the
// aesthetic is consistent across pages. Used both as standalone artboards
// on the canvas and (later) as routed pages in production.

const { useState: _tp_ts } = React;

// Lucide-style social icons (monoline, ~16px)
const SOCIAL_ICONS = {
  website: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2 a 15 15 0 0 1 0 20 a 15 15 0 0 1 0 -20" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12 a 5 5 0 1 0 5 5 V 4 a 5 5 0 0 0 5 5" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="8" y1="10" x2="8" y2="17" />
      <circle cx="8" cy="7" r="0.9" fill="currentColor" />
      <path d="M12 17 v -4 a 2 2 0 0 1 4 0 v 4 M12 10 v 7" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <path d="M10 9 L 15 12 L 10 15 Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4 L 20 20 M20 4 L 4 20" />
    </svg>
  ),
};

const SOCIAL_KINDS = ['website', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x'];

function CompanySocials({ links, lang }) {
  if (!links) return null;
  const items = SOCIAL_KINDS.filter((k) => links[k]).map((k) => ({ kind: k, ...links[k] }));
  if (!items.length) return null;
  return (
    <div className="wf-tm-md-section">
      <div className="wf-tm-md-h2">## links</div>
      <div className="wf-tm-socials">
        {items.map((it) => (
          <a key={it.kind} className="wf-tm-social" href={it.url} target="_blank" rel="noreferrer noopener">
            <span className="wf-tm-social-icon">{SOCIAL_ICONS[it.kind]}</span>
            <span className="wf-tm-social-kind">{it.kind}</span>
            <span className="wf-tm-bullet">→</span>
            <span className="wf-tm-social-label">{it.label}</span>
            <span className="wf-tm-social-ext">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─────── ProjectPage ───────────────────────────────────────
function ProjectPage({
  slug,
  initLang = 'ua',
  theme = 'light',
  accent = 'lime',
  crtGlow = false,
}) {
  const project = (window.WF_LOOKUPS && window.WF_LOOKUPS.projectBySlug(slug)) || null;
  const company = project ? (window.WF_LOOKUPS && window.WF_LOOKUPS.companyBySlug(project.company)) : null;
  const t = window.WF_CONTENT[initLang] || window.WF_CONTENT.ua;
  const ua = initLang === 'ua';

  // Theme + accent CSS vars (same logic as TerminalLanding)
  const preset = ACCENT_PRESETS[accent] || ACCENT_PRESETS.lime;
  const accentColor = theme === 'dark' ? preset.dark : preset.light;
  const cssVars = {
    '--wf-accent': accentColor,
    '--wf-accent-bg': preset.dark,
    '--wf-accent-soft': theme === 'dark' ? preset.softDark : preset.soft,
  };

  if (!project) {
    return <div style={{ padding: 40, fontFamily: 'monospace' }}>project not found: {slug}</div>;
  }

  const pickL = (obj) => (obj && (obj[initLang] || obj.ua || obj.en)) || '';
  const name = pickL(project.name);
  const role = pickL(project.role);
  const duration = pickL(project.duration);
  const status = pickL(project.status);
  const summary = pickL(project.summary);
  const problem = pickL(project.problem) || [];
  const solution = pickL(project.solution) || [];
  const beforeAfter = project.before_after && (project.before_after[initLang] || project.before_after.ua);
  const testimonialText = pickL(project.testimonial);

  return (
    <div className={`wf-root wf-v-terminal-pro${crtGlow ? ' wf-tm-glow' : ''}`} data-theme={theme} data-accent={accent} style={cssVars}>
      <div className="wf-tm-wrap">
        <div className="wf-tm-window">
          {/* Titlebar */}
          <div className="wf-tm-titlebar">
            <div className="wf-tm-traffic">
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
              <span className="wf-tm-traffic-dot" />
            </div>
            <div className="wf-tm-titlebar-title">~/illia/workflo/work/{slug} — bash</div>
            <div />
          </div>

          {/* Breadcrumb */}
          <div className="wf-tm-page-crumb">
            <a className="wf-tm-crumb" href="#top">~</a>
            <span className="wf-tm-crumb-sep">/</span>
            <a className="wf-tm-crumb" href="#sec-1">work</a>
            <span className="wf-tm-crumb-sep">/</span>
            <span className="wf-tm-crumb-current">{slug}</span>
          </div>

          <div className="wf-tm-body">
            <TermPrompt cmd={`cat ~/work/${slug}.md`} />

            <div className="wf-tm-output wf-tm-project">
              {/* HERO BLOCK — partner chip + H1 + summary + key metric */}
              <div className="wf-tm-project-hero">
                <div className="wf-tm-project-hero-top">
                  {company ? (
                    <a className="wf-tm-case-partner-chip" href={`#company-${company.slug}`}>{company.slug}</a>
                  ) : <span className="wf-tm-case-partner-chip">{project.company}</span>}
                  <span className="wf-tm-case-card-meta">{project.year}{project.quarter ? ` · ${project.quarter}` : ''} · {duration}</span>
                </div>
                <h1 className="wf-tm-page-h1">{name}</h1>
                <p className="wf-tm-project-hero-summary">{summary}</p>
                {project.metrics && project.metrics[0] && (
                  <div className="wf-tm-case-card-metric wf-tm-project-hero-metric">
                    <div className="wf-tm-case-card-metric-v">{project.metrics[0].value}</div>
                    <div className="wf-tm-case-card-metric-l">{pickL(project.metrics[0].label)}</div>
                  </div>
                )}
              </div>

              {/* Compact meta strip */}
              <div className="wf-tm-meta-strip">
                <div className="wf-tm-meta-cell">
                  <span className="wf-tm-meta-key">role</span>
                  <span className="wf-tm-meta-val">{role}</span>
                </div>
                <div className="wf-tm-meta-cell">
                  <span className="wf-tm-meta-key">status</span>
                  <span className="wf-tm-meta-val"><StatusDot accent="var(--wf-accent)" /> {status}</span>
                </div>
                <div className="wf-tm-meta-cell">
                  <span className="wf-tm-meta-key">stack</span>
                  <span className="wf-tm-meta-val">{project.stack.slice(0, 3).join(' · ')}{project.stack.length > 3 ? ' …' : ''}</span>
                </div>
              </div>

              {/* TL;DR — other metrics at-a-glance */}
              {project.metrics && project.metrics.length > 1 && (
                <div className="wf-tm-md-section">
                  <div className="wf-tm-md-h2">## tl;dr</div>
                  <ul className="wf-tm-tldr">
                    {project.metrics.slice(1).map((m, i) => (
                      <li key={i}>
                        <span className="wf-tm-tldr-v">{m.value}</span>
                        <span className="wf-tm-tldr-l">{pickL(m.label)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Problem */}
              <div className="wf-tm-md-section">
                <div className="wf-tm-md-h2">## problem</div>
                <div className="wf-tm-prose">
                  {problem.map((p, i) => (
                    <p key={i} className="wf-tm-prose-p">{p}</p>
                  ))}
                </div>
              </div>

              {/* Solution */}
              <div className="wf-tm-md-section">
                <div className="wf-tm-md-h2">## solution</div>
                <div className="wf-tm-prose">
                  {solution.map((p, i) => (
                    <p key={i} className="wf-tm-prose-p">{p}</p>
                  ))}
                </div>
              </div>

              {/* Approach — timeline with progress bars */}
              <div className="wf-tm-md-section">
                <div className="wf-tm-md-h2">## approach</div>
                <div className="wf-tm-approach">
                  {project.approach.map((step, i) => {
                    const filled = Math.round(step.pct / 10);
                    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
                    return (
                      <div key={i} className="wf-tm-approach-row">
                        <span className="wf-tm-approach-num">[{String(i + 1).padStart(2, '0')}]</span>
                        <span className="wf-tm-approach-name">{pickL(step.name)}</span>
                        <span className="wf-tm-approach-bar">[{bar}]</span>
                        <span className="wf-tm-approach-week">{pickL(step.week)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Results — metrics grid */}
              <div className="wf-tm-md-section">
                <div className="wf-tm-md-h2">## results</div>
                <div className="wf-tm-metrics-grid">
                  {project.metrics.map((m, i) => (
                    <div key={i} className="wf-tm-metric-cell">
                      <div className="wf-tm-metric-v">{m.value}</div>
                      <div className="wf-tm-metric-l">{pickL(m.label)}</div>
                    </div>
                  ))}
                </div>
                {beforeAfter && (
                  <div className="wf-tm-beforeafter">
                    <div className="wf-tm-ba-row">
                      <span className="wf-tm-ba-key">before</span>
                      <span className="wf-tm-ba-val">{beforeAfter.before}</span>
                    </div>
                    <div className="wf-tm-ba-row">
                      <span className="wf-tm-ba-key">after</span>
                      <span className="wf-tm-ba-val" style={{ color: 'var(--wf-fg)' }}>{beforeAfter.after}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stack */}
              <div className="wf-tm-md-section">
                <div className="wf-tm-md-h2">## stack</div>
                <div className="wf-tm-stack-chips">
                  {project.stack.map((s, i) => (
                    <span key={i} className="wf-tm-stack-chip">{s}</span>
                  ))}
                </div>
              </div>

              {/* Testimonial */}
              {testimonialText && (
                <div className="wf-tm-md-section">
                  <div className="wf-tm-md-h2">## testimonial</div>
                  <blockquote className="wf-tm-testimonial">
                    <span className="wf-tm-testimonial-prefix">{'>'}</span>
                    <span>"{testimonialText}"</span>
                    <div className="wf-tm-testimonial-author">— {project.testimonial.author}</div>
                  </blockquote>
                </div>
              )}

              {/* Related */}
              {project.related && project.related.length > 0 && (
                <div className="wf-tm-md-section">
                  <div className="wf-tm-md-h2">## related</div>
                  <div className="wf-tm-related">
                    {project.related.map((rslug) => {
                      const r = window.WF_LOOKUPS.projectBySlug(rslug);
                      if (!r) return null;
                      const rCompany = window.WF_LOOKUPS.companyBySlug(r.company);
                      return (
                        <a key={rslug} href={`#project-${rslug}`} className="wf-tm-related-link">
                          <span className="wf-tm-bullet">▸</span>
                          <span className="wf-tm-related-name">{pickL(r.name)}</span>
                          <span className="wf-tm-related-meta">{rCompany ? rCompany.name : ''} · {r.year}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nav CTAs */}
              <div className="wf-tm-page-ctas">
                <a className="wf-tm-btn" href="#top">[ ← {ua ? 'на головну' : 'home'} ]</a>
                <a className="wf-tm-btn" href="#sec-1">[ {ua ? 'усі кейси' : 'all work'} ]</a>
                <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">[ {ua ? 'обговорити схожий' : 'discuss similar'} → ]</a>
              </div>

              <div className="wf-tm-eof">
                <TermPrompt cmd="" />
                <span className="wf-tm-cursor" />
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="wf-tm-statusbar">
            <div className="wf-tm-statusbar-left">
              <span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> work/{slug}</span>
              <span className="wf-tm-sb-sep">·</span>
              <span>{ua ? 'кейс-стаді' : 'case study'}</span>
              <span className="wf-tm-sb-sep">·</span>
              <span>{project.year} · {duration}</span>
            </div>
            <div className="wf-tm-statusbar-right">
              <span>{preset.name.toLowerCase()}</span>
              <span className="wf-tm-sb-sep">·</span>
              <span>{ua ? 'збережено · auto' : 'saved · auto'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────── CompanyPage ───────────────────────────────────────
function CompanyPage({
  slug,
  initLang = 'ua',
  theme = 'light',
  accent = 'lime',
  crtGlow = false,
}) {
  const company = (window.WF_LOOKUPS && window.WF_LOOKUPS.companyBySlug(slug)) || null;
  const projects = (window.WF_LOOKUPS && window.WF_LOOKUPS.projectsForCompany(slug)) || [];
  const ua = initLang === 'ua';

  const preset = ACCENT_PRESETS[accent] || ACCENT_PRESETS.lime;
  const cssVars = {
    '--wf-accent': theme === 'dark' ? preset.dark : preset.light,
    '--wf-accent-bg': preset.dark,
    '--wf-accent-soft': theme === 'dark' ? preset.softDark : preset.soft,
  };

  if (!company) return <div style={{ padding: 40, fontFamily: 'monospace' }}>company not found: {slug}</div>;

  const bio = company.bio[initLang] || company.bio.ua;
  const industry = company.industry[initLang] || company.industry.ua;
  const size = company.size[initLang] || company.size.ua;
  const testimonialText = company.testimonial[initLang] || company.testimonial.ua;

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
            <div className="wf-tm-titlebar-title">~/illia/workflo/companies/{slug} — bash</div>
            <div />
          </div>

          <div className="wf-tm-page-crumb">
            <a className="wf-tm-crumb" href="#top">~</a>
            <span className="wf-tm-crumb-sep">/</span>
            <a className="wf-tm-crumb" href="#companies">companies</a>
            <span className="wf-tm-crumb-sep">/</span>
            <span className="wf-tm-crumb-current">{slug}</span>
          </div>

          <div className="wf-tm-body">
            <TermPrompt cmd={`cat ~/companies/${slug}.md`} />

            <div className="wf-tm-output">
              {/* HERO BLOCK — logo, name, industry, stats badges */}
              <div className="wf-tm-company-hero">
                <div className="wf-tm-company-hero-top">
                  <div className="wf-tm-company-logo" style={{ background: company.accent }}>{company.logo_glyph}</div>
                  <div className="wf-tm-company-hero-id">
                    <h1 className="wf-tm-page-h1" style={{ margin: 0 }}>{company.name}</h1>
                    <div className="wf-tm-company-hero-industry">{industry}</div>
                  </div>
                  <div className="wf-tm-company-hero-status">
                    <StatusDot accent="var(--wf-accent)" />
                    <span>{company.status === 'active' ? (ua ? 'active partnership' : 'active partnership') : company.status}</span>
                  </div>
                </div>
                <div className="wf-tm-company-hero-stats">
                  <div className="wf-tm-company-stat">
                    <div className="wf-tm-company-stat-v">{projects.length}</div>
                    <div className="wf-tm-company-stat-l">{ua ? (projects.length === 1 ? 'проєкт' : 'проєкти') : (projects.length === 1 ? 'project' : 'projects')}</div>
                  </div>
                  <div className="wf-tm-company-stat">
                    <div className="wf-tm-company-stat-v">{(new Date()).getFullYear() - parseInt(company.since)}</div>
                    <div className="wf-tm-company-stat-l">{ua ? 'роки разом' : 'years together'}</div>
                  </div>
                  <div className="wf-tm-company-stat">
                    <div className="wf-tm-company-stat-v wf-tm-company-stat-v--text">{company.location.split(',')[0]}</div>
                    <div className="wf-tm-company-stat-l">{company.location.split(',')[1] || ''}</div>
                  </div>
                  <div className="wf-tm-company-stat">
                    <div className="wf-tm-company-stat-v wf-tm-company-stat-v--text">{size.split(' · ')[0]}</div>
                    <div className="wf-tm-company-stat-l">{size.split(' · ').slice(1).join(' · ') || (ua ? 'команда' : 'team')}</div>
                  </div>
                </div>
              </div>

              {/* Social links (moved up for discoverability) */}
              <CompanySocials links={company.links} lang={initLang} />

              {/* About */}
              <div className="wf-tm-md-section">
                <div className="wf-tm-md-h2">## about</div>
                <div className="wf-tm-prose">
                  {bio.map((p, i) => <p key={i} className="wf-tm-prose-p">{p}</p>)}
                </div>
              </div>

              {/* Projects together — case-card grid (matching landing) */}
              <div className="wf-tm-md-section">
                <div className="wf-tm-md-h2">## projects together</div>
                <div className="wf-tm-case-grid">
                  {projects.map((p, i) => {
                    const pName = p.name[initLang] || p.name.ua;
                    const pSum = p.summary[initLang] || p.summary.ua;
                    const pDur = p.duration[initLang] || p.duration.ua;
                    const hero = p.metrics[0];
                    const heroLbl = hero && (hero.label[initLang] || hero.label.ua);
                    const otherMetrics = p.metrics.slice(1, 3);
                    return (
                      <article key={p.slug} className="wf-tm-case-card">
                        <div className="wf-tm-case-card-top">
                          <span className="wf-tm-case-partner-chip">{slug}</span>
                          <span className="wf-tm-case-card-meta">{p.year} · {pDur}</span>
                        </div>
                        <h3 className="wf-tm-case-card-title">{pName}</h3>
                        {hero && (
                          <div className="wf-tm-case-card-metric">
                            <div className="wf-tm-case-card-metric-v">{hero.value}</div>
                            <div className="wf-tm-case-card-metric-l">{heroLbl}</div>
                          </div>
                        )}
                        <p className="wf-tm-case-card-context">{pSum}</p>
                        {otherMetrics.length > 0 && (
                          <ul className="wf-tm-case-card-others">
                            {otherMetrics.map((m, j) => (
                              <li key={j}><span className="wf-tm-case-plus">+</span> {m.value} {m.label[initLang] || m.label.ua}</li>
                            ))}
                          </ul>
                        )}
                        <div className="wf-tm-case-card-stack">
                          {p.stack.slice(0, 5).map((s, j) => <span key={j} className="wf-tm-stack-chip">{s}</span>)}
                          {p.stack.length > 5 && <span className="wf-tm-stack-chip wf-tm-stack-chip--more">+{p.stack.length - 5}</span>}
                        </div>
                        <a className="wf-tm-case-card-readmore" href={`#project-${p.slug}`}>
                          <span>$ cat ~/work/{p.slug}.md</span>
                          <span className="wf-tm-case-card-readmore-arrow">→</span>
                        </a>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Testimonial */}
              <div className="wf-tm-md-section">
                <div className="wf-tm-md-h2">## testimonial</div>
                <blockquote className="wf-tm-testimonial">
                  <span className="wf-tm-testimonial-prefix">{'>'}</span>
                  <span>"{testimonialText}"</span>
                  <div className="wf-tm-testimonial-author">— {company.testimonial.author}</div>
                </blockquote>
              </div>

              <div className="wf-tm-page-ctas">
                <a className="wf-tm-btn" href="#top">[ ← {ua ? 'на головну' : 'home'} ]</a>
                <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">[ {ua ? 'почати схожий проєкт' : 'start similar project'} → ]</a>
              </div>

              <div className="wf-tm-eof">
                <TermPrompt cmd="" />
                <span className="wf-tm-cursor" />
              </div>
            </div>
          </div>

          <div className="wf-tm-statusbar">
            <div className="wf-tm-statusbar-left">
              <span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> companies/{slug}</span>
              <span className="wf-tm-sb-sep">·</span>
              <span>{projects.length} {ua ? 'проєктів' : 'projects'}</span>
              <span className="wf-tm-sb-sep">·</span>
              <span>since {company.since}</span>
            </div>
            <div className="wf-tm-statusbar-right">
              <span>{preset.name.toLowerCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProjectPage, CompanyPage, CompanySocials, SOCIAL_ICONS });
