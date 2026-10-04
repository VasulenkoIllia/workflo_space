// landing-marketing.jsx — standalone public landing routes that used to be
// homepage sections only: /services (+ :slug), /about, /contact. Plus /500.
// All rendered in the shared TermPageShell terminal chrome (landing-blog.jsx),
// reusing WfAvatar for team glyphs. UA + EN, light + dark.

const { useState: _lm_ts } = React;

// ════════════════════════ /services — catalog ════════════════════════
function ServicesIndex({ initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  const data = window.WF_SERVICES;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  return (
    <TermPageShell
      cwd="~/illia/workflo/services"
      crumbs={[{ label: '~', href: '#top' }, { label: 'services' }]}
      cmd="ls -la ~/services/"
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> services</span><span className="wf-tm-sb-sep">·</span><span>{data.items.length} {ua ? 'типи робіт' : 'kinds of work'}</span></>}
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">{ua ? 'Послуги' : 'Services'}</h1>
        <p className="wf-tm-page-lead">{pickL(data.intro)}</p>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## ls ~/services</div>
        <div className="wf-tm-svc-grid">
          {data.items.map((s) => (
            <a key={s.slug} className="wf-tm-svc-card" href={`#service-${s.slug}`}>
              <div className="wf-tm-svc-card-top">
                <span className="wf-tm-svc-glyph">{s.glyph}</span>
                <span className="wf-tm-svc-num">{s.num}</span>
              </div>
              <h3 className="wf-tm-svc-name">{pickL(s.name)}</h3>
              <p className="wf-tm-svc-line">{pickL(s.line)}</p>
              <p className="wf-tm-svc-summary">{pickL(s.summary)}</p>
              <div className="wf-tm-stack-chips">
                {s.stack.slice(0, 4).map((t, i) => <span key={i} className="wf-tm-stack-chip">{t}</span>)}
                {s.stack.length > 4 && <span className="wf-tm-stack-chip wf-tm-stack-chip--more">+{s.stack.length - 4}</span>}
              </div>
              <div className="wf-tm-svc-card-foot">
                <span className="wf-tm-svc-typical">{pickL(s.typical)}</span>
                <span className="wf-tm-svc-open">$ open →</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="wf-tm-cta-band">
        <div>
          <div className="wf-tm-cta-band-t">{ua ? 'Не бачите свою задачу?' : 'Don’t see your task?'}</div>
          <div className="wf-tm-cta-band-sub">{ua ? '// напишіть — скажу чесно, чи берусь' : '// drop a line — I’ll tell you honestly if it fits'}</div>
        </div>
        <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">[ {ua ? 'обговорити' : 'let’s talk'} → ]</a>
      </div>
    </TermPageShell>
  );
}

// ════════════════════════ /services/:slug — detail ════════════════════════
function ServicePage({ slug = 'integrations', initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  const data = window.WF_SERVICES;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  const s = data.items.find((x) => x.slug === slug) || data.items[0];
  const relCase = window.WF_CASES && window.WF_CASES.cases.find((c) => c.slug === s.relatedCase);
  const others = data.items.filter((x) => x.slug !== s.slug).slice(0, 3);

  return (
    <TermPageShell
      cwd={`~/illia/workflo/services/${s.slug}`}
      crumbs={[{ label: '~', href: '#top' }, { label: 'services', href: '#services' }, { label: s.slug }]}
      cmd={`man ~/services/${s.slug}`}
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> services/{s.slug}</span><span className="wf-tm-sb-sep">·</span><span>{pickL(s.typical)}</span></>}
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 6 }}>
        <div className="wf-tm-project-hero-top">
          <span className="wf-tm-svc-glyph wf-tm-svc-glyph--lg">{s.glyph}</span>
          <span className="wf-tm-case-card-meta">{s.num} · {pickL(s.typical)}</span>
        </div>
        <h1 className="wf-tm-page-h1">{pickL(s.name)}</h1>
        <p className="wf-tm-project-hero-summary">{pickL(s.summary)}</p>
      </div>

      {/* problem */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## коли це про вас</div>
        <ul className="wf-tm-art-ul">
          {pickL(s.problem).map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </div>

      {/* deliverables */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## що отримаєте</div>
        <div className="wf-tm-svc-deliver">
          {pickL(s.deliverables).map((d, i) => (
            <div className="wf-tm-svc-deliver-row" key={i}>
              <span className="wf-tm-bullet" style={{ color: 'var(--wf-accent)' }}>▸</span>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </div>

      {/* examples + stack */}
      <div className="wf-tm-md-section wf-tm-art">
        <nav className="wf-tm-art-toc">
          <div className="wf-tm-art-toc-h">## stack</div>
          <div className="wf-tm-stack-chips" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            {s.stack.map((t, i) => <span key={i} className="wf-tm-stack-chip">{t}</span>)}
          </div>
        </nav>
        <div className="wf-tm-art-body">
          <div className="wf-tm-md-h2">## приклади</div>
          <p className="wf-tm-art-p">{pickL(s.examples)}</p>

          {relCase && (
            <div className="wf-tm-svc-case">
              <div className="wf-tm-svc-case-h">// реальний кейс</div>
              <a className="wf-tm-related-link" href={`#case-${relCase.slug}`}>
                <span className="wf-tm-bullet">▸</span>
                <span className="wf-tm-related-name">{(relCase.title[initLang] || relCase.title.ua)}</span>
                <span className="wf-tm-related-meta">{relCase.client}</span>
              </a>
            </div>
          )}

          <div className="wf-tm-cta-band" style={{ marginTop: 28 }}>
            <div>
              <div className="wf-tm-cta-band-t">{ua ? 'Схожа задача?' : 'Similar task?'}</div>
              <div className="wf-tm-cta-band-sub">{ua ? '// безкоштовний дзвінок · 30 хв' : '// free call · 30 min'}</div>
            </div>
            <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">[ {ua ? 'обговорити' : 'let’s talk'} → ]</a>
          </div>
        </div>
      </div>

      {/* other services */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## інші послуги</div>
        <div className="wf-tm-related">
          {others.map((o) => (
            <a key={o.slug} href={`#service-${o.slug}`} className="wf-tm-related-link">
              <span className="wf-tm-bullet">{o.glyph}</span>
              <span className="wf-tm-related-name">{pickL(o.name)}</span>
              <span className="wf-tm-related-meta">{o.num}</span>
            </a>
          ))}
        </div>
      </div>
    </TermPageShell>
  );
}

// ════════════════════════ /about — team ════════════════════════
function AboutPage({ initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  const t = window.WF_TEAM;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  const f = t.founder;
  return (
    <TermPageShell
      cwd="~/illia/workflo/about"
      crumbs={[{ label: '~', href: '#top' }, { label: 'about' }]}
      cmd="whoami && cat ~/team.md"
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> about</span><span className="wf-tm-sb-sep">·</span><span>{t.members.length + 1} {ua ? 'людей' : 'people'}</span></>}
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">{ua ? 'Про нас' : 'About'}</h1>
        <p className="wf-tm-page-lead">{pickL(t.intro)}</p>
      </div>

      {/* founder */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## whoami</div>
        <div className="wf-tm-about-founder">
          <div className="wf-tm-about-founder-av">
            <WfAvatar kind={f.avatar} size="xl" fill="solid" bracket />
          </div>
          <div className="wf-tm-about-founder-main">
            <div className="wf-tm-about-founder-name">{f.name}</div>
            <div className="wf-tm-about-founder-role">// {pickL(f.role)}</div>
            <div className="wf-tm-prose" style={{ marginTop: 12 }}>
              {pickL(f.bio).map((p, i) => <p key={i} className="wf-tm-prose-p">{p}</p>)}
            </div>
            <div className="wf-tm-about-stats">
              {f.stats.map((st, i) => (
                <div className="wf-tm-about-stat" key={i}>
                  <span className="wf-tm-about-stat-v">{st.v}</span>
                  <span className="wf-tm-about-stat-k">{pickL(st.k)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* team */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## команда</div>
        <div className="wf-tm-about-team">
          {t.members.map((m, i) => (
            <div className="wf-tm-about-member" key={i}>
              <WfAvatar kind={m.avatar} size="lg" />
              <div className="wf-tm-about-member-main">
                <div className="wf-tm-about-member-name">{m.name}</div>
                <div className="wf-tm-about-member-role">// {pickL(m.role)}</div>
                <div className="wf-tm-about-member-focus">{pickL(m.focus)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* principles */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## принципи</div>
        <div className="wf-tm-about-principles">
          {pickL(t.principles).map((p, i) => (
            <div className="wf-tm-about-principle" key={i}>
              <div className="wf-tm-about-principle-n">[{String(i + 1).padStart(2, '0')}]</div>
              <div>
                <div className="wf-tm-about-principle-t">{p[0]}</div>
                <div className="wf-tm-about-principle-d">{p[1]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="wf-tm-cta-band">
        <div>
          <div className="wf-tm-cta-band-t">{ua ? 'Хочете працювати з нами?' : 'Want to work with us?'}</div>
          <div className="wf-tm-cta-band-sub">{ua ? '// почнемо з короткого дзвінка' : '// let’s start with a short call'}</div>
        </div>
        <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">[ {ua ? 'звʼязатися' : 'get in touch'} → ]</a>
      </div>
    </TermPageShell>
  );
}

// ════════════════════════ /contact ════════════════════════
const CONTACT_ICON = {
  telegram: <path d="M21 4L3 11l6 2 2 6 3-4 4 3 3-14z" />,
  mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M3 6l9 7 9-7" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></>),
};

function ContactPage({ initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  const c = window.WF_CONTACT;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  const fields = pickL(c.fields);
  return (
    <TermPageShell
      cwd="~/illia/workflo/contact"
      crumbs={[{ label: '~', href: '#top' }, { label: 'contact' }]}
      cmd="cat ~/contact.md"
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> contact</span><span className="wf-tm-sb-sep">·</span><span>{ua ? 'відповідь у день' : 'same-day reply'}</span></>}
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">{ua ? 'Контакт' : 'Contact'}</h1>
        <p className="wf-tm-page-lead">{pickL(c.intro)}</p>
      </div>

      <div className="wf-tm-contact">
        {/* form */}
        <form className="wf-tm-contact-form" onSubmit={(e) => e.preventDefault()}>
          <div className="wf-tm-contact-form-h">// напишіть задачу</div>
          {fields.map((fld) => (
            <div className="wf-tm-field" key={fld.id}>
              <label className="wf-tm-field-label">{fld.label}</label>
              {fld.type === 'textarea' ? (
                <textarea className="wf-tm-field-input wf-tm-field-textarea" placeholder={fld.placeholder} rows={4} />
              ) : fld.type === 'select' ? (
                <select className="wf-tm-field-input">
                  {fld.options.map((o, i) => <option key={i}>{o}</option>)}
                </select>
              ) : (
                <input className="wf-tm-field-input" placeholder={fld.placeholder} />
              )}
            </div>
          ))}
          <button className="wf-tm-btn wf-tm-btn--primary wf-tm-contact-submit" type="submit">
            [ {ua ? 'надіслати' : 'send'} → ]
          </button>
          <div className="wf-tm-contact-reasons">
            {pickL(c.reasons).map((r, i) => (
              <span className="wf-tm-contact-reason" key={i}><span className="wf-tm-bullet" style={{ color: 'var(--wf-accent)' }}>✓</span> {r}</span>
            ))}
          </div>
        </form>

        {/* channels */}
        <aside className="wf-tm-contact-channels">
          <div className="wf-tm-contact-form-h">// або напряму</div>
          {c.channels.map((ch) => (
            <a key={ch.kind} className="wf-tm-contact-channel" href={ch.href} data-primary={ch.primary || undefined}>
              <span className="wf-tm-contact-channel-ic">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{CONTACT_ICON[ch.kind]}</svg>
              </span>
              <div className="wf-tm-contact-channel-main">
                <div className="wf-tm-contact-channel-label">{ch.label}</div>
                <div className="wf-tm-contact-channel-val">{ch.value}</div>
              </div>
              <span className="wf-tm-contact-channel-note">{pickL(ch.note)}</span>
            </a>
          ))}
          <div className="wf-tm-contact-meta">
            <div className="wf-tm-contact-meta-row"><span>{ua ? 'Працюємо' : 'Hours'}</span><span>Пн–Пт · 10:00–19:00 (EET)</span></div>
            <div className="wf-tm-contact-meta-row"><span>{ua ? 'Оплата' : 'Billing'}</span><span>ФОП · USD/₴ · USDT</span></div>
            <div className="wf-tm-contact-meta-row"><span>NDA</span><span>{ua ? 'за потреби' : 'on request'}</span></div>
          </div>
        </aside>
      </div>
    </TermPageShell>
  );
}

// ════════════════════════ /500 — server error ════════════════════════
function Error500({ initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  return (
    <TermPageShell
      cwd="~/illia/workflo"
      cmd="curl -I workflo.space"
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="#D97706" /> 500</span><span className="wf-tm-sb-sep">·</span><span>internal error</span></>}
    >
      <div className="wf-tm-err">
        <div className="wf-tm-err-code">HTTP/1.1 500</div>
        <pre className="wf-tm-err-art">{`  500  ~  щось зламалось у нас
  ──────────────────────────
  $ tail -f /var/log/workflo.log
  [error] unexpected — не ваша провина`}</pre>
        <h1 className="wf-tm-page-h1">{ua ? 'Внутрішня помилка' : 'Internal error'}</h1>
        <p className="wf-tm-page-lead" style={{ maxWidth: '54ch' }}>
          {ua
            ? 'Це збій на нашому боці, не ваш. Ми вже бачимо логи. Спробуйте оновити сторінку за хвилину — або напишіть нам, якщо повторюється.'
            : 'This is a failure on our side, not yours. We can see the logs. Try refreshing in a minute — or message us if it persists.'}
        </p>
        <div className="wf-tm-page-ctas">
          <a className="wf-tm-btn" href="#top">[ ← {ua ? 'на головну' : 'home'} ]</a>
          <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">[ {ua ? 'написати в підтримку' : 'contact support'} → ]</a>
        </div>
      </div>
    </TermPageShell>
  );
}

Object.assign(window, { ServicesIndex, ServicePage, AboutPage, ContactPage, Error500 });
