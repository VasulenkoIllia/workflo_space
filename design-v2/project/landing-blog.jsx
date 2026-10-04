// landing-blog.jsx — public Blog (G2): index + long-read article.
// Renders inside the same terminal-window chrome as terminal-pages.jsx via a
// shared <TermPageShell>. Exported to window for reuse by landing-pricing.jsx.

const { useState: _lb_ts } = React;

// ─────── Shared window-chrome shell ───────
function TermPageShell({
  cwd = '~', crumbs = [], cmd, statusLeft, statusRight,
  theme = 'light', accent = 'lime', crtGlow = false, children,
}) {
  const preset = (window.ACCENT_PRESETS && window.ACCENT_PRESETS[accent]) || window.ACCENT_PRESETS.lime;
  const cssVars = {
    '--wf-accent': theme === 'dark' ? preset.dark : preset.light,
    '--wf-accent-bg': preset.dark,
    '--wf-accent-soft': theme === 'dark' ? preset.softDark : preset.soft,
  };
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
            <div className="wf-tm-titlebar-title">{cwd} — bash</div>
            <div />
          </div>

          {crumbs.length > 0 && (
            <div className="wf-tm-page-crumb">
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="wf-tm-crumb-sep">/</span>}
                  {i === crumbs.length - 1
                    ? <span className="wf-tm-crumb-current">{c.label}</span>
                    : <a className="wf-tm-crumb" href={c.href || '#top'}>{c.label}</a>}
                </React.Fragment>
              ))}
            </div>
          )}

          <div className="wf-tm-body">
            {cmd != null && <TermPrompt cmd={cmd} />}
            <div className="wf-tm-output">
              {children}
              <div className="wf-tm-eof">
                <TermPrompt cmd="" />
                <span className="wf-tm-cursor" />
              </div>
            </div>
          </div>

          <div className="wf-tm-statusbar">
            <div className="wf-tm-statusbar-left">{statusLeft}</div>
            <div className="wf-tm-statusbar-right">
              {statusRight || <span>{preset.name.toLowerCase()}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const _fmtDate = (iso, ua) => {
  const d = new Date(iso + 'T00:00:00');
  if (ua) {
    const m = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
    return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ─────── /blog — index ───────
function BlogIndex({ initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false, forceEmpty = false }) {
  const ua = initLang === 'ua';
  const data = window.WF_BLOG;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  const [tag, setTag] = _lb_ts(forceEmpty ? 'telegram' : 'усі');
  const [shown, setShown] = _lb_ts(4);

  // pretend the "telegram" filter under forceEmpty yields nothing (empty-state demo)
  const all = forceEmpty ? [] : data.posts.filter((p) => tag === 'усі' || p.tags.includes(tag));
  const featured = all.find((p) => p.featured);
  const rest = all.filter((p) => !p.featured).slice(0, shown);

  return (
    <TermPageShell
      cwd="~/illia/workflo/blog"
      crumbs={[{ label: '~', href: '#top' }, { label: 'blog' }]}
      cmd="ls ~/blog/"
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> blog</span><span className="wf-tm-sb-sep">·</span><span>{data.posts.length} {ua ? 'статей' : 'posts'}</span></>}
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">{ua ? 'Блог' : 'Blog'}</h1>
        <p className="wf-tm-page-lead">
          {ua
            ? 'Нотатки про автоматизацію, AI-агентів та інтеграції — з реальних проєктів, без маркетингового шуму.'
            : 'Notes on automation, AI agents and integrations — from real projects, no marketing noise.'}
        </p>
      </div>

      {/* tag filters */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## filter</div>
        <div className="wf-tm-blog-filters">
          {data.tags.map((tg) => (
            <button key={tg} className="wf-tm-blog-filter" data-on={tag === tg || undefined}
              onClick={() => { setTag(tg); setShown(4); }}>
              {tg}{tg !== 'усі' ? `(${data.posts.filter((p) => p.tags.includes(tg)).length})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## posts</div>

        {all.length === 0 ? (
          <div className="wf-tm-blog-empty">
            <div className="wf-tm-blog-empty-glyph">{'/\\_/\\\n( -.- )  // 0 results\n > ^ <'}</div>
            <div className="wf-tm-blog-empty-t">{ua ? 'Поки немає статей за цим тегом' : 'No posts under this tag yet'}</div>
            <div className="wf-tm-blog-empty-sub">{ua ? 'Спробуй інший фільтр або зазирни пізніше' : 'Try another filter or check back later'}</div>
            <button className="wf-tm-btn" style={{ marginTop: 6 }} onClick={() => setTag('усі')}>[ {ua ? 'усі статті' : 'all posts'} ]</button>
          </div>
        ) : (
          <div className="wf-tm-blog-list">
            {featured && (
              <article className="wf-tm-blog-feature" onClick={() => {}}>
                <div className="wf-tm-blog-feature-body">
                  <div className="wf-tm-blog-tags">
                    <span className="wf-tm-blog-tag" style={{ borderStyle: 'solid', color: 'var(--wf-accent)', borderColor: 'var(--wf-accent)' }}>★ {ua ? 'обране' : 'featured'}</span>
                    {featured.tags.map((t) => <span key={t} className="wf-tm-blog-tag">{t}</span>)}
                  </div>
                  <h2 className="wf-tm-blog-row-title">{pickL(featured.title)}</h2>
                  <p className="wf-tm-blog-excerpt">{pickL(featured.excerpt)}</p>
                  <div className="wf-tm-art-meta" style={{ marginTop: 4 }}>
                    <span>{_fmtDate(featured.date, ua)}</span>
                    <span className="wf-tm-art-meta-dot" />
                    <span>{pickL(featured.reading)} {ua ? 'читання' : 'read'}</span>
                  </div>
                  <a className="wf-tm-blog-readmore" href={`#blog-${featured.slug}`}>$ cat {featured.slug}.md →</a>
                </div>
                <div className="wf-tm-blog-feature-thumb">
                  <span className="wf-tm-blog-feature-thumb-glyph">{'{ }'}</span>
                </div>
              </article>
            )}

            {rest.map((p) => (
              <article key={p.slug} className="wf-tm-blog-row">
                <span className="wf-tm-blog-date">{_fmtDate(p.date, ua)}</span>
                <div className="wf-tm-blog-row-main">
                  <h3 className="wf-tm-blog-row-title">{pickL(p.title)}</h3>
                  <p className="wf-tm-blog-excerpt">{pickL(p.excerpt)}</p>
                  <div className="wf-tm-blog-tags">
                    {p.tags.map((t) => <span key={t} className="wf-tm-blog-tag">{t}</span>)}
                  </div>
                </div>
                <span className="wf-tm-blog-reading">{pickL(p.reading)}</span>
              </article>
            ))}
          </div>
        )}

        {all.length > 0 && rest.length < all.filter((p) => !p.featured).length && (
          <div className="wf-tm-blog-more">
            <button className="wf-tm-btn" onClick={() => setShown((s) => s + 4)}>[ {ua ? 'завантажити ще' : 'load more'} ↓ ]</button>
          </div>
        )}
      </div>
    </TermPageShell>
  );
}

// ─────── /blog/:slug — article ───────
function BlogArticle({ slug = 'excel-to-crm-without-pain', initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  const data = window.WF_BLOG;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  const post = data.posts.find((p) => p.slug === slug) || data.posts[0];
  const body = (post.body && (post.body[initLang] || post.body.ua)) || [];
  const headings = body.map((b, i) => ({ ...b, i })).filter((b) => b.t === 'h2');
  const related = (post.related || []).map((s) => data.posts.find((p) => p.slug === s)).filter(Boolean);

  const renderBlock = (b, i) => {
    switch (b.t) {
      case 'h2':   return <h2 key={i} id={`h-${i}`} className="wf-tm-art-h2">{b.v}</h2>;
      case 'p':    return <p key={i} className="wf-tm-art-p" dangerouslySetInnerHTML={{ __html: b.v.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />;
      case 'ul':   return <ul key={i} className="wf-tm-art-ul">{b.v.map((li, j) => <li key={j}>{li}</li>)}</ul>;
      case 'code': return <pre key={i} className="wf-tm-art-code"><code><span className="wf-tm-art-code-lang">{b.lang || 'bash'}</span>{b.v}</code></pre>;
      case 'callout': return <div key={i} className="wf-tm-art-callout"><span className="wf-tm-art-callout-k">{b.k}</span><span className="wf-tm-art-callout-v">{b.v}</span></div>;
      case 'quote': return <blockquote key={i} className="wf-tm-art-quote">"{b.v}"<span className="wf-tm-art-quote-author">— {b.author}</span></blockquote>;
      default: return null;
    }
  };

  return (
    <TermPageShell
      cwd={`~/illia/workflo/blog/${post.slug}`}
      crumbs={[{ label: '~', href: '#top' }, { label: 'blog', href: '#blog' }, { label: post.slug }]}
      cmd={`cat ~/blog/${post.slug}.md`}
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> blog/{post.slug}</span><span className="wf-tm-sb-sep">·</span><span>{pickL(post.reading)} {ua ? 'читання' : 'read'}</span></>}
    >
      {/* header */}
      <div className="wf-tm-project-hero" style={{ marginBottom: 6 }}>
        <div className="wf-tm-blog-tags" style={{ marginBottom: 4 }}>
          {post.tags.map((t) => <span key={t} className="wf-tm-blog-tag">{t}</span>)}
        </div>
        <h1 className="wf-tm-page-h1">{pickL(post.title)}</h1>
        <p className="wf-tm-page-lead">{pickL(post.excerpt)}</p>
        <div className="wf-tm-art-meta">
          <span>{ua ? 'Ілля' : 'Illia'}</span>
          <span className="wf-tm-art-meta-dot" />
          <span>{_fmtDate(post.date, ua)}</span>
          <span className="wf-tm-art-meta-dot" />
          <span>{pickL(post.reading)} {ua ? 'читання' : 'read'}</span>
          <span className="wf-tm-art-share">
            <a className="wf-tm-art-share-btn" href="#" title="X / Twitter"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4 L 20 20 M20 4 L 4 20" /></svg></a>
            <a className="wf-tm-art-share-btn" href="#" title="LinkedIn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="8" y1="10" x2="8" y2="17" /><circle cx="8" cy="7" r="0.9" fill="currentColor" /><path d="M12 17 v -4 a 2 2 0 0 1 4 0 v 4 M12 10 v 7" /></svg></a>
            <a className="wf-tm-art-share-btn" href="#" title={ua ? 'Копіювати лінк' : 'Copy link'}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg></a>
          </span>
        </div>
      </div>

      <div className="wf-tm-md-section wf-tm-art">
        {/* TOC */}
        <nav className="wf-tm-art-toc">
          <div className="wf-tm-art-toc-h">## зміст</div>
          {headings.map((h) => (
            <a key={h.i} className="wf-tm-art-toc-link" href={`#h-${h.i}`}>{h.v}</a>
          ))}
        </nav>
        {/* body */}
        <div className="wf-tm-art-body">
          {body.map(renderBlock)}

          {/* related */}
          {related.length > 0 && (
            <div className="wf-tm-md-section" style={{ marginTop: 36 }}>
              <div className="wf-tm-md-h2">## related</div>
              <div className="wf-tm-related">
                {related.map((r) => (
                  <a key={r.slug} href={`#blog-${r.slug}`} className="wf-tm-related-link">
                    <span className="wf-tm-bullet">▸</span>
                    <span className="wf-tm-related-name">{pickL(r.title)}</span>
                    <span className="wf-tm-related-meta">{_fmtDate(r.date, ua)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
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

Object.assign(window, { TermPageShell, BlogIndex, BlogArticle });
