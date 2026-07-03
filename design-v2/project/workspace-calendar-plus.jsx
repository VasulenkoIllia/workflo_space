// workspace-calendar-plus.jsx — calendar layers/filters (24-А) ·
// booking types + providers (24-*) · leaves / time-off (23-Б).

const _cl = React.useState;

const CAL_LAYERS = [
  { id: 'meetings', label: 'Зустрічі з клієнтами', color: '#A3D90D', on: true, count: 12 },
  { id: 'deadlines', label: 'Дедлайни задач', color: '#DC2626', on: true, count: 8 },
  { id: 'internal', label: 'Внутрішні події', color: '#0EA5E9', on: true, count: 5 },
  { id: 'leaves', label: 'Відпустки / відсутності', color: '#F59E0B', on: false, count: 3 },
  { id: 'holidays', label: 'Державні свята', color: '#78716C', on: true, count: 2 },
];

const BOOKING_TYPES = [
  { id: 'intro', name: 'Знайомство', dur: 30, mode: 'video', provider: 'Google Meet', buffer: 10, color: '#A3D90D', active: true, desc: 'Перший дзвінок із потенційним клієнтом' },
  { id: 'demo', name: 'Демо рішення', dur: 45, mode: 'video', provider: 'Zoom', buffer: 15, color: '#0EA5E9', active: true, desc: 'Показ прототипу / результату' },
  { id: 'sync', name: 'Синк по проєкту', dur: 30, mode: 'video', provider: 'Google Meet', buffer: 5, color: '#8B5CF6', active: true, desc: 'Щотижнева синхронізація' },
  { id: 'call', name: 'Телефонний дзвінок', dur: 20, mode: 'phone', provider: '—', buffer: 5, color: '#F59E0B', active: true, desc: 'Короткий дзвінок' },
  { id: 'onsite', name: 'Зустріч в офісі', dur: 60, mode: 'inperson', provider: 'Адреса агенції', buffer: 30, color: '#78716C', active: false, desc: 'Особиста зустріч' },
];
const MODE_ICON = { video: 'send', phone: 'bell', inperson: 'users' };
const MODE_LABEL = { video: 'Відеодзвінок', phone: 'Телефон', inperson: 'Особисто' };

const LEAVES = [
  { id: 'l1', who: 'Марія Слюсар', type: 'vacation', from: '23.06', to: '04.07', days: 9, status: 'approved' },
  { id: 'l2', who: 'Ігор Бондар', type: 'sick', from: '16.06', to: '17.06', days: 2, status: 'approved' },
  { id: 'l3', who: 'Андрій Левченко', type: 'vacation', from: '14.07', to: '18.07', days: 5, status: 'pending' },
  { id: 'l4', who: 'Марія Слюсар', type: 'dayoff', from: '20.06', to: '20.06', days: 1, status: 'pending' },
];
const LEAVE_TYPE = { vacation: { label: 'Відпустка', tone: 'accent' }, sick: { label: 'Лікарняна', tone: 'warn' }, dayoff: { label: 'Відгул', tone: 'muted' } };

function CalToggle({ on, onClick, color }) {
  return (
    <button onClick={onClick} style={{ width: 38, height: 22, borderRadius: 999, border: 0, cursor: 'pointer', padding: 2, background: on ? (color || 'var(--wf-accent)') : 'var(--wf-border-strong)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .12s' }}>
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
    </button>
  );
}

// ════════════════ Calendar settings: layers + booking types ════════════════
function WsCalendarSettings() {
  const [tab, setTab] = _cl('layers');
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Календар · налаштування</h1><div className="wfp-ph-sub">// шари видимості · типи бронювань · провайдери відеодзвінків</div></div>
      </div>
      <div className="wfdk-toolbar" style={{ marginBottom: 18 }}>
        <div className="wfdk-seg">
          <div className="wfdk-seg-opt" data-on={tab === 'layers' || undefined} onClick={() => setTab('layers')}>Шари</div>
          <div className="wfdk-seg-opt" data-on={tab === 'booking' || undefined} onClick={() => setTab('booking')}>Типи бронювань</div>
        </div>
      </div>
      {tab === 'layers' ? <CalLayers /> : <CalBookingTypes />}
    </React.Fragment>
  );
}

function CalLayers() {
  const [layers, setLayers] = _cl(CAL_LAYERS);
  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)', marginBottom: 16 }}>Керуйте, які календарі показуються на спільному вигляді. Колір = позначка події в сітці.</div>
      <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 0 }}>
        {layers.map((l, i) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: i ? '1px solid var(--wf-border)' : 0 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{l.label}</div><div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>{l.count} подій цього місяця</div></div>
            <CalToggle on={l.on} color={l.color} onClick={() => setLayers(layers.map((x) => x.id === l.id ? { ...x, on: !x.on } : x))} />
          </div>
        ))}
      </div></div>
      <button className="wfl-add" style={{ padding: 12, marginTop: 12 }} onClick={() => window.wfToast && window.wfToast('Підключити зовнішній календар (Google /  · демо', 'ok')}><Icon name="plus" size={13} />Підключити зовнішній календар (Google / Outlook)</button>
    </div>
  );
}

function CalBookingTypes() {
  const [types, setTypes] = _cl(BOOKING_TYPES);
  const [edit, setEdit] = _cl(null);
  return (
    <React.Fragment>
      <div className="wfc-sec-h"><span className="wfc-sec-h-t">Типи бронювань <span className="wfc-sec-h-s" style={{ marginLeft: 6 }}>// показуються на /book/:slug</span></span><button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => setEdit({})}><Icon name="plus" size={13} />Тип</button></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {types.map((t) => (
          <div key={t.id} className="wfl-panel" style={{ opacity: t.active ? 1 : 0.6 }}><div className="wfl-panel-b" style={{ gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <span style={{ width: 36, height: 36, borderRadius: 9, background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0C0A09', flexShrink: 0 }}><Icon name={MODE_ICON[t.mode]} size={16} /></span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div><div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)' }}>{t.desc}</div></div>
              <CalToggle on={t.active} onClick={() => setTypes(types.map((x) => x.id === t.id ? { ...x, active: !x.active } : x))} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTop: '1px solid var(--wf-border)' }}>
              <span className="wfl-card-chip"><Icon name="clock" size={11} />{t.dur} хв</span>
              <span className="wfl-card-chip"><Icon name={MODE_ICON[t.mode]} size={11} />{MODE_LABEL[t.mode]}</span>
              {t.provider !== '—' && <span className="wfl-card-chip">{t.provider}</span>}
              <span className="wfl-card-chip">буфер {t.buffer} хв</span>
            </div>
            <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit(t)}><Icon name="edit" size={12} />Налаштувати</button>
          </div></div>
        ))}
      </div>
      {edit && <BookingTypeModal type={edit} onClose={() => setEdit(null)} />}
    </React.Fragment>
  );
}

function BookingTypeModal({ type, onClose }) {
  const [mode, setMode] = _cl(type.mode || 'video');
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 500, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="clock" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">{type.name ? type.name : 'Новий тип бронювання'}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfp-field"><label>Назва</label><input defaultValue={type.name} placeholder="напр. Демо рішення" /></div>
          <div className="wfc-grid2" style={{ marginTop: 12 }}>
            <div className="wfp-field"><label>Тривалість (хв)</label><input defaultValue={type.dur || 30} /></div>
            <div className="wfp-field"><label>Буфер після (хв)</label><input defaultValue={type.buffer || 10} /></div>
          </div>
          <div className="wfp-field" style={{ marginTop: 12 }}><label>Формат</label>
            <div className="wfc-seg">{['video', 'phone', 'inperson'].map((m) => <div key={m} className="wfc-seg-opt" data-on={mode === m || undefined} onClick={() => setMode(m)}>{MODE_LABEL[m]}</div>)}</div>
          </div>
          {mode === 'video' && <div className="wfp-field" style={{ marginTop: 12 }}><label>Провайдер відео</label><select className="wfl-select"><option>Google Meet</option><option>Zoom</option><option>Microsoft Teams</option><option>Власне посилання</option></select></div>}
          {mode === 'inperson' && <div className="wfp-field" style={{ marginTop: 12 }}><label>Адреса</label><input placeholder="вул. …" /></div>}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 24 · booking</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={onClose}>Зберегти</button></div></div>
      </div>
    </div>
  );
}

// ════════════════ Відсутності (23-Б) ════════════════
function WsLeaves() {
  const [leaves, setLeaves] = _cl(LEAVES);
  const [req, setReq] = _cl(false);
  const act = (id, status) => setLeaves(leaves.map((l) => l.id === id ? { ...l, status } : l));
  const pending = leaves.filter((l) => l.status === 'pending').length;
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Відсутності</h1><div className="wfp-ph-sub">// відпустки · лікарняні · відгули — впливають на capacity та календар</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => setReq(true)}><Icon name="plus" size={14} />Запит на відсутність</button></div>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">на розгляді</div><div className={`wfp-stat-v${pending ? ' wfp-stat-v--warn' : ''}`}>{pending}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">у відпустці зараз</div><div className="wfp-stat-v">1</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">днів відпустки (рік)</div><div className="wfp-stat-v">24</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">використано</div><div className="wfp-stat-v wfp-stat-v--accent">11</div></div>
      </div>

      <table className="wfp-table">
        <thead><tr><th>Працівник</th><th>Тип</th><th>Період</th><th className="wfp-num">Днів</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          {leaves.map((l) => {
            const t = LEAVE_TYPE[l.type];
            return (
              <tr key={l.id}>
                <td style={{ fontWeight: 500 }}>{l.who}</td>
                <td><span className="wfg-pill2" data-tone={t.tone}><span className="wfg-pill2-dot" />{t.label}</span></td>
                <td className="wfp-mono">{l.from} → {l.to}</td>
                <td className="wfp-num">{l.days}</td>
                <td>{l.status === 'approved' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />погоджено</span> : <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />на розгляді</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  {l.status === 'pending'
                    ? <span style={{ display: 'inline-flex', gap: 6 }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => act(l.id, 'rejected')}>Відхилити</button><button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => act(l.id, 'approved')}><Icon name="check" size={12} />Погодити</button></span>
                    : <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Деталі</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {req && <LeaveRequestModal onClose={() => setReq(false)} />}
    </React.Fragment>
  );
}
function LeaveRequestModal({ onClose }) {
  const [type, setType] = _cl('vacation');
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 460, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="clock" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Запит на відсутність</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfp-field"><label>Тип</label>
            <div className="wfc-seg">{Object.entries(LEAVE_TYPE).map(([id, t]) => <div key={id} className="wfc-seg-opt" data-on={type === id || undefined} onClick={() => setType(id)}>{t.label}</div>)}</div>
          </div>
          <div className="wfc-grid2" style={{ marginTop: 12 }}><div className="wfp-field"><label>З</label><input placeholder="дд.мм" /></div><div className="wfp-field"><label>По</label><input placeholder="дд.мм" /></div></div>
          <div className="wfp-field" style={{ marginTop: 12 }}><label>Коментар (необовʼязково)</label><textarea className="wfl-select" style={{ height: 56, padding: '8px 10px', resize: 'vertical' }} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--wf-subtle)', fontSize: 12, color: 'var(--wf-fg-secondary)' }}><Icon name="alert" size={14} color="var(--wf-warning)" />Період позначиться в календарі та зменшить вашу capacity на ці дні.</div>
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 23-Б</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={onClose}>Надіслати запит</button></div></div>
      </div>
    </div>
  );
}

Object.assign(window, { WsCalendarSettings, WsLeaves });
