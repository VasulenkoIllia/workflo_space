// landing-pricing.jsx — public Pricing (tiers + comparison + FAQ, currency
// toggle) and Legal (Terms / Privacy) pages. Uses the shared <TermPageShell>
// from landing-blog.jsx so the window chrome stays identical.

const { useState: _lp_ts } = React;

// ─────── /pricing ───────
function PricingPage({ initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  const d = window.WF_PRICING;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  const [cur, setCur] = _lp_ts('usd');
  const [open, setOpen] = _lp_ts(0);

  const toUah = (s) => s.replace(/[\d\s]+/g, (m) => {
    const n = parseInt(m.replace(/\s/g, ''), 10);
    if (!n) return m;
    return Math.round(n * d.fx).toLocaleString('uk-UA');
  });
  const showAmount = (usd) => cur === 'usd' ? `$ ${usd}` : `₴ ${toUah(usd)}`;

  const cols = d.compare.cols[initLang] || d.compare.cols.ua;
  const rows = d.compare.rows[initLang] || d.compare.rows.ua;
  const faq = d.faq[initLang] || d.faq.ua;

  return (
    <TermPageShell
      cwd="~/illia/workflo/pricing"
      crumbs={[{ label: '~', href: '#top' }, { label: 'pricing' }]}
      cmd="cat ~/pricing.md"
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> pricing</span><span className="wf-tm-sb-sep">·</span><span>{ua ? '3 моделі співпраці' : '3 engagement models'}</span></>}
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="wf-tm-page-h1">{ua ? 'Тарифи' : 'Pricing'}</h1>
            <p className="wf-tm-page-lead">{ua ? 'Три способи працювати разом. Обираєте за тим, наскільки чіткий скоуп і чи потрібен постійний партнер.' : 'Three ways to work together. Pick by how defined the scope is and whether you need an ongoing partner.'}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div className="wf-tm-price-toggle">
              <button data-on={cur === 'usd' || undefined} onClick={() => setCur('usd')}>USD $</button>
              <button data-on={cur === 'uah' || undefined} onClick={() => setCur('uah')}>UAH ₴</button>
            </div>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>// курс ≈ {d.fx} ₴/$</span>
          </div>
        </div>
      </div>

      {/* tier cards */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## models</div>
        <div className="wf-tm-price-grid">
          {d.tiers.map((t) => (
            <div key={t.id} className="wf-tm-price-card" data-featured={t.featured || undefined}>
              {t.featured && <span className="wf-tm-price-badge">{ua ? 'найпопулярніше' : 'most popular'}</span>}
              <div>
                <div className="wf-tm-price-name">{pickL(t.name)}</div>
                <div className="wf-tm-price-tagline">{pickL(t.tagline)}</div>
              </div>
              <div className="wf-tm-price-amount">
                <span className="wf-tm-price-amount-v">{showAmount(t.priceUsd)}</span>
                <span className="wf-tm-price-amount-u">{pickL(t.unit)}</span>
              </div>
              <div className="wf-tm-price-features">
                {(t.features[initLang] || t.features.ua).map((f, i) => (
                  <div key={i} className="wf-tm-price-feat">
                    <span className="wf-tm-price-feat-check">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <a className={`wf-tm-btn${t.featured ? ' wf-tm-btn--primary' : ''}`} href="#contact" style={{ justifyContent: 'center' }}>[ {pickL(t.cta)} → ]</a>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-muted)', marginTop: 12 }}>// {pickL(d.note)}</div>
      </div>

      {/* comparison */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## compare</div>
        <table className="wf-tm-price-table">
          <thead>
            <tr>
              <th></th>
              {cols.map((c, i) => <th key={i}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => <td key={j}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FAQ */}
      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## faq</div>
        <div className="wf-tm-faq">
          {faq.map(([q, a], i) => (
            <div key={i} className="wf-tm-faq-item" onClick={() => setOpen(open === i ? -1 : i)} style={{ cursor: 'pointer' }}>
              <div className="wf-tm-faq-q">{q}</div>
              {open === i && <div className="wf-tm-faq-a">{a}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="wf-tm-cta-band">
        <div>
          <div className="wf-tm-cta-band-t">{ua ? 'Не впевнені, яка модель ваша?' : 'Not sure which model fits?'}</div>
          <div className="wf-tm-cta-band-sub">{ua ? '// напишіть задачу — підкажу на дзвінку' : '// send the problem — I’ll advise on a call'}</div>
        </div>
        <a className="wf-tm-btn wf-tm-btn--primary" href="#contact">[ {ua ? 'обговорити' : 'let’s talk'} → ]</a>
      </div>
    </TermPageShell>
  );
}

// ─────── /terms · /privacy ───────
function LegalPage({ kind = 'terms', initLang = 'ua', theme = 'light', accent = 'lime', crtGlow = false }) {
  const ua = initLang === 'ua';
  const doc = window.WF_LEGAL[kind] || window.WF_LEGAL.terms;
  const pickL = (o) => (o && (o[initLang] || o.ua)) || '';
  const sections = doc.sections[initLang] || doc.sections.ua;

  return (
    <TermPageShell
      cwd={`~/illia/workflo/legal/${kind}`}
      crumbs={[{ label: '~', href: '#top' }, { label: 'legal', href: '#legal' }, { label: kind }]}
      cmd={`less ~/legal/${kind}.txt`}
      theme={theme} accent={accent} crtGlow={crtGlow}
      statusLeft={<><span className="wf-tm-sb-branch"><StatusDot accent="var(--wf-accent)" /> legal/{kind}</span><span className="wf-tm-sb-sep">·</span><span>{pickL(doc.updated)}</span></>}
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 6 }}>
        <h1 className="wf-tm-page-h1">{pickL(doc.title)}</h1>
        <div className="wf-tm-legal-updated">{pickL(doc.updated)}</div>
        <p className="wf-tm-legal-intro">{pickL(doc.intro)}</p>
      </div>

      <div className="wf-tm-md-section wf-tm-legal">
        {/* TOC */}
        <nav className="wf-tm-legal-toc">
          <div className="wf-tm-art-toc-h">## {ua ? 'розділи' : 'sections'}</div>
          {sections.map(([h], i) => (
            <a key={i} className="wf-tm-art-toc-link" href={`#sec-${i}`}>{String(i + 1).padStart(2, '0')} · {h}</a>
          ))}
        </nav>
        {/* body */}
        <div className="wf-tm-legal-body">
          {sections.map(([h, p], i) => (
            <section key={i} id={`sec-${i}`} className="wf-tm-legal-sec">
              <div className="wf-tm-legal-sec-h">
                <span className="wf-tm-legal-sec-num">{String(i + 1).padStart(2, '0')}</span>
                <span>{h}</span>
              </div>
              <div className="wf-tm-legal-sec-body">{p}</div>
            </section>
          ))}

          <div className="wf-tm-cta-band" style={{ marginTop: 24 }}>
            <div>
              <div className="wf-tm-cta-band-t">{ua ? 'Питання щодо умов?' : 'Questions about the terms?'}</div>
              <div className="wf-tm-cta-band-sub">{ua ? '// напишіть — відповім особисто' : '// reach out — I’ll reply personally'}</div>
            </div>
            <a className="wf-tm-btn" href="#contact">[ {ua ? 'контакт' : 'contact'} → ]</a>
          </div>
        </div>
      </div>
    </TermPageShell>
  );
}

Object.assign(window, { PricingPage, LegalPage });
