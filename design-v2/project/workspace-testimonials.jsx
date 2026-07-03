// workspace-testimonials.jsx — Testimonial CRUD (14-Г) + landing blocks preview
// (14-Г відгуки+логотипи, 14-В CTA «Забронювати дзвінок»).

const _tm = React.useState;

const TESTIMONIALS = [
  { id: 't1', author: 'Олена Брунь', role: 'CEO', company: 'Brunky', text: 'Ілля зрозумів, що нам потрібен не просто бот, а нова схема комунікації з водіями. За шість тижнів ми перейшли від ручної координації до повністю автоматизованого циклу.', rating: 5, featured: true, published: true, avatar: 'ОБ' },
  { id: 't2', author: 'Дмитро Тарас', role: 'Засновник', company: 'EduForge', text: 'Серйозно думав, що бот — це чат-вікно з кнопочками. Виявилось, він закриває заперечення краще за нашого менеджера.', rating: 5, featured: true, published: true, avatar: 'ДТ' },
  { id: 't3', author: 'Ірина Коваль', role: 'COO', company: 'Tably', text: 'Ділова комунікація, чіткі дедлайни, фіксована ціна. Рідкість на ринку.', rating: 5, featured: false, published: true, avatar: 'ІК' },
  { id: 't4', author: 'Андрій Нор', role: 'CTO', company: 'NordStream', text: 'Кожен з нас тепер економить 4 години на тиждень. Команда зробила більше за квартал, ніж ми за два попередні.', rating: 4, featured: false, published: false, avatar: 'АН' },
];
const CLIENT_LOGOS = ['Brunky', 'EduForge', 'Tably', 'NordStream', 'Florèal', 'Kvit'];

function Stars({ n, size = 13 }) {
  return <span style={{ display: 'inline-flex', gap: 1 }}>{[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} color={i <= n ? 'var(--wf-accent)' : 'var(--wf-border-strong)'} />)}</span>;
}

function WsTestimonials() {
  const [items, setItems] = _tm(TESTIMONIALS);
  const [edit, setEdit] = _tm(null);
  const [preview, setPreview] = _tm(false);
  const togF = (id) => setItems(items.map((t) => t.id === id ? { ...t, featured: !t.featured } : t));
  const togP = (id) => setItems(items.map((t) => t.id === id ? { ...t, published: !t.published } : t));

  if (preview) return <LandingTestimonialsPreview items={items.filter((t) => t.published)} onBack={() => setPreview(false)} />;

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Відгуки</h1><div className="wfp-ph-sub">// CRUD відгуків · блок на лендінгу + логотипи клієнтів</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn" onClick={() => setPreview(true)}><Icon name="eye" size={14} />Прев'ю блоку</button><button className="wfp-btn wfp-btn--primary" onClick={() => setEdit({})}><Icon name="plus" size={14} />Відгук</button></div>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">усього</div><div className="wfp-stat-v">{items.length}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">опубліковано</div><div className="wfp-stat-v wfp-stat-v--accent">{items.filter((t) => t.published).length}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">у featured</div><div className="wfp-stat-v">{items.filter((t) => t.featured).length}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">сер. оцінка</div><div className="wfp-stat-v">{(items.reduce((s, t) => s + t.rating, 0) / items.length).toFixed(1)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
        {items.map((t) => (
          <div key={t.id} className="wfl-panel" style={{ opacity: t.published ? 1 : 0.62 }}><div className="wfl-panel-b" style={{ gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span className="wfo-av" data-team="true" style={{ width: 38, height: 38 }}>{t.avatar}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.author}</div><div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>{t.role} · {t.company}</div></div>
              <Stars n={t.rating} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.55, fontStyle: 'italic' }}>«{t.text}»</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid var(--wf-border)', flexWrap: 'wrap' }}>
              <button className="wfg-pill2" data-tone={t.featured ? 'accent' : 'muted'} style={{ cursor: 'pointer', border: 0 }} onClick={() => togF(t.id)}><Icon name="star" size={11} />{t.featured ? 'featured' : 'у featured'}</button>
              <button className="wfg-pill2" data-tone={t.published ? 'ok' : 'muted'} style={{ cursor: 'pointer', border: 0 }} onClick={() => togP(t.id)}><span className="wfg-pill2-dot" />{t.published ? 'опубліковано' : 'чернетка'}</button>
              <span style={{ flex: 1 }} />
              <button className="wfp-iconbtn" onClick={() => setEdit(t)}><Icon name="edit" size={14} /></button>
            </div>
          </div></div>
        ))}
      </div>
      {edit && <TestimonialModal item={edit} onClose={() => setEdit(null)} />}
    </React.Fragment>
  );
}

function TestimonialModal({ item, onClose }) {
  const [rating, setRating] = _tm(item.rating || 5);
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 500, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="star" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">{item.author ? 'Редагувати відгук' : 'Новий відгук'}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfc-grid2"><div className="wfp-field"><label>Автор</label><input defaultValue={item.author} /></div><div className="wfp-field"><label>Компанія</label><input defaultValue={item.company} /></div></div>
          <div className="wfp-field" style={{ marginTop: 12 }}><label>Посада</label><input defaultValue={item.role} /></div>
          <div className="wfp-field" style={{ marginTop: 12 }}><label>Текст відгуку</label><textarea className="wfl-select" style={{ height: 90, padding: '8px 10px', resize: 'vertical' }} defaultValue={item.text} /></div>
          <div className="wfp-field" style={{ marginTop: 12 }}><label>Оцінка</label>
            <div style={{ display: 'flex', gap: 3 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 2 }}><Icon name="star" size={22} color={n <= rating ? 'var(--wf-accent)' : 'var(--wf-border-strong)'} /></button>)}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}><input type="checkbox" defaultChecked={item.published} />Опублікувати</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}><input type="checkbox" defaultChecked={item.featured} />У featured-блок</label>
          </div>
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 14-Г</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={onClose}>Зберегти</button></div></div>
      </div>
    </div>
  );
}

// ── Landing preview: testimonials + logos (14-Г) + CTA booking (14-В) ──
function LandingTestimonialsPreview({ items, onBack }) {
  const feat = items.filter((t) => t.featured);
  const show = feat.length ? feat : items.slice(0, 3);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />відгуки</button><h1 className="wfp-ph-h1" style={{ marginTop: 6 }}>Прев'ю блоків лендінгу</h1></div>
      </div>

      <div style={{ background: 'var(--wf-fg)', borderRadius: 16, padding: '44px 40px', color: 'var(--wf-bg)' }}>
        {/* logos */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, opacity: 0.5, marginBottom: 18, letterSpacing: '0.1em' }}>// НАМ ДОВІРЯЮТЬ</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 28 }}>
            {CLIENT_LOGOS.map((l) => <span key={l} style={{ fontSize: 17, fontWeight: 700, opacity: 0.45, letterSpacing: '-0.01em' }}>{l}</span>)}
          </div>
        </div>

        {/* testimonials */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(show.length, 3)}, 1fr)`, gap: 20, marginBottom: 44 }}>
          {show.map((t) => (
            <div key={t.id} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 22 }}>
              <Stars n={t.rating} size={14} />
              <div style={{ fontSize: 14, lineHeight: 1.6, margin: '14px 0 18px' }}>«{t.text}»</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--wf-accent)', color: '#0C0A09', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>{t.avatar}</span>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{t.author}</div><div style={{ fontSize: 11, opacity: 0.55 }}>{t.role} · {t.company}</div></div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA booking (14-В) */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.12)', paddingTop: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>Готові обговорити ваш проєкт?</div>
          <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 22 }}>30 хвилин, без зобовʼязань — зрозуміємо задачу й запропонуємо рішення.</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--wf-accent)', color: '#0C0A09', padding: '14px 26px', borderRadius: 11, fontSize: 15, fontWeight: 600 }}><Icon name="calendar" size={17} />Забронювати дзвінок</span>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, opacity: 0.4, marginTop: 14 }}>// booking-link тип «Знайомство · 30 хв» (модуль 24)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--wf-subtle)', fontSize: 12.5, color: 'var(--wf-fg-secondary)' }}>
        <Icon name="alert" size={14} color="var(--wf-fg-muted)" />Так блок відображається на агенційному лендінгу. У featured показуються позначені відгуки; CTA веде на booking-link із модуля «Календар».
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { WsTestimonials });
