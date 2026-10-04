// portal-signing.jsx — workflo.space client document-signing workflow.
// Round 4 · G12. Portal (client) context. Self-contained interactive flow:
//   list (pending-signature entry) → review (PDF + sticky actions) →
//   sign / reject / request-changes modals → signed state + audit trail.
// Plus a mobile variant (full-screen PDF + 2-button bottom bar + sign sheet).
// Renders inside the portal AppShell (wfp-root). Reuses wfd-* document
// components (SpecificationDoc) + wfp-* portal vocabulary; adds wfs-*.

const _ps = React.useState;
const _pe = React.useEffect;
const _pr = React.useRef;

// the document under review (specification awaiting client approval)
const WFS_DOC = {
  num: 'SPC-2025-0418',
  code: 'SPC',
  type: 'specification',
  typeLabel: 'Специфікація проєкту',
  order: 'ORD-2412',
  project: 'Інтеграція 1С ↔ Telegram-бот',
  sum: 4200,
  weeks: 6,
  from: 'workflo.space · Васюленко І.С.',
  critical: true, // requires SMS-PIN
  client: { name: 'Іваненко О. П.', title: 'Директор ТОВ «Брунки»' },
};

const WFS_AUDIT = [
  { k: 'sent', t: 'Надіслано на погодження', s: 'workflo.space · Ілля Васюленко', ts: '24.05 · 11:08' },
  { k: 'viewed', t: 'Документ відкрито', s: 'Ви · Chrome · IP 178.92.41.7', ts: '01.06 · 14:21' },
  { k: 'signed', t: 'Підписано електронно', s: 'Ви · підтверджено SMS-кодом · IP 178.92.41.7', ts: '01.06 · 14:23' },
];

function WfsDocPreview() {
  const C = window.SpecificationDoc;
  return C ? React.createElement(C) : <div style={{ padding: 40, color: '#78716C' }}>// документ недоступний</div>;
}

// ── PDF + SIGNED stamp overlay (signed state) ──
function WfsSignedDoc() {
  return (
    <div style={{ position: 'relative' }}>
      <div className="wfd-stamp" style={{ right: 70, top: 250 }}>
        ПІДПИСАНО<br />01.06.2026<br />{WFS_DOC.client.name}
      </div>
      <WfsDocPreview />
    </div>
  );
}

// ─────────────── List view (entry point) ───────────────
function WfsList({ onReview }) {
  const types = (window.WFP_DATA && window.WFP_DATA.doc_types) || {};
  const recent = ((window.WFP_DATA && window.WFP_DATA.documents_list) || []).slice(0, 4);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Документи</h1>
          <div className="wfp-ph-sub">// 1 документ очікує вашого погодження</div>
        </div>
      </div>

      <div className="wfs-pending">
        <div className="wfs-pending-ic"><Icon name="file" size={24} /></div>
        <div>
          <div className="wfs-pending-k"><span className="wfs-pending-dot" />потрібне ваше погодження</div>
          <div className="wfs-pending-t">{WFS_DOC.typeLabel} · {WFS_DOC.project}</div>
          <div className="wfs-pending-m">
            <span className="wfp-doc-type-pill" data-t="specification">{WFS_DOC.code}</span>
            <span>{WFS_DOC.num}</span>
            <span>·</span>
            <span>${WFS_DOC.sum.toLocaleString('uk-UA')}</span>
            <span>·</span>
            <span>{WFS_DOC.weeks} тижнів</span>
          </div>
        </div>
        <button className="wfp-btn wfp-btn--sign" onClick={onReview}><Icon name="eye" size={14} />Переглянути</button>
      </div>

      <div className="wfp-filters" style={{ marginTop: 24 }}>
        <div className="wfp-search"><Icon name="search" size={14} color="var(--wf-fg-muted)" /><input placeholder="Шукати за номером, замовленням, типом…" /><span className="wfp-search-kbd">⌘K</span></div>
        <button className="wfp-pill" data-on="true">всі типи</button>
        <button className="wfp-pill">2026</button>
      </div>

      <table className="wfp-table">
        <thead><tr><th style={{ width: 130 }}>№</th><th>Тип / документ</th><th>Замовлення</th><th>Дата</th><th className="wfp-num">Сума</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          {recent.map((d) => {
            const t = types[d.type] || { code: '—', label: d.type };
            return (
              <tr key={d.num}>
                <td className="wfp-mono"><span className="wfp-link" style={{ fontWeight: 500 }}>{d.num}</span></td>
                <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="wfp-doc-type-pill" data-t={d.type}>{t.code}</span><span>{t.label}</span></div></td>
                <td className="wfp-mono"><span className="wfp-link">{d.order}</span></td>
                <td className="wfp-mono">{d.date}</td>
                <td className="wfp-num">{d.amount ? `$${d.amount.toLocaleString('uk-UA')}` : '—'}</td>
                <td><span className={`wfp-badge wfp-badge--${d.status === 'signed' || d.status === 'paid' ? 'paid' : d.status === 'sent' || d.status === 'partial' ? 'partial' : 'soft'}`}>{d.status === 'signed' ? 'підписано' : d.status === 'sent' ? 'надіслано' : d.status === 'partial' ? 'частково' : d.status === 'paid' ? 'оплачено' : 'чернетка'}</span></td>
                <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Open · демо', 'ok')}><Icon name="external" size={11} />Open</button></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ─────────────── Review view ───────────────
function WfsReview({ onBack, onAction }) {
  return (
    <div className="wfs-review">
      <div className="wfs-review-bar">
        <button className="wfs-back" onClick={onBack}><Icon name="chevron" size={14} style={{ transform: 'rotate(90deg)' }} />назад</button>
        <div className="wfs-review-title">
          <span className="wfs-review-h">{WFS_DOC.num} · {WFS_DOC.typeLabel}</span>
          <span className="wfs-review-sub">// {WFS_DOC.order} · від {WFS_DOC.from} · надіслано 24.05.2026</span>
        </div>
      </div>

      <div className="wfs-doc-pane"><WfsDocPreview /></div>

      <div className="wfs-actionbar">
        <div className="wfs-actionbar-info">
          <span className="wfs-actionbar-k">{WFS_DOC.critical ? 'критичний документ · підпис через SMS-код' : 'очікує вашого рішення'}</span>
          <span className="wfs-actionbar-v">Погодьте специфікацію, щоб ми почали роботу — ${WFS_DOC.sum.toLocaleString('uk-UA')} · {WFS_DOC.weeks} тижнів</span>
        </div>
        <div className="wfs-actionbar-actions">
          <button className="wfp-btn wfp-btn--ghost" onClick={() => onAction('changes')}><Icon name="edit" size={14} />Запитати правки</button>
          <button className="wfp-btn wfp-btn--danger-soft" onClick={() => onAction('reject')}><Icon name="alert" size={14} />Відхилити</button>
          <button className="wfp-btn wfp-btn--sign" onClick={() => onAction('sign')}><Icon name="check" size={14} />Підписати</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────── Signed state ───────────────
function WfsSigned({ onBack }) {
  return (
    <React.Fragment>
      <div className="wfs-review-bar">
        <button className="wfs-back" onClick={onBack}><Icon name="chevron" size={14} style={{ transform: 'rotate(90deg)' }} />до документів</button>
        <div className="wfs-review-title">
          <span className="wfs-review-h">{WFS_DOC.num}</span>
          <span className="wfs-review-sub">// підписано · {WFS_DOC.order}</span>
        </div>
      </div>

      <div className="wfs-signed-banner">
        <div className="wfs-signed-ic"><Icon name="check" size={24} /></div>
        <div>
          <div className="wfs-signed-t">Документ підписано</div>
          <div className="wfs-signed-s">Ви погодили специфікацію 01.06.2026 о 14:23 · команду повідомлено, роботу розпочато</div>
        </div>
        <div className="wfs-signed-actions">
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"><Icon name="external" size={12} />Поділитися</button>
          <button className="wfp-btn wfp-btn--sign wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Завантажити PDF · демо', 'ok')}><Icon name="download" size={12} />Завантажити PDF</button>
        </div>
      </div>

      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <div className="wfs-doc-pane"><WfsSignedDoc /></div>
        <div className="wfs-audit">
          <div className="wfs-audit-h">// audit trail</div>
          {WFS_AUDIT.map((a, i) => (
            <div key={i} className="wfs-audit-row">
              <span className="wfs-audit-dot" data-k={a.k} />
              <div><div className="wfs-audit-c-t">{a.t}</div><div className="wfs-audit-c-s">{a.s}</div></div>
              <span className="wfs-audit-ts">{a.ts}</span>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

// ─────────────── Modals ───────────────
function WfsModalShell({ title, aux, onClose, children, foot }) {
  _pe(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 480, margin: 0 }}>
        <div className="wfp-modal-h">
          <span className="wfp-modal-h-t">{title}</span>
          <span className="wfp-modal-h-aux">{aux}</span>
          <span className="wfp-modal-h-close" onClick={onClose}><Icon name="alert" size={14} /></span>
        </div>
        <div className="wfp-modal-body">{children}</div>
        <div className="wfp-modal-foot">{foot}</div>
      </div>
    </div>
  );
}

function WfsSignModal({ onClose, onConfirm }) {
  const [consent, setConsent] = _ps(false);
  const [pin, setPin] = _ps('');
  const critical = WFS_DOC.critical;
  const pinOk = !critical || pin.length === 4;
  const canSign = consent && pinOk;
  return (
    <WfsModalShell title="Підписати документ" aux="// sign · electronic" onClose={onClose}
      foot={<React.Fragment>
        <span className="wfp-modal-foot-left">// підпис фіксується з датою, часом та IP</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wfp-btn" onClick={onClose}>Скасувати</button>
          <button className="wfp-btn wfp-btn--sign" disabled={!canSign} style={{ opacity: canSign ? 1 : 0.5 }} onClick={canSign ? onConfirm : undefined}><Icon name="check" size={14} />Підтвердити підпис</button>
        </div>
      </React.Fragment>}>
      <div className="wfs-modal-lead">Ви підписуєте <strong>{WFS_DOC.num}</strong> — {WFS_DOC.typeLabel.toLowerCase()} на <strong>${WFS_DOC.sum.toLocaleString('uk-UA')}</strong>. Ваш підпис матиме юридичну силу.</div>

      <div className="wfs-sigprev">
        <span className="wfs-sigprev-l">// ваш підпис</span>
        <div className="wfs-sigprev-name">{WFS_DOC.client.name}</div>
        <div className="wfs-sigprev-meta">{WFS_DOC.client.title} · 01.06.2026</div>
      </div>

      <div className="wfs-check" data-on={consent || undefined} onClick={() => setConsent((c) => !c)}>
        <span className="wfs-check-box"><Icon name="check" size={13} /></span>
        <span className="wfs-check-t">Я ознайомився зі змістом документа, погоджуюсь з обсягом робіт, термінами та вартістю.</span>
      </div>

      {critical && (
        <div className="wfs-pin-wrap">
          <div className="wfs-pin-l"><Icon name="lock" size={13} />Код з SMS на +380 67 ••• 21 04 · критичний документ</div>
          <div className="wfs-pin">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="wfs-pin-cell" data-filled={pin.length > i || undefined} data-active={pin.length === i || undefined}>{pin[i] || ''}</div>
            ))}
            <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ marginLeft: 6 }} onClick={() => setPin('4192')}>демо-код</button>
          </div>
        </div>
      )}
    </WfsModalShell>
  );
}

function WfsRejectModal({ onClose, onConfirm }) {
  const [reason, setReason] = _ps('');
  return (
    <WfsModalShell title="Відхилити документ" aux="// reject" onClose={onClose}
      foot={<React.Fragment>
        <span className="wfp-modal-foot-left">// виконавець отримає сповіщення з причиною</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wfp-btn" onClick={onClose}>Назад</button>
          <button className="wfp-btn wfp-btn--danger-soft" disabled={!reason.trim()} style={{ opacity: reason.trim() ? 1 : 0.5 }} onClick={reason.trim() ? onConfirm : undefined}>Відхилити документ</button>
        </div>
      </React.Fragment>}>
      <div className="wfs-modal-lead">Розкажіть, що саме не так — це допоможе команді швидко виправити документ.</div>
      <span className="wfs-pin-l" style={{ marginBottom: 8 }}>// причина (обовʼязково)</span>
      <textarea className="wfs-textarea" placeholder="Напр.: бюджет вищий за погоджений усно; бракує етапу тестування…" value={reason} onChange={(e) => setReason(e.target.value)} />
    </WfsModalShell>
  );
}

function WfsChangesModal({ onClose, onConfirm }) {
  const [rows, setRows] = _ps([
    { sec: 'Скоуп', t: '' },
  ]);
  const sections = ['Контекст', 'Цілі', 'Скоуп', 'Deliverables', 'Етапи', 'Бюджет', 'Приймання'];
  const update = (i, t) => setRows((r) => r.map((x, j) => (j === i ? { ...x, t } : x)));
  const add = () => setRows((r) => [...r, { sec: 'Цілі', t: '' }]);
  const del = (i) => setRows((r) => r.filter((_, j) => j !== i));
  const any = rows.some((r) => r.t.trim());
  return (
    <WfsModalShell title="Запитати правки" aux="// request-changes" onClose={onClose}
      foot={<React.Fragment>
        <span className="wfp-modal-foot-left">// {rows.filter((r) => r.t.trim()).length} коментар(і) · буде створено гілку обговорення</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wfp-btn" onClick={onClose}>Скасувати</button>
          <button className="wfp-btn wfp-btn--primary" disabled={!any} style={{ opacity: any ? 1 : 0.5 }} onClick={any ? onConfirm : undefined}><Icon name="send" size={13} />Надіслати правки</button>
        </div>
      </React.Fragment>}>
      <div className="wfs-modal-lead">Прикріпіть конкретні зауваги до секцій документа. Команда відповість у чаті замовлення.</div>
      <div className="wfs-chg">
        {rows.map((r, i) => (
          <div key={i} className="wfs-chg-row">
            <select className="wfs-chg-sec" value={r.sec} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, sec: e.target.value } : x)))} style={{ border: 0, cursor: 'pointer' }}>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea className="wfs-chg-input" placeholder="Що змінити в цій секції…" value={r.t} onChange={(e) => update(i, e.target.value)} />
            {rows.length > 1 && <button className="wfs-chg-del" onClick={() => del(i)}><Icon name="alert" size={13} /></button>}
          </div>
        ))}
        <button className="wfs-chg-add" onClick={add}><Icon name="plus" size={13} />Додати ще зауваження до секції</button>
      </div>
    </WfsModalShell>
  );
}

// ─────────────── Mobile variant ───────────────
function WfsMobile({ theme, accent }) {
  const [sheet, setSheet] = _ps(null); // null | 'sign'
  const [signed, setSigned] = _ps(false);
  const [consent, setConsent] = _ps(false);
  return (
    <MPhone theme={theme} accent={accent}>
      <div className="wfs-m">
        <div className="wfm-top">
          <button className="wfm-top-back"><Icon name="chevron" size={18} style={{ transform: 'rotate(90deg)' }} /></button>
          <div className="wfm-top-title"><div className="wfm-top-h">{WFS_DOC.num}</div><div className="wfm-top-sub">{WFS_DOC.typeLabel}</div></div>
          <div className="wfm-top-actions"><button className="wfm-iconbtn"><Icon name="download" size={17} /></button></div>
        </div>

        {signed && (
          <div className="wfs-signed-banner" style={{ margin: 14, marginBottom: 0 }}>
            <div className="wfs-signed-ic" style={{ width: 38, height: 38 }}><Icon name="check" size={18} /></div>
            <div><div className="wfs-signed-t" style={{ fontSize: 14 }}>Підписано</div><div className="wfs-signed-s">01.06.2026 · 14:23</div></div>
            <span />
          </div>
        )}

        <div className="wfs-m-doc">
          <div style={{ position: 'relative' }}>
            {signed && <div className="wfd-stamp" style={{ right: 40, top: 150, zoom: 0.46 }}>ПІДПИСАНО<br />01.06.2026</div>}
            <WfsDocPreview />
          </div>
        </div>

        {!signed && (
          <div className="wfs-m-bar">
            <button className="wfm-btn wfm-btn--block" style={{ flex: 1 }} onClick={() => window.wfToast && window.wfToast('Відхилити · демо', 'ok')}><Icon name="alert" size={15} />Відхилити</button>
            <button className="wfm-btn wfm-btn--primary wfm-btn--block" style={{ flex: 1.4 }} onClick={() => setSheet('sign')}><Icon name="check" size={15} />Підписати</button>
          </div>
        )}

        {sheet === 'sign' && (
          <div className="wfm-sheet-scrim" onClick={(e) => { if (e.target.classList.contains('wfm-sheet-scrim')) setSheet(null); }}>
            <div className="wfm-sheet">
              <div className="wfm-sheet-grip" />
              <div className="wfs-m-sheet-h">Підписати {WFS_DOC.num}</div>
              <div className="wfs-m-sheet-sub">// підпис із датою, часом та IP</div>
              <div className="wfs-sigprev" style={{ marginBottom: 14 }}>
                <span className="wfs-sigprev-l">// ваш підпис</span>
                <div className="wfs-sigprev-name" style={{ fontSize: 38 }}>{WFS_DOC.client.name}</div>
                <div className="wfs-sigprev-meta">{WFS_DOC.client.title}</div>
              </div>
              <div className="wfs-check" data-on={consent || undefined} onClick={() => setConsent((c) => !c)} style={{ marginBottom: 14 }}>
                <span className="wfs-check-box"><Icon name="check" size={13} /></span>
                <span className="wfs-check-t">Я ознайомився та погоджуюсь з обсягом, термінами і вартістю.</span>
              </div>
              <button className="wfm-btn wfm-btn--primary wfm-btn--block" style={{ opacity: consent ? 1 : 0.5 }} onClick={consent ? () => { setSheet(null); setSigned(true); } : undefined}>Підтвердити підпис</button>
            </div>
          </div>
        )}
      </div>
    </MPhone>
  );
}

// ─────────────── Portal inbox-item (G12 entry inside the Inbox) ───────────────
function WfsInboxItem({ onOpen }) {
  return (
    <div className="wfs-pending" style={{ marginBottom: 18 }}>
      <div className="wfs-pending-ic"><Icon name="file" size={24} /></div>
      <div>
        <div className="wfs-pending-k"><span className="wfs-pending-dot" />документ готовий на погодження · щойно</div>
        <div className="wfs-pending-t">{WFS_DOC.typeLabel} {WFS_DOC.num}</div>
        <div className="wfs-pending-m">
          <span className="wfp-doc-type-pill" data-t="specification">{WFS_DOC.code}</span>
          <span>{WFS_DOC.project}</span><span>·</span><span>${WFS_DOC.sum.toLocaleString('uk-UA')}</span>
        </div>
      </div>
      <button className="wfp-btn wfp-btn--sign" onClick={onOpen}><Icon name="eye" size={14} />Переглянути</button>
    </div>
  );
}

// ─────────────── Flow shell ───────────────
function PortalSigningFlow({ theme = 'light', accent = 'lime' }) {
  const [view, setView] = _ps('list'); // list | review | signed
  const [modal, setModal] = _ps(null);
  const [vp, setVp] = _ps('desktop');

  const onAction = (kind) => setModal(kind);
  const closeModal = () => setModal(null);

  // mobile phone needs fit-to-height scaling inside portal content
  const scaleRef = _pr(null);
  const [scale, setScale] = _ps(1);
  _pe(() => {
    if (vp !== 'mobile') return;
    const el = scaleRef.current; if (!el) return;
    const fit = () => { const h = el.clientHeight; if (h) setScale(Math.min(1, (h - 8) / 844)); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [vp]);

  return (
    <div className="wfs">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div className="wfs-vp">
          <button data-on={vp === 'desktop' || undefined} onClick={() => setVp('desktop')}><Icon name="external" size={12} />десктоп</button>
          <button data-on={vp === 'mobile' || undefined} onClick={() => setVp('mobile')}><Icon name="file" size={12} />мобільний</button>
        </div>
      </div>

      {vp === 'mobile' ? (
        <div ref={scaleRef} style={{ height: 720, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 30%, color-mix(in oklab, var(--wf-fg) 6%, transparent), transparent 70%)', borderRadius: 16 }}>
          <div style={{ width: 390, height: 844, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: 'center' }}>
            <WfsMobile theme="dark" accent={accent} />
          </div>
        </div>
      ) : view === 'list' ? (
        <WfsList onReview={() => setView('review')} />
      ) : view === 'review' ? (
        <WfsReview onBack={() => setView('list')} onAction={onAction} />
      ) : (
        <WfsSigned onBack={() => setView('list')} />
      )}

      {modal === 'sign' && <WfsSignModal onClose={closeModal} onConfirm={() => { closeModal(); setView('signed'); }} />}
      {modal === 'reject' && <WfsRejectModal onClose={closeModal} onConfirm={() => { closeModal(); setView('list'); }} />}
      {modal === 'changes' && <WfsChangesModal onClose={closeModal} onConfirm={() => { closeModal(); setView('list'); }} />}
    </div>
  );
}

Object.assign(window, {
  PortalSigningFlow, WfsList, WfsReview, WfsSigned, WfsSignModal, WfsRejectModal, WfsChangesModal, WfsMobile, WfsInboxItem,
});
