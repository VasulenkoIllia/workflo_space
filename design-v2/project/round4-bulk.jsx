// round4-bulk.jsx — G14 · Bulk actions framework.
// Selection bar appears on first pick; per-entity action sets; range select
// (shift) + toggle (click); bulk-confirm modal with destructive warning;
// progress toast for long operations.

const _bk = React.useState;
const _bke = React.useEffect;

const BK_CTX = {
  orders: {
    label: 'Замовлення', cols: ['№', 'Назва', 'Клієнт', 'Статус'],
    actions: [{ id: 'assign', l: 'Призначити', ic: 'users' }, { id: 'status', l: 'Статус', ic: 'kanban' }, { id: 'tag', l: 'Теги', ic: 'star' }, { id: 'archive', l: 'Архів', ic: 'truck', danger: true }, { id: 'export', l: 'Експорт', ic: 'download' }],
    rows: [
      ['ORD-2412', 'Інтеграція 1С ↔ бот', 'ТОВ «Брунки»', 'в роботі'],
      ['ORD-2419', 'API синхронізації складу', 'EduForge', 'рев’ю'],
      ['ORD-2421', 'Міграція БД', 'ТОВ «Брунки»', 'у черзі'],
      ['ORD-2408', 'Фікс webhook-черги', 'Mono Lab', 'блок'],
      ['ORD-2390', 'Звіт по SLA', 'EduForge', 'готово'],
    ],
  },
  invoices: {
    label: 'Рахунки', cols: ['№', 'Замовлення', 'Сума', 'Статус'],
    actions: [{ id: 'remind', l: 'Нагадати', ic: 'mail' }, { id: 'paid', l: 'Оплачено', ic: 'check' }, { id: 'export', l: 'Експорт', ic: 'download' }, { id: 'archive', l: 'Архів', ic: 'truck', danger: true }],
    rows: [
      ['INV-0418', 'ORD-2412', '$4 200', 'надіслано'],
      ['INV-0417', 'ORD-2419', '$3 600', 'частково'],
      ['INV-0411', 'ORD-2408', '$1 200', 'прострочено'],
      ['INV-0405', 'ORD-2390', '$900', 'оплачено'],
    ],
  },
  companies: {
    label: 'Клієнти', cols: ['Назва', 'Tier', 'Оборот', 'Активність'],
    actions: [{ id: 'tier', l: 'Змінити tier', ic: 'star' }, { id: 'export', l: 'Експорт', ic: 'download' }, { id: 'archive', l: 'Архів', ic: 'truck', danger: true }],
    rows: [
      ['ТОВ «Брунки»', 'silver', '$18 400', '2 дні тому'],
      ['EduForge', 'partner', '$41 200', 'сьогодні'],
      ['Mono Lab', 'regular', '$6 900', 'тиждень тому'],
    ],
  },
  documents: {
    label: 'Документи', cols: ['№', 'Тип', 'Замовлення', 'Статус'],
    actions: [{ id: 'zip', l: 'Завантажити ZIP', ic: 'download' }, { id: 'archive', l: 'Архів', ic: 'truck', danger: true }],
    rows: [
      ['SPC-0418', 'Специфікація', 'ORD-2412', 'підписано'],
      ['INV-0418', 'Рахунок', 'ORD-2412', 'надіслано'],
      ['ACT-0417', 'Акт', 'ORD-2419', 'підписано'],
    ],
  },
  team: {
    label: 'Команда', cols: ['Імʼя', 'Роль', 'Email', 'Статус'],
    actions: [{ id: 'role', l: 'Роль', ic: 'shield' }, { id: 'disable', l: 'Вимкнути', ic: 'lock', danger: true }, { id: 'export', l: 'Експорт', ic: 'download' }],
    rows: [
      ['Олег Демченко', 'виконавець', 'oleg@', 'active'],
      ['Марія Коваль', 'PM', 'maria@', 'active'],
      ['Андрій Шевчук', 'виконавець', 'andriy@', 'invited'],
    ],
  },
};

function R4Bulk() {
  const [ctx, setCtx] = _bk('orders');
  const [sel, setSel] = _bk(() => new Set());
  const [last, setLast] = _bk(null);
  const [confirm, setConfirm] = _bk(null);
  const [progress, setProgress] = _bk(null);

  const data = BK_CTX[ctx];
  const ids = data.rows.map((r) => r[0]);
  const allOn = sel.size === ids.length && ids.length > 0;

  const reset = () => { setSel(new Set()); setLast(null); };
  _bke(() => { reset(); }, [ctx]);

  const toggle = (i, e) => {
    const next = new Set(sel);
    const id = ids[i];
    if (e && e.shiftKey && last != null) {
      const [a, b] = [Math.min(i, last), Math.max(i, last)];
      for (let k = a; k <= b; k++) next.add(ids[k]);
    } else {
      next.has(id) ? next.delete(id) : next.add(id);
    }
    setSel(next); setLast(i);
  };
  const toggleAll = () => { allOn ? setSel(new Set()) : setSel(new Set(ids)); };

  const runAction = (act) => {
    const total = sel.size;
    setConfirm(null);
    if (act.danger || total > 1) {
      setProgress({ done: 0, total, label: act.l });
    } else { reset(); }
  };

  _bke(() => {
    if (!progress) return;
    if (progress.done >= progress.total) { const t = setTimeout(() => { setProgress(null); reset(); }, 700); return () => clearTimeout(t); }
    const id = setTimeout(() => setProgress((p) => ({ ...p, done: p.done + 1 })), 280);
    return () => clearTimeout(id);
  }, [progress]);

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Bulk-дії</h1><div className="wfp-ph-sub">// мультивибір · Shift = діапазон · контекстні дії на список</div></div>
      </div>

      <div className="r4-seg" style={{ marginBottom: 16 }}>
        {Object.keys(BK_CTX).map((k) => <div key={k} className="r4-seg-opt" data-on={ctx === k || undefined} onClick={() => setCtx(k)}>{BK_CTX[k].label}</div>)}
      </div>

      {sel.size > 0 && (
        <div className="r4-selbar">
          <span className="r4-selbar-count"><span className="r4-selbar-n">{sel.size}</span>обрано</span>
          <button className="r4-selbar-clear" onClick={reset}>скасувати вибір</button>
          <div className="r4-selbar-actions">
            {data.actions.map((a) => (
              <button key={a.id} className={`r4-selbar-btn${a.danger ? ' r4-selbar-btn--danger' : ''}`} onClick={() => (a.danger ? setConfirm(a) : runAction(a))}><Icon name={a.ic} size={13} />{a.l}</button>
            ))}
          </div>
        </div>
      )}

      <table className="wfp-table">
        <thead>
          <tr>
            <th className="r4-checkcell"><span className="r4-checkbox" data-on={allOn || undefined} onClick={toggleAll}><Icon name="check" size={12} /></span></th>
            {data.cols.map((c, i) => <th key={i} className={i === 2 && ctx === 'invoices' ? 'wfp-num' : ''}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => {
            const on = sel.has(r[0]);
            return (
              <tr key={r[0]} data-sel={on || undefined}>
                <td className="r4-checkcell"><span className="r4-checkbox" data-on={on || undefined} onClick={(e) => toggle(i, e)}><Icon name="check" size={12} /></span></td>
                {r.map((c, j) => <td key={j} className={j === 0 ? 'wfp-mono' : ''}>{j === 0 ? <span className="wfp-link" style={{ fontWeight: 500 }}>{c}</span> : c}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="r4-note" style={{ marginTop: 12 }}>// клік — обрати · Shift+клік — діапазон · заголовок — усі</div>

      {confirm && (
        <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) setConfirm(null); }}>
          <div className="wfp-modal" style={{ width: 420, margin: 0 }}>
            <div className="wfp-modal-h"><Icon name="alert" size={18} color="var(--wf-destructive)" /><span className="wfp-modal-h-t">{confirm.l} · {sel.size} рядк.</span><span className="wfp-modal-h-close" onClick={() => setConfirm(null)}><Icon name="alert" size={14} /></span></div>
            <div className="wfp-modal-body"><div className="wfs-modal-lead" style={{ marginBottom: 0 }}>Дія торкнеться <strong>{sel.size}</strong> {data.label.toLowerCase()}. {confirm.danger && 'Це деструктивна операція — її буде складно відмінити.'}</div></div>
            <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// {confirm.id}</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={() => setConfirm(null)}>Скасувати</button><button className="wfp-btn wfp-btn--primary" style={confirm.danger ? { background: 'var(--wf-destructive)', borderColor: 'var(--wf-destructive)', color: '#fff' } : {}} onClick={() => runAction(confirm)}>Підтвердити</button></div></div>
          </div>
        </div>
      )}

      {progress && (
        <div className="r4-toast">
          <div className="r4-toast-h">{progress.done >= progress.total ? <Icon name="check" size={15} color="var(--wf-success)" /> : <Icon name="clock" size={15} color="var(--wf-accent)" />}{progress.label}</div>
          <div className="r4-toast-s">{progress.done >= progress.total ? 'готово' : `оброблено ${progress.done} з ${progress.total}…`}</div>
          <div className="r4-toast-bar"><div className="r4-toast-fill" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /></div>
        </div>
      )}
    </React.Fragment>
  );
}

Object.assign(window, { R4Bulk });
