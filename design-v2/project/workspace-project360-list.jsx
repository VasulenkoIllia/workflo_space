// workspace-project360-list.jsx — Projects list (05) + create wizard + editor.
// Overrides WsProjects (loaded after finprojects) so the row opens the full
// Project 360° card. Adds client-vs-internal split and a kind-aware wizard.

const _pl = React.useState;

function PjTeamStack({ team }) {
  return (
    <span className="wpj-stack">
      {(team || []).slice(0, 3).map((u, i) => {
        const init = (u.name || '?').split(' ').map((x) => x[0]).slice(0, 2).join('');
        return <span key={i} className="wpj-stack-av" title={u.name} style={{ zIndex: 3 - i }}>{init}</span>;
      })}
      {(team || []).length > 3 && <span className="wpj-stack-more">+{team.length - 3}</span>}
    </span>
  );
}

// ════════════════════════ LIST ════════════════════════
function ProjectsList({ onOpen, onCreate }) {
  const D = window.WF_PROJ;
  const C = window.WF_C360;
  const role = window.__wsRole || 'owner';
  const seesMoney = role !== 'manager';
  const [kind, setKind] = _pl('client');
  const [q, setQ] = _pl('');
  const [filter, setFilter] = _pl('all');

  const ofKind = D.PROJECTS.filter((p) => p.kind === kind);
  let rows = ofKind.filter((p) => (p.name + (p.client || '') + p.code + (p.purpose || '')).toLowerCase().includes(q.toLowerCase()));
  if (filter !== 'all') rows = rows.filter((p) => p.status === filter);

  const clientCount = D.PROJECTS.filter((p) => p.kind === 'client').length;
  const internalCount = D.PROJECTS.filter((p) => p.kind === 'internal').length;
  const active = ofKind.filter((p) => p.status === 'active').length;
  const mrr = D.PROJECTS.filter((p) => p.model === 'fixed_monthly_advance' && p.status === 'active').reduce((a, p) => a + p.amount, 0);

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Проєкти</h1>
          <div className="wfp-ph-sub">// проєкт — вершина ієрархії: білінг, замовлення й задачі ростуть звідси · {active} активних{kind === 'client' ? ` · MRR з абонплат ≈ $${mrr.toLocaleString('en-US')}` : ''}</div>
        </div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={onCreate}><Icon name="plus" size={14} />Створити проєкт</button></div>
      </div>

      <div className="wpj-kindseg">
        <button data-on={kind === 'client' || undefined} onClick={() => setKind('client')}><Icon name="building" size={13} />Клієнтські<span className="wpj-kindseg-c">{clientCount}</span></button>
        <button data-on={kind === 'internal' || undefined} onClick={() => setKind('internal')}><Icon name="users" size={13} />Внутрішні<span className="wpj-kindseg-c">{internalCount}</span></button>
      </div>

      <div className="wfp-filters">
        <div className="wfp-search"><Icon name="search" size={14} color="var(--wf-fg-muted)" /><input placeholder={kind === 'client' ? 'Шукати проєкт / клієнта…' : 'Шукати внутрішній проєкт…'} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {[['all', 'усі'], ['active', 'активні'], ['paused', 'пауза'], ['closed', 'закриті']].map(([id, l]) => (
          <button key={id} className="wfp-pill" data-on={filter === id || undefined} onClick={() => setFilter(id)}>{l}</button>
        ))}
      </div>

      {kind === 'client' ? (
        <table className="wfp-table">
          <thead><tr><th>Проєкт</th><th>Клієнт</th><th>Модель</th><th className="wfp-num">Ставка / абонплата</th><th>Команда</th><th>Договір</th>{seesMoney && <th className="wfp-num">Маржа</th>}<th>Статус</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const retainer = p.model === 'fixed_monthly_advance';
              return (
                <tr key={p.id} onClick={() => onOpen(p)} style={Object.assign({ cursor: 'pointer' }, p.status === 'closed' ? { opacity: 0.55 } : {})}>
                  <td><span className="wfp-link" style={{ fontWeight: 600 }}>{p.name}</span><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{p.code} · {p.hoursUsed}{retainer || p.hoursPrepaid ? `/${retainer ? p.hoursIncluded : p.hoursPrepaid}` : ''} год</div></td>
                  <td>{p.client}</td>
                  <td><span className="wfg-pill2" data-tone={retainer ? 'accent' : 'muted'}><span className="wfg-pill2-dot" />{retainer ? 'абонплата' : 'погодинно'}</span></td>
                  <td className="wfp-num" style={{ fontWeight: 600 }}>{C.money(retainer ? p.amount : p.rate, p.currency)}<span style={{ fontSize: 10, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}>{retainer ? '/міс' : '/год'}</span></td>
                  <td><PjTeamStack team={p.team} /></td>
                  <td>{p.contract ? (p.contract.status === 'signed' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />підписано</span> : <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />чернетка</span>) : <span style={{ color: 'var(--wf-fg-subtle)', fontSize: 12 }}>—</span>}</td>
                  {seesMoney && <td className="wfp-num"><span className="wfc-margin"><span className="wfc-margin-v">{p.margin}%</span></span></td>}
                  <td>{p.status === 'active' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активний</span> : p.status === 'paused' ? <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />пауза</span> : <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />закрито</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="wfp-table">
          <thead><tr><th>Проєкт</th><th>Команда-власник</th><th>Тип</th><th>Учасники</th><th className="wfp-num">Години (план)</th><th>Статус</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const team = D.TEAMS.find((t) => t.id === p.team_id);
              return (
                <tr key={p.id} onClick={() => onOpen(p)} style={{ cursor: 'pointer' }}>
                  <td><span className="wfp-link" style={{ fontWeight: 600 }}>{p.name}</span><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{p.code}</div></td>
                  <td>{team ? team.name : '—'}</td>
                  <td><span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />{p.purpose}</span></td>
                  <td><PjTeamStack team={p.team} /></td>
                  <td className="wfp-num">{p.hoursUsed} / {p.hoursPlanned}</td>
                  <td><span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активний</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="wpj-note" style={{ marginTop: 18 }}>
        <Icon name="copy" size={14} color="var(--wf-accent)" />
        {kind === 'client'
          ? <span><strong>Клієнтські проєкти</strong> прив’язані до клієнта й несуть білінг-модель. Усе, що ми робимо для клієнта, — у межах проєкту: замовлення або задача, окремо платна чи в абонплаті.</span>
          : <span><strong>Внутрішні проєкти</strong> (навчання, організаційне) не білуються й закріплені за командою. Сюди йде вся не-клієнтська робота — для capacity й порядку.</span>}
      </div>
    </React.Fragment>
  );
}

// ════════════════════════ CREATE WIZARD (kind-aware) ════════════════════════
function ProjectCreateWizard({ onClose, initKind }) {
  const D = window.WF_PROJ;
  const C = window.WF_C360;
  const ENT = C.LEGAL_ENTITIES;
  const [s, set] = _pl({
    kind: initKind || 'client', name: '', client: 'Brunky', team_id: 't-dev', purpose: 'Навчання',
    model: 'fixed_monthly_advance', currency: 'USD', amount: '3200', rate: '45', hours: '60',
    cycle: 'monthly_day', cycleDay: '1', terms: 'net14', contract: 'required',
    entity: (ENT.find((e) => e.def) || ENT[0]).id,
    contractSource: 'generate', contractTemplate: 'ct2', contractFile: null,
    services: ['sv-support', 'sv-monitor', 'sv-backup', 'sv-report', 'sv-server'],
  });
  const u = (k, v) => set({ ...s, [k]: v });
  const internal = s.kind === 'internal';
  const retainer = s.model === 'fixed_monthly_advance';
  const isHourly = !retainer;

  // dynamic step list
  const steps = internal
    ? [['kind', 'Тип'], ['internal', 'Команда й мета'], ['review', 'Огляд']]
    : [['kind', 'Тип'], ['client', 'Клієнт'], ['model', 'Модель'], ['money', 'Гроші'],
       ...(retainer ? [['scope', 'Абонплата']] : []), ['cycle', 'Цикл і договір'], ['review', 'Огляд']];
  const [stepIdx, setStepIdx] = _pl(0);
  const idx = Math.min(stepIdx, steps.length - 1);
  const stepId = steps[idx][0];
  const last = idx === steps.length - 1;
  const ent = ENT.find((e) => e.id === s.entity);
  const mdl = C.BILLING_MODELS.find((b) => b.id === s.model);
  const team = D.TEAMS.find((t) => t.id === s.team_id);
  const fmt = ent && ent.country === 'EE' ? 'EU' : 'UA';
  const TPL = (window.WF_FINPROJ ? window.WF_FINPROJ.CONTRACT_TEMPLATES : []).filter((t) => t.format === fmt && !/NDA/.test(t.name));
  const tpl = TPL.find((t) => t.id === s.contractTemplate) || TPL[0];
  // gate: required contract needs a template or an attached file before leaving cycle step
  const contractReady = internal || s.contract !== 'required' || (s.contractSource === 'generate' ? !!tpl : !!s.contractFile);
  const blockNext = stepId === 'cycle' && !contractReady;

  const toggleSvc = (id) => set({ ...s, services: s.services.includes(id) ? s.services.filter((x) => x !== id) : [...s.services, id] });
  // per-service task config (team / executor / cadence) — set HERE, not in catalog
  const svcCfg = s.svcCfg || {};
  const cfgFor = (id) => svcCfg[id] || { team: 't-dev', assignee: '', cadence: (window.WF_SVC && window.WF_SVC.CATALOG.find((x) => x.id === id) || {}).recurring || 'monthly' };
  const setCfg = (id, k, v) => set({ ...s, svcCfg: { ...svcCfg, [id]: { ...cfgFor(id), [k]: v } } });
  const PEOPLE = window.WF_SVC ? window.WF_SVC.A : {};
  const CAD = window.WF_SVC ? window.WF_SVC.CADENCE : {};
  // retainer economics from chosen catalog services
  const SVC = window.WF_SVC ? window.WF_SVC.CATALOG : [];
  const chosen = SVC.filter((x) => s.services.includes(x.id));
  const svcHours = chosen.filter((x) => x.bill.mode === 'hours' && !x.variable).reduce((a, x) => a + x.bill.hours, 0);
  const svcMoney = chosen.filter((x) => x.bill.mode === 'money').reduce((a, x) => a + x.bill.price, 0);
  const svcTasks = chosen.filter((x) => x.makesTask).length;

  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal wfc-wiz" style={{ margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="plus" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Новий проєкт · {steps[idx][1]}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfc-wiz-steps">{steps.map((_, i) => <span key={i} className="wfc-wiz-step" data-on={i <= idx || undefined} />)}</div>
        <div className="wfc-wiz-body" style={{ maxHeight: '62vh', overflowY: 'auto' }}>

          {stepId === 'kind' && (
            <React.Fragment>
              <div className="wfc-wiz-q">Який це проєкт?</div>
              <div className="wfc-opts">
                <div className="wfc-opt" data-on={s.kind === 'client' || undefined} onClick={() => u('kind', 'client')}>
                  <span className="wfc-opt-radio" /><span className="wfc-opt-ico"><Icon name="building" size={16} /></span>
                  <div style={{ flex: 1 }}><div className="wfc-opt-t">Клієнтський<span className="wfc-opt-tag">білінг</span></div><div className="wfc-opt-d">Прив’язаний до клієнта, має білінг-модель, договір, рахунки.</div></div>
                </div>
                <div className="wfc-opt" data-on={s.kind === 'internal' || undefined} onClick={() => u('kind', 'internal')}>
                  <span className="wfc-opt-radio" /><span className="wfc-opt-ico"><Icon name="users" size={16} /></span>
                  <div style={{ flex: 1 }}><div className="wfc-opt-t">Внутрішній<span className="wfc-opt-tag">без білінгу</span></div><div className="wfc-opt-d">Навчання, організаційне тощо. Закріплений за командою, не білується.</div></div>
                </div>
              </div>
              <div className="wfp-field"><label>Назва проєкту</label><input placeholder={internal ? 'напр. Внутрішнє навчання · React' : 'напр. Підтримка платформи'} value={s.name} onChange={(e) => u('name', e.target.value)} /></div>
            </React.Fragment>
          )}

          {stepId === 'client' && (
            <React.Fragment>
              <div className="wfc-wiz-q">Для якого клієнта?</div>
              <div className="wfp-field"><label>Клієнт</label>
                <select className="wfl-select" value={s.client} onChange={(e) => u('client', e.target.value)}>
                  {['Brunky', 'EduForge', 'Tably', 'NordStream', 'Florèal'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="wfc-wiz-hint" style={{ marginTop: 8 }}>// усі замовлення, задачі та рахунки цього проєкту впадуть у картку клієнта.</div>
              </div>
            </React.Fragment>
          )}

          {stepId === 'internal' && (
            <React.Fragment>
              <div className="wfc-wiz-q">Команда-власник і мета</div>
              <div className="wfp-field"><label>Команда</label>
                <div className="wfc-opts" style={{ marginTop: 4 }}>
                  {D.TEAMS.map((t) => (
                    <div key={t.id} className="wfc-opt" data-on={s.team_id === t.id || undefined} onClick={() => u('team_id', t.id)}>
                      <span className="wfc-opt-radio" /><span className="wfc-opt-ico"><Icon name="users" size={15} /></span>
                      <div style={{ flex: 1 }}><div className="wfc-opt-t">{t.name}</div><div className="wfc-opt-d">лід: {t.lead} · {t.size} людей</div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="wfp-field"><label>Тип</label>
                <select className="wfl-select" value={s.purpose} onChange={(e) => u('purpose', e.target.value)}>
                  {['Навчання', 'Організаційне', 'R&D / експеримент', 'Маркетинг агенції', 'Інше'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </React.Fragment>
          )}

          {stepId === 'model' && (
            <React.Fragment>
              <div className="wfc-wiz-q">Як білимо цей проєкт?</div>
              <div className="wfc-opts">
                {C.BILLING_MODELS.map((b) => (
                  <div key={b.id} className="wfc-opt" data-on={s.model === b.id || undefined} onClick={() => u('model', b.id)}>
                    <span className="wfc-opt-radio" /><span className="wfc-opt-ico"><Icon name={b.icon} size={16} /></span>
                    <div style={{ flex: 1 }}><div className="wfc-opt-t">{b.label}<span className="wfc-opt-tag">{b.short}</span></div><div className="wfc-opt-d">{b.desc}</div></div>
                  </div>
                ))}
              </div>
            </React.Fragment>
          )}

          {stepId === 'money' && (
            <React.Fragment>
              <div className="wfc-wiz-q">Валюта і ставки</div>
              <div className="wfc-grid2">
                <div className="wfp-field"><label>Валюта</label><select className="wfl-select" value={s.currency} onChange={(e) => u('currency', e.target.value)}><option>USD</option><option>EUR</option><option>UAH</option></select></div>
                {retainer
                  ? <div className="wfp-field"><label>Абонплата / міс</label><input value={s.amount} onChange={(e) => u('amount', e.target.value)} /></div>
                  : <div className="wfp-field"><label>Ставка / год</label><input value={s.rate} onChange={(e) => u('rate', e.target.value)} /></div>}
              </div>
              {retainer && <div className="wfp-field"><label>Включені години / міс</label><input value={s.hours} onChange={(e) => u('hours', e.target.value)} /><div className="wfc-wiz-hint" style={{ marginTop: 8 }}>// понад ліміт — доплата окремим рахунком (фаза 2).</div></div>}
              {s.model === 'hourly_prepaid' && <div className="wfp-field"><label>Передплачені години</label><input value={s.hours} onChange={(e) => u('hours', e.target.value)} /></div>}
            </React.Fragment>
          )}

          {stepId === 'scope' && (
            <React.Fragment>
              <div className="wfc-wiz-q">Які послуги входять в абонплату</div>
              <div className="wfc-wiz-hint" style={{ marginTop: 0 }}>// беремо з каталогу послуг. Послуги-роботи з розкладом авто-створять задачі виконавцю; ресурси (сервер) лише білуються.</div>
              <div className="wpj-svcpick">
                {SVC.map((sv) => {
                  const on = s.services.includes(sv.id);
                  const k = window.WF_SVC.KIND[sv.kind];
                  const billLabel = sv.bill.mode === 'money' ? C.money(sv.bill.price) + '/міс' : (sv.variable ? 'по факту' : sv.bill.hours + ' год');
                  const cfg = cfgFor(sv.id);
                  return (
                    <div key={sv.id} className="wpj-svc-item">
                      <label className="wpj-svc" data-on={on || undefined} onClick={() => toggleSvc(sv.id)}>
                        <span className="wpj-checkrow-box">{on && <Icon name="check" size={11} />}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="wpj-svc-t">{sv.name}<span className="wfg-pill2" data-tone={k.tone} style={{ marginLeft: 8 }}><span className="wfg-pill2-dot" />{k.label}</span>{sv.makesTask && <span className="wfc-opt-tag" style={{ marginLeft: 6 }}>задача</span>}</div>
                          <div className="wpj-svc-d">{sv.bill.mode === 'hours' ? 'зі включених годин' : 'у сумі абонплати'}</div>
                        </div>
                        <span className="wpj-svc-bill">{billLabel}</span>
                      </label>
                      {on && sv.makesTask && (
                        <div className="wpj-svc-cfg" onClick={(e) => e.stopPropagation()}>
                          <div className="wpj-svc-cfg-h"><Icon name="kanban" size={12} color="var(--wf-fg-muted)" />Кому падає задача та як часто</div>
                          <div className="wpj-svc-cfg-row">
                            <div className="wpj-svc-cfg-f"><label>Команда</label>
                              <select className="wfl-select" value={cfg.team} onChange={(e) => setCfg(sv.id, 'team', e.target.value)}>{D.TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                            </div>
                            <div className="wpj-svc-cfg-f"><label>Виконавець</label>
                              <select className="wfl-select" value={cfg.assignee} onChange={(e) => setCfg(sv.id, 'assignee', e.target.value)}>
                                <option value="">— на команду (без виконавця)</option>
                                {Object.keys(PEOPLE).map((key) => <option key={key} value={key}>{PEOPLE[key]}</option>)}
                              </select>
                            </div>
                            <div className="wpj-svc-cfg-f"><label>Регулярність</label>
                              <select className="wfl-select" value={cfg.cadence} onChange={(e) => setCfg(sv.id, 'cadence', e.target.value)}>{Object.keys(CAD).map((c) => <option key={c} value={c}>{CAD[c].label}</option>)}</select>
                            </div>
                          </div>
                          <div className="wpj-svc-cfg-hint">{cfg.assignee ? `задача падає особі · ${PEOPLE[cfg.assignee]}` : 'задача падає на команду — будь-хто бере з дошки'} · {CAD[cfg.cadence] ? CAD[cfg.cadence].label.toLowerCase() : ''}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="wpj-svc-summary">
                <div><span className="wpj-svc-sk">включені години</span><span className="wpj-svc-sv">{svcHours > 0 ? `${svcHours} год / міс` : '—'}</span></div>
                <div><span className="wpj-svc-sk">ресурси в сумі</span><span className="wpj-svc-sv">{svcMoney > 0 ? C.money(svcMoney) + '/міс' : '—'}</span></div>
                <div><span className="wpj-svc-sk">авто-задач</span><span className="wpj-svc-sv">{svcTasks}</span></div>
              </div>
              <div className="wfc-wiz-hint">// каталог послуг — окреме меню (Налаштування → Каталог послуг), там додаєте/редагуєте послуги наперед.</div>
            </React.Fragment>
          )}

          {stepId === 'cycle' && (
            <React.Fragment>
              <div className="wfc-wiz-q">Білінг-цикл і договір</div>
              <div className="wfc-grid2">
                <div className="wfp-field"><label>Цикл</label><select className="wfl-select" value={s.cycle} onChange={(e) => u('cycle', e.target.value)}>{C.BILLING_CYCLES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
                <div className="wfp-field"><label>Payment terms</label><select className="wfl-select" value={s.terms} onChange={(e) => u('terms', e.target.value)}>{C.PAYMENT_TERMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
              </div>
              {s.cycle === 'monthly_day' && <div className="wfp-field"><label>Число місяця</label><input value={s.cycleDay} onChange={(e) => u('cycleDay', e.target.value)} style={{ width: 120 }} /></div>}
              <div className="wfp-field"><label>Юр-особа (від кого рахунок і договір)</label>
                <select className="wfl-select" value={s.entity} onChange={(e) => u('entity', e.target.value)}>{ENT.filter((e) => e.forCur.includes(s.currency)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                <div className="wfc-wiz-hint" style={{ marginTop: 8 }}>// показані лише юр-особи у валюті {s.currency}. Бланк договору — формат {fmt}.</div>
              </div>
              <div className="wfp-field"><label>Договір</label>
                <div className="wfc-seg">
                  <div className="wfc-seg-opt" data-on={s.contract === 'required' || undefined} onClick={() => u('contract', 'required')}>Обовʼязковий</div>
                  <div className="wfc-seg-opt" data-on={s.contract === 'optional' || undefined} onClick={() => u('contract', 'optional')}>Опційний</div>
                </div>
              </div>

              {s.contract === 'required' ? (
                <div className="wpj-contract">
                  <div className="wpj-contract-seg">
                    <button data-on={s.contractSource === 'generate' || undefined} onClick={() => u('contractSource', 'generate')}><Icon name="file" size={13} />Згенерувати з шаблону</button>
                    <button data-on={s.contractSource === 'attach' || undefined} onClick={() => u('contractSource', 'attach')}><Icon name="paperclip" size={13} />Прикріпити наявний</button>
                  </div>

                  {s.contractSource === 'generate' ? (
                    <React.Fragment>
                      <div className="wfp-field" style={{ marginBottom: 0 }}><label>Шаблон договору · {fmt}</label>
                        <select className="wfl-select" value={tpl ? tpl.id : ''} onChange={(e) => u('contractTemplate', e.target.value)}>{TPL.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                      </div>
                      {tpl
                        ? <div className="wpj-contract-note"><Icon name="check" size={13} color="var(--wf-accent)" />Договір згенерується автоматично як <strong>чернетка</strong> — {tpl.vars} змінних підтягнуться з юр-особи та клієнта. Підпишете на екрані проєкту.</div>
                        : <div className="wpj-contract-note" data-warn="true"><Icon name="alert" size={13} />Немає шаблону формату {fmt}. Додайте його в Шаблони договорів або прикріпіть файл.</div>}
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <div className={`wpj-drop${s.contractFile ? ' wpj-drop--filled' : ''}`} onClick={() => u('contractFile', s.contractFile ? null : 'Договір_підписаний.pdf')}>
                        {s.contractFile
                          ? <React.Fragment><span className="wpj-drop-ic" data-ok="true"><Icon name="file" size={16} /></span><div style={{ flex: 1 }}><div className="wpj-drop-t">{s.contractFile}</div><div className="wpj-drop-d">прикріплено · клікніть, щоб прибрати</div></div><span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />готово</span></React.Fragment>
                          : <React.Fragment><span className="wpj-drop-ic"><Icon name="paperclip" size={16} /></span><div style={{ flex: 1 }}><div className="wpj-drop-t">Перетягніть або виберіть файл</div><div className="wpj-drop-d">PDF / DOCX · напр. уже підписаний скан</div></div></React.Fragment>}
                      </div>
                      {!s.contractFile && <div className="wpj-contract-note" data-warn="true"><Icon name="alert" size={13} />Договір обовʼязковий — прикріпіть файл, щоб продовжити.</div>}
                    </React.Fragment>
                  )}
                </div>
              ) : (
                <div className="wfc-wiz-hint">// договір опційний — проєкт можна запустити без нього, додасте пізніше на вкладці «Договір».</div>
              )}
            </React.Fragment>
          )}

          {stepId === 'review' && (
            <React.Fragment>
              <div className="wfc-wiz-q">Перевірте і створіть</div>
              <div className="wfc-review">
                <div className="wfc-review-row"><span className="wfc-review-k">Тип</span><span className="wfc-review-v">{internal ? 'Внутрішній' : 'Клієнтський'}</span></div>
                <div className="wfc-review-row"><span className="wfc-review-k">Назва</span><span className="wfc-review-v">{s.name || '—'}</span></div>
                {internal ? (
                  <React.Fragment>
                    <div className="wfc-review-row"><span className="wfc-review-k">Команда</span><span className="wfc-review-v">{team ? team.name : '—'}</span></div>
                    <div className="wfc-review-row"><span className="wfc-review-k">Мета</span><span className="wfc-review-v">{s.purpose}</span></div>
                    <div className="wfc-review-row"><span className="wfc-review-k">Білінг</span><span className="wfc-review-v">немає (внутрішній)</span></div>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <div className="wfc-review-row"><span className="wfc-review-k">Клієнт</span><span className="wfc-review-v">{s.client}</span></div>
                    <div className="wfc-review-row"><span className="wfc-review-k">Модель</span><span className="wfc-review-v">{mdl.label}</span></div>
                    <div className="wfc-review-row"><span className="wfc-review-k">{retainer ? 'Абонплата' : 'Ставка'}</span><span className="wfc-review-v">{C.money(retainer ? +s.amount : +s.rate, s.currency)}{retainer ? '/міс' : '/год'}</span></div>
                    {retainer && <div className="wfc-review-row"><span className="wfc-review-k">Включено</span><span className="wfc-review-v">{s.services.length} послуг · {svcHours} год{svcMoney > 0 ? ` + ${C.money(svcMoney)} ресурсів` : ''}</span></div>}
                    <div className="wfc-review-row"><span className="wfc-review-k">Цикл</span><span className="wfc-review-v">{C.BILLING_CYCLES.find((c) => c.id === s.cycle).label}{s.cycle === 'monthly_day' ? ` · ${s.cycleDay}-е` : ''}</span></div>
                    <div className="wfc-review-row"><span className="wfc-review-k">Договір</span><span className="wfc-review-v">{s.contract === 'required' ? (s.contractSource === 'generate' ? `обовʼязковий · з шаблону «${tpl ? tpl.name : '—'}»` : `обовʼязковий · файл ${s.contractFile || '—'}`) : 'опційний'}</span></div>
                    <div className="wfc-review-row"><span className="wfc-review-k">Юр-особа</span><span className="wfc-review-v">{ent.name}</span></div>
                  </React.Fragment>
                )}
              </div>
              <div className="wfc-wiz-hint">// {internal ? 'задачі цього проєкту рахуються в capacity команди, не білуються.' : 'задачі йдуть у дошку; included_in_subscription — zero-billed.'}</div>
            </React.Fragment>
          )}
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// крок {idx + 1} / {steps.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {idx > 0 && <button className="wfp-btn" onClick={() => setStepIdx(idx - 1)}>Назад</button>}
            {!last
              ? <button className="wfp-btn wfp-btn--primary" disabled={blockNext} title={blockNext ? 'Договір обовʼязковий — згенеруйте або прикріпіть' : undefined} onClick={() => !blockNext && setStepIdx(idx + 1)}>Далі</button>
              : <button className="wfp-btn wfp-btn--primary" onClick={() => { window.wfToast && window.wfToast('Проєкт створено · демо', 'ok'); onClose(); }}><Icon name="check" size={14} />Створити проєкт</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════ ROUTER (overrides finprojects WsProjects) ════════════════════════
function WsProjects() {
  const [open, setOpen] = _pl(null);
  const [wiz, setWiz] = _pl(false);
  if (open) return <Project360Card project={open} onBack={() => setOpen(null)} />;
  return (
    <React.Fragment>
      <ProjectsList onOpen={setOpen} onCreate={() => setWiz(true)} />
      {wiz && <ProjectCreateWizard onClose={() => setWiz(false)} />}
    </React.Fragment>
  );
}

Object.assign(window, { WsProjects, ProjectsList, ProjectCreateWizard });
