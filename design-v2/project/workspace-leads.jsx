// workspace-leads.jsx — G20 · Leads (module 26)
// /leads kanban (drag) · /leads/:id card · /settings/leads/pipelines editor.
// Source-icon set shared with integrations channels (window.WfSource).

const _l = React.useState;

// ── consistent channel/source icon-set ─────────────────────────────
const SRC = {
  form:     { label: 'Форма на сайті', color: '#0C0A09', glyph: <path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" /> },
  telegram: { label: 'Telegram',  color: '#229ED9', glyph: <path d="M21 4L3 11l5 2 2 6 3-4 5 4 3-15z" /> },
  instagram:{ label: 'Instagram', color: '#E1306C', glyph: <><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" /></> },
  tiktok:   { label: 'TikTok',    color: '#111111', glyph: <path d="M14 4c.6 2.5 2.2 3.8 4.5 4v3c-1.7 0-3.2-.5-4.5-1.4V16a5.5 5.5 0 1 1-5.5-5.5c.3 0 .7 0 1 .1v3.1a2.5 2.5 0 1 0 1.5 2.3V4h3z" /> },
  facebook: { label: 'Facebook',  color: '#1877F2', glyph: <path d="M14 8h2V5h-2.5C11.6 5 10 6.6 10 8.5V11H8v3h2v6h3v-6h2.2l.8-3H13V9c0-.6.4-1 1-1z" /> },
  whatsapp: { label: 'WhatsApp',  color: '#25D366', glyph: <path d="M4 20l1.4-4A8 8 0 1 1 9 19l-5 1zM9 8.5c-.3 0-.6.1-.8.4-.3.4-.8 1-.8 2s.8 2.1 1 2.3c1 1.5 2.4 2.5 4 3 .8.2 1.3.1 1.7-.2.4-.3.5-.9.4-1.2-.1-.2-.3-.3-.6-.5l-1-.5c-.2 0-.4-.1-.6.1l-.5.6c-.1.2-.3.2-.5.1-.7-.3-1.4-.9-1.9-1.7-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.5-1.1c-.1-.3-.3-.3-.5-.3z" /> },
  email:    { label: 'Email',     color: '#78716C', glyph: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></> },
  phone:    { label: 'Телефон',   color: '#16A34A', glyph: <path d="M5 4h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 1-2z" /> },
  referral: { label: 'Реферал',   color: '#D97706', glyph: <><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M3 9h18M12 9v11M12 9s-2.5-5-5-3 2 3 5 3zM12 9s2.5-5 5-3-2 3-5 3z" /></> },
  manual:   { label: 'Вручну',    color: '#A8A29E', glyph: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /> },
};

function WfSource({ id, size = 'md' }) {
  const s = SRC[id] || SRC.manual;
  return (
    <span className={`wfg-src${size === 'sm' ? ' wfg-src--sm' : size === 'lg' ? ' wfg-src--lg' : ''}`}
      style={{ background: s.color }} title={s.label}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{s.glyph}</svg>
    </span>
  );
}

// ── data ────────────────────────────────────────────────────────────
const LEAD_STAGES = [
  { id: 'new',      title: 'Нові',          color: '#0891B2', kind: 'open' },
  { id: 'contact',  title: 'Звʼязались',    color: '#6D28D9', kind: 'open' },
  { id: 'qualify',  title: 'Кваліфікація',  color: '#D97706', kind: 'open' },
  { id: 'proposal', title: 'Пропозиція',    color: '#A3D90D', kind: 'open' },
  { id: 'won',      title: 'Виграно',       color: '#16A34A', kind: 'won' },
  { id: 'lost',     title: 'Втрачено',      color: '#78716C', kind: 'lost' },
];

const LEAD_DATA = [
  { id: 'LD-318', col: 'new',      name: 'Андрій Мельник', co: 'CoffeeLab', src: 'form',     contact: 'andriy@coffeelab.ua', val: 3200, prio: 'high',   assignee: 'illia', time: '14 хв тому', handle: 'utm: google/cpc' },
  { id: 'LD-317', col: 'new',      name: 'Olena R.',        co: 'Petsy shop', src: 'instagram', contact: '@petsy.shop',        val: 1500, prio: 'normal', assignee: 'oleh',  time: '1 год тому', handle: 'IG DM' },
  { id: 'LD-316', col: 'new',      name: 'Тарас Б.',        co: '—',          src: 'telegram', contact: '@taras_b',           val: 0,    prio: 'low',    assignee: null,    time: '2 год тому', handle: '@workflo_bot' },
  { id: 'LD-314', col: 'contact',  name: 'Maria Kovach',    co: 'EduForge',   src: 'whatsapp', contact: '+380 67 221 04 18',  val: 5400, prio: 'high',   assignee: 'illia', time: 'вчора',      handle: 'WA Business' },
  { id: 'LD-312', col: 'contact',  name: 'Ihor S.',         co: 'NordStream', src: 'referral', contact: 'ihor@nordstream.io', val: 8800, prio: 'urgent', assignee: 'oleh',  time: '2 дні тому', handle: 'ref: Brunky' },
  { id: 'LD-309', col: 'qualify',  name: 'Софія Гнатюк',    co: 'Tably',      src: 'form',     contact: 'sofia@tably.app',    val: 12000,prio: 'urgent', assignee: 'illia', time: '3 дні тому', handle: 'utm: blog/cta' },
  { id: 'LD-305', col: 'qualify',  name: 'Dmytro L.',       co: 'Brewmaster', src: 'facebook', contact: 'fb.me/dmytro.l',     val: 2600, prio: 'normal', assignee: 'oleh',  time: '4 дні тому', handle: 'FB Lead Ad' },
  { id: 'LD-301', col: 'proposal', name: 'Kateryna V.',     co: 'Florèal',    src: 'tiktok',   contact: '@floreal.kyiv',      val: 4200, prio: 'high',   assignee: 'illia', time: '5 днів тому',handle: 'TikTok bio' },
  { id: 'LD-298', col: 'proposal', name: 'Богдан П.',       co: 'GreenHaus',  src: 'phone',    contact: '+380 50 118 22 90',  val: 6900, prio: 'normal', assignee: 'oleh',  time: 'тиждень',    handle: 'дзвінок' },
  { id: 'LD-289', col: 'won',      name: 'Anna Tkach',      co: 'Brunky',     src: 'referral', contact: 'anna@brunky.com',    val: 4200, prio: 'normal', assignee: 'illia', time: '12 днів',    handle: 'ref: EduForge' },
  { id: 'LD-276', col: 'lost',     name: 'Pavlo M.',        co: 'QuickShip',  src: 'email',    contact: 'pavlo@quickship.ua', val: 1800, prio: 'low',    assignee: 'oleh',  time: '3 тижні',    handle: 'lost: ціна', lostReason: 'Бюджет не зійшовся' },
];

const PRIO_LABEL = { urgent: 'терміново', high: 'високий', normal: 'звичайний', low: 'низький' };
const ASSIGNEE_NAME = { illia: 'Ілля', oleh: 'Олег' };
const money = (n) => n ? '$' + n.toLocaleString('uk-UA') : '—';

// ── A1 · /leads kanban board ────────────────────────────────────────
function LeadsBoard({ onOpen, onPipelines }) {
  const [leads, setLeads] = _l(LEAD_DATA);
  const [dragId, setDragId] = _l(null);
  const [overCol, setOverCol] = _l(null);
  const [filterSrc, setFilterSrc] = _l('all');

  const visible = filterSrc === 'all' ? leads : leads.filter((l) => l.src === filterSrc);
  const byCol = (cid) => visible.filter((l) => l.col === cid);
  const colSum = (cid) => byCol(cid).reduce((s, l) => s + l.val, 0);

  const drop = (cid) => {
    if (dragId) setLeads((xs) => xs.map((l) => (l.id === dragId ? { ...l, col: cid } : l)));
    setDragId(null); setOverCol(null);
  };

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Ліди</h1>
          <div className="wfp-ph-sub">// воронка вхідних · {leads.filter((l) => l.col !== 'won' && l.col !== 'lost').length} активних · конверсія 24%</div>
        </div>
        <div className="wfp-ph-r">
          <button className="wfp-btn" onClick={onPipelines}><Icon name="settings" size={14} />Воронки</button>
          <button className="wfp-btn wfp-btn--primary"><Icon name="plus" size={14} />Лід</button>
        </div>
      </div>

      <div className="wfp-filters">
        <div className="wfp-search">
          <Icon name="search" size={14} color="var(--wf-fg-muted)" />
          <input placeholder="Шукати лід, компанію, контакт…" />
        </div>
        <select className="wfl-select" style={{ width: 150, height: 34 }} value="default" onChange={() => {}}>
          <option value="default">Основна воронка</option>
          <option value="partners">Партнери / B2B</option>
        </select>
        <button className="wfp-pill" data-on={filterSrc === 'all' || undefined} onClick={() => setFilterSrc('all')}>усі джерела</button>
        {['form', 'telegram', 'instagram', 'whatsapp'].map((s) => (
          <button key={s} className="wfp-pill" data-on={filterSrc === s || undefined} onClick={() => setFilterSrc(filterSrc === s ? 'all' : s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <WfSource id={s} size="sm" />{SRC[s].label}
          </button>
        ))}
      </div>

      <div className="wfl-board">
        {LEAD_STAGES.map((col) => {
          const cards = byCol(col.id);
          return (
            <div key={col.id} className="wfl-col" data-kind={col.kind} data-over={overCol === col.id || undefined}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setOverCol(null); }}
              onDrop={() => drop(col.id)}>
              <div className="wfl-col-h">
                <span className="wfl-col-stripe" style={{ background: col.color }} />
                <span className="wfl-col-t">{col.title}</span>
                <span className="wfl-col-count">{cards.length}</span>
              </div>
              {colSum(col.id) > 0 && <div className="wfl-col-sum">Σ {money(colSum(col.id))}</div>}
              {cards.length === 0 ? (
                <div className="wfl-empty">// порожньо{overCol === col.id ? ' · відпусти тут' : ''}</div>
              ) : cards.map((l) => {
                const isWon = col.kind === 'won', isLost = col.kind === 'lost';
                return (
                  <div key={l.id} className="wfl-card" data-won={isWon || undefined} data-lost={isLost || undefined}
                    data-drag={dragId === l.id || undefined}
                    draggable={!isWon && !isLost}
                    onDragStart={() => setDragId(l.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onClick={() => onOpen(l.id)}>
                    <div className="wfl-card-top">
                      <WfSource id={l.src} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="wfl-card-name">{l.name}</div>
                        <div className="wfl-card-co">{l.co}</div>
                      </div>
                      <span className="wfg-prio" data-p={l.prio} title={PRIO_LABEL[l.prio]} />
                    </div>
                    <div className="wfl-card-mid">
                      <span className="wfl-card-chip"><Icon name={l.src === 'phone' ? 'send' : 'mail'} size={10} />{l.contact}</span>
                    </div>
                    <div className="wfl-card-foot">
                      <span className="wfl-card-foot-l">
                        {l.assignee ? <AvatarsStack ids={[l.assignee]} /> : <span className="wfl-card-time">не призначено</span>}
                        {l.val > 0 && <span className="wfl-card-val">{money(l.val)}</span>}
                      </span>
                      <span className="wfl-card-time">{isLost && l.lostReason ? '✕ ' + l.lostReason : l.time}</span>
                    </div>
                  </div>
                );
              })}
              {col.kind === 'open' && <button className="wfl-add" onClick={() => window.wfToast && window.wfToast('Додати лід · демо', 'ok')}><Icon name="plus" size={11} />Додати лід</button>}
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

// ── A2 · /leads/:id detail ──────────────────────────────────────────
const LEAD_ACTIVITY = [
  { kind: 'note',    who: 'Ілля',   ts: 'сьогодні 11:20', txt: 'Передзвонив — потрібна інтеграція складу з Rozetka API. Бюджет до $12k, дедлайн — кінець липня.' },
  { kind: 'stage',   who: 'Ілля',   ts: 'сьогодні 11:05', txt: 'Етап змінено: Звʼязались → Кваліфікація' },
  { kind: 'note',    who: 'Олег',   ts: 'вчора 16:40',    txt: 'Надіслав short-бриф у Telegram, чекаю відповіді по обсягу SKU.' },
  { kind: 'stage',   who: 'system', ts: '3 дні тому',     txt: 'Етап змінено: Нові → Звʼязались · auto (перша відповідь)' },
  { kind: 'inbound', who: 'system', ts: '3 дні тому',     txt: 'Лід створено з форми на сайті · utm_source=blog · utm_campaign=cta' },
];

function LeadDetail({ leadId, onBack }) {
  const lead = LEAD_DATA.find((l) => l.id === leadId) || LEAD_DATA[0];
  const [stage, setStage] = _l(lead.col);
  const [note, setNote] = _l('');
  const [acts, setActs] = _l(LEAD_ACTIVITY);
  const [convert, setConvert] = _l(false);
  const stageObj = LEAD_STAGES.find((s) => s.id === stage) || LEAD_STAGES[0];
  const converted = lead.col === 'won';

  const addNote = () => {
    if (!note.trim()) return;
    setActs((a) => [{ kind: 'note', who: 'Ілля', ts: 'щойно', txt: note.trim() }, ...a]);
    setNote('');
  };
  const changeStage = (v) => {
    setStage(v);
    const t = LEAD_STAGES.find((s) => s.id === v);
    setActs((a) => [{ kind: 'stage', who: 'Ілля', ts: 'щойно', txt: 'Етап змінено: ' + stageObj.title + ' → ' + t.title }, ...a]);
  };

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />ліди</button>
          <h1 className="wfp-ph-h1" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <WfSource id={lead.src} size="lg" />{lead.name}
            {converted && <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />конвертовано</span>}
          </h1>
          <div className="wfp-ph-sub">// {lead.id} · {lead.co} · {SRC[lead.src].label}</div>
        </div>
        <div className="wfp-ph-r">
          {lead.col === 'lost' ? (
            <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />втрачено · {lead.lostReason}</span>
          ) : converted ? (
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Відкрити клієнта · демо', 'ok')}><Icon name="building" size={14} />Відкрити клієнта</button>
          ) : (
            <button className="wfp-btn wfp-btn--primary" onClick={() => setConvert(true)}><Icon name="check" size={14} />Зробити клієнтом</button>
          )}
        </div>
      </div>

      <div className="wfl-detail">
        {/* left — contact + attribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="wfl-panel">
            <div className="wfl-panel-h">// контакт</div>
            <div className="wfl-panel-b">
              <div className="wfl-kv"><span className="wfl-kv-k">Імʼя</span><span className="wfl-kv-v">{lead.name}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Компанія</span><span className="wfl-kv-v">{lead.co}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Контакт</span><span className="wfl-kv-v wf-mono" style={{ fontSize: 12.5 }}>{lead.contact}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Орієнтовна сума</span><span className="wfl-kv-v">{money(lead.val)}</span></div>
            </div>
          </div>

          <div className="wfl-panel">
            <div className="wfl-panel-h">// атрибуція</div>
            <div className="wfl-panel-b">
              <div className="wfl-kv"><span className="wfl-kv-k">Джерело</span>
                <span className="wfl-kv-v" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><WfSource id={lead.src} size="sm" />{SRC[lead.src].label}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">UTM / handle</span><span className="wfl-kv-v wf-mono" style={{ fontSize: 12 }}>{lead.handle}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Створено</span><span className="wfl-kv-v">{lead.time}</span></div>
            </div>
          </div>

          <div className="wfl-panel">
            <div className="wfl-panel-h">// управління</div>
            <div className="wfl-panel-b">
              <div className="wfl-kv"><span className="wfl-kv-k">Етап</span>
                <select className="wfl-select" value={stage} onChange={(e) => changeStage(e.target.value)} disabled={converted || lead.col === 'lost'}>
                  {LEAD_STAGES.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Відповідальний</span>
                <select className="wfl-select" defaultValue={lead.assignee || ''}>
                  <option value="">— не призначено —</option>
                  <option value="illia">Ілля Васюленко</option>
                  <option value="oleh">Олег Шевчук</option>
                </select></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Пріоритет</span>
                <select className="wfl-select" defaultValue={lead.prio}>
                  {Object.keys(PRIO_LABEL).map((p) => <option key={p} value={p}>{PRIO_LABEL[p]}</option>)}
                </select></div>
            </div>
          </div>
        </div>

        {/* right — activity timeline */}
        <div className="wfl-panel">
          <div className="wfl-panel-h">// активність<span>{acts.length} подій</span></div>
          <div className="wfl-panel-b">
            <div className="wfl-noteinput" style={{ marginTop: 0, paddingTop: 0, borderTop: 0, borderBottom: '1px solid var(--wf-border)', paddingBottom: 16 }}>
              <textarea placeholder="Додати нотатку… @mention підтримується" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="wfp-btn wfp-btn--primary" style={{ alignSelf: 'flex-end' }} onClick={addNote}><Icon name="send" size={12} />Записати</button>
            </div>
            <div className="wfl-tl" style={{ marginTop: 16 }}>
              {acts.map((a, i) => (
                <div key={i} className="wfl-tl-row">
                  <span className="wfl-tl-dot" data-kind={a.kind}>
                    <Icon name={a.kind === 'note' ? 'edit' : a.kind === 'stage' ? 'kanban' : 'mail'} size={11} />
                  </span>
                  <div className="wfl-tl-body">
                    <div className="wfl-tl-txt">{a.txt}</div>
                    <div className="wfl-tl-meta">{a.who} · {a.ts}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {convert && <LeadConvertModal lead={lead} onClose={() => setConvert(false)} />}
    </React.Fragment>
  );
}

function LeadConvertModal({ lead, onClose }) {
  const [done, setDone] = _l(false);
  const [withProject, setWithProject] = _l(true);
  const [pName, setPName] = _l(lead.co !== '—' ? `${lead.co} · старт` : 'Перший проєкт');
  const [pModel, setPModel] = _l('fixed_monthly_advance');
  const MODELS = [['fixed_monthly_advance', 'Абонплата'], ['hourly_prepaid', 'Погодинно · передплата'], ['hourly_postpaid', 'Погодинно · постоплата']];
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 480, margin: 0 }}>
        <div className="wfp-modal-h">
          <Icon name="building" size={18} color="var(--wf-accent)" />
          <span className="wfp-modal-h-t">{done ? 'Клієнта створено' : 'Зробити клієнтом'}</span>
          <span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span>
        </div>
        <div className="wfp-modal-body">
          {!done ? (
            <React.Fragment>
              <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                Лід <strong>{lead.name}</strong> ({lead.co}) стане компанією-клієнтом. Власнику надійде запрошення в портал.
              </div>
              <div className="wfp-field" style={{ marginBottom: 14 }}><label>Назва компанії</label><input defaultValue={lead.co !== '—' ? lead.co : lead.name} /></div>
              <div className="wfp-field"><label>Email власника</label><input defaultValue={lead.contact.includes('@') && !lead.contact.startsWith('@') ? lead.contact : ''} placeholder="owner@company.com" /></div>

              <label className="wflc-projtoggle">
                <input type="checkbox" checked={withProject} onChange={(e) => setWithProject(e.target.checked)} />
                <span><strong>Створити перший проєкт</strong> відразу (26-А)<div className="wflc-projtoggle-s">лід → компанія + проєкт в один крок</div></span>
              </label>
              {withProject && (
                <div className="wflc-projbox">
                  <div className="wfp-field" style={{ marginBottom: 10 }}><label>Назва проєкту</label><input value={pName} onChange={(e) => setPName(e.target.value)} /></div>
                  <div className="wfp-field"><label>Білінг-модель</label><select className="wfl-select" value={pModel} onChange={(e) => setPModel(e.target.value)}>{MODELS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)', marginTop: 8 }}>// деталі ставок/валюти — у майстрі проєкту після створення</div>
                </div>
              )}
            </React.Fragment>
          ) : (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.7 }}>
              <div style={{ color: 'var(--wf-success)' }}>✓ Company «{lead.co}» створено</div>
              {withProject && <div style={{ color: 'var(--wf-success)' }}>✓ Проєкт «{pName}» створено ({MODELS.find((m) => m[0] === pModel)[1]})</div>}
              <div style={{ color: 'var(--wf-success)' }}>✓ Запрошення надіслано на {lead.contact}</div>
              <div style={{ color: 'var(--wf-fg-muted)' }}>· лід позначено як «Виграно»</div>
            </div>
          )}
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// {done ? 'done' : withProject ? 'lead → company + project' : 'lead → company'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {!done ? (
              <React.Fragment>
                <button className="wfp-btn" onClick={onClose}>Скасувати</button>
                <button className="wfp-btn wfp-btn--primary" onClick={() => setDone(true)}>{withProject ? 'Створити клієнта + проєкт' : 'Створити клієнта'}</button>
              </React.Fragment>
            ) : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── A3 · /settings/leads/pipelines ──────────────────────────────────
const PIPELINES = [
  { id: 'default', name: 'Основна воронка', isDefault: true, stages: LEAD_STAGES },
  { id: 'partners', name: 'Партнери / B2B', isDefault: false, stages: [
    { id: 'p1', title: 'Заявка',     color: '#0891B2', kind: 'open' },
    { id: 'p2', title: 'Демо',       color: '#6D28D9', kind: 'open' },
    { id: 'p3', title: 'Контракт',   color: '#A3D90D', kind: 'open' },
    { id: 'p4', title: 'Підписано',  color: '#16A34A', kind: 'won' },
    { id: 'p5', title: 'Відмова',    color: '#78716C', kind: 'lost' },
  ] },
];
const STAGE_COLORS = ['#0891B2', '#6D28D9', '#D97706', '#A3D90D', '#16A34A', '#DC2626', '#78716C'];
const KIND_LABEL = { open: 'open', won: 'won', lost: 'lost' };

function LeadsPipelines({ onBack }) {
  const [sel, setSel] = _l('default');
  const pipe = PIPELINES.find((p) => p.id === sel) || PIPELINES[0];
  const [stages, setStages] = _l(pipe.stages);
  React.useEffect(() => { setStages((PIPELINES.find((p) => p.id === sel) || PIPELINES[0]).stages); }, [sel]);

  const setColor = (i, c) => setStages((xs) => xs.map((s, j) => (j === i ? { ...s, color: c } : s)));
  const setKind = (i, k) => setStages((xs) => xs.map((s, j) => (j === i ? { ...s, kind: k } : s)));

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />ліди</button>
          <h1 className="wfp-ph-h1" style={{ marginTop: 6 }}>Воронки</h1>
          <div className="wfp-ph-sub">// /settings/leads/pipelines · етапи, кольори, типи</div>
        </div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зберегти · демо', 'ok')}><Icon name="check" size={14} />Зберегти</button></div>
      </div>

      <div className="wfl-pipe">
        <div>
          <div className="wfp-card-h"><div className="wfp-card-h-aux">// воронки</div></div>
          <div className="wfl-pipe-list">
            {PIPELINES.map((p) => (
              <div key={p.id} className="wfl-pipe-item" data-on={sel === p.id || undefined} onClick={() => setSel(p.id)}>
                <Icon name="kanban" size={14} color={sel === p.id ? 'var(--wf-accent)' : 'var(--wf-fg-muted)'} />
                <span className="wfl-pipe-item-n">{p.name}</span>
                {p.isDefault && <span className="wfg-pill2" data-tone="accent" style={{ fontSize: 9, padding: '1px 6px' }}>default</span>}
              </div>
            ))}
            <button className="wfl-add" style={{ marginTop: 4 }} onClick={() => window.wfToast && window.wfToast('Нова воронка · демо', 'ok')}><Icon name="plus" size={11} />Нова воронка</button>
          </div>
        </div>

        <div>
          <div className="wfp-card-h" style={{ marginBottom: 12 }}>
            <div className="wfp-card-h-t">{pipe.name}</div>
            <div className="wfp-card-h-aux">// {stages.length} етапів · drag для порядку</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stages.map((s, i) => (
              <div key={s.id} className="wfl-stage-row">
                <span className="wfl-stage-grip"><Icon name="list" size={13} /></span>
                <input className="wfl-stage-name" defaultValue={s.title} />
                <div className="wfl-swatches">
                  {STAGE_COLORS.map((c) => <span key={c} className="wfl-swatch" data-on={s.color === c || undefined} style={{ background: c }} onClick={() => setColor(i, c)} />)}
                </div>
                <select className="wfl-select" style={{ height: 30, fontSize: 11.5 }} value={s.kind} onChange={(e) => setKind(i, e.target.value)}>
                  {Object.keys(KIND_LABEL).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
                <button className="wfp-iconbtn" title="Видалити" onClick={() => window.wfToast && window.wfToast('Видалити · демо', 'ok')}><Icon name="plus" size={13} style={{ transform: 'rotate(45deg)' }} /></button>
              </div>
            ))}
            <button className="wfl-add" onClick={() => window.wfToast && window.wfToast('Додати етап · демо', 'ok')}><Icon name="plus" size={11} />Додати етап</button>
          </div>

          <div className="wfp-card-h" style={{ marginTop: 26, marginBottom: 4 }}><div className="wfp-card-h-aux">// прев'ю канбану</div></div>
          <div className="wfl-kanban-prev">
            {stages.map((s) => (
              <div key={s.id} className="wfl-kanban-prev-col" style={{ background: `color-mix(in oklab, ${s.color} 8%, transparent)`, border: `1px solid color-mix(in oklab, ${s.color} 30%, var(--wf-border))` }}>
                <div className="wfl-kanban-prev-h" style={{ color: s.color }}>{s.title}</div>
                <div className="wfl-kanban-prev-card" />
                <div className="wfl-kanban-prev-card" style={{ width: '70%' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ── router wrapper ──────────────────────────────────────────────────
function WorkspaceLeads() {
  const [view, setView] = _l({ name: 'board', id: null });
  if (view.name === 'detail') return <LeadDetail leadId={view.id} onBack={() => setView({ name: 'board' })} />;
  if (view.name === 'pipelines') return <LeadsPipelines onBack={() => setView({ name: 'board' })} />;
  return <LeadsBoard onOpen={(id) => setView({ name: 'detail', id })} onPipelines={() => setView({ name: 'pipelines' })} />;
}

Object.assign(window, { WorkspaceLeads, LeadsBoard, LeadDetail, LeadsPipelines, WfSource, LEAD_SRC: SRC });
