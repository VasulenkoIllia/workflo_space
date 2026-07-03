// workspace-case-editor.jsx — Case editor (11-А AI draft-from-order · 11-Е SEO).
// Wraps the existing WorkspaceCases list; "Редагувати"/"Новий кейс" open this editor.

const _ce = React.useState;

// orders that can seed a case (AI draft source, 11-А)
const CE_ORDERS = [
  { id: 'ORD-2412', title: 'Інтеграція 1С ↔ Telegram-бот', client: 'Brunky', result: '−70% ручної координації' },
  { id: 'ORD-2388', title: 'API синхронізації складу', client: 'Tably', result: 'синхронізація 4 систем' },
  { id: 'ORD-2350', title: 'LMS платформа', client: 'EduForge', result: '+38% конверсія в premium' },
];

const CE_SECTIONS = ['Контекст', 'Задача', 'Рішення', 'Результат'];

function aiDraft(order) {
  return {
    title: `${order.client}: ${order.title}`,
    sections: {
      'Контекст': `${order.client} звернулися із задачею «${order.title}». До старту процеси були ручними, що з'їдало час команди.`,
      'Задача': `Зробити так, щоб ${order.title.toLowerCase()} працювала автоматично, надійно й масштабовано — без падінь під навантаженням.`,
      'Рішення': `Спроєктували архітектуру обміну, побудували чергу повідомлень і поетапно впровадили інтеграцію. Команда workflo.space супроводжувала на кожному кроці.`,
      'Результат': order.result + '. Клієнт отримав передбачуваний процес і прозору звітність.',
    },
    metrics: [
      { label: 'час на координацію', value: '−70%' },
      { label: 'тижнів до MVP', value: '6' },
      { label: 'аптайм інтеграції', value: '99.8%' },
    ],
  };
}

function CaseEditorScreen({ seed, onBack }) {
  const [order, setOrder] = _ce(seed || null);
  const [draft, setDraft] = _ce(null);
  const [gen, setGen] = _ce(false);
  const [title, setTitle] = _ce(seed ? seed.title : '');
  const [sections, setSections] = _ce({});
  const [seo, setSeo] = _ce({ metaTitle: '', metaDesc: '', slug: '', og: true, keywords: 'інтеграція, 1С, telegram, автоматизація' });
  const [ba, setBa] = _ce([{ metric: 'Час на координацію', before: '20 год/тижд', after: '6 год/тижд' }]);
  const baValid = ba.some((r) => r.metric.trim() && r.before.trim() && r.after.trim());
  const setBaRow = (i, k, v) => setBa(ba.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const addBa = () => setBa([...ba, { metric: '', before: '', after: '' }]);
  const rmBa = (i) => setBa(ba.filter((_, j) => j !== i));

  const runAi = () => {
    if (!order) return;
    setGen(true);
    setTimeout(() => {
      const d = aiDraft(order);
      setDraft(d); setTitle(d.title); setSections(d.sections);
      setSeo({ ...seo, metaTitle: d.title + ' — кейс workflo.space', metaDesc: d.sections['Результат'].slice(0, 150), slug: order.id.toLowerCase().replace('ord-', 'case-') });
      setGen(false);
    }, 1400);
  };

  // SEO scoring
  const seoChecks = [
    { ok: seo.metaTitle.length >= 30 && seo.metaTitle.length <= 60, label: `Meta title ${seo.metaTitle.length} симв. (30–60)` },
    { ok: seo.metaDesc.length >= 70 && seo.metaDesc.length <= 160, label: `Meta description ${seo.metaDesc.length} симв. (70–160)` },
    { ok: !!seo.slug, label: 'Slug заданий' },
    { ok: seo.keywords.split(',').filter((k) => k.trim()).length >= 3, label: 'Ключові слова ≥ 3' },
    { ok: seo.og, label: 'OG-картинка увімкнена' },
  ];
  const score = Math.round((seoChecks.filter((c) => c.ok).length / seoChecks.length) * 100);

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />кейси</button>
          <h1 className="wfp-ph-h1" style={{ marginTop: 6 }}>{title || 'Новий кейс'}</h1>
          <div className="wfp-ph-sub">// AI-чернетка із замовлення · SEO-оптимізація</div>
        </div>
        <div className="wfp-ph-r"><button className="wfp-btn"><Icon name="eye" size={14} />Прев'ю</button><button className="wfp-btn wfp-btn--primary" disabled={!baValid} title={baValid ? '' : 'Додайте хоча б одну пару До→Після'}><Icon name="check" size={14} />Опублікувати</button></div>
      </div>

      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}>
        <div>
          {/* AI draft generator (11-А) */}
          <div className="wfl-panel" style={{ marginBottom: 18, borderColor: 'var(--wf-accent)' }}>
            <div className="wfl-panel-b" style={{ gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--wf-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="star" size={15} color="var(--wf-fg)" /></span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>Згенерувати чернетку з замовлення</div><div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)' }}>AI складе структуру кейсу з даних замовлення — ви відредагуєте</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="wfl-select" style={{ flex: 1 }} value={order ? order.id : ''} onChange={(e) => setOrder(CE_ORDERS.find((o) => o.id === e.target.value))}>
                  <option value="">Оберіть замовлення-джерело…</option>
                  {CE_ORDERS.map((o) => <option key={o.id} value={o.id}>{o.id} · {o.title} ({o.client})</option>)}
                </select>
                <button className="wfp-btn wfp-btn--primary" disabled={!order || gen} onClick={runAi}>{gen ? <React.Fragment><span className="wfpi-spin" style={{ borderTopColor: '#0C0A09' }} />Генерую…</React.Fragment> : <React.Fragment><Icon name="star" size={13} />Згенерувати</React.Fragment>}</button>
              </div>
            </div>
          </div>

          <div className="wfp-field" style={{ marginBottom: 16 }}><label>Заголовок кейсу</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Клієнт: що зробили" /></div>

          {CE_SECTIONS.map((s) => (
            <div key={s} className="wfp-field" style={{ marginBottom: 16 }}>
              <label>{s}</label>
              <textarea className="wfl-select" style={{ height: 84, padding: '10px 12px', resize: 'vertical', lineHeight: 1.6 }} value={sections[s] || ''} onChange={(e) => setSections({ ...sections, [s]: e.target.value })} placeholder={`${s}…`} />
            </div>
          ))}

          {/* Before / After — обовʼязкові пари (11-А) */}
          <div className="wfc-sec-h">
            <span className="wfc-sec-h-t" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}>До → Після <span className="wfce-req" data-ok={baValid || undefined}>{baValid ? '✓ ок' : 'обовʼязково'}</span></span>
            <span className="wfc-sec-h-s">// показується на лендінгу як before/after</span>
          </div>
          <div className="wfce-ba">
            {ba.map((r, i) => (
              <div key={i} className="wfce-ba-row">
                <input className="wfce-ba-metric" value={r.metric} onChange={(e) => setBaRow(i, 'metric', e.target.value)} placeholder="Метрика (напр. Час на координацію)" />
                <input className="wfce-ba-before" value={r.before} onChange={(e) => setBaRow(i, 'before', e.target.value)} placeholder="було" />
                <Icon name="chevron" size={14} color="var(--wf-fg-subtle)" />
                <input className="wfce-ba-after" value={r.after} onChange={(e) => setBaRow(i, 'after', e.target.value)} placeholder="стало" />
                <button className="wfp-iconbtn" onClick={() => rmBa(i)} disabled={ba.length === 1} title="Прибрати"><Icon name="plus" size={13} style={{ transform: 'rotate(45deg)' }} /></button>
              </div>
            ))}
            <button className="wfce-ba-add" onClick={addBa}><Icon name="plus" size={12} />Додати пару</button>
          </div>

          {draft && (
            <div>
              <div className="wfc-sec-h"><span className="wfc-sec-h-t" style={{ fontSize: 13 }}>Метрики результату</span></div>
              <div style={{ display: 'flex', gap: 12 }}>
                {draft.metrics.map((m, i) => (
                  <div key={i} className="wfl-panel" style={{ flex: 1 }}><div className="wfl-panel-b" style={{ alignItems: 'center', gap: 2, textAlign: 'center' }}>
                    <input defaultValue={m.value} style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', border: 0, background: 'none', color: 'var(--wf-accent)', width: '100%' }} />
                    <input defaultValue={m.label} style={{ fontSize: 11, textAlign: 'center', border: 0, background: 'none', color: 'var(--wf-fg-muted)', width: '100%' }} />
                  </div></div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SEO panel (11-Е) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 0 }}>
          <div className="wfl-panel">
            <div className="wfl-panel-h"><span>// SEO</span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: score >= 80 ? 'var(--wf-success)' : score >= 50 ? 'var(--wf-warning)' : 'var(--wf-destructive)' }}>{score}/100</span></div>
            <div className="wfl-panel-b" style={{ gap: 12 }}>
              <div className="wfp-field"><label>Meta title</label><input value={seo.metaTitle} onChange={(e) => setSeo({ ...seo, metaTitle: e.target.value })} /><span className="wf-mono" style={{ fontSize: 10, color: seo.metaTitle.length > 60 ? 'var(--wf-destructive)' : 'var(--wf-fg-subtle)' }}>{seo.metaTitle.length}/60</span></div>
              <div className="wfp-field"><label>Meta description</label><textarea className="wfl-select" style={{ height: 60, padding: '7px 9px', resize: 'vertical' }} value={seo.metaDesc} onChange={(e) => setSeo({ ...seo, metaDesc: e.target.value })} /><span className="wf-mono" style={{ fontSize: 10, color: seo.metaDesc.length > 160 ? 'var(--wf-destructive)' : 'var(--wf-fg-subtle)' }}>{seo.metaDesc.length}/160</span></div>
              <div className="wfp-field"><label>Slug</label><input value={seo.slug} onChange={(e) => setSeo({ ...seo, slug: e.target.value })} placeholder="case-…" /></div>
              <div className="wfp-field"><label>Ключові слова</label><input value={seo.keywords} onChange={(e) => setSeo({ ...seo, keywords: e.target.value })} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}><input type="checkbox" checked={seo.og} onChange={(e) => setSeo({ ...seo, og: e.target.checked })} />OG-картинка для соцмереж</label>
            </div>
          </div>

          {/* SERP preview */}
          <div className="wfl-panel">
            <div className="wfl-panel-h"><span>// прев'ю в Google</span></div>
            <div className="wfl-panel-b" style={{ gap: 3 }}>
              <div style={{ fontSize: 11, color: '#1a73e8', fontFamily: 'arial' }}>workflo.space › cases › {seo.slug || 'case-…'}</div>
              <div style={{ fontSize: 15, color: '#1a0dab', fontFamily: 'arial', lineHeight: 1.3 }}>{seo.metaTitle || 'Meta title зʼявиться тут'}</div>
              <div style={{ fontSize: 12, color: '#4d5156', fontFamily: 'arial', lineHeight: 1.4 }}>{seo.metaDesc || 'Опис сторінки для пошукової видачі…'}</div>
            </div>
          </div>

          {/* checklist */}
          <div className="wfl-panel">
            <div className="wfl-panel-h"><span>// чекліст</span></div>
            <div className="wfl-panel-b" style={{ gap: 8 }}>
              {seoChecks.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12 }}>
                  <Icon name={c.ok ? 'check' : 'alert'} size={13} color={c.ok ? 'var(--wf-success)' : 'var(--wf-warning)'} />
                  <span style={{ color: c.ok ? 'var(--wf-fg-secondary)' : 'var(--wf-fg-muted)' }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// Wrapper: list (existing) → editor
function WorkspaceCasesV2() {
  const [editing, setEditing] = _ce(null); // null | {} (new) | caseObj
  if (editing !== null) return <CaseEditorScreen seed={editing.slug ? editing : null} onBack={() => setEditing(null)} />;
  const cases = window.WFP_CMS.cases;
  return (
    <React.Fragment>
      <PageHeader title="Кейси" subtitle="// портфоліо для лендінгу · AI-чернетка з замовлення + SEO">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Відкрити на сайті · демо', 'ok')}><Icon name="globe" size={14} />Відкрити на сайті</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => setEditing({})}><Icon name="plus" size={14} />Новий кейс</button>
      </PageHeader>
      <div className="wfc-cases">
        {cases.map((c) => (
          <div className="wfc-case" key={c.slug}>
            <div className="wfc-case-top">
              <WfAvatar kind={c.industry} size="md" shape="circle" />
              <div><div className="wfc-case-client">{c.client}</div><div className="wfc-case-ind">// {c.slug}</div></div>
              {c.featured && <span style={{ marginLeft: 'auto' }}><Icon name="star" size={15} color="var(--wf-accent)" /></span>}
            </div>
            <div className="wfc-case-body">
              <div className="wfc-case-title">{c.title}</div>
              <span className="wfc-case-result"><Icon name="check" size={12} />{c.result}</span>
            </div>
            <div className="wfc-case-foot">
              <CmsStatus s={c.status} />
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setEditing(c)}><Icon name="edit" size={12} />Редагувати</button>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { CaseEditorScreen, WorkspaceCasesV2 });
