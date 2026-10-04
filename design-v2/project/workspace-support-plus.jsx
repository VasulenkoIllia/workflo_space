// workspace-support-plus.jsx — Support module 29:
// WsCannedReplies (29-А) · WsKnowledgeBase (29-Б, manage) ·
// PortalHelp (29-Б browse + suggest at ticket · 29-В CSAT).

const _sp = React.useState;

const CANNED = [
  { id: 'c1', cat: 'Білінг', shortcut: '/invoice', title: 'Як оплатити рахунок', text: 'Рахунок можна оплатити карткою прямо за посиланням у листі або банківським переказом за реквізитами в розділі «Фінанси». У призначенні вкажіть номер рахунку.' },
  { id: 'c2', cat: 'Білінг', shortcut: '/overdue', title: 'Нагадування про борг', text: 'Звертаємо увагу, що по рахунку {{invoice}} настав термін оплати. Будь ласка, оплатіть найближчим часом або напишіть, якщо потрібна відстрочка.' },
  { id: 'c3', cat: 'Робота', shortcut: '/eta', title: 'Орієнтовний термін', text: 'Дякуємо за звернення! Орієнтовно повернемось із результатом протягом {{time}}. Тримаємо в курсі в цьому ж чаті.' },
  { id: 'c4', cat: 'Робота', shortcut: '/access', title: 'Запит доступів', text: 'Щоб продовжити, потрібні доступи до {{service}}. Додайте їх, будь ласка, у розділ «Секрети» вашої картки — там вони зашифровані.' },
  { id: 'c5', cat: 'Загальне', shortcut: '/hello', title: 'Привітання', text: 'Вітаємо! На звʼязку команда workflo.space. Чим можемо допомогти?' },
];

const KB = [
  { id: 'k1', cat: 'Старт', title: 'Як створити перше замовлення', excerpt: 'Покроково: від брифу до погодження кошторису.', views: 412, helpful: 94 },
  { id: 'k2', cat: 'Білінг', title: 'Способи оплати та реквізити', excerpt: 'Картка, банківський переказ, USDT. Як вказати призначення.', views: 388, helpful: 91 },
  { id: 'k3', cat: 'Білінг', title: 'Що таке абонплата і години', excerpt: 'Як працює включений ліміт годин і що відбувається при перевищенні.', views: 256, helpful: 88 },
  { id: 'k4', cat: 'Документи', title: 'Як сформувати акт звірки', excerpt: 'Self-service генерація документів у порталі.', views: 174, helpful: 96 },
  { id: 'k5', cat: 'Безпека', title: 'Як додати ключі та доступи', excerpt: 'Типізовані секрети, 2FA для перегляду, журнал доступів.', views: 142, helpful: 90 },
];

// ════════════════ Canned replies (29-А) ════════════════
function WsCannedReplies() {
  const [q, setQ] = _sp('');
  const [create, setCreate] = _sp(false);
  const [copied, setCopied] = _sp(null);
  const cats = [...new Set(CANNED.map((c) => c.cat))];
  const rows = CANNED.filter((c) => (c.title + c.text + c.shortcut).toLowerCase().includes(q.toLowerCase()));
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Шаблони відповідей</h1><div className="wfp-ph-sub">// canned replies · спільні для тікетів і чатів замовлень</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => setCreate(true)}><Icon name="plus" size={14} />Шаблон</button></div>
      </div>
      <div className="wfp-filters"><div className="wfp-search"><Icon name="search" size={14} color="var(--wf-fg-muted)" /><input placeholder="Шукати шаблон або /скорочення…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      {cats.map((cat) => {
        const list = rows.filter((c) => c.cat === cat);
        if (!list.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 22 }}>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t" style={{ fontSize: 13 }}>{cat}</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
              {list.map((c) => (
                <div key={c.id} className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.title}</div>
                    <span className="wfl-card-chip" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--wf-accent)' }}>{c.shortcut}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)', lineHeight: 1.5 }}>{c.text}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="wfp-btn wfp-btn--sm" onClick={() => { setCopied(c.id); setTimeout(() => setCopied(null), 1200); }}><Icon name={copied === c.id ? 'check' : 'copy'} size={12} />{copied === c.id ? 'Скопійовано' : 'Копіювати'}</button>
                    <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Редагувати · демо', 'ok')}><Icon name="edit" size={12} />Редагувати</button>
                  </div>
                </div></div>
              ))}
            </div>
          </div>
        );
      })}
      {create && <CannedModal onClose={() => setCreate(false)} />}
    </React.Fragment>
  );
}
function CannedModal({ onClose }) {
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 520, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="edit" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Новий шаблон</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfc-grid2"><div className="wfp-field"><label>Категорія</label><input placeholder="напр. Білінг" /></div><div className="wfp-field"><label>Скорочення</label><input placeholder="/shortcut" /></div></div>
          <div className="wfp-field" style={{ marginTop: 12 }}><label>Заголовок</label><input /></div>
          <div className="wfp-field" style={{ marginTop: 12 }}><label>Текст (підтримує {'{{змінні}}'})</label><textarea className="wfl-select" style={{ height: 90, padding: '8px 10px', resize: 'vertical' }} /></div>
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 29-А</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={onClose}>Зберегти</button></div></div>
      </div>
    </div>
  );
}

// ════════════════ Knowledge base — manage (29-Б) ════════════════
function WsKnowledgeBase() {
  const [edit, setEdit] = _sp(null);
  if (edit) return <KbEditor article={KB.find((k) => k.id === edit)} onBack={() => setEdit(null)} />;
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">База знань</h1><div className="wfp-ph-sub">// статті для клієнтів · підказки при створенні тікета</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary"><Icon name="plus" size={14} />Стаття</button></div>
      </div>
      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">статей</div><div className="wfp-stat-v">{KB.length}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">переглядів (30д)</div><div className="wfp-stat-v wfp-stat-v--accent">{KB.reduce((s, k) => s + k.views, 0)}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">сер. корисність</div><div className="wfp-stat-v">{Math.round(KB.reduce((s, k) => s + k.helpful, 0) / KB.length)}%</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">дефлекшн тікетів</div><div className="wfp-stat-v">31%</div></div>
      </div>
      <table className="wfp-table">
        <thead><tr><th>Стаття</th><th>Категорія</th><th className="wfp-num">Перегляди</th><th className="wfp-num">Корисність</th><th></th></tr></thead>
        <tbody>{KB.map((k) => (
          <tr key={k.id}>
            <td><span className="wfp-link" style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => setEdit(k.id)}>{k.title}</span><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{k.excerpt}</div></td>
            <td><span className="wfl-card-chip">{k.cat}</span></td>
            <td className="wfp-num">{k.views}</td>
            <td className="wfp-num"><span style={{ color: k.helpful >= 90 ? 'var(--wf-success)' : 'var(--wf-warning)' }}>{k.helpful}%</span></td>
            <td style={{ textAlign: 'right' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setEdit(k.id)}>Редагувати</button></td>
          </tr>
        ))}</tbody>
      </table>
    </React.Fragment>
  );
}
function KbEditor({ article, onBack }) {
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />база знань</button><h1 className="wfp-ph-h1" style={{ marginTop: 6 }}>{article.title}</h1></div>
        <div className="wfp-ph-r"><button className="wfp-btn"><Icon name="eye" size={14} />Прев'ю</button><button className="wfp-btn wfp-btn--primary"><Icon name="check" size={14} />Опублікувати</button></div>
      </div>
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, alignItems: 'start' }}>
        <div className="wfl-panel"><div className="wfl-panel-h"><span>// редактор</span></div>
          <textarea style={{ width: '100%', minHeight: 320, border: 0, padding: 18, background: 'var(--wf-bg)', color: 'var(--wf-fg)', font: 'inherit', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }} defaultValue={`# ${article.title}\n\n${article.excerpt}\n\n## Кроки\n1. …\n2. …\n\n> Підказка: …`} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 12 }}>
            <div className="wfp-field"><label>Категорія</label><input defaultValue={article.cat} /></div>
            <div className="wfp-field"><label>Видимість</label><select className="wfl-select"><option>Усі клієнти</option><option>Лише тенант</option></select></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}><input type="checkbox" defaultChecked />Пропонувати при створенні тікета</label>
          </div></div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ════════════════ Portal: Довідка (KB + suggest + CSAT) ════════════════
function PortalHelp() {
  const [q, setQ] = _sp('');
  const [creating, setCreating] = _sp(false);
  const rows = KB.filter((k) => (k.title + k.excerpt + k.cat).toLowerCase().includes(q.toLowerCase()));
  return (
    <React.Fragment>
      <PageHeader title="Довідка" subtitle="// база знань · підтримка" />

      {/* CSAT prompt for last resolved ticket (29-В) */}
      <PortalCsat />

      <div className="wfo-searchbar" style={{ maxWidth: 560, margin: '4px 0 20px' }}>
        <Icon name="search" size={15} color="var(--wf-fg-muted)" />
        <input placeholder="Опишіть питання…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        {rows.map((k) => (
          <div key={k.id} className="wfl-panel" style={{ cursor: 'pointer' }}><div className="wfl-panel-b" style={{ gap: 8 }}>
            <span className="wfl-card-chip" style={{ alignSelf: 'flex-start' }}>{k.cat}</span>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{k.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)' }}>{k.excerpt}</div>
            <div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{k.helpful}% вважають корисною</div>
          </div></div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', border: '1px solid var(--wf-border)', borderRadius: 12, background: 'var(--wf-subtle)' }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--wf-fg-secondary)' }}>Не знайшли відповідь? Створіть звернення — підкажемо особисто.</div>
        <button className="wfp-btn wfp-btn--primary" onClick={() => setCreating(true)}><Icon name="plus" size={14} />Створити тікет</button>
      </div>

      {creating && <TicketWithSuggest onClose={() => setCreating(false)} />}
    </React.Fragment>
  );
}

function PortalCsat() {
  const [rating, setRating] = _sp(0);
  const [done, setDone] = _sp(false);
  if (done) return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'color-mix(in oklab, var(--wf-success) 10%, transparent)', marginBottom: 20, fontSize: 13 }}><Icon name="check" size={16} color="var(--wf-success)" />Дякуємо за оцінку!</div>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, background: 'var(--wf-accent-soft)', border: '1px solid var(--wf-accent)', marginBottom: 20 }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>Як ми впорались із тікетом TK-1042?</div><div style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>«Інтеграція оплати» · закрито вчора</div></div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => { setRating(n); setTimeout(() => setDone(true), 400); }} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 2, color: n <= rating ? 'var(--wf-accent-bg, #C5F82A)' : 'var(--wf-fg-subtle)' }} title={`${n}/5`}>
            <Icon name="star" size={24} />
          </button>
        ))}
      </div>
    </div>
  );
}

function TicketWithSuggest({ onClose }) {
  const [subj, setSubj] = _sp('');
  const suggestions = subj.length > 2 ? KB.filter((k) => k.title.toLowerCase().includes(subj.toLowerCase()) || k.cat.toLowerCase().includes(subj.toLowerCase()) || subj.toLowerCase().split(' ').some((w) => w.length > 3 && (k.title + k.excerpt).toLowerCase().includes(w))).slice(0, 3) : [];
  const [sent, setSent] = _sp(false);
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 520, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="inbox" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Нове звернення</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          {!sent ? (
            <React.Fragment>
              <div className="wfp-field"><label>Тема</label><input placeholder="Коротко опишіть питання…" value={subj} onChange={(e) => setSubj(e.target.value)} /></div>
              {suggestions.length > 0 && (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 9, background: 'var(--wf-subtle)' }}>
                  <div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-muted)', marginBottom: 8 }}>// можливо, це допоможе одразу:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {suggestions.map((k) => (
                      <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, cursor: 'pointer' }}><Icon name="file" size={13} color="var(--wf-accent)" /><span style={{ fontWeight: 500 }}>{k.title}</span><Icon name="chev_r" size={12} color="var(--wf-fg-subtle)" /></div>
                    ))}
                  </div>
                </div>
              )}
              <div className="wfp-field" style={{ marginTop: 12 }}><label>Опис</label><textarea className="wfl-select" style={{ height: 80, padding: '8px 10px', resize: 'vertical' }} /></div>
            </React.Fragment>
          ) : <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)' }}>✓ звернення створено · TK-1043 · відповімо протягом 4 год</div>}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 29-Б</span><div style={{ display: 'flex', gap: 8 }}>{!sent ? <React.Fragment><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={() => setSent(true)}>Надіслати</button></React.Fragment> : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}</div></div>
      </div>
    </div>
  );
}

Object.assign(window, { WsCannedReplies, WsKnowledgeBase, PortalHelp, PortalCsat });
