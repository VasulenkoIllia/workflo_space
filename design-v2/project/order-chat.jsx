// order-chat.jsx — enhanced order chat (03-МЕДІА/REPLY/Б/В/Г) + file states
// (04-В PDF lightbox, 04-Д AV scan) + order detail wrappers for both apps.

const _oc = React.useState;
const _oe = React.useEffect;

// ── message data (shared) ──
const OC_MSGS = [
  { id: 1, who: 'Олена (клієнт)', me: false, team: false, time: '09:02', text: 'Привіт! Скинула макети водійського застосунку — гляньте, будь ласка.', media: { type: 'image', items: ['driver-1.png', 'driver-2.png', 'flow.png'] } },
  { id: 2, who: 'Ілля · workflo', me: true, team: true, time: '09:14', text: 'Дякую! Беремо в роботу. Ось коротке голосове з першими думками щодо навігації.', media: { type: 'audio', dur: '0:48' } },
  { id: 3, who: 'Олена (клієнт)', me: false, team: false, time: '09:20', text: 'Ось ще ТЗ у PDF — там детальніше про інтеграцію з 1С.', media: { type: 'file', name: 'tz-1c-integration.pdf', size: '2.4 MB', kind: 'pdf', scan: 'clean' } },
  { id: 4, who: 'Ілля · workflo', me: true, team: true, time: '09:31', text: 'Прочитав. По п.4 — зробимо чергу повідомлень, щоб 1С не падала під навантаженням.', replyTo: 3 },
  { id: 5, who: 'Марія · workflo', me: false, team: true, time: '10:05', text: 'Записала демо поточного прототипу бота 👇', media: { type: 'video', dur: '1:12' } },
  { id: 6, who: 'Олена (клієнт)', me: false, team: false, time: '10:40', text: 'Виглядає супер! Додаю ще архів з логотипами.', media: { type: 'file', name: 'brand-assets.zip', size: '18 MB', kind: 'zip', scan: 'scanning' } },
];
const OC_PIN = { who: 'Ілля · workflo', text: 'Дедлайн MVP — 4 липня. Демо щосереди о 15:00. Гілка деплою: staging.brunky.app' };

function OcAvatar({ m }) { return <span className="wfo-av" data-team={m.team || undefined}>{m.who.slice(0, 2).toUpperCase()}</span>; }

// highlight matches inside a text node
function hl(text, q, curStart) {
  if (!q) return text;
  const parts = []; const low = text.toLowerCase(); const ql = q.toLowerCase();
  let i = 0, k = 0;
  while (i < text.length) {
    const idx = low.indexOf(ql, i);
    if (idx === -1) { parts.push(text.slice(i)); break; }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={k++} className="wfo-hl">{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
  }
  return parts;
}

// ── Lightbox (images + PDF viewer) ──
function OrderLightbox({ item, onClose }) {
  const [page, setPage] = _oc(1);
  _oe(() => { const h = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  const isPdf = item.kind === 'pdf';
  return (
    <div className="wfo-lb" onClick={(e) => { if (e.target.classList.contains('wfo-lb')) onClose(); }}>
      <div className="wfo-lb-top">
        <span className="wfo-lb-title">{isPdf ? item.name : (item.items ? item.items[item.idx] : 'image')}</span>
        <div className="wfo-lb-tools">
          <button className="wfo-lb-btn" title="Завантажити" onClick={() => window.wfToast && window.wfToast('Завантажити · демо', 'ok')}><Icon name="download" size={16} /></button>
          <button className="wfo-lb-btn" onClick={onClose} title="Закрити"><Icon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
      </div>
      <div className="wfo-lb-stage">
        {!isPdf && item.items && item.items.length > 1 && <button className="wfo-lb-arrow" onClick={() => item.setIdx((item.idx - 1 + item.items.length) % item.items.length)}><Icon name="chevron" size={20} style={{ transform: 'rotate(90deg)' }} /></button>}
        <div className="wfo-lb-canvas">
          {isPdf ? (
            <div className="wfo-pdf">
              <div className="wfo-pdf-page">
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#A8A29E', marginBottom: 18 }}>ТЗ · Інтеграція з 1С — сторінка {page}</div>
                <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#0C0A09' }}>{page === 1 ? '1. Загальні вимоги' : page === 2 ? '2. Архітектура обміну' : '3. Сценарії помилок'}</h2>
                {[...Array(6)].map((_, i) => <div key={i} style={{ height: 9, background: '#F0EFED', borderRadius: 3, marginBottom: 9, width: `${90 - (i % 3) * 14}%` }} />)}
                <div style={{ height: 120, background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 6, margin: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A8A29E', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{page === 2 ? 'REST → queue → 1С діаграма' : 'схема'}</div>
                {[...Array(4)].map((_, i) => <div key={i} style={{ height: 9, background: '#F0EFED', borderRadius: 3, marginBottom: 9, width: `${85 - i * 8}%` }} />)}
              </div>
            </div>
          ) : <div className="wfo-lb-img">{(item.items && item.items[item.idx]) || 'preview'}</div>}
        </div>
        {!isPdf && item.items && item.items.length > 1 && <button className="wfo-lb-arrow" onClick={() => item.setIdx((item.idx + 1) % item.items.length)}><Icon name="chev_r" size={20} /></button>}
      </div>
      {isPdf && (
        <div className="wfo-lb-pagebar">
          <button className="wfo-lb-btn" style={{ width: 30, height: 30 }} onClick={() => setPage(Math.max(1, page - 1))}><Icon name="chevron" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
          <span>сторінка {page} / 3 · pdf.js</span>
          <button className="wfo-lb-btn" style={{ width: 30, height: 30 }} onClick={() => setPage(Math.min(3, page + 1))}><Icon name="chev_r" size={14} /></button>
        </div>
      )}
    </div>
  );
}

// ── one message ──
function OcMessage({ m, q, onReply, onPin, onOpenImage, onOpenFile }) {
  const replied = m.replyTo ? OC_MSGS.find((x) => x.id === m.replyTo) : null;
  const [playing, setPlaying] = _oc(false);
  return (
    <div className="wfo-msg" data-me={m.me || undefined} id={`ocm-${m.id}`}>
      <OcAvatar m={m} />
      <div className="wfo-bubble-wrap">
        <div className="wfo-meta"><span className="wfo-who">{m.who}</span><span className="wfo-time">{m.time}</span></div>
        <div className="wfo-bubble">
          <div className="wfo-msg-actions">
            <button title="Відповісти" onClick={() => onReply(m)}><Icon name="chev_r" size={13} /></button>
            <button title="Закріпити" onClick={() => onPin(m)}><Icon name="star" size={13} /></button>
          </div>
          {replied && <div className="wfo-quote"><div className="wfo-quote-who">{replied.who}</div><div className="wfo-quote-t">{replied.text}</div></div>}
          <span>{hl(m.text, q)}</span>
          {m.media && m.media.type === 'image' && (
            <div className="wfo-media-img">
              {m.media.items.map((src, i) => (
                <div key={i} className="wfo-thumb" style={{ background: `linear-gradient(135deg, hsl(${70 + i * 40} 60% 55%), #44403c)` }} onClick={() => onOpenImage(m.media.items, i)}>{src}</div>
              ))}
            </div>
          )}
          {m.media && m.media.type === 'audio' && (
            <div className="wfo-audio">
              <button className="wfo-audio-play" onClick={() => setPlaying(!playing)}><Icon name={playing ? 'plus' : 'send'} size={13} style={playing ? { transform: 'rotate(45deg)' } : undefined} /></button>
              <div className="wfo-audio-wave">{[...Array(26)].map((_, i) => <span key={i} className="wfo-audio-bar" data-on={playing && i < 10 || undefined} style={{ height: `${20 + Math.abs(Math.sin(i * 1.3)) * 70}%` }} />)}</div>
              <span className="wfo-audio-time">{m.media.dur}</span>
            </div>
          )}
          {m.media && m.media.type === 'video' && (
            <div className="wfo-video" onClick={() => onOpenImage([m.media.dur + ' · demo.mp4'], 0)}>
              <span className="wfo-video-play"><Icon name="send" size={18} /></span>
              <span className="wfo-video-dur">{m.media.dur}</span>
            </div>
          )}
          {m.media && m.media.type === 'file' && (
            <div className="wfo-file">
              <span className="wfo-file-ic"><Icon name={m.media.kind === 'pdf' ? 'file' : 'paperclip'} size={17} /></span>
              <div style={{ flex: 1 }}>
                <div className="wfo-file-n">{m.media.name}</div>
                <div className="wfo-file-m">
                  {m.media.size}
                  {m.media.scan === 'scanning' ? <span className="wfo-scan"><span className="wfo-scan-spin" />перевірка антивірусом…</span> : <span className="wfo-clean"><Icon name="shield" size={11} />перевірено</span>}
                </div>
              </div>
              {m.media.scan === 'clean' && <button className="wfp-iconbtn" onClick={() => onOpenFile(m.media)} title={m.media.kind === 'pdf' ? 'Переглянути' : 'Завантажити'}><Icon name={m.media.kind === 'pdf' ? 'eye' : 'download'} size={15} /></button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── full chat ──
function OrderChatV2() {
  const [q, setQ] = _oc('');
  const [pinned, setPinned] = _oc(OC_PIN);
  const [reply, setReply] = _oc(null);
  const [lb, setLb] = _oc(null);
  const [imgIdx, setImgIdx] = _oc(0);
  const [muted, setMuted] = _oc(null);
  const [muteOpen, setMuteOpen] = _oc(false);
  const [typing] = _oc(true);
  const [draft, setDraft] = _oc('');
  const [msgs, setMsgs] = _oc(OC_MSGS);
  const matches = q ? msgs.filter((m) => m.text.toLowerCase().includes(q.toLowerCase())).length : 0;
  const openImage = (items, i) => { setImgIdx(i); setLb({ kind: 'image', items, idx: i, setIdx: setImgIdx }); };
  const openFile = (f) => setLb({ kind: f.kind, name: f.name });
  const send = () => { if (!draft.trim()) return; setMsgs([...msgs, { id: Date.now(), who: 'Ілля · workflo', me: true, team: true, time: 'щойно', text: draft, replyTo: reply ? reply.id : undefined }]); setDraft(''); setReply(null); };

  return (
    <div className="wfo">
      <div className="wfo-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Чат замовлення</span>
          <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />ORD-2412</span>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setMuteOpen(!muteOpen)}>
            <Icon name={muted ? 'eye_off' : 'bell'} size={13} />{muted ? `тиша · ${muted}` : 'Сповіщення'}
          </button>
          {muteOpen && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 20, minWidth: 180, background: 'var(--wf-surface)', border: '1px solid var(--wf-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.14)', padding: 5 }}>
              {[['1 година', '1 год'], ['До завтра', 'до завтра'], ['Назавжди', 'назавжди'], ['Увімкнути', null]].map(([lbl, val]) => (
                <button key={lbl} onClick={() => { setMuted(val); setMuteOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 0, background: 'none', font: 'inherit', fontSize: 12.5, color: 'var(--wf-fg)', cursor: 'pointer', borderRadius: 7 }}>{lbl}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="wfo-searchbar">
        <Icon name="search" size={14} color="var(--wf-fg-muted)" />
        <input placeholder="Пошук у листуванні замовлення…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <span className="wfo-search-nav">{matches} збігів <button className="wfp-iconbtn" onClick={() => setQ('')}><Icon name="plus" size={13} style={{ transform: 'rotate(45deg)' }} /></button></span>}
      </div>

      {pinned && (
        <div className="wfo-pinned">
          <span className="wfo-pinned-ic"><Icon name="star" size={15} /></span>
          <div style={{ flex: 1 }}><div className="wfo-pinned-l">закріплено · {pinned.who}</div><div className="wfo-pinned-t">{pinned.text}</div></div>
          <button className="wfp-iconbtn" onClick={() => setPinned(null)} title="Відкріпити"><Icon name="plus" size={13} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
      )}

      <div className="wfo-thread">
        {msgs.filter((m) => !q || m.text.toLowerCase().includes(q.toLowerCase())).map((m) => (
          <OcMessage key={m.id} m={m} q={q} onReply={setReply} onPin={(mm) => setPinned({ who: mm.who, text: mm.text })} onOpenImage={openImage} onOpenFile={openFile} />
        ))}
        {typing && !q && (
          <div className="wfo-typing"><OcAvatar m={{ who: 'Ол', team: false }} /><span>Олена друкує</span><span className="wfo-typing-dots"><span /><span /><span /></span></div>
        )}
      </div>

      <div className="wfo-composer">
        {reply && (
          <div className="wfo-reply-strip">
            <div className="wfo-quote"><div className="wfo-quote-who">↩ {reply.who}</div><div className="wfo-quote-t">{reply.text}</div></div>
            <button className="wfp-iconbtn" onClick={() => setReply(null)}><Icon name="plus" size={13} style={{ transform: 'rotate(45deg)' }} /></button>
          </div>
        )}
        <div className="wfo-composer-row">
          <button className="wfp-iconbtn" title="Прикріпити"><Icon name="paperclip" size={17} /></button>
          <textarea placeholder="Написати повідомлення…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="wfp-btn wfp-btn--primary" onClick={send}><Icon name="send" size={15} /></button>
        </div>
      </div>

      {lb && <OrderLightbox item={lb} onClose={() => setLb(null)} />}
    </div>
  );
}

// ── Files tab with AV-scan states + open in lightbox ──
const OC_FILES = [
  { name: 'tz-1c-integration.pdf', size: '2.4 MB', kind: 'pdf', scan: 'clean', by: 'Олена', when: '09:20' },
  { name: 'driver-app-mockups.fig', size: '12 MB', kind: 'fig', scan: 'clean', by: 'Олена', when: '09:02' },
  { name: 'brand-assets.zip', size: '18 MB', kind: 'zip', scan: 'scanning', by: 'Олена', when: '10:40' },
  { name: 'api-contract.json', size: '64 KB', kind: 'json', scan: 'clean', by: 'Ілля', when: 'вчора' },
  { name: 'demo-recording.mp4', size: '88 MB', kind: 'video', scan: 'uploading', prog: 72, by: 'Марія', when: 'щойно' },
];
function OrderFilesV2() {
  const [lb, setLb] = _oc(null);
  return (
    <React.Fragment>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Файли замовлення <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', fontWeight: 400 }}>// {OC_FILES.length}</span></span>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Завантажити · демо', 'ok')}><Icon name="paperclip" size={13} />Завантажити</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {OC_FILES.map((f, i) => (
          <div key={i} className="wfo-file" style={{ marginTop: 0, minWidth: 0 }}>
            <span className="wfo-file-ic"><Icon name={f.kind === 'pdf' ? 'file' : f.kind === 'video' ? 'send' : 'paperclip'} size={17} /></span>
            <div style={{ flex: 1 }}>
              <div className="wfo-file-n">{f.name}</div>
              <div className="wfo-file-m">
                {f.size} · {f.by} · {f.when}
                {f.scan === 'scanning' && <span className="wfo-scan"><span className="wfo-scan-spin" />на перевірці антивірусом</span>}
                {f.scan === 'clean' && <span className="wfo-clean"><Icon name="shield" size={11} />перевірено</span>}
              </div>
              {f.scan === 'uploading' && <div className="wfo-upbar"><div className="wfo-upbar-f" style={{ width: f.prog + '%' }} /></div>}
            </div>
            {f.scan === 'clean' && <button className="wfp-iconbtn" onClick={() => f.kind === 'pdf' ? setLb({ kind: 'pdf', name: f.name }) : f.kind === 'fig' || f.kind === 'video' ? setLb({ kind: 'image', items: [f.name], idx: 0, setIdx: () => {} }) : null} title="Відкрити"><Icon name="eye" size={15} /></button>}
            {f.scan === 'uploading' && <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>{f.prog}%</span>}
          </div>
        ))}
      </div>
      {lb && <OrderLightbox item={lb} onClose={() => setLb(null)} />}
    </React.Fragment>
  );
}

// ── Documents for one order: specification · invoice · act ──
const ORDER_DOCS = [
  { num: 'SPC-2025-0418', type: 'Специфікація', date: '01.06.2026', status: 'signed', note: 'фінальна v2 · підписано обома сторонами', act: 'view' },
  { num: 'INV-2025-0418', type: 'Рахунок', date: '04.07.2026', status: 'unpaid', amount: '$4 200', note: 'до оплати після здачі робіт', act: 'pay' },
  { num: 'ACT-2025-0418', type: 'Акт виконаних робіт', date: '04.07.2026', status: 'await_sign', note: 'очікує вашого підпису', act: 'sign' },
];
const DOC_STATUS = {
  signed:     { label: 'підписано',       tone: 'ok' },
  unpaid:     { label: 'до оплати',       tone: 'bad' },
  paid:       { label: 'оплачено',        tone: 'ok' },
  await_sign: { label: 'очікує підпису',  tone: 'warn' },
};
function OrderDocsTab({ kind = 'portal' }) {
  return (
    <React.Fragment>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Документи замовлення <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', fontWeight: 400 }}>// ORD-2412</span></span>
        <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Завантажити всі (ZIP) · демо', 'ok')}><Icon name="download" size={12} />Завантажити всі</button>
      </div>
      <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-subtle)', marginBottom: 16 }}>// специфікація, рахунок та акт по цьому замовленню — все в одному місці</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ORDER_DOCS.map((d) => {
          const st = DOC_STATUS[d.status] || DOC_STATUS.signed;
          return (
            <div key={d.num} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--wf-border)', borderRadius: 12, background: 'var(--wf-surface)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--wf-subtle)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={d.type === 'Рахунок' ? 'receipt' : d.type === 'Акт виконаних робіт' ? 'check' : 'file'} size={17} color="var(--wf-fg-muted)" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.type}</span>
                  <span className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-accent)' }}>{d.num}</span>
                  {d.amount && <span className="wf-mono" style={{ fontSize: 12, fontWeight: 600 }}>{d.amount}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)', marginTop: 2 }}>{d.note} · {d.date}</div>
              </div>
              <span className="wfg-pill2" data-tone={st.tone}><span className="wfg-pill2-dot" />{st.label}</span>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast(d.type + ' · перегляд (демо)', 'ok')}><Icon name="eye" size={13} />Переглянути</button>
                {d.act === 'pay' && <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.__portalNav && window.__portalNav('billing')}><Icon name="lock" size={12} />Оплатити</button>}
                {d.act === 'sign' && <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfConfirm && window.wfConfirm({ title: 'Підписати акт ' + d.num + '?', message: 'Підписанням ви підтверджуєте, що роботи прийнято.', confirmLabel: 'Підписати', successToast: 'Акт підписано · дякуємо' })}><Icon name="check" size={12} />Підписати</button>}
                {d.act === 'view' && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('PDF · демо', 'ok')}><Icon name="download" size={12} />PDF</button>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--wf-fg-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon name="file" size={13} color="var(--wf-fg-subtle)" />
        Усі документи по компанії — у розділі <button className="wfp-link" style={{ border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--wf-accent)', padding: 0 }} onClick={() => window.__portalNav && window.__portalNav('documents')}>«Документи»</button>.
      </div>
    </React.Fragment>
  );
}

// ── Order detail wrapper (tabs) — used by both apps ──
function OrderDetailTabs({ kind = 'portal', onBack }) {
  const [tab, setTab] = _oc('chat');
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          {onBack && <button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />замовлення</button>}
          <h1 className="wfp-ph-h1" style={{ marginTop: onBack ? 6 : 0, display: 'flex', alignItems: 'center', gap: 10 }}>Інтеграція 1С ↔ Telegram-бот<span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />в роботі</span></h1>
          <div className="wfp-ph-sub">// ORD-2412 · Brunky · fixed price · дедлайн 04.07.2026</div>
        </div>
      </div>
      <div className="wfo-tabs" style={{ borderBottom: '1px solid var(--wf-border)', marginBottom: 18, paddingBottom: 8 }}>
        <div className="wfo-tab" data-on={tab === 'chat' || undefined} onClick={() => setTab('chat')}><Icon name="inbox" size={14} />Чат</div>
        <div className="wfo-tab" data-on={tab === 'files' || undefined} onClick={() => setTab('files')}><Icon name="paperclip" size={14} />Файли<span className="wfo-tab-badge">{OC_FILES.length}</span></div>
        <div className="wfo-tab" data-on={tab === 'estimate' || undefined} onClick={() => setTab('estimate')}><Icon name="list" size={14} />Кошторис</div>
        <div className="wfo-tab" data-on={tab === 'docs' || undefined} onClick={() => setTab('docs')}><Icon name="receipt" size={14} />Документи<span className="wfo-tab-badge">3</span></div>
        <div className="wfo-tab" data-on={tab === 'changes' || undefined} onClick={() => setTab('changes')}><Icon name="file" size={14} />Зміни в угоді<span className="wfo-tab-badge" style={{ background: 'var(--wf-warning)', color: '#0C0A09' }}>v2</span></div>
      </div>
      {tab === 'chat' && <OrderChatV2 />}
      {tab === 'files' && <OrderFilesV2 />}
      {tab === 'estimate' && (window.PortalEstimate ? <PortalEstimate /> : <div>кошторис</div>)}
      {tab === 'docs' && <OrderDocsTab kind={kind} />}
      {tab === 'changes' && (window.R4Diff ? <R4Diff embedded /> : <div>зміни</div>)}
    </React.Fragment>
  );
}

function PortalOrderView() {
  const [open, setOpen] = _oc(false);
  if (open) return <OrderDetailTabs kind="portal" onBack={() => setOpen(false)} />;
  return (
    <React.Fragment>
      {window.PortalOrders ? <PortalOrders onOpen={() => setOpen(true)} /> : null}
    </React.Fragment>
  );
}
function WorkspaceOrderChat() { return <OrderDetailTabs kind="workspace" />; }

Object.assign(window, { OrderChatV2, OrderFilesV2, OrderLightbox, OrderDetailTabs, PortalOrderView, WorkspaceOrderChat });
