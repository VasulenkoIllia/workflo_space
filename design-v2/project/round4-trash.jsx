// round4-trash.jsx — G19 · Trash / Undelete (soft-delete restore).
// Tabs per entity (Orders/Files/Comments/Documents/Companies/Members),
// retention banner, per-row restore / purge, bulk actions,
// purge-confirm modal with countdown + type-to-confirm.

const _tr = React.useState;

const TR = {
  orders: { label: 'Замовлення', rows: [
    { name: 'ORD-2377 · Лендінг для Mono Lab', by: 'Ілля', when: '2 дні тому', reason: 'дубль', left: 28 },
    { name: 'ORD-2360 · Тестове замовлення', by: 'Олег', when: '6 днів тому', reason: 'тест', left: 24 },
  ] },
  files: { label: 'Файли', rows: [
    { name: 'old-spec-v1.pdf', by: 'Марія', when: 'вчора', reason: 'застаріле', left: 29 },
    { name: 'screenshot-2.png', by: 'Олег', when: '3 дні тому', reason: '—', left: 27 },
    { name: 'export-april.csv', by: 'Ілля', when: '12 днів тому', reason: 'дубль', left: 18 },
  ] },
  comments: { label: 'Коментарі', rows: [
    { name: '«потрібно уточнити у клієнта…»', by: 'Олег', when: '4 дні тому', reason: 'помилково', left: 26 },
  ] },
  documents: { label: 'Документи', rows: [
    { name: 'INV-2025-0399 (чернетка)', by: 'Ілля', when: 'вчора', reason: 'помилка суми', left: 29 },
  ] },
  companies: { label: 'Клієнти', rows: [
    { name: 'Тестова компанія', by: 'Ілля', when: '8 днів тому', reason: 'тест', left: 22 },
  ] },
  members: { label: 'Учасники', rows: [] },
};

function R4PurgeModal({ name, onClose, onPurge }) {
  const [cd, setCd] = _tr(5);
  const [typed, setTyped] = _tr('');
  React.useEffect(() => { const id = setInterval(() => setCd((c) => (c <= 1 ? (clearInterval(id), 0) : c - 1)), 1000); return () => clearInterval(id); }, []);
  const ok = cd === 0 && typed.trim().toLowerCase() === 'видалити';
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 440, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="alert" size={18} color="var(--wf-destructive)" /><span className="wfp-modal-h-t">Видалити назавжди?</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="alert" size={14} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfs-modal-lead"><strong>{name}</strong> буде знищено остаточно. Відновити буде неможливо.</div>
          <div className="r4-note" style={{ marginBottom: 8 }}>// для підтвердження введіть «видалити»</div>
          <input className="wfp-field" style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid var(--wf-border)', borderRadius: 8, background: 'var(--wf-surface)', color: 'var(--wf-fg)', fontFamily: 'JetBrains Mono, monospace' }} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="видалити" />
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// незворотно</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" disabled={!ok} style={{ opacity: ok ? 1 : 0.55, background: 'var(--wf-destructive)', borderColor: 'var(--wf-destructive)', color: '#fff' }} onClick={ok ? onPurge : undefined}>{cd > 0 ? `Видалити (${cd})` : 'Видалити назавжди'}</button></div></div>
      </div>
    </div>
  );
}

function R4Trash() {
  const [tab, setTab] = _tr('files');
  const [data, setData] = _tr(TR);
  const [purge, setPurge] = _tr(null);
  const rows = data[tab].rows;
  const soonCount = Object.values(data).reduce((n, g) => n + g.rows.filter((r) => r.left <= 20).length, 0);
  const restore = (i) => setData((d) => ({ ...d, [tab]: { ...d[tab], rows: d[tab].rows.filter((_, j) => j !== i) } }));

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Кошик</h1><div className="wfp-ph-sub">// soft-delete · відновлення · авто-очистка через 30 днів</div></div>
      </div>

      <div className="r4-banner"><span className="r4-banner-ic"><Icon name="alert" size={16} /></span>{soonCount} запис(ів) буде назавжди видалено протягом найближчих 20 днів.</div>

      <div className="r4-tabs">
        {Object.keys(TR).map((k) => <div key={k} className="r4-tab" data-on={tab === k || undefined} onClick={() => setTab(k)}>{data[k].label}<span className="r4-tab-count">{data[k].rows.length}</span></div>)}
      </div>

      {rows.length === 0 ? (
        <div className="wfm-empty" style={{ padding: '50px 20px', color: 'var(--wf-fg-muted)' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-fg-subtle)' }}>{`[ порожньо ]`}</div>
          <div style={{ fontSize: 14 }}>Тут нічого немає</div>
        </div>
      ) : (
        <table className="wfp-table">
          <thead><tr><th>Назва</th><th>Видалив</th><th>Коли</th><th>Причина</th><th>Авто-очистка</th><th></th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{r.name}</td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{r.by}</td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{r.when}</td>
              <td className="wfp-mono" style={{ fontSize: 11.5 }}>{r.reason}</td>
              <td><span className="r4-retention" data-soon={r.left <= 20 || undefined}>через {r.left} дн.</span></td>
              <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => restore(i)}><Icon name="external" size={11} style={{ transform: 'scaleX(-1)' }} />Відновити</button>
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm wfp-btn--danger" onClick={() => setPurge({ i, name: r.name })}>Видалити</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      )}

      {purge && <R4PurgeModal name={purge.name} onClose={() => setPurge(null)} onPurge={() => { restore(purge.i); setPurge(null); }} />}
    </React.Fragment>
  );
}

Object.assign(window, { R4Trash, R4PurgeModal });
