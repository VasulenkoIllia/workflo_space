// landing-cases.jsx — public Case studies (G4): index + detail.
// Reuses TermPageShell (landing-blog.jsx) + the wf-tm-art-* blocks so the
// aesthetic matches the blog exactly. Mirrors the workspace /cases CMS content.

const _ind_glyph = { food: '{ }', logistics: '>>', saas: '~/', retail: '$', fintech: '%' };

// ─────── /cases — index ───────
function CaseIndex({ initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  const data = window.WF_CASES;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  return (
    <TermPageShell
      cwd="~/illia/workflo/cases"
      crumbs={[{ label: '~', href: '#top' }, { label: 'cases' }]}
      cmd="ls ~/cases/"
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> cases</span><span className="wf-tm-sb-sep">·</span><span>{data.cases.length} {ua ? 'історій' : 'stories'}</span></>}
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">{ua ? 'Кейси' : 'Case studies'}</h1>
        <p className="wf-tm-page-lead">
          {ua
            ? 'Реальні проєкти з реальними числами. Що боліло, що зробили, що змінилось.'
            : 'Real projects with real numbers. What hurt, what we did, what changed.'}
        </p>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## results</div>
        <div className="wf-tm-case-grid">
          {data.cases.map((c) => {
            const m0 = pickL(c.metrics)[0];
            return (
              <article key={c.slug} className="wf-tm-case-card" onClick={() => {}}>
                <div className="wf-tm-case-card-top">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, color: 'var(--wf-accent)', width: 28, textAlign: 'center' }}>{_ind_glyph[c.industry] || '#'}</span>
                  <div>
                    <div className="wf-tm-case-card-client">{c.client}</div>
                    <div className="wf-tm-case-card-ind">// {c.industry} · {c.tier}</div>
                  </div>
                </div>
                <div className="wf-tm-case-card-body">
                  <h2 className="wf-tm-case-card-title">{pickL(c.title)}</h2>
                  <p className="wf-tm-case-card-lead">{pickL(c.lead)}</p>
                  <div className="wf-tm-blog-tags">
                    {c.tags.map((t) => <span key={t} className="wf-tm-blog-tag">{t}</span>)}
                  </div>
                </div>
                <div className="wf-tm-case-card-foot">
                  <span className="wf-tm-case-card-metric">▸ {m0.v} {m0.k}</span>
                  <a className="wf-tm-case-readmore" href={`#case-${c.slug}`}>$ open →</a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </TermPageShell>
  );
}

// ─────── /cases/:slug — detail ───────
function CasePage({ slug = 'brunky-crm-1c', initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  const data = window.WF_CASES;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  const c = data.cases.find((x) => x.slug === slug) || data.cases[0];
  const body = (c.body && (c.body[initLang] || c.body.ua)) || [];
  const metrics = pickL(c.metrics);
  const facts = pickL(c.facts);
  const related = (c.related || []).map((s) => data.cases.find((x) => x.slug === s)).filter(Boolean);

  const renderBlock = (b, i) => {
    switch (b.t) {
      case 'h2':   return <h2 key={i} id={`h-${i}`} className="wf-tm-art-h2">{b.v}</h2>;
      case 'p':    return <p key={i} className="wf-tm-art-p" dangerouslySetInnerHTML={{ __html: b.v.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />;
      case 'ul':   return <ul key={i} className="wf-tm-art-ul">{b.v.map((li, j) => <li key={j}>{li}</li>)}</ul>;
      case 'callout': return <div key={i} className="wf-tm-art-callout"><span className="wf-tm-art-callout-k">{b.k}</span><span className="wf-tm-art-callout-v">{b.v}</span></div>;
      case 'quote': return <blockquote key={i} className="wf-tm-art-quote">"{b.v}"<span className="wf-tm-art-quote-author">— {b.author}</span></blockquote>;
      default: return null;
    }
  };

  return (
    <TermPageShell
      cwd={`~/illia/workflo/cases/${c.slug}`}
      crumbs={[{ label: '~', href: '#top' }, { label: 'cases', href: '#cases' }, { label: c.slug }]}
      cmd={`cat ~/cases/${c.slug}.md`}
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> cases/{c.slug}</span><span className="wf-tm-sb-sep">·</span><span>{c.client}</span></>}
    >
      {/* header */}
      <div className="wf-tm-project-hero" style={{ marginBottom: 6 }}>
        <div className="wf-tm-blog-tags" style={{ marginBottom: 4 }}>
          <span className="wf-tm-blog-tag" style={{ borderStyle: 'solid', color: 'var(--wf-accent)', borderColor: 'var(--wf-accent)' }}>{c.client}</span>
          {c.tags.map((t) => <span key={t} className="wf-tm-blog-tag">{t}</span>)}
        </div>
        <h1 className="wf-tm-page-h1">{pickL(c.title)}</h1>
        <p className="wf-tm-page-lead">{pickL(c.lead)}</p>
      </div>

      {/* metric band */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## impact</div>
        <div className="wf-tm-case-metrics">
          {metrics.map((m, i) => (
            <div className="wf-tm-case-metric-cell" key={i}>
              <div className="wf-tm-case-metric-v">{m.v}</div>
              <div className="wf-tm-case-metric-k">{m.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* body + facts sidebar (reuse art grid) */}
      <div className="wf-tm-md-section wf-tm-art">
        <nav className="wf-tm-art-toc">
          <div className="wf-tm-art-toc-h">## факти</div>
          <div className="wf-tm-case-facts">
            {facts.map((f, i) => (
              <div className="wf-tm-case-fact" key={i}>
                <span className="wf-tm-case-fact-k">{f[0]}</span>
                <span className="wf-tm-case-fact-v">{f[1]}</span>
              </div>
            ))}
          </div>
        </nav>
        <div className="wf-tm-art-body">
          {body.map(renderBlock)}

          {related.length > 0 && (
            <div className="wf-tm-md-section" style={{ marginTop: 36 }}>
              <div className="wf-tm-md-h2">## related</div>
              <div className="wf-tm-related">
                {related.map((r) => (
                  <a key={r.slug} href={`#case-${r.slug}`} className="wf-tm-related-link">
                    <span className="wf-tm-bullet">▸</span>
                    <span className="wf-tm-related-name">{pickL(r.title)}</span>
                    <span className="wf-tm-related-meta">{r.client}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="wf-tm-cta-band">
            <div>
              <div className="wf-tm-cta-band-t">{ua ? 'Маєте схожу задачу?' : 'Got a similar problem?'}</div>
              <div className="wf-tm-cta-band-sub">{ua ? '// безкоштовний discovery-дзвінок · 30 хв' : '// free discovery call · 30 min'}</div>
            </div>
            <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">[ {ua ? 'обговорити' : 'let’s talk'} → ]</a>
          </div>
        </div>
      </div>
    </TermPageShell>
  );
}

Object.assign(window, { CaseIndex, CasePage });
