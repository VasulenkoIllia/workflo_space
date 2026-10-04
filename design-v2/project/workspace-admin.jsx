// workspace-admin.jsx — Block 5: Department + Role management for superadmin
// /settings/departments · /settings/team · /settings/permissions
// + Invite member modal · Edit member modal

// ──────────────────────────────────────────────────────────────────────
// Settings sub-nav for admin section (Workspace)
// ──────────────────────────────────────────────────────────────────────
const ADMIN_NAV = [
  { id: 'departments', label: 'Підрозділи',      icon: 'building' },
  { id: 'team',        label: 'Команда · ролі',  icon: 'users'    },
  { id: 'permissions', label: 'Permissions',     icon: 'settings' },
  { id: 'invites',     label: 'Запрошення',      icon: 'gift'     },
];

function AdminHeader({ active }) {
  return (
    <React.Fragment>
      <PageHeader
        title="Адмін · команда"
        subtitle="// owner · підрозділи, ролі, доступи"
      >
        <button className="wfp-btn" onClick={() => window.__wsNav && window.__wsNav('reports')}><Icon name="settings" size={13} />Лог змін</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfModal && window.wfModal({ title: 'Запросити члена команди', fields: [{ key: 'email', label: 'Email', placeholder: 'name@workflo.space' }, { key: 'role', label: 'Роль', type: 'select', options: [['executor','Executor'],['manager','Manager'],['viewer','Viewer']] }, { key: 'rate', label: 'Ставка $/год', value: '22' }], confirmLabel: 'Надіслати запрошення', note: 'Запрошення дійсне 7 днів.', successToast: 'Запрошення надіслано' })}><Icon name="plus" size={13} />Запросити члена</button>
      </PageHeader>

      <div className="wfp-rep-tabs">
        {ADMIN_NAV.map((t) => (
          <span key={t.id} className="wfp-rep-tab" data-on={t.id === active || undefined} style={{ cursor: 'pointer' }} onClick={() => window.__adminNav && window.__adminNav(t.id)}>
            <Icon name={t.icon} size={13} />{t.label}
          </span>
        ))}
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /settings/departments
// ──────────────────────────────────────────────────────────────────────
function AdminDepartments() {
  const depts = window.WFP_DATA.departments;
  const team = window.WFP_DATA.team_v2;

  return (
    <React.Fragment>
      <AdminHeader active="departments" />

      <StatsRow>
        <Stat k="підрозділів"      v={depts.length} sub="всі активні" />
        <Stat k="людей у підрозділах" v={team.length} sub="включно з superadmin" kind="accent" />
        <Stat k="активних задач"   v={depts.reduce((s, d) => s + d.count_active, 0)} sub="в роботі" />
        <Stat k="закрито за весь час" v={depts.reduce((s, d) => s + d.count_total, 0)} sub="за поточний рік" />
      </StatsRow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {depts.map((d) => {
          const members = team.filter((m) => m.departments.includes(d.id));
          return (
            <div key={d.id} className="wfp-dept-card" style={{ '--dept-color': d.color }}>
              <div className="wfp-dept-card-h">
                <div className="wfp-dept-card-h-l">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <DeptBadge id={d.id} />
                    <span className="wfp-dept-card-t">{d.label}</span>
                  </div>
                  <div className="wfp-dept-card-sub">slug: {d.id} · {members.length} {members.length === 1 ? 'людина' : 'людей'}</div>
                  {(() => { const L = team.find((x) => x.id === d.lead); return (
                    <div className="wfp-dept-lead">
                      <Icon name="star" size={11} color={d.lead ? 'var(--wf-accent)' : 'var(--wf-fg-subtle)'} />
                      {L ? <React.Fragment>керівник: <strong>{L.name}</strong></React.Fragment> : <span className="wfp-dept-lead-none">керівника не призначено · <span className="wfp-link">Призначити</span></span>}
                    </div>
                  ); })()}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Редагування підрозділу · демо', 'info')}><Icon name="edit" size={11} />Edit</button>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"><Icon name="chevron" size={11} /></button>
                </div>
              </div>

              <div className="wfp-dept-card-stats">
                <div className="wfp-dept-card-stat">
                  <div className="wfp-dept-card-stat-k">активних</div>
                  <div className="wfp-dept-card-stat-v">{d.count_active}</div>
                </div>
                <div className="wfp-dept-card-stat">
                  <div className="wfp-dept-card-stat-k">закрито</div>
                  <div className="wfp-dept-card-stat-v">{d.count_total}</div>
                </div>
                <div className="wfp-dept-card-stat">
                  <div className="wfp-dept-card-stat-k">people</div>
                  <div className="wfp-dept-card-stat-v">{members.length}</div>
                </div>
              </div>

              <div className="wfp-dept-card-members">
                {members.map((m) => (
                  <div key={m.id} className="wfp-dept-member">
                    <WfAvatar kind={wfAvatarKindForMember(m)} size="xs" />
                    <span>{m.name}</span>
                    {m.id === d.lead && <span className="wfp-dept-lead-badge" title="тімлід підрозділу"><Icon name="star" size={9} />лід</span>}
                    <span className={`wfp-dept-member-role wfp-dept-member-role--${m.role}`}>{m.role}</span>
                  </div>
                ))}
                {members.length === 0 && (
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-subtle)', textAlign: 'center', padding: '8px 0' }}>
                    // ще нікого нема
                  </div>
                )}
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ justifyContent: 'center', marginTop: 6 }} onClick={() => window.wfToast && window.wfToast('Додати людину до підрозділу · демо', 'info')}>
                  <Icon name="plus" size={11} />Додати людину
                </button>
              </div>
            </div>
          );
        })}

        {/* Create new dept card */}
        <div className="wfp-dept-card" style={{ borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 280, '--dept-color': 'var(--wf-fg-subtle)' }}>
          <Icon name="plus" size={24} color="var(--wf-fg-subtle)" />
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--wf-fg-secondary)' }}>Створити підрозділ</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textAlign: 'center', maxWidth: 280 }}>
            наприклад: Sales · QA · DevOps. AI-router буде вчитися направляти нові задачі сюди.
          </div>
          <button className="wfp-btn wfp-btn--primary wfp-btn--sm" style={{ marginTop: 6 }} onClick={() => window.wfModal && window.wfModal({ title: 'Новий підрозділ', fields: [{ key: 'name', label: 'Назва', placeholder: 'напр. QA' }, { key: 'slug', label: 'Slug', placeholder: 'qa' }], confirmLabel: 'Створити', successToast: 'Підрозділ створено' })}>
            <Icon name="plus" size={11} />Новий
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /settings/team — extended team management
// ──────────────────────────────────────────────────────────────────────
function AdminTeam() {
  const team = window.WFP_DATA.team_v2;
  const exec = window.WFP_DATA.report_executors;
  const earningsById = Object.fromEntries(exec.map((e) => [e.id, e.earnings_month]));

  return (
    <React.Fragment>
      <AdminHeader active="team" />

      <StatsRow>
        <Stat k="команда"          v={team.length} sub="1 owner · 2 managers · 3 executors" />
        <Stat k="payroll · травень" v={`$${Object.values(earningsById).reduce((s, x) => s + (x || 0), 0).toLocaleString('uk-UA')}`} sub="нараховано" kind="accent" />
        <Stat k="запрошень pending" v={window.WFP_DATA.pending_invites.length} sub="чекають accept" kind="warn" />
        <Stat k="середня rate"      v={`$${Math.round(team.reduce((s, x) => s + x.rate, 0) / team.length)}/h`} sub="по команді" />
      </StatsRow>

      <FilterBar search searchPlaceholder="Шукати по імені, email, ролі…">
        <button className="wfp-pill" data-on="true">активні · {team.length}</button>
        <button className="wfp-pill">неактивні</button>
        <button className="wfp-pill">запрошення · {window.WFP_DATA.pending_invites.length}</button>
        <span style={{ width: 1, height: 24, background: 'var(--wf-border)', margin: '0 4px' }} />
        <button className="wfp-pill">всі ролі</button>
        <button className="wfp-pill">всі підрозділи</button>
      </FilterBar>

      <div>
        {team.map((m) => {
          const earnings = earningsById[m.id] || 0;
          return (
            <div key={m.id} className="wfp-team-row">
              <WfAvatar kind={wfAvatarKindForMember(m)} size="sm" status={m.active_tasks > 0 ? 'online' : 'off'} />
              <div>
                <div className="wfp-team-row-name">{m.name}{m.title && <span className="wfp-team-row-title">{m.title}</span>}</div>
                <div className="wfp-team-row-sub">
                  {m.id === 'illia' ? 'illia@workflo.space' : `${m.id}@workflo.space`}
                  {(() => { const boss = team.find((x) => x.id === m.reportsTo); return boss
                    ? <span className="wfp-reports-to"> · <Icon name="chevron" size={9} style={{ transform: 'rotate(90deg)', verticalAlign: 'middle' }} />звітує: {boss.name.split(' ')[0]} {boss.name.split(' ')[1] ? boss.name.split(' ')[1][0] + '.' : ''}</span>
                    : <span className="wfp-reports-to wfp-reports-to--top"> · вершина ієрархії</span>; })()}
                </div>
              </div>
              <div>
                <span className={`wfp-role-pill wfp-role-pill--${m.role}`}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                  {m.role}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {m.departments.map((dId) => <DeptBadge key={dId} id={dId} short />)}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600 }}>${m.rate}<span style={{ color: 'var(--wf-fg-muted)', fontSize: 10, fontWeight: 400 }}>/h</span></div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>rate</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600 }}>{m.hours_week}h</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>тиждень</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--wf-success)' }}>${earnings.toLocaleString('uk-UA')}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>міс · earnings</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfModal && window.wfModal({ title: 'Редагувати члена', fields: [{ key: 'role', label: 'Роль', type: 'select', options: [['executor','Executor'],['manager','Manager'],['viewer','Viewer']] }, { key: 'rate', label: 'Ставка $/год', value: '22' }], confirmLabel: 'Зберегти', successToast: 'Зміни збережено' })}>Edit</button>
                <button className="wfp-iconbtn" style={{ width: 28, height: 28 }}><Icon name="chevron" size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending invites section */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          // запрошення pending · {window.WFP_DATA.pending_invites.length}
        </h2>
        {window.WFP_DATA.pending_invites.map((inv, i) => (
          <div key={i} className="wfp-team-row" data-inactive="true" style={{ borderStyle: 'dashed' }}>
            <span className="wfp-team-row-av" style={{ background: 'color-mix(in oklab, var(--wf-fg) 10%, var(--wf-bg))', color: 'var(--wf-fg-muted)' }}>
              <Icon name="bell" size={16} />
            </span>
            <div>
              <div className="wfp-team-row-name">{inv.email}</div>
              <div className="wfp-team-row-sub">надіслано {inv.sent} · діє до {inv.expires} · {inv.by}</div>
            </div>
            <div><span className={`wfp-role-pill wfp-role-pill--${inv.role}`}>{inv.role}</span></div>
            <div><DeptBadge id={inv.dept} short /></div>
            <div></div>
            <div></div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-warning)', textAlign: 'right' }}>pending</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Запрошення повторно надіслано', 'ok')}>Resend</button>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm wfp-btn--danger" onClick={() => window.wfToast && window.wfToast('Запрошення скасовано', 'warn')}>Cancel</button>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /settings/permissions — Role matrix
// ──────────────────────────────────────────────────────────────────────
function AdminPermissions() {
  const matrix = window.WFP_DATA.role_permissions;

  return (
    <React.Fragment>
      <AdminHeader active="permissions" />

      <div style={{ padding: '14px 18px', background: 'color-mix(in oklab, var(--wf-accent) 5%, transparent)', border: '1px solid color-mix(in oklab, var(--wf-accent) 24%, var(--wf-border))', borderRadius: 8, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Icon name="check" size={20} color="var(--wf-accent)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Built-in ролі · permissions матриця</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-secondary)', marginTop: 4 }}>
            // 3 базові ролі: <strong style={{ color: 'var(--wf-fg)' }}>owner</strong> · <strong style={{ color: 'var(--wf-fg)' }}>manager</strong> · <strong style={{ color: 'var(--wf-fg)' }}>executor</strong>. <strong style={{ color: 'var(--wf-fg)' }}>dept</strong> = "тільки в межах свого підрозділу", <strong style={{ color: 'var(--wf-fg)' }}>assigned</strong> = "тільки те що призначене".
            Custom ролі — у roadmap.
          </div>
        </div>
        <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Матрицю прав експортовано (CSV)', 'ok')}>Export CSV</button>
      </div>

      <div style={{ border: '1px solid var(--wf-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--wf-bg)' }}>
        <table className="wfp-perm-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Право</th>
              <th className="wfp-perm-table th--owner" style={{ width: '20%' }}>Owner</th>
              <th className="wfp-perm-table th--manager" style={{ width: '20%' }}>Manager</th>
              <th className="wfp-perm-table th--executor" style={{ width: '20%' }}>Executor</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((area, ai) => (
              <React.Fragment key={ai}>
                <tr><td className="wfp-perm-area" colSpan={4}>// {area.area}</td></tr>
                {area.items.map((it, ii) => (
                  <tr key={ii}>
                    <td>{it.what}</td>
                    <td><PermCell v={it.owner} /></td>
                    <td><PermCell v={it.manager} /></td>
                    <td><PermCell v={it.executor} /></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', border: '1px dashed var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-secondary)', lineHeight: 1.55, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div>
          <span className="wfp-perm-yes" style={{ width: 16, height: 16 }}><Icon name="check" size={10} /></span>
          {' '}повний доступ
        </div>
        <div>
          <span className="wfp-perm-scoped">dept</span>
          {' '}тільки в межах свого підрозділу
        </div>
        <div>
          <span className="wfp-perm-no" />
          {' '}доступ закрито
        </div>
      </div>
    </React.Fragment>
  );
}

function PermCell({ v }) {
  if (v === true)  return <span className="wfp-perm-yes"><Icon name="check" size={12} /></span>;
  if (v === false) return <span className="wfp-perm-no" />;
  return <span className="wfp-perm-scoped">{v}</span>;
}

// ──────────────────────────────────────────────────────────────────────
// Invite member modal
// ──────────────────────────────────────────────────────────────────────
function InviteMemberModal() {
  return (
    <div className="wfp-modal-overlay">
      <div className="wfp-modal">
        <div className="wfp-modal-h">
          <Icon name="plus" size={18} color="var(--wf-accent)" />
          <div className="wfp-modal-h-t">Запросити члена команди</div>
          <div className="wfp-modal-h-aux">// invite to workflo workspace</div>
          <span className="wfp-modal-h-close"><Icon name="alert" size={14} /></span>
        </div>
        <div className="wfp-modal-body">
          <div className="wfp-field">
            <label>Email</label>
            <input type="email" defaultValue="serhii@workflo.space" />
            <div className="wfp-field-hint">на цей email прийде запрошення з 7-денним токеном</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="wfp-field">
              <label>Роль</label>
              <select style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} defaultValue="executor">
                <option value="executor">Executor — бачить призначене</option>
                <option value="manager">Manager — керує підрозділом, без фінансів</option>
                <option value="viewer">Viewer — read-only</option>
              </select>
              <div className="wfp-field-hint">owner призначається тільки вручну в DB</div>
            </div>
            <div className="wfp-field">
              <label>Підрозділ</label>
              <select style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} defaultValue="dev">
                {window.WFP_DATA.departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <div className="wfp-field-hint">можна додати в кілька після приймання</div>
            </div>
          </div>

          <div className="wfp-field">
            <label>Rate · $/година</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6 }}>
              <span style={{ color: 'var(--wf-fg-muted)' }}>$</span>
              <input defaultValue="22" style={{ flex: 1, border: 0, background: 'transparent', outline: 0, font: 'inherit', color: 'var(--wf-fg)', padding: 0, fontFamily: 'JetBrains Mono, monospace' }} />
              <span style={{ color: 'var(--wf-fg-muted)', fontSize: 11 }}>/ година</span>
            </div>
            <div className="wfp-field-hint">видно тільки superadmin'у і лідам</div>
          </div>

          <div className="wfp-field">
            <label>Особистий лист (опційно)</label>
            <textarea
              className="wfp-no-textarea"
              placeholder="Hi Serhii — додаю тебе в Dev. Завдання на тижні..."
              style={{ minHeight: 80, fontSize: 13 }}
            />
          </div>

          <FormMsg kind="info" k="перевірка">
            Запрошення дійсне 7 днів. Якщо не прийняте — автоматично архівується. Лог дій буде в /reports/audit.
          </FormMsg>
        </div>
        <div className="wfp-modal-foot">
          <div className="wfp-modal-foot-left">// Esc · скасувати</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасовано', 'info')}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Запрошення надіслано', 'ok')}><Icon name="send" size={13} />Надіслати запрошення</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Edit member modal — change role / dept / rate / deactivate
// ──────────────────────────────────────────────────────────────────────
function EditMemberModal() {
  const m = window.WFP_DATA.team_v2[2]; // Олег
  return (
    <div className="wfp-modal-overlay">
      <div className="wfp-modal wfp-modal--lg">
        <div className="wfp-modal-h">
          <WfAvatar kind={wfAvatarKindForMember(m)} size="sm" />
          <div>
            <div className="wfp-modal-h-t">{m.name}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>{m.id}@workflo.space · з 12.02.2026</div>
          </div>
          <div className="wfp-modal-h-aux">edit member</div>
          <span className="wfp-modal-h-close"><Icon name="alert" size={14} /></span>
        </div>
        <div className="wfp-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="wfp-field">
              <label>Роль</label>
              <select style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} defaultValue={m.role}>
                <option value="executor">Executor</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
              <div className="wfp-field-hint">// поточна: <strong style={{ color: 'var(--wf-fg)' }}>{m.role}</strong></div>
            </div>
            <div className="wfp-field">
              <label>Rate · $/година</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6 }}>
                <span style={{ color: 'var(--wf-fg-muted)' }}>$</span>
                <input defaultValue={m.rate} style={{ flex: 1, border: 0, background: 'transparent', outline: 0, font: 'inherit', color: 'var(--wf-fg)', padding: 0, fontFamily: 'JetBrains Mono, monospace' }} />
                <span style={{ color: 'var(--wf-fg-muted)', fontSize: 11 }}>/ година</span>
              </div>
              <div className="wfp-field-hint">// поточна: <strong style={{ color: 'var(--wf-fg)' }}>${m.rate}/h</strong></div>
            </div>
          </div>

          <div className="wfp-field">
            <label>Підрозділи · можна кілька</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {window.WFP_DATA.departments.map((d) => {
                const isMember = m.departments.includes(d.id);
                return (
                  <button key={d.id} className="wfp-chip" data-on={isMember || undefined}>
                    <DeptBadge id={d.id} short />
                    {isMember && <Icon name="check" size={11} color="var(--wf-success)" />}
                  </button>
                );
              })}
            </div>
            <div className="wfp-field-hint">впливає на видимість задач: executor бачить тільки задачі своїх підрозділів</div>
          </div>

          <div className="wfp-field">
            <label>Керівник · підпорядкування</label>
            <select style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} defaultValue={m.reportsTo || ''}>
              <option value="">— нікому (вершина ієрархії)</option>
              {window.WFP_DATA.team_v2.filter((x) => x.id !== m.id && (x.role === 'owner' || x.role === 'manager')).map((x) => (
                <option key={x.id} value={x.id}>{x.name} · {x.title || x.role}</option>
              ))}
            </select>
            <div className="wfp-field-hint">// звітує керівнику; тімлід підрозділу бачить задачі й час підлеглих</div>
          </div>

          <div className="wfp-set-section" style={{ marginBottom: 0 }}>
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t">
                <Icon name="alert" size={14} color="var(--wf-warning)" />
                Активність зараз
              </div>
            </div>
            <div className="wfp-set-section-body" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>активних задач</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 600 }}>{m.active_tasks}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>годин · тиждень</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 600 }}>{m.hours_week}h</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>таймер</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 500, color: 'var(--wf-fg-muted)' }}>не активний</div>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: 10, background: 'color-mix(in oklab, var(--wf-warning) 6%, transparent)', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-secondary)' }}>
                ⚠ Якщо змінюєте підрозділ — переконайтеся що задачі переходять до іншого виконавця або стають unassigned.
              </div>
            </div>
          </div>
        </div>
        <div className="wfp-modal-foot" style={{ justifyContent: 'space-between' }}>
          <button className="wfp-btn wfp-btn--ghost wfp-btn--danger wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Деактивувати акаунт · демо', 'ok')}>
            <Icon name="alert" size={11} />Деактивувати акаунт
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасовано', 'info')}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зміни збережено', 'ok')}><Icon name="check" size={13} />Зберегти зміни</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  AdminDepartments,
  AdminTeam,
  AdminPermissions,
  InviteMemberModal,
  EditMemberModal,
});
