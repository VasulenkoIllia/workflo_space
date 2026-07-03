// workspace-client360-tabs.jsx — heavy tabs of Client Card 360°.
// Projects (05-ПРОЕКТИ) + creation wizard · Finance (05-Г/В, 22-Д) ·
// Documents (06-А/Б/Г, UA/EU) · Secrets (17-А/Б/Д).

const _xt = React.useState;

// ════════════════════════ ПРОЄКТИ (05) ════════════════════════
function C360Projects({ isManager }) {
  const D = window.WF_C360;
  const [wiz, setWiz] = _xt(false);
  const [edit, setEdit] = _xt(null);
  const ent = (id) => D.LEGAL_ENTITIES.find((e) => e.id === id);
  const model = (id) => D.BILLING_MODELS.find((b) => b.id === id);
  const cycle = (id) => D.BILLING_CYCLES.find((c) => c.id === id);
  return (
    <React.Fragment>
      <div className="wfc-sec-h">
        <span className="wfc-sec-h-t">Фінансові проєкти <span className="wfc-sec-h-s" style={{ marginLeft: 6 }}>// білінг у розрізі проєктів</span></span>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => setWiz(true)}><Icon name="plus" size={13} />Створити проєкт</button>
      </div>
      <div className="wfc-projects">
        {D.PROJECTS.map((p) => {
          const mdl = model(p.model);
          const hasHours = p.model !== 'hourly_postpaid';
          const cap = p.model === 'fixed_monthly_advance' ? p.hoursIncluded : p.hoursPrepaid;
          const pct = hasHours && cap ? Math.round((p.hoursUsed / cap) * 100) : 0;
          return (
            <div key={p.id} className="wfc-proj" data-status={p.status} onClick={() => setEdit(p)} style={{ cursor: 'pointer' }}>
              <div className="wfc-proj-top">
                <span className="wfc-proj-ico"><Icon name={mdl.icon} size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wfc-proj-name">{p.name}</div>
                  <div className="wfc-proj-code">{p.code} · {mdl.short}</div>
                </div>
                <div className="wfc-proj-amt">
                  {isManager
                    ? <span style={{ color: 'var(--wf-fg-subtle)', fontSize: 13 }}>—</span>
                    : <React.Fragment>{p.model === 'fixed_monthly_advance' ? D.money(p.amount, p.currency) : D.money(p.rate, p.currency)}
                      <div className="wfc-proj-amt-u">{p.model === 'fixed_monthly_advance' ? '/міс' : '/год'}</div></React.Fragment>}
                </div>
              </div>
              <div className="wfc-proj-meta">
                <div className="wfc-proj-kv"><span className="wfc-proj-kv-k">Цикл</span><span className="wfc-proj-kv-v">{cycle(p.cycle).label}{p.cycleDay ? ` · ${p.cycleDay}-е` : ''}</span></div>
                <div className="wfc-proj-kv"><span className="wfc-proj-kv-k">Юр-особа</span><span className="wfc-proj-kv-v">{ent(p.entity).name}</span></div>
                <div className="wfc-proj-kv"><span className="wfc-proj-kv-k">Договір</span><span className="wfc-proj-kv-v">{p.contract === 'required' ? 'обовʼязковий' : 'опційний'} · {p.contractStatus === 'signed' ? '✓ підписано' : p.contractStatus === 'draft' ? 'чернетка' : '—'}</span></div>
                <div className="wfc-proj-kv"><span className="wfc-proj-kv-k">Наступний білінг</span><span className="wfc-proj-kv-v">{p.next}</span></div>
              </div>
              {hasHours && cap && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>
                    <span>{p.model === 'fixed_monthly_advance' ? 'години включені' : 'передплачено'}</span><span>{p.hoursUsed} / {cap} год</span>
                  </div>
                  <div className="wfc-bar"><div className="wfc-bar-fill" data-tone={pct > 85 ? 'warn' : undefined} style={{ width: Math.min(pct, 100) + '%' }} /></div>
                </div>
              )}
              {p.model === 'hourly_postpaid' && (
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>відпрацьовано {p.hoursUsed} год · до рахунку</div>
              )}
              <div className="wfc-proj-foot">
                {isManager
                  ? <span />
                  : <span className="wfc-margin"><span className="wfc-margin-v">{p.margin}%</span><span className="wfc-margin-l">маржа</span></span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {p.status === 'active'
                    ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активний</span>
                    : <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />закрито</span>}
                  <span className="wfp-iconbtn" title="Редагувати"><Icon name="edit" size={13} /></span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {wiz && <ProjectWizard onClose={() => setWiz(false)} />}
      {edit && <ProjectEditModal project={edit} onClose={() => setEdit(null)} />}
    </React.Fragment>
  );
}

function ProjectWizard({ onClose }) {
  const D = window.WF_C360;
  const [step, setStep] = _xt(0);
  const [s, set] = _xt({ model: 'fixed_monthly_advance', currency: 'USD', amount: '3200', rate: '45', hours: '60', cycle: 'monthly_day', cycleDay: '1', terms: 'net14', contract: 'required', entity: D.LEGAL_ENTITIES.find((e) => e.def).id, name: '' });
  const u = (k, v) => set({ ...s, [k]: v });
  const isHourly = s.model !== 'fixed_monthly_advance';
  const steps = ['Модель', 'Гроші', 'Цикл', 'Договір', 'Огляд'];
  const ent = D.LEGAL_ENTITIES.find((e) => e.id === s.entity);
  const mdl = D.BILLING_MODELS.find((b) => b.id === s.model);
  const last = step === steps.length - 1;

  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal wfc-wiz" style={{ margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="plus" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Новий проєкт · {steps[step]}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfc-wiz-steps">{steps.map((_, i) => <span key={i} className="wfc-wiz-step" data-on={i <= step || undefined} />)}</div>
        <div className="wfc-wiz-body">
          {step === 0 && (
            <React.Fragment>
              <div className="wfc-wiz-q">Як білимо цей проєкт?</div>
              <div className="wfc-opts">
                {D.BILLING_MODELS.map((b) => (
                  <div key={b.id} className="wfc-opt" data-on={s.model === b.id || undefined} onClick={() => u('model', b.id)}>
                    <span className="wfc-opt-radio" /><span className="wfc-opt-ico"><Icon name={b.icon} size={16} /></span>
                    <div style={{ flex: 1 }}><div className="wfc-opt-t">{b.label}<span className="wfc-opt-tag">{b.short}</span></div><div className="wfc-opt-d">{b.desc}</div></div>
                  </div>
                ))}
              </div>
              <div className="wfp-field"><label>Назва проєкту</label><input placeholder="напр. Підтримка платформи" value={s.name} onChange={(e) => u('name', e.target.value)} /></div>
            </React.Fragment>
          )}
          {step === 1 && (
            <React.Fragment>
              <div className="wfc-wiz-q">Валюта і ставки</div>
              <div className="wfc-grid2">
                <div className="wfp-field"><label>Валюта</label><select className="wfl-select" value={s.currency} onChange={(e) => u('currency', e.target.value)}><option>USD</option><option>EUR</option><option>UAH</option></select></div>
                {!isHourly
                  ? <div className="wfp-field"><label>Абонплата / міс</label><input value={s.amount} onChange={(e) => u('amount', e.target.value)} /></div>
                  : <div className="wfp-field"><label>Ставка / год</label><input value={s.rate} onChange={(e) => u('rate', e.target.value)} /></div>}
              </div>
              {s.model === 'fixed_monthly_advance' && (
                <React.Fragment>
                  <div className="wfp-field"><label>Включені години (інформативно)</label><input value={s.hours} onChange={(e) => u('hours', e.target.value)} /></div>
                  <div className="wfc-wiz-hint">// логіка понадліміту — фаза 2. Зараз години показуються лише як прогрес, без блоку/доплати.</div>
                </React.Fragment>
              )}
              {s.model === 'hourly_prepaid' && (
                <div className="wfp-field"><label>Передплачені години</label><input value={s.hours} onChange={(e) => u('hours', e.target.value)} /></div>
              )}
            </React.Fragment>
          )}
          {step === 2 && (
            <React.Fragment>
              <div className="wfc-wiz-q">Білінг-цикл</div>
              <div className="wfc-opts">
                {D.BILLING_CYCLES.map((c) => (
                  <div key={c.id} className="wfc-opt" data-on={s.cycle === c.id || undefined} onClick={() => u('cycle', c.id)}>
                    <span className="wfc-opt-radio" /><div style={{ flex: 1 }}><div className="wfc-opt-t">{c.label}</div><div className="wfc-opt-d">{c.hint}</div></div>
                  </div>
                ))}
              </div>
              {s.cycle === 'monthly_day' && <div className="wfp-field"><label>Число місяця</label><input value={s.cycleDay} onChange={(e) => u('cycleDay', e.target.value)} style={{ width: 120 }} /></div>}
              <div className="wfp-field"><label>Payment terms (термін оплати)</label>
                <select className="wfl-select" value={s.terms} onChange={(e) => u('terms', e.target.value)}>{D.PAYMENT_TERMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                <div className="wfc-wiz-hint" style={{ marginTop: 8 }}>// задає dueDate рахунку та звʼязку з dunning-нагадуваннями.</div>
              </div>
            </React.Fragment>
          )}
          {step === 3 && (
            <React.Fragment>
              <div className="wfc-wiz-q">Договір і юр-особа</div>
              <div className="wfc-seg">
                <div className="wfc-seg-opt" data-on={s.contract === 'required' || undefined} onClick={() => u('contract', 'required')}>Договір обовʼязковий</div>
                <div className="wfc-seg-opt" data-on={s.contract === 'optional' || undefined} onClick={() => u('contract', 'optional')}>Опційний</div>
              </div>
              <div className="wfp-field"><label>Юр-особа агенції (від кого договір і рахунки)</label>
                <div className="wfc-opts" style={{ marginTop: 4 }}>
                  {D.LEGAL_ENTITIES.filter((e) => e.forCur.includes(s.currency)).map((e) => (
                    <div key={e.id} className="wfc-opt" data-on={s.entity === e.id || undefined} onClick={() => u('entity', e.id)}>
                      <span className="wfc-opt-radio" /><span className="wfc-opt-ico"><Icon name="building" size={15} /></span>
                      <div style={{ flex: 1 }}><div className="wfc-opt-t">{e.name}<span className="wfc-opt-tag">{e.kind}</span></div><div className="wfc-opt-d">{e.tax} · {e.country} · {e.vat ? 'з ПДВ' : 'без ПДВ'}</div></div>
                    </div>
                  ))}
                </div>
                <div className="wfc-wiz-hint" style={{ marginTop: 8 }}>// показані лише юр-особи, що працюють у {s.currency}. Керувати — у Налаштування → Юр-особи.</div>
              </div>
            </React.Fragment>
          )}
          {step === 4 && (
            <React.Fragment>
              <div className="wfc-wiz-q">Перевірте і створіть</div>
              <div className="wfc-review">
                <div className="wfc-review-row"><span className="wfc-review-k">Назва</span><span className="wfc-review-v">{s.name || '—'}</span></div>
                <div className="wfc-review-row"><span className="wfc-review-k">Модель</span><span className="wfc-review-v">{mdl.label}</span></div>
                <div className="wfc-review-row"><span className="wfc-review-k">{isHourly ? 'Ставка' : 'Абонплата'}</span><span className="wfc-review-v">{D.money(isHourly ? +s.rate : +s.amount, s.currency)}{isHourly ? '/год' : '/міс'}</span></div>
                {s.model !== 'hourly_postpaid' && <div className="wfc-review-row"><span className="wfc-review-k">Години</span><span className="wfc-review-v">{s.hours} ({s.model === 'fixed_monthly_advance' ? 'включені' : 'передплата'})</span></div>}
                <div className="wfc-review-row"><span className="wfc-review-k">Цикл</span><span className="wfc-review-v">{D.BILLING_CYCLES.find((c) => c.id === s.cycle).label}{s.cycle === 'monthly_day' ? ` · ${s.cycleDay}-е` : ''}</span></div>
                <div className="wfc-review-row"><span className="wfc-review-k">Payment terms</span><span className="wfc-review-v">{D.PAYMENT_TERMS.find((t) => t.id === s.terms).label}</span></div>
                <div className="wfc-review-row"><span className="wfc-review-k">Договір</span><span className="wfc-review-v">{s.contract === 'required' ? 'обовʼязковий' : 'опційний'}</span></div>
                <div className="wfc-review-row"><span className="wfc-review-k">Юр-особа</span><span className="wfc-review-v">{ent.name}</span></div>
              </div>
              <div className="wfc-wiz-hint">// задачі цього проєкту йдуть у канбан звичайним потоком; included_in_subscription — zero-billed.</div>
            </React.Fragment>
          )}
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// крок {step + 1} / {steps.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && <button className="wfp-btn" onClick={() => setStep(step - 1)}>Назад</button>}
            {!last
              ? <button className="wfp-btn wfp-btn--primary" onClick={() => setStep(step + 1)}>Далі</button>
              : <button className="wfp-btn wfp-btn--primary" onClick={onClose}><Icon name="check" size={14} />Створити проєкт</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared project editor — opens from the client card AND the global Projects list.
// `p` accepts both the rich card shape (model: 'fixed_monthly_advance'…) and the
// list shape (model: 'fixed'|'hourly', amount|rate, cur).
function ProjectEditModal({ project, onClose }) {
  const D = window.WF_C360;
  const p = project || {};
  const isFixedModel = (p.model === 'fixed_monthly_advance' || p.model === 'fixed');
  const [s, set] = _xt({
    name: p.name || '', code: p.code || '',
    model: p.model === 'fixed' ? 'fixed_monthly_advance' : (p.model === 'hourly' ? 'hourly_postpaid' : (p.model || 'fixed_monthly_advance')),
    currency: p.currency || p.cur || 'USD',
    amount: String(p.amount || 3200), rate: String(p.rate || 45),
    hours: String(p.hoursIncluded || p.hoursPrepaid || 60),
    terms: p.terms || 'net14', contract: p.contract || 'required',
    entity: p.entity || D.LEGAL_ENTITIES.find((e) => e.def).id,
    status: p.status || 'active', desc: p.desc || '',
    cycle: p.cycle || 'monthly_day', cycleDay: String(p.cycleDay || 1),
  });
  const [done, setDone] = _xt(false);
  const u = (k, v) => set({ ...s, [k]: v });
  const isHourly = s.model !== 'fixed_monthly_advance';
  const entList = D.LEGAL_ENTITIES.filter((e) => e.forCur.includes(s.currency));
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal wfc-wiz" style={{ margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="edit" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Редагувати проєкт{p.code ? ` · ${p.code}` : ''}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfc-wiz-body" style={{ minHeight: 0, paddingTop: 14, maxHeight: '64vh', overflowY: 'auto' }}>
          {done ? <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)', padding: '20px 0' }}>✓ зміни збережено</div> : (
          <React.Fragment>
            <div className="wfp-field"><label>Назва</label><input value={s.name} onChange={(e) => u('name', e.target.value)} /></div>
            <div className="wfp-field"><label>Опис</label><textarea className="wfl-select" style={{ height: 56, padding: '8px 10px', resize: 'vertical' }} value={s.desc} onChange={(e) => u('desc', e.target.value)} /></div>
            <div className="wfp-field"><label>Білінг-модель</label><select className="wfl-select" value={s.model} onChange={(e) => u('model', e.target.value)}>{D.BILLING_MODELS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>
            <div className="wfc-grid2">
              <div className="wfp-field"><label>Валюта</label><select className="wfl-select" value={s.currency} onChange={(e) => u('currency', e.target.value)}><option>USD</option><option>EUR</option><option>UAH</option></select></div>
              {!isHourly
                ? <div className="wfp-field"><label>Абонплата / міс</label><input value={s.amount} onChange={(e) => u('amount', e.target.value)} /></div>
                : <div className="wfp-field"><label>Ставка / год</label><input value={s.rate} onChange={(e) => u('rate', e.target.value)} /></div>}
            </div>
            {s.model !== 'hourly_postpaid' && <div className="wfp-field"><label>{s.model === 'fixed_monthly_advance' ? 'Включені години' : 'Передплачені години'}</label><input value={s.hours} onChange={(e) => u('hours', e.target.value)} /></div>}
            <div className="wfc-grid2">
              <div className="wfp-field"><label>Білінг-цикл</label><select className="wfl-select" value={s.cycle} onChange={(e) => u('cycle', e.target.value)}>{D.BILLING_CYCLES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
              <div className="wfp-field"><label>Payment terms</label><select className="wfl-select" value={s.terms} onChange={(e) => u('terms', e.target.value)}>{D.PAYMENT_TERMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
            </div>
            <div className="wfp-field"><label>Юр-особа (від кого рахунок)</label><select className="wfl-select" value={s.entity} onChange={(e) => u('entity', e.target.value)}>{entList.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
            <div className="wfc-grid2">
              <div className="wfp-field"><label>Договір</label><select className="wfl-select" value={s.contract} onChange={(e) => u('contract', e.target.value)}><option value="required">обовʼязковий</option><option value="optional">опційний</option></select></div>
              <div className="wfp-field"><label>Статус</label><select className="wfl-select" value={s.status} onChange={(e) => u('status', e.target.value)}><option value="active">активний</option><option value="paused">призупинено</option><option value="closed">закрито</option></select></div>
            </div>
          </React.Fragment>
          )}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 05-ПРОЕКТИ · edit</span><div style={{ display: 'flex', gap: 8 }}>{!done ? <React.Fragment><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={() => setDone(true)}><Icon name="check" size={14} />Зберегти</button></React.Fragment> : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}</div></div>
      </div>
    </div>
  );
}

// Editable client billing requisites (06-Б) — on whom the invoice is issued.
// Client fills via portal; agency can view / edit / fill on the client's behalf.
function ClientBillingPanel() {
  const D = window.WF_C360;
  const b = D.CLIENT.billing;
  const [edit, setEdit] = _xt(false);
  const fields = [
    ['legalName', 'Юр. назва', b.legalName], ['kind', 'Форма', b.kind],
    ['taxId', 'ЄДРПОУ / tax ID', b.taxId], ['vat', 'ПДВ', b.vat ? 'платник' : 'без ПДВ'],
    ['address', 'Адреса', b.address], ['bank', 'Банк', b.bank],
    ['iban', 'IBAN', b.iban], ['docEmail', 'Email для документів', b.docEmail],
    ['signer', 'Підписант', b.signer], ['signerRole', 'Посада', b.signerRole],
  ];
  return (
    <div className="wfl-panel" style={{ marginBottom: 20 }}>
      <div className="wfl-panel-h">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          // реквізити для рахунку
          <span className="wfg-pill2" data-tone={b.filledBy === 'клієнт' ? 'ok' : 'muted'}><span className="wfg-pill2-dot" />заповнив: {b.filledBy}</span>
          {b.confirmed && <span className="wfg-pill2" data-tone="accent"><span className="wfg-pill2-dot" />підтверджено</span>}
        </span>
        <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setEdit(!edit)}><Icon name="edit" size={12} />{edit ? 'Готово' : 'Редагувати'}</button>
      </div>
      <div className="wfl-panel-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {fields.map(([k, label, v]) => (
          <div key={k} className="wfp-field" style={k === 'address' ? { gridColumn: '1 / -1' } : undefined}>
            <label>{label}</label>
            {edit ? <input defaultValue={v} /> : <div style={{ fontSize: 13.5, padding: '2px 0' }}>{v}</div>}
          </div>
        ))}
        {edit && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 9, alignItems: 'center', padding: '10px 12px', borderRadius: 9, background: 'var(--wf-subtle)', fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
            <Icon name="users" size={14} color="var(--wf-accent)" />
            Редагуєте реквізити <strong style={{ margin: '0 4px' }}>за клієнта</strong> — зміни позначаться як «заповнив: агенція». Клієнт також редагує їх у себе в порталі.
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════ ФІНАНСИ (05-Г/В · 22-Д) ════════════════════════
function C360Finance() {
  const D = window.WF_C360;
  const cl = D.CLIENT;
  const m = (n) => D.money(n, cl.currency);
  const [action, setAction] = _xt(null);
  const proj = (id) => D.PROJECTS.find((p) => p.id === id);
  const totalRev = D.PROJECTS.reduce((a, p) => a + (p.model === 'fixed_monthly_advance' ? p.amount : (p.rate * (p.hoursUsed || 0))), 0);
  return (
    <React.Fragment>
      <ClientBillingPanel />
      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat"><div className="wfp-stat-k">сплачено разом (LTV)</div><div className="wfp-stat-v wfp-stat-v--accent">{m(cl.kpis.ltv)}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">поточний борг</div><div className="wfp-stat-v wfp-stat-v--warn">{m(cl.kpis.debt)}</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">маржа сер.</div><div className="wfp-stat-v">{cl.kpis.margin}%</div></div>
        <div className="wfp-stat"><div className="wfp-stat-k">собівартість (міс)</div><div className="wfp-stat-v">{m(2376)}</div></div>
      </div>

      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, alignItems: 'start' }}>
        <div>
          {/* per-project breakdown with margin (22-Д) */}
          <div className="wfc-sec-h"><span className="wfc-sec-h-t">Розрізи по проєктах</span><span className="wfc-sec-h-s">// дохід · собівартість · маржа</span></div>
          <table className="wfp-table">
            <thead><tr><th>Проєкт</th><th className="wfp-num">Дохід</th><th className="wfp-num">Собівартість</th><th className="wfp-num">Маржа</th></tr></thead>
            <tbody>
              {D.PROJECTS.map((p) => {
                const rev = p.model === 'fixed_monthly_advance' ? p.amount : p.rate * (p.hoursUsed || 0);
                const cost = Math.round(rev * (1 - p.margin / 100));
                return (
                  <tr key={p.id}>
                    <td><span style={{ fontWeight: 500 }}>{p.name}</span><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{p.code}</div></td>
                    <td className="wfp-num" style={{ fontWeight: 600 }}>{D.money(rev, p.currency)}</td>
                    <td className="wfp-num" style={{ color: 'var(--wf-fg-muted)' }}>{D.money(cost, p.currency)}</td>
                    <td className="wfp-num"><span className="wfc-margin"><span className="wfc-margin-v">{p.margin}%</span></span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* invoices + dunning (05-Б) */}
          <div className="wfc-sec-h" style={{ marginTop: 26 }}><span className="wfc-sec-h-t">Рахунки</span></div>
          <table className="wfp-table">
            <thead><tr><th>Рахунок</th><th>Виставлено</th><th>Термін</th><th className="wfp-num">Сума</th><th>Статус</th></tr></thead>
            <tbody>
              {D.FINANCE.invoices.map((iv) => (
                <tr key={iv.id}>
                  <td className="wfp-mono"><span className="wfp-link">{iv.id}</span></td>
                  <td className="wfp-mono">{iv.date}</td>
                  <td className="wfp-mono" style={{ color: iv.status === 'overdue' ? 'var(--wf-destructive)' : 'var(--wf-fg-muted)' }}>{iv.due}</td>
                  <td className="wfp-num">{m(iv.amount)}{iv.paid > 0 && iv.paid < iv.amount && <div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>сплачено {m(iv.paid)}</div>}</td>
                  <td>{iv.status === 'paid' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />сплачено</span> : <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />овердʼю {iv.overdueDays}д</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* payment terms (05-Г) */}
          <div>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t">Payment terms</span><span className="wfc-sec-h-s">// 05-Г</span></div>
            <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 12 }}>
              <div className="wfp-field"><label>Дефолт для клієнта</label><select className="wfl-select" defaultValue="net14">{D.PAYMENT_TERMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
              <div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)', lineHeight: 1.5 }}>Задає dueDate на рахунках клієнта. Можна перевизначати на окремому рахунку.</div>
            </div></div>
          </div>

          {/* dunning chain (05-Б) */}
          <div>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t">Dunning по овердʼю</span></div>
            <div className="wfl-panel"><div className="wfl-panel-b" style={{ gap: 0 }}>
              <div className="wfl-tl">
                {D.FINANCE.dunning.map((d, i) => (
                  <div key={i} className="wfl-tl-row">
                    <span className="wfl-tl-dot" data-kind={d.status === 'sent' ? 'inbound' : 'note'}><Icon name={d.status === 'sent' ? 'check' : 'clock'} size={11} /></span>
                    <div className="wfl-tl-body"><div className="wfl-tl-txt" style={{ fontSize: 12.5 }}>{d.label}</div><div className="wfl-tl-meta">{d.when} · {d.status === 'sent' ? `надіслано ${d.sent}` : 'заплановано'}</div></div>
                  </div>
                ))}
              </div>
            </div></div>
          </div>

          {/* actions (05-В) */}
          <div>
            <div className="wfc-sec-h"><span className="wfc-sec-h-t">Дії з боргом</span><span className="wfc-sec-h-s">// 05-В</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="wfp-btn" style={{ justifyContent: 'flex-start' }} onClick={() => setAction('refund')}><Icon name="coins" size={14} />Повернення (refund)</button>
              <button className="wfp-btn" style={{ justifyContent: 'flex-start' }} onClick={() => setAction('credit')}><Icon name="receipt" size={14} />Сторно / credit-note</button>
              <button className="wfp-btn" style={{ justifyContent: 'flex-start' }} onClick={() => setAction('writeoff')}><Icon name="alert" size={14} />Списати борг (write-off)</button>
            </div>
          </div>
        </div>
      </div>
      {action && <FinanceActionModal kind={action} m={m} onClose={() => setAction(null)} />}
    </React.Fragment>
  );
}

function FinanceActionModal({ kind, m, onClose }) {
  const [done, setDone] = _xt(false);
  const cfg = {
    refund:   { ic: 'coins',   title: 'Повернення коштів', desc: 'Повернути частину або всю суму клієнту. Реферальний бонус буде клавбекнуто пропорційно.', cta: 'Оформити повернення', ok: 'Повернення створено · документ згенеровано' },
    credit:   { ic: 'receipt', title: 'Сторно / credit-note', desc: 'Зменшити суму до сплати кредит-нотою. Привʼязується до рахунку, видно клієнту.', cta: 'Створити credit-note', ok: 'Credit-note №CN-014 створено' },
    writeoff: { ic: 'alert',   title: 'Списати борг', desc: 'Безнадійний борг переходить у статус written_off. Реферальний бонус клавбекається. Дія в audit-log.', cta: 'Списати борг', ok: 'Борг списано · позначено written_off', danger: true },
  }[kind];
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 480, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name={cfg.ic} size={18} color={cfg.danger ? 'var(--wf-destructive)' : 'var(--wf-accent)'} /><span className="wfp-modal-h-t">{cfg.title}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          {!done ? (
            <React.Fragment>
              <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6, marginBottom: 14 }}>{cfg.desc}</div>
              <div className="wfp-field"><label>Рахунок</label><select className="wfl-select"><option>INV-2025-0418 · {m(3200)} · овердʼю</option><option>INV-2025-0402 · {m(1260)}</option></select></div>
              <div className="wfp-field" style={{ marginTop: 12 }}><label>Сума</label><input defaultValue={kind === 'writeoff' ? '1800' : '1400'} /></div>
              <div className="wfp-field" style={{ marginTop: 12 }}><label>Причина (в audit-log)</label><input placeholder="напр. часткове повернення за домовленістю" /></div>
            </React.Fragment>
          ) : <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)' }}>✓ {cfg.ok}</div>}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 05-В</span><div style={{ display: 'flex', gap: 8 }}>{!done ? <React.Fragment><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" style={cfg.danger ? { background: 'var(--wf-destructive)', borderColor: 'var(--wf-destructive)', color: '#fff' } : undefined} onClick={() => setDone(true)}>{cfg.cta}</button></React.Fragment> : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}</div></div>
      </div>
    </div>
  );
}

// ════════════════════════ ДОКУМЕНТИ (06) ════════════════════════
const DOC_KIND = {
  contract: { ic: 'file', l: 'Договір' }, nda: { ic: 'shield', l: 'NDA' },
  invoice: { ic: 'receipt', l: 'Рахунок' }, act: { ic: 'check', l: 'Акт' },
  recon: { ic: 'list', l: 'Акт звірки' }, upload: { ic: 'paperclip', l: 'Завантажено' },
};
const DOC_DEL = { delivered: 'доставлено', opened: 'відкрито', pending: 'очікує' };

function C360DocRow({ d }) {
  const k = DOC_KIND[d.kind] || DOC_KIND.upload;
  const dels = Object.entries(d.delivery || {});
  return (
    <div className="wfc-doc-row">
      <span className="wfc-doc-ico" data-fmt={d.format}><Icon name={k.ic} size={16} /></span>
      <div>
        <div className="wfc-doc-name">{d.name}</div>
        <div className="wfc-doc-meta">{k.l} · {d.format} · {d.project} · {d.date}</div>
      </div>
      <div className="wfc-delivery">
        {dels.length === 0
          ? <span className="wfc-deliv" style={{ color: 'var(--wf-fg-subtle)' }}>не надсилалось</span>
          : dels.map(([ch, st]) => <span key={ch} className="wfc-deliv"><span className="wfc-deliv-dot" data-s={st} />{ch === 'email' ? 'email' : 'TG'}: {DOC_DEL[st]}</span>)}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {d.status === 'signed' && <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />підписано</span>}
        {d.status === 'overdue' && <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />овердʼю</span>}
        {d.status === 'awaiting' && <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />очікує</span>}
        {d.status === 'draft' && <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />чернетка</span>}
        {d.status === 'uploaded' && <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />скан</span>}
        <button className="wfp-iconbtn" title="Переглянути" onClick={() => window.wfToast && window.wfToast('Переглянути · демо', 'ok')}><Icon name="eye" size={14} /></button>
        <button className="wfp-iconbtn" title="Завантажити" onClick={() => window.wfToast && window.wfToast('Завантажити · демо', 'ok')}><Icon name="download" size={14} /></button>
      </div>
    </div>
  );
}

function C360Docs() {
  const D = window.WF_C360;
  const [fmt, setFmt] = _xt('all');
  const rows = D.DOCS.filter((d) => fmt === 'all' || d.format === fmt);
  const work = rows.filter((d) => d.docType === 'work');
  const result = rows.filter((d) => d.docType === 'result');
  return (
    <React.Fragment>
      <div className="wfc-sec-h">
        <span className="wfc-sec-h-t">Документи клієнта</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Завантажити підписаний · демо', 'ok')}><Icon name="paperclip" size={13} />Завантажити підписаний</button>
          <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Згенерувати · демо', 'ok')}><Icon name="plus" size={13} />Згенерувати</button>
        </div>
      </div>
      <div className="wfp-filters" style={{ marginBottom: 20 }}>
        <button className="wfp-pill" data-on={fmt === 'all' || undefined} onClick={() => setFmt('all')}>усі формати</button>
        <button className="wfp-pill" data-on={fmt === 'UA' || undefined} onClick={() => setFmt('UA')}>🇺🇦 UA-комплект</button>
        <button className="wfp-pill" data-on={fmt === 'EU' || undefined} onClick={() => setFmt('EU')}>🇪🇺 EU-комплект</button>
      </div>

      <div className="wfc-sec-h">
        <span className="wfc-sec-h-t" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="file" size={15} color="var(--wf-fg-muted)" />Документи для роботи</span>
        <span className="wfc-sec-h-s">// договори · NDA · старт співпраці</span>
      </div>
      {work.length ? work.map((d) => <C360DocRow key={d.id} d={d} />) : <div className="wfl-empty" style={{ marginBottom: 4 }}>немає документів у цьому форматі</div>}

      <div className="wfc-sec-h" style={{ marginTop: 26 }}>
        <span className="wfc-sec-h-t" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="receipt" size={15} color="var(--wf-fg-muted)" />Результати та білінг</span>
        <span className="wfc-sec-h-s">// рахунки · акти · акти звірки</span>
      </div>
      {result.length ? result.map((d) => <C360DocRow key={d.id} d={d} />) : <div className="wfl-empty">немає документів у цьому форматі</div>}
    </React.Fragment>
  );
}

// ════════════════════════ СЕКРЕТИ (17) ════════════════════════
function C360Secrets() {
  const D = window.WF_C360;
  const [revealed, setRevealed] = _xt(null);
  const [add, setAdd] = _xt(false);
  const FK = D.FIELD_KINDS;
  return (
    <React.Fragment>
      <div className="wfc-sec-h">
        <span className="wfc-sec-h-t">Ключі та доступи <span className="wfc-sec-h-s" style={{ marginLeft: 6 }}>// ресурс + гнучкі поля · reveal лише після 2FA</span></span>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => setAdd(true)}><Icon name="plus" size={13} />Додати ресурс</button>
      </div>
      <div className="wfc-secrets">
        {D.SECRETS.map((sec) => {
          const t = D.RESOURCE_TYPES[sec.type] || D.RESOURCE_TYPES.other;
          const open = revealed === sec.id;
          return (
            <div key={sec.id} className="wfc-secret">
              <div className="wfc-secret-top">
                <span className="wfc-secret-ico"><Icon name={t.icon} size={16} /></span>
                <div style={{ flex: 1 }}><div className="wfc-secret-name">{sec.resource}</div><div className="wfc-secret-login">{t.label} · {sec.fields.length} пол{sec.fields.length === 1 ? 'е' : 'ів'}</div></div>
                {sec.fields.some((f) => FK[f.kind].secret) && (
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setRevealed(open ? null : sec.id)} title="2FA-gated"><Icon name={open ? 'eye_off' : 'eye'} size={13} />{open ? 'Сховати' : 'Reveal'}</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sec.fields.map((f, i) => {
                  const fk = FK[f.kind];
                  const masked = fk.secret && !open;
                  return (
                    <div key={i} className="wfc-secret-field">
                      <Icon name={fk.icon} size={12} color="var(--wf-fg-subtle)" />
                      <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--wf-fg-subtle)', minWidth: 58 }}>{fk.label}</span>
                      <input readOnly value={masked ? '••••••••••' : f.value} style={{ flex: 1, fontSize: 11.5 }} />
                      <button title="Копіювати"><Icon name="copy" size={13} /></button>
                    </div>
                  );
                })}
              </div>
              <div className="wfc-secret-foot"><span>оновлено {sec.updated}</span><span>додав: {sec.addedBy}</span></div>
            </div>
          );
        })}
      </div>

      <div className="wfc-sec-h" style={{ marginTop: 26 }}><span className="wfc-sec-h-t">Журнал доступів</span><span className="wfc-sec-h-s">// 17-Б · видно клієнту</span></div>
      <table className="wfp-table">
        <thead><tr><th>Хто</th><th>Секрет</th><th>Дія</th><th>2FA</th><th>Коли</th></tr></thead>
        <tbody>
          {D.SECRET_LOG.map((l, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{l.who}</td>
              <td>{l.secret}</td>
              <td><span className="wfg-pill2" data-tone={l.action === 'reveal' ? 'warn' : 'muted'}><span className="wfg-pill2-dot" />{l.action}</span></td>
              <td><span className="wfc-2fa" data-on={l.twofa}><Icon name="shield" size={11} />{l.twofa ? 'on' : 'off'}</span></td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{l.when}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {add && <AddSecretModal onClose={() => setAdd(false)} />}
    </React.Fragment>
  );
}

function AddSecretModal({ onClose }) {
  const D = window.WF_C360;
  const FK = D.FIELD_KINDS;
  const [type, setType] = _xt('crm');
  const [fields, setFields] = _xt([{ kind: 'url', value: '' }, { kind: 'login', value: '' }, { kind: 'password', value: '' }]);
  const [done, setDone] = _xt(false);
  const addField = (kind) => setFields([...fields, { kind, value: '' }]);
  const rmField = (i) => setFields(fields.filter((_, j) => j !== i));
  const setVal = (i, v) => setFields(fields.map((f, j) => j === i ? { ...f, value: v } : f));
  const setKind = (i, k) => setFields(fields.map((f, j) => j === i ? { ...f, kind: k } : f));
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 540, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="lock" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Новий ресурс</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body" style={{ maxHeight: '64vh', overflowY: 'auto' }}>
          {!done ? (
            <React.Fragment>
              <div className="wfc-grid2">
                <div className="wfp-field"><label>Назва ресурсу</label><input placeholder="напр. KeyCRM" /></div>
                <div className="wfp-field"><label>Тип</label><select className="wfl-select" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(D.RESOURCE_TYPES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}</select></div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)', margin: '14px 0 8px' }}>Поля доступу — додавайте лише потрібні. Токени/ключі не потребують пароля.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fields.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select className="wfl-select" style={{ width: 150, flexShrink: 0 }} value={f.kind} onChange={(e) => setKind(i, e.target.value)}>{Object.entries(FK).map(([id, k]) => <option key={id} value={id}>{k.label}</option>)}</select>
                    <input placeholder={FK[f.kind].secret ? '••••••' : 'значення'} type={FK[f.kind].secret ? 'password' : 'text'} value={f.value} onChange={(e) => setVal(i, e.target.value)} style={{ flex: 1, height: 36, padding: '0 10px', border: '1px solid var(--wf-border)', borderRadius: 7, background: 'var(--wf-bg)', color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} />
                    <button className="wfp-iconbtn" onClick={() => rmField(i)} title="Прибрати"><Icon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {['login', 'password', 'api_key', 'token', 'url', 'secret_w', 'note'].map((k) => (
                  <button key={k} className="wfl-card-chip" style={{ cursor: 'pointer', border: '1px dashed var(--wf-border)' }} onClick={() => addField(k)}><Icon name="plus" size={10} />{FK[k].label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--wf-subtle)', fontSize: 12, color: 'var(--wf-fg-secondary)' }}><Icon name="shield" size={14} color="var(--wf-accent)" />Поля з типом пароль/ключ/токен зашифровано. Перегляд командою — лише після 2FA, із записом у журнал.</div>
            </React.Fragment>
          ) : <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-success)' }}>✓ ресурс додано та зашифровано</div>}
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 17-А · {fields.length} полів</span><div style={{ display: 'flex', gap: 8 }}>{!done ? <React.Fragment><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={() => setDone(true)}>Зберегти</button></React.Fragment> : <button className="wfp-btn wfp-btn--primary" onClick={onClose}>Готово</button>}</div></div>
      </div>
    </div>
  );
}

Object.assign(window, { C360Projects, ProjectWizard, ProjectEditModal, ClientBillingPanel, C360Finance, C360Docs, C360Secrets });
