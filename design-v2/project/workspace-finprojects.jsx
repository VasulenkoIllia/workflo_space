// workspace-finprojects.jsx — standalone Workspace screens (П1):
// WsProjects (05, separate list) · WsLegalEntities (20-Д) ·
// WsCompensation (12-А triârus + 22-Д) · WsContractTemplates (06-А).

const _fp = React.useState;

// ════════════════ Фінансові проєкти — окремий список (С1) ════════════════
function WsProjects() {
  const D = window.WF_FINPROJ;
  const C = window.WF_C360;
  const [q, setQ] = _fp('');
  const [filter, setFilter] = _fp('all');
  const [wiz, setWiz] = _fp(false);
  const [edit, setEdit] = _fp(null);
  let rows = D.PROJECTS_ALL.filter((p) => (p.name + p.client + p.code).toLowerCase().includes(q.toLowerCase()));
  if (filter !== 'all') rows = rows.filter((p) => p.status === filter);
  const active = D.PROJECTS_ALL.filter((p) => p.status === 'active').length;
  const mrr = D.PROJECTS_ALL.filter((p) => p.model === 'fixed' && p.status === 'active').reduce((a, p) => a + p.amount, 0);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Проєкти</h1>
          <div className="wfp-ph-sub">// {active} активних · MRR з абонплат ≈ ${mrr.toLocaleString('en-US')}</div>
        </div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => setWiz(true)}><Icon name="plus" size={14} />Створити проєкт</button></div>
      </div>
      <div className="wfp-filters">
        <div className="wfp-search"><Icon name="search" size={14} color="var(--wf-fg-muted)" /><input placeholder="Шукати проєкт / клієнта…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {[['all', 'усі'], ['active', 'активні'], ['paused', 'призупинені'], ['closed', 'закриті']].map(([id, l]) => (
          <button key={id} className="wfp-pill" data-on={filter === id || undefined} onClick={() => setFilter(id)}>{l}</button>
        ))}
      </div>
      <table className="wfp-table">
        <thead><tr><th>Проєкт</th><th>Клієнт</th><th>Модель</th><th className="wfp-num">Ставка / абонплата</th><th>Цикл</th><th>Юр-особа</th><th className="wfp-num">Маржа</th><th>Статус</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} onClick={() => setEdit(p)} style={Object.assign({ cursor: 'pointer' }, p.status === 'closed' ? { opacity: 0.55 } : {})}>
              <td><span className="wfp-link" style={{ fontWeight: 600 }}>{p.name}</span><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{p.code} · {p.hours} год</div></td>
              <td>{p.client}</td>
              <td><span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />{p.model === 'fixed' ? 'абонплата' : 'погодинно'}</span></td>
              <td className="wfp-num" style={{ fontWeight: 600 }}>{C.money(p.model === 'fixed' ? p.amount : p.rate, p.cur)}<span style={{ fontSize: 10, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}>{p.model === 'fixed' ? '/міс' : '/год'}</span></td>
              <td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{p.cycle}</td>
              <td style={{ fontSize: 12 }}>{p.entity}</td>
              <td className="wfp-num"><span className="wfc-margin"><span className="wfc-margin-v">{p.margin}%</span></span></td>
              <td>{p.status === 'active' ? <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активний</span> : p.status === 'paused' ? <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />пауза</span> : <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />закрито</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {wiz && window.ProjectWizard && <ProjectWizard onClose={() => setWiz(false)} />}
      {edit && window.ProjectEditModal && <ProjectEditModal project={edit} onClose={() => setEdit(null)} />}
    </React.Fragment>
  );
}

// ════════════════ Юр-особи агенції (20-Д) ════════════════
function WsLegalEntities() {
  const D = window.WF_C360;
  const [sel, setSel] = _fp(D.LEGAL_ENTITIES[0].id);
  const [edit, setEdit] = _fp(false);
  const e = D.LEGAL_ENTITIES.find((x) => x.id === sel);
  const missing = D.legalMissing(e);
  const complete = missing.length === 0;
  const readyCount = D.LEGAL_ENTITIES.filter((x) => D.legalComplete(x)).length;
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Юр-особи</h1><div className="wfp-ph-sub">// {D.LEGAL_ENTITIES.length} профілі · {readyCount} готові до документів · для договорів і рахунків</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Додати юр-особу · демо', 'ok')}><Icon name="plus" size={14} />Додати юр-особу</button></div>
      </div>
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {D.LEGAL_ENTITIES.map((x) => {
            const ok = D.legalComplete(x);
            return (
            <div key={x.id} className="wfl-pipe-item" data-on={sel === x.id || undefined} onClick={() => { setSel(x.id); setEdit(false); }}>
              <span className="wfc-proj-ico" style={{ width: 30, height: 30 }}><Icon name="building" size={15} /></span>
              <div className="wfl-pipe-item-n">{x.name}<div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}>{x.kind}</div></div>
              <span className="wfl-ready" data-ok={ok || undefined} title={ok ? 'готова до документів' : 'не вистачає реквізитів'}><Icon name={ok ? 'check' : 'alert'} size={11} />{ok ? 'ready' : 'чернетка'}</span>
              {x.def && <span className="wfg-pill2" data-tone="accent"><span className="wfg-pill2-dot" />дефолт</span>}
            </div>
            );
          })}
        </div>
        <div className="wfl-panel">
          <div className="wfl-panel-h"><span>// {e.name}</span><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setEdit(!edit)}><Icon name="edit" size={12} />{edit ? 'Готово' : 'Редагувати'}</button></div>
          <div className={`wfl-gate${complete ? ' wfl-gate--ok' : ''}`}>
            <Icon name={complete ? 'check' : 'alert'} size={16} />
            <div style={{ flex: 1 }}>
              <div className="wfl-gate-t">{complete ? 'Готова до документів' : 'Не готова до документів'}</div>
              <div className="wfl-gate-s">{complete ? 'усі обовʼязкові реквізити заповнені — можна формувати договори й рахунки' : `бракує: ${missing.join(' · ')} — документи заблоковані`}</div>
            </div>
          </div>
          <div className="wfl-panel-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[['Юр. назва', e.name, 'name'], ['Форма / податки', `${e.kind} · ${e.tax}`, null], ['Країна', e.country, null], ['ЄДРПОУ / рег.№', e.edrpou, 'edrpou'], ['IBAN', e.iban, 'iban'], ['ПДВ', e.vat ? 'платник ПДВ' : 'без ПДВ', null], ['Адреса', e.addr, 'addr'], ['Валюти', e.forCur.join(' · '), null]].map(([k, v, reqKey]) => {
              const isMissing = reqKey && (!v || String(v).trim() === '');
              return (
              <div key={k} className="wfp-field"><label>{k}{isMissing && <span className="wfl-req"> · обовʼязкове</span>}</label>{edit ? <input defaultValue={v} placeholder={isMissing ? 'заповніть…' : ''} data-missing={isMissing || undefined} /> : <div style={{ fontSize: 13.5, padding: '2px 0', color: isMissing ? 'var(--wf-destructive)' : undefined }}>{v || '— не заповнено'}</div>}</div>
              );
            })}
            <div className="wfp-field" style={{ gridColumn: '1 / -1' }}><label>Використання</label><div style={{ fontSize: 12.5, color: 'var(--wf-fg-muted)' }}>Селектор юр-особи показується у майстрі проєкту — фільтрується за валютою проєкту. Привʼязується до договорів і рахунків через змінні шаблону.</div></div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ════════════════ Ставки / компенсації (12-А + 22-Д) ════════════════
function WsCompensation() {
  const D = window.WF_FINPROJ;
  const [open, setOpen] = _fp(null);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Ставки та компенсації</h1><div className="wfp-ph-sub">// триярус: базова ставка профілю → override на проєкті → прапорець «без собівартості»</div></div>
      </div>

      <div className="wfl-panel" style={{ marginBottom: 18 }}>
        <div className="wfl-panel-b" style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          {Object.entries(D.COMP_MODELS).map(([id, m]) => (
            <div key={id} style={{ flex: '1 1 220px', display: 'flex', gap: 11, alignItems: 'flex-start', padding: '12px 14px', border: '1px solid var(--wf-border)', borderRadius: 11, background: 'var(--wf-subtle)' }}>
              <span className="wfc-opt-ico"><Icon name="coins" size={15} /></span>
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div><div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)', marginTop: 3 }}>{m.desc}</div></div>
            </div>
          ))}
        </div>
      </div>

      <table className="wfp-table">
        <thead><tr><th>Виконавець</th><th>Базова модель</th><th className="wfp-num">Ставка / сума</th><th className="wfp-num">Комісія %</th><th>Override на проєктах</th><th>Собівартість</th><th></th></tr></thead>
        <tbody>
          {D.TEAM_COMP.map((t) => (
            <tr key={t.id}>
              <td><span style={{ fontWeight: 500 }}>{t.name}</span><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{t.role} · {t.dept}</div></td>
              <td><span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />{D.COMP_MODELS[t.model].label}</span></td>
              <td className="wfp-num" style={{ fontWeight: 600 }}>{t.zeroCost ? '—' : (D.COMP_MODELS[t.model].hasHours ? '$' + t.base + '/год' : '$' + (t.base || 2400) + '/міс')}</td>
              <td className="wfp-num">{t.commission ? <span className="wfg-pill2" data-tone="accent" style={{ display: 'inline-flex' }}><span className="wfg-pill2-dot" />+{t.commission}%</span> : '—'}</td>
              <td>{t.projects.length ? t.projects.map((p) => <span key={p.name} className="wfl-card-chip" style={{ marginRight: 4 }}>{p.name}: ${p.override}</span>) : <span style={{ color: 'var(--wf-fg-subtle)' }}>—</span>}</td>
              <td>{t.zeroCost ? <span className="wfg-pill2" data-tone="accent"><span className="wfg-pill2-dot" />без собівартості</span> : <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />враховується</span>}</td>
              <td style={{ textAlign: 'right' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => setOpen(t.id)}>Налаштувати</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--wf-accent-soft)', border: '1px solid var(--wf-accent)' }}>
        <Icon name="shield" size={15} color="var(--wf-fg)" style={{ marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.5 }}><strong>Комісія %</strong> — ортогональна: тумблер поверх будь-якої моделі. Ставка $/год показується лише для моделей з годинами. <strong>«Без собівартості» (zeroCost)</strong> — увесь дохід проєкту йде агенції; собівартість і маржа видимі адміну на екрані проєкту і у звітах (22-Д).</div>
      </div>
      {open && <CompModal t={D.TEAM_COMP.find((x) => x.id === open)} models={D.COMP_MODELS} onClose={() => setOpen(null)} />}
    </React.Fragment>
  );
}

function CompModal({ t, models, onClose }) {
  const [model, setModel] = _fp(t.model);
  const [zero, setZero] = _fp(t.zeroCost);
  const [hasComm, setHasComm] = _fp(t.commission > 0);
  const hasHours = models[model].hasHours;
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 500, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="coins" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Компенсація · {t.name}</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfp-field"><label>Базова модель оплати</label>
            <div className="wfc-opts" style={{ marginTop: 4 }}>
              {Object.entries(models).map(([id, m]) => (
                <div key={id} className="wfc-opt" data-on={model === id || undefined} onClick={() => setModel(id)}>
                  <span className="wfc-opt-radio" /><div style={{ flex: 1 }}><div className="wfc-opt-t">{m.label}{m.hasHours && <span className="wfc-opt-tag">з годинами</span>}</div><div className="wfc-opt-d">{m.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
          {/* hourlyRate показується ЛИШЕ для моделей з годинами */}
          {hasHours
            ? <div className="wfp-field" style={{ marginTop: 14 }}><label>Ставка ($/год)</label><input defaultValue={t.base} disabled={zero} style={{ maxWidth: 200 }} /></div>
            : <div className="wfp-field" style={{ marginTop: 14 }}><label>Фіксована сума ($ / період)</label><input defaultValue={t.base || 2400} disabled={zero} style={{ maxWidth: 200 }} /></div>}
          {/* Комісія % — ОРТОГОНАЛЬНА: тумблер поверх будь-якої моделі */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '11px 13px', border: '1px solid var(--wf-border)', borderRadius: 10, cursor: 'pointer', borderColor: hasComm ? 'var(--wf-accent)' : 'var(--wf-border)' }}>
            <input type="checkbox" checked={hasComm} onChange={(e) => setHasComm(e.target.checked)} />
            <span style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 600 }}>Комісія % поверх</span><div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)' }}>Незалежна від моделі — додається до будь-якої</div></span>
            {hasComm && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><input defaultValue={t.commission || 5} style={{ width: 56, height: 32, padding: '0 8px', border: '1px solid var(--wf-border)', borderRadius: 7, background: 'var(--wf-bg)', color: 'var(--wf-fg)', font: 'inherit', textAlign: 'right' }} onClick={(e) => e.preventDefault()} /><span style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>%</span></span>}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '11px 13px', border: '1px solid var(--wf-border)', borderRadius: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={zero} onChange={(e) => setZero(e.target.checked)} />
            <span><span style={{ fontSize: 13, fontWeight: 600 }}>Без собівартості (zeroCost)</span><div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)' }}>Весь дохід проєктів цієї людини = дохід агенції</div></span>
          </label>
        </div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// 12-КОМПЕНСАЦІЇ</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={onClose}><Icon name="check" size={14} />Зберегти</button></div></div>
      </div>
    </div>
  );
}

// ════════════════ Шаблони договорів (06-А) ════════════════
function WsContractTemplates() {
  const D = window.WF_FINPROJ;
  const [edit, setEdit] = _fp(null);
  if (edit) return <ContractEditor tpl={D.CONTRACT_TEMPLATES.find((t) => t.id === edit)} onBack={() => setEdit(null)} />;
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Шаблони договорів</h1><div className="wfp-ph-sub">// зі змінними · привʼязка до проєкту · кастомізація тенантом під SaaS</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Новий шаблон · демо', 'ok')}><Icon name="plus" size={14} />Новий шаблон</button></div>
      </div>
      <div className="r4-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {D.CONTRACT_TEMPLATES.map((t) => (
          <div key={t.id} className="r4-card" style={{ cursor: 'pointer' }} onClick={() => setEdit(t.id)}>
            <div className="r4-card-top">
              <span className="wfg-src wfg-src--lg" style={{ background: t.format === 'EU' ? '#3B82F6' : 'var(--wf-fg)' }}><Icon name="file" size={16} /></span>
              <div style={{ flex: 1 }}><div className="r4-card-name" style={{ fontSize: 13.5 }}>{t.name}</div><div className="r4-card-meta">{t.format} · {t.lang} · {t.vars} змінних</div></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>
              <span>оновлено {t.updated}</span>
              <span>{t.linkedProjects} проєкт(и)</span>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

function ContractEditor({ tpl, onBack }) {
  const D = window.WF_FINPROJ;
  const [text, setText] = _fp(D.SAMPLE_CONTRACT);
  const insert = (v) => setText(text + ' ' + v);
  // render preview with vars highlighted
  const preview = text.split(/(\{\{[^}]+\}\})/g).map((part, i) =>
    /^\{\{/.test(part) ? <mark key={i} style={{ background: 'var(--wf-accent-soft)', color: 'var(--wf-fg)', padding: '0 3px', borderRadius: 3 }}>{part}</mark> : part
  );
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <button className="wfg-back" onClick={onBack}><Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />шаблони</button>
          <h1 className="wfp-ph-h1" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>{tpl.name}<span className="wfg-pill2" data-tone={tpl.format === 'EU' ? 'accent' : 'muted'}><span className="wfg-pill2-dot" />{tpl.format}</span></h1>
        </div>
        <div className="wfp-ph-r"><button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Прев’ю PDF · демо', 'ok')}><Icon name="eye" size={14} />Прев'ю PDF</button><button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зберегти · демо', 'ok')}><Icon name="check" size={14} />Зберегти</button></div>
      </div>
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
        <div className="wfl-panel">
          <div className="wfl-panel-h"><span>// редактор · {tpl.lang}</span></div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ width: '100%', minHeight: 360, border: 0, padding: 18, background: 'var(--wf-bg)', color: 'var(--wf-fg)', font: 'inherit', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div className="wfl-panel">
          <div className="wfl-panel-h"><span>// змінні</span></div>
          <div className="wfl-panel-b" style={{ gap: 6, padding: 12 }}>
            {D.TEMPLATE_VARS.map((v) => (
              <button key={v.v} onClick={() => insert(v.v)} title={'напр. ' + v.ex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', textAlign: 'left', padding: '7px 9px', border: '1px solid var(--wf-border)', borderRadius: 7, background: 'var(--wf-surface)', cursor: 'pointer', font: 'inherit' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-accent)' }}>{v.v}</span>
                <span style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)' }}>{v.ex}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="wfc-sec-h" style={{ marginTop: 22 }}><span className="wfc-sec-h-t">Прев'ю зі змінними</span><span className="wfc-sec-h-s">// підсвічені — підставляються при генерації</span></div>
      <div className="wfl-panel"><div style={{ padding: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--wf-fg-secondary)' }}>{preview}</div></div>
    </React.Fragment>
  );
}

// ════════════════ План / факт годин (12-ПЛАН-ФАКТ) ════════════════
function PfBar({ plan, fact, unit = 'год' }) {
  const pct = Math.round((fact / plan) * 100);
  const over = fact > plan;
  const under = pct < 75;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
        <span style={{ color: 'var(--wf-fg-muted)' }}>факт {fact} / план {plan} {unit}</span>
        <span style={{ fontWeight: 600, color: over ? 'var(--wf-destructive)' : under ? 'var(--wf-warning)' : 'var(--wf-success)' }}>{pct}%</span>
      </div>
      <div className="wfc-bar" style={{ height: 8 }}>
        <div className="wfc-bar-fill" data-tone={over ? 'bad' : under ? 'warn' : undefined} style={{ width: Math.min(pct, 100) + '%' }} />
        {over && <div style={{ position: 'relative', height: 0 }}><span style={{ position: 'absolute', right: 0, top: -8, width: `${Math.min(pct - 100, 40)}%`, height: 8, background: 'repeating-linear-gradient(45deg, var(--wf-destructive), var(--wf-destructive) 3px, transparent 3px, transparent 6px)', borderRadius: 4 }} /></div>}
      </div>
    </div>
  );
}

function WsPlanFact() {
  const D = window.WF_FINPROJ.PLANFACT;
  const [lvl, setLvl] = _fp('person');
  const teamPct = Math.round((D.team.fact / D.team.plan) * 100);
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">План / факт годин</h1><div className="wfp-ph-sub">// норма capacity × тижні vs TimeLog · {D.period}</div></div>
      </div>

      {/* team aggregate */}
      <div className="wfl-panel" style={{ marginBottom: 20 }}>
        <div className="wfl-panel-b" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, alignItems: 'center' }}>
          <div>
            <div className="wfc-kpi-k">Команда · агрегат</div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4 }}>{teamPct}%</div>
            <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>{D.team.fact} / {D.team.plan} год · {D.team.people} людини</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PfBar plan={D.team.plan} fact={D.team.fact} />
            <div style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>Σ потужності (норма {D.team.normWeek} год/тижд × тижні) проти відпрацьованого. Резерв ще {D.team.plan - D.team.fact} год.</div>
          </div>
        </div>
      </div>

      <div className="wfdk-toolbar" style={{ marginBottom: 16 }}>
        <div className="wfdk-seg">
          {[['person', 'По людях'], ['project', 'По проєктах'], ['order', 'По замовленнях']].map(([id, l]) => (
            <div key={id} className="wfdk-seg-opt" data-on={lvl === id || undefined} onClick={() => setLvl(id)}>{l}</div>
          ))}
        </div>
        <span className="wfc-sec-h-s">// перевантаження — червоний штрих, недопрацювання — жовтий</span>
      </div>

      {lvl === 'person' && (
        <table className="wfp-table">
          <thead><tr><th>Виконавець</th><th style={{ width: 320 }}>Завантаження</th><th>Стан</th></tr></thead>
          <tbody>
            {D.byPerson.map((p) => {
              const over = p.fact > p.plan, under = (p.fact / p.plan) < 0.75;
              return (
                <tr key={p.name}>
                  <td><span style={{ fontWeight: 500 }}>{p.name}</span><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{p.role}</div></td>
                  <td><PfBar plan={p.plan} fact={p.fact} /></td>
                  <td>{over ? <span className="wfg-pill2" data-tone="bad"><span className="wfg-pill2-dot" />перевантажений +{p.fact - p.plan}год</span> : under ? <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />недозавантажений</span> : <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />в нормі</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {lvl === 'project' && (
        <table className="wfp-table">
          <thead><tr><th>Проєкт</th><th>База плану</th><th style={{ width: 320 }}>Години</th></tr></thead>
          <tbody>
            {D.byProject.map((p) => (
              <tr key={p.code}>
                <td><span style={{ fontWeight: 500 }}>{p.name}</span><div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{p.code}</div></td>
                <td><span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />{p.type === 'subscription' ? 'абон-ліміт' : 'estimatedHours'}</span></td>
                <td><PfBar plan={p.limit} fact={p.fact} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lvl === 'order' && (
        <table className="wfp-table">
          <thead><tr><th>Замовлення</th><th>Назва</th><th style={{ width: 320 }}>Години</th></tr></thead>
          <tbody>
            {D.byOrder.map((o) => (
              <tr key={o.num}>
                <td className="wfp-mono"><span className="wfp-link">{o.num}</span></td>
                <td>{o.title}</td>
                <td><PfBar plan={o.plan} fact={o.fact} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </React.Fragment>
  );
}

Object.assign(window, { WsProjects, WsLegalEntities, WsCompensation, WsContractTemplates, WsPlanFact });
