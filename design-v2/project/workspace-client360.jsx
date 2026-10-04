// workspace-client360.jsx — Client Card 360° (28-Б), the #1 owner screen.
// 7 tabs: Огляд · Люди · Проєкти · Фінанси · Документи · Секрети · Активність.
// Heavy tabs (Projects/Finance/Documents/Secrets) live in workspace-client360-tabs.jsx.

const _x = React.useState;

const C360_TABS = [
  { id: 'overview', label: 'Огляд' },
  { id: 'people',   label: 'Люди',      badgeKey: 'people' },
  { id: 'projects', label: 'Проєкти',   badgeKey: 'projects' },
  { id: 'finance',  label: 'Фінанси' },
  { id: 'docs',     label: 'Документи', badgeKey: 'docs' },
  { id: 'secrets',  label: 'Секрети',   badgeKey: 'secrets' },
  { id: 'activity', label: 'Активність' },
];

function Client360Card({ onBack }) {
  const D = window.WF_C360;
  const cl = D.CLIENT;
  const role = window.__wsRole || 'owner';
  const isManager = role === 'manager';
  const tabs = C360_TABS.filter((t) => !(isManager && t.id === 'finance'));
  const [tab, setTab] = _x('overview');
  const safeTab = (isManager && tab === 'finance') ? 'overview' : tab;
  const m = (n) => D.money(n, cl.currency);
  const badges = { people: D.PEOPLE.length, projects: D.PROJECTS.filter((p) => p.status === 'active').length, docs: D.DOCS.length, secrets: D.SECRETS.length };

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />клієнти</button>
          <h1 className="wfp-ph-h1" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {cl.name}
            <span className="wfg-pill2" data-tone="accent"><span className="wfg-pill2-dot" />{cl.tier}</span>
            {cl.kpis.debt > 0 && <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />борг {m(cl.kpis.debt)}</span>}
          </h1>
          <div className="wfp-ph-sub">// {cl.legalName} · {cl.industry} · клієнт з {cl.since} · валюта {cl.currency}</div>
        </div>
        <div className="wfp-ph-r">
          <button className="wfp-btn"><Icon name="external" size={14} />View-as портал</button>
          <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Редагувати · демо', 'ok')}><Icon name="edit" size={14} />Редагувати</button>
        </div>
      </div>

      <div className="wfg-tabs">
        {tabs.map((t) => (
          <div key={t.id} className="wfg-tab" data-on={safeTab === t.id || undefined} onClick={() => setTab(t.id)}>
            {t.label}{t.badgeKey && <span className="wfg-tab-badge">{badges[t.badgeKey]}</span>}
          </div>
        ))}
      </div>

      <div key={safeTab}>
        {safeTab === 'overview' && <C360Overview cl={cl} m={m} onTab={setTab} isManager={isManager} />}
        {safeTab === 'people' && <C360People />}
        {safeTab === 'projects' && window.C360Projects && <C360Projects isManager={isManager} />}
        {safeTab === 'finance' && !isManager && window.C360Finance && <C360Finance />}
        {safeTab === 'docs' && window.C360Docs && <C360Docs />}
        {safeTab === 'secrets' && window.C360Secrets && <C360Secrets />}
        {safeTab === 'activity' && <C360Activity />}
      </div>
    </React.Fragment>
  );
}

// ─── Огляд ─────────────────────────────────────────────────────────
function C360Overview({ cl, m, onTab, isManager }) {
  const D = window.WF_C360;
  const k = cl.kpis;
  const hoursPct = Math.round((k.hoursMonth / k.hoursIncluded) * 100);
  const [tags, setTags] = _x(cl.tags);
  return (
    <React.Fragment>
      <div className="wfc-hero">
        <div>
          <div className="wfc-kpis">
            <div className="wfc-kpi"><div className="wfc-kpi-k">LTV</div><div className="wfc-kpi-v wfc-kpi-v--accent">{m(k.ltv)}</div><div className="wfc-kpi-sub">за весь час</div></div>
            <div className="wfc-kpi"><div className="wfc-kpi-k">Поточний борг</div><div className={`wfc-kpi-v${k.debt > 0 ? ' wfc-kpi-v--warn' : ''}`}>{m(k.debt)}</div><div className="wfc-kpi-sub">{k.debt > 0 ? '1 рахунок овердʼю' : 'без боргу'}</div></div>
            {!isManager && <div className="wfc-kpi"><div className="wfc-kpi-k">Маржа</div><div className="wfc-kpi-v">{k.margin}%</div><div className="wfc-kpi-sub">сер. по проєктах</div></div>}
            <div className="wfc-kpi"><div className="wfc-kpi-k">Активні проєкти</div><div className="wfc-kpi-v">{k.activeProjects}</div><div className="wfc-kpi-sub">+1 закритий</div></div>
            <div className="wfc-kpi"><div className="wfc-kpi-k">Відкриті замовлення</div><div className="wfc-kpi-v">{k.openOrders}</div><div className="wfc-kpi-sub">в роботі</div></div>
            <div className="wfc-kpi">
              <div className="wfc-kpi-k">Години цикл</div>
              <div className="wfc-kpi-v">{k.hoursMonth}<span style={{ fontSize: 14, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}> / {k.hoursIncluded}</span></div>
              <div className="wfc-bar"><div className="wfc-bar-fill" data-tone={hoursPct > 85 ? 'warn' : undefined} style={{ width: hoursPct + '%' }} /></div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t">Теги та сегменти</span></div>
            <div className="wfc-tags">
              {tags.map((t) => <span key={t} className="wfc-tag">{t}<span className="wfc-tag-x" onClick={() => setTags(tags.filter((x) => x !== t))}><Icon name="plus" size={11} style={{ transform: 'rotate(45deg)' }} /></span></span>)}
              {cl.segments.map((s) => <span key={s} className="wfc-tag" data-kind="segment"><Icon name="kanban" size={11} />{s}</span>)}
              <span className="wfc-tag wfc-tag-add"><Icon name="plus" size={11} />тег</span>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t">Реквізити</span><span className="wfc-sec-h-s">// для документів</span></div>
            <div className="wfl-panel"><div className="wfl-panel-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="wfl-kv"><span className="wfl-kv-k">Юр. назва</span><span className="wfl-kv-v">{cl.legalName}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Власник акаунта</span><span className="wfl-kv-v">{cl.owner}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Сайт</span><span className="wfl-kv-v wf-mono" style={{ fontSize: 12 }}>{cl.site}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Галузь</span><span className="wfl-kv-v">{cl.industry}</span></div>
            </div></div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t">Прапорці ризику</span></div>
            <div className="wfc-risks">
              {cl.risks.map((r) => (
                <div key={r.id} className="wfc-risk" data-tone={r.tone} onClick={() => onTab(r.id === 'cap' ? 'projects' : 'finance')} style={{ cursor: 'pointer' }}>
                  <span className="wfc-risk-ico"><Icon name="alert" size={15} /></span>
                  <div style={{ flex: 1 }}><div className="wfc-risk-t">{r.label}</div><div className="wfc-risk-d">{r.detail}</div></div>
                  <Icon name="chev_r" size={14} color="var(--wf-fg-subtle)" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t">Хто привів</span><span className="wfc-sec-h-s">// 12-РЕФЕРАЛ</span></div>
            <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 12 }}>
              <div className="wfl-kv"><span className="wfl-kv-k">Реферер</span><span className="wfl-kv-v" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="gift" size={14} color="var(--wf-accent)" />{cl.referredBy.name}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Тип</span><span className="wfl-kv-v">{cl.referredBy.kind}</span></div>
              <div className="wfl-kv"><span className="wfl-kv-k">Бонус рефереру</span><span className="wfl-kv-v">{cl.referredBy.bonus}</span></div>
            </div></div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ─── Люди (28-А) ──────────────────────────────────────────────────
function C360People() {
  const D = window.WF_C360;
  const [people, setPeople] = _x(D.PEOPLE);
  const [menu, setMenu] = _x(null);
  const [modal, setModal] = _x(null);
  const roleTone = (r) => r === 'owner' ? 'accent' : r === 'billing' ? 'ok' : 'muted';
  const act = (id, action) => { setMenu(null); setModal({ id, action }); };
  return (
    <React.Fragment>
      <div className="wfc-sec-h">
        <span className="wfc-sec-h-t">Команда клієнта <span className="wfc-sec-h-s" style={{ marginLeft: 6 }}>// {people.length} учасників</span></span>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Запросити · демо', 'ok')}><Icon name="plus" size={13} />Запросити</button>
      </div>
      <table className="wfp-table">
        <thead><tr><th>Учасник</th><th>Email</th><th>Роль</th><th>2FA</th><th>Останній вхід</th><th></th></tr></thead>
        <tbody>
          {people.map((u) => (
            <tr key={u.id} style={u.status === 'invited' ? { opacity: 0.62 } : undefined}>
              <td style={{ fontWeight: 500 }}>{u.name}{u.status === 'invited' && <span className="wfg-pill2" data-tone="muted" style={{ marginLeft: 8 }}><span className="wfg-pill2-dot" />запрошено</span>}</td>
              <td className="wfp-mono">{u.email}</td>
              <td><span className="wfg-pill2" data-tone={roleTone(u.role)}><span className="wfg-pill2-dot" />{u.role}</span></td>
              <td><span className="wfc-2fa" data-on={u.twofa}><Icon name={u.twofa ? 'shield' : 'lock'} size={12} />{u.twofa ? 'on' : 'off'}</span></td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{u.last}</td>
              <td style={{ textAlign: 'right', position: 'relative' }}>
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setMenu(menu === u.id ? null : u.id)}>Адмін-дії ▾</button>
                {menu === u.id && (
                  <div className="wfp-menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, marginTop: 4, minWidth: 200, background: 'var(--wf-surface)', border: '1px solid var(--wf-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.14)', padding: 5, textAlign: 'left' }}>
                    {[['edit', 'Редагувати дані', 'edit'], ['key', 'Скинути пароль', 'reset'], ['mail', 'Змінити email', 'email'], ['lock', 'Деактивувати', 'deact']].map(([ic, lbl, a]) => (
                      <button key={a} className="wfp-menu-item" onClick={() => act(u.id, a)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', border: 0, background: 'none', font: 'inherit', fontSize: 12.5, color: 'var(--wf-fg)', cursor: 'pointer', borderRadius: 7 }}><Icon name={ic} size={13} color="var(--wf-fg-muted)" />{lbl}</button>
                    ))}
                    {u.role !== 'owner' && <button className="wfp-menu-item" onClick={() => act(u.id, 'remove')} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', border: 0, background: 'none', font: 'inherit', fontSize: 12.5, color: 'var(--wf-destructive)', cursor: 'pointer', borderRadius: 7 }}><Icon name="alert" size={13} />Видалити учасника</button>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {modal && <C360PeopleModal member={people.find((p) => p.id === modal.id)} action={modal.action} onClose={() => setModal(null)} />}
    </React.Fragment>
  );
}

function C360PeopleModal({ member, action, onClose }) {
  const [done, setDone] = _x(false);
  const cfg = {
    edit:   { ic: 'edit', title: 'Редагувати учасника', body: <EditPersonBody member={member} done={done} />, cta: 'Зберегти зміни' },
    reset:  { ic: 'key',  title: 'Скинути пароль', body: <ResetPasswordBody member={member} done={done} />, cta: 'Надіслати лінк' },
    email:  { ic: 'mail', title: 'Змінити email', body: <ChangeEmailBody member={member} done={done} />, cta: 'Надіслати підтвердження' },
    deact:  { ic: 'lock', title: 'Деактивувати учасника', body: <SimpleConfirm done={done} txt={`Доступ ${member.name} буде заблоковано. Дані замовлень зберігаються. Реактивувати можна будь-коли.`} okTxt="Учасника деактивовано" />, cta: 'Деактивувати', danger: true },
    remove: { ic: 'alert', title: 'Видалити учасника', body: <SimpleConfirm done={done} txt={`${member.name} буде видалено з компанії клієнта. Дію не можна скасувати.`} okTxt="Учасника видалено" />, cta: 'Видалити', danger: true },
  }[action];
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 460, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name={cfg.ic} size={18} color={cfg.danger ? 'var(--wf-destructive)' : 'var(--wf-accent)'} /><span className="wfp-modal-h-t">{cfg.title}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', marginBottom: 14 }}>Для <strong>{member.name}</strong> · <span className="wf-mono">{member.email}</span></div>
          {cfg.body}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 28-А admin</span><div style={{ display: 'flex', gap: 8 }}>{!done ? <React.Fragment><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" style={cfg.danger ? { background: 'var(--wf-destructive)', borderColor: 'var(--wf-destructive)', color: '#fff' } : undefined} onClick={() => setDone(true)}>{cfg.cta}</button></React.Fragment> : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}</div></div>
      </div>
    </div>
  );
}
function EditPersonBody({ member, done }) {
  if (done) return <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)' }}>✓ дані учасника оновлено</div>;
  return (
    <React.Fragment>
      <div className="wfp-field"><label>Імʼя</label><input defaultValue={member.name} /></div>
      <div className="wfp-field" style={{ marginTop: 12 }}><label>Email</label><input defaultValue={member.email} /></div>
      <div className="wfp-field" style={{ marginTop: 12 }}><label>Роль</label>
        <select className="wfl-select" defaultValue={member.role}><option value="owner">owner</option><option value="member">member</option><option value="billing">billing</option></select>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)', marginTop: 10 }}>Зміна email вимагатиме підтвердження на стару та нову адресу.</div>
    </React.Fragment>
  );
}
function ResetPasswordBody({ member, done }) {
  if (done) return <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)', lineHeight: 1.8 }}>✓ лист надіслано на {member.email}<br /><span style={{ color: 'var(--wf-fg-muted)' }}>· активні сесії завершено</span></div>;
  return <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>Користувач отримає лист із посиланням на встановлення нового пароля. Лінк діє 1 годину. Усі активні сесії завершаться.</div>;
}
function ChangeEmailBody({ member, done }) {
  if (done) return <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)' }}>✓ підтвердження надіслано на стару і нову адресу</div>;
  return <div className="wfp-field"><label>Нова адреса</label><input placeholder="new@brunky.com" /><div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)', marginTop: 8 }}>Лист підтвердження піде і на стару, і на нову адресу.</div></div>;
}
function SimpleConfirm({ done, txt, okTxt }) {
  if (done) return <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)' }}>✓ {okTxt}</div>;
  return <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>{txt}</div>;
}

// ─── Активність (28-В) ─────────────────────────────────────────────
function C360Activity() {
  const D = window.WF_C360;
  const [note, setNote] = _x('');
  const [items, setItems] = _x(D.ACTIVITY);
  const addNote = () => { if (!note.trim()) return; setItems([{ kind: 'note', txt: note, who: 'Ви', when: 'щойно' }, ...items]); setNote(''); };
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="wfc-act-note">
        <textarea placeholder="Внутрішня нотатка по клієнту (видно лише команді)…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="wfp-btn wfp-btn--primary" style={{ alignSelf: 'flex-end' }} onClick={addNote}><Icon name="send" size={13} />Додати</button>
      </div>
      <div className="wfl-tl">
        {items.map((it, i) => (
          <div key={i} className="wfl-tl-row">
            <span className="wfl-tl-dot" data-kind={it.kind}><Icon name={it.kind === 'note' ? 'edit' : it.kind === 'stage' ? 'kanban' : 'receipt'} size={11} /></span>
            <div className="wfl-tl-body"><div className="wfl-tl-txt">{it.txt}</div><div className="wfl-tl-meta">{it.who} · {it.when}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Client360Card, C360Overview, C360People, C360Activity });
