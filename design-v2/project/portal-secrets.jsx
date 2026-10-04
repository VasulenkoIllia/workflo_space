// portal-secrets.jsx — Portal «Секрети» (модуль 17-А/Б/Д). NEW per ТЗ Частина III §17:
// «Portal-екран Секрети не існує жодним мокапом». Client adds typed credential
// resources, reveals own secrets behind a 2FA challenge, and sees the access
// journal (17-Б, visible to client). States: active / expiring / revoked.

const _ps2 = React.useState;

// Local view-model layered on the shared C360 secrets data, plus a couple of
// extra states (expiring/revoked) the spec calls for.
function portalSecretsModel() {
  const D = window.WF_C360 || {};
  const base = (D.SECRETS || []).map((s, i) => ({
    ...s,
    status: i === 0 ? 'expiring' : 'active',
    shared: i === 0 ? ['Олег Д.', 'Марʼяна К.'] : i === 1 ? ['Олег Д.'] : [],
  }));
  base.push({
    id: 's_rev', resource: 'Old SMTP', type: 'other', updated: '2 міс тому', addedBy: 'клієнт',
    status: 'revoked', shared: [],
    fields: [{ kind: 'url', value: 'smtp.old-host.com' }, { kind: 'login', value: 'noreply@brunky.com' }, { kind: 'password', value: 'revoked' }],
  });
  return base;
}

function PortalSecrets() {
  const D = window.WF_C360 || {};
  const FK = D.FIELD_KINDS || {};
  const RT = D.RESOURCE_TYPES || {};
  const secrets = portalSecretsModel();
  const log = D.SECRET_LOG || [];

  const [revealed, setRevealed] = _ps2(null);   // id currently revealed (after 2FA)
  const [challenge, setChallenge] = _ps2(null);  // id awaiting 2FA
  const [add, setAdd] = _ps2(false);

  const active = secrets.filter((s) => s.status !== 'revoked');
  const shared = secrets.reduce((n, s) => n + (s.shared ? s.shared.length : 0), 0);
  const expiring = secrets.filter((s) => s.status === 'expiring').length;

  return (
    <React.Fragment>
      <PageHeader
        title="Секрети"
        subtitle="// ключі та доступи вашої компанії · команда відкриває їх лише під 2FA, і це видно у журналі"
      >
        <button className="wfp-btn"><Icon name="shield" size={13} />Журнал доступів</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => setAdd(true)}><Icon name="plus" size={13} />Додати ресурс</button>
      </PageHeader>

      <StatsRow>
        <Stat k="активних ресурсів" v={active.length} sub={`${secrets.length - active.length} відкликано`} />
        <Stat k="розшарено команді" v={shared} sub="через доступ до замовлень" kind="accent" />
        <Stat k="потребують ротації" v={expiring} sub="спливає термін" kind="warn" />
        <Stat k="останній перегляд" v="2 дн тому" sub="Олег Д. · KeyCRM" />
      </StatsRow>

      {/* security explainer */}
      <div className="wfps-enc">
        <span className="wfps-enc-ico"><Icon name="lock" size={18} color="var(--wf-accent)" /></span>
        <div>
          <div className="wfps-enc-t">End-to-end шифрування</div>
          <div className="wfps-enc-s">Поля з типом пароль/ключ/токен шифруються. Команда workflo бачить лише маски; кожне розкриття вимагає 2FA і потрапляє в журнал нижче. Ви можете відкликати будь-який доступ у будь-який момент.</div>
        </div>
      </div>

      <div className="wfc-sec-h"><span className="wfc-sec-h-t">Ваші ресурси <span className="wfc-sec-h-s" style={{ marginLeft: 6 }}>// {secrets.length} · типізовані картки</span></span></div>

      <div className="wfc-secrets">
        {secrets.map((sec) => {
          const t = RT[sec.type] || RT.other || { label: sec.type, icon: 'lock' };
          const open = revealed === sec.id;
          const revoked = sec.status === 'revoked';
          const hasSecret = sec.fields.some((f) => (FK[f.kind] || {}).secret);
          return (
            <div key={sec.id} className="wfc-secret" data-revoked={revoked || undefined}
              style={revoked ? { opacity: .58 } : undefined}>
              <div className="wfc-secret-top">
                <span className="wfc-secret-ico"><Icon name={t.icon} size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wfc-secret-name">{sec.resource}</div>
                  <div className="wfc-secret-login">{t.label} · {sec.fields.length} пол{sec.fields.length === 1 ? 'е' : 'ів'}</div>
                </div>
                {sec.status === 'expiring' && <span className="wfps-tag wfps-tag--warn"><Icon name="alert" size={10} />ротація</span>}
                {revoked && <span className="wfps-tag wfps-tag--muted">відкликано</span>}
                {!revoked && hasSecret && (
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"
                    onClick={() => (open ? setRevealed(null) : setChallenge(sec.id))} title="reveal · 2FA">
                    <Icon name={open ? 'eye_off' : 'eye'} size={13} />{open ? 'Сховати' : 'Reveal'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sec.fields.map((f, i) => {
                  const fk = FK[f.kind] || { label: f.kind, icon: 'lock' };
                  const masked = fk.secret && !open;
                  return (
                    <div key={i} className="wfc-secret-field">
                      <Icon name={fk.icon} size={12} color="var(--wf-fg-subtle)" />
                      <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--wf-fg-subtle)', minWidth: 58 }}>{fk.label}</span>
                      <input readOnly value={masked || revoked ? '••••••••••' : f.value} style={{ flex: 1, fontSize: 11.5 }} />
                      {!revoked && <button title="Копіювати"><Icon name="copy" size={13} /></button>}
                    </div>
                  );
                })}
              </div>

              {sec.shared && sec.shared.length > 0 && !revoked && (
                <div className="wfps-shared"><Icon name="users" size={11} />доступ у команди: {sec.shared.join(', ')}</div>
              )}

              <div className="wfc-secret-foot">
                <span>оновлено {sec.updated} · {sec.addedBy}</span>
                {revoked
                  ? <span className="wfps-foot-link">Видалити</span>
                  : <span className="wfps-foot-link wfps-foot-link--danger">Відкликати</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* access journal — 17-Б, visible to the client */}
      <div className="wfc-sec-h" style={{ marginTop: 28 }}>
        <span className="wfc-sec-h-t">Журнал доступів <span className="wfc-sec-h-s">// 17-Б · хто з команди і коли відкривав ваші ключі</span></span>
      </div>
      <table className="wfp-table">
        <thead><tr><th>Хто</th><th>Секрет</th><th>Дія</th><th>2FA</th><th>Коли</th></tr></thead>
        <tbody>
          {log.map((l, i) => (
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

      {challenge && (
        <Reveal2FAModal
          resource={(secrets.find((s) => s.id === challenge) || {}).resource}
          onClose={() => setChallenge(null)}
          onConfirm={() => { setRevealed(challenge); setChallenge(null); }}
        />
      )}
      {add && <PortalAddSecretModal onClose={() => setAdd(false)} />}
    </React.Fragment>
  );
}

// 2FA challenge before reveal (S9 / 17)
function Reveal2FAModal({ resource, onClose, onConfirm }) {
  const [code, setCode] = _ps2('');
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 420, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="shield" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Підтвердження 2FA</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} /></span></div>
        <div className="wfp-modal-body">
          <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.55, marginBottom: 16 }}>
            Розкриття секрету <strong style={{ color: 'var(--wf-fg)' }}>{resource}</strong> — одноразова дія, яку буде записано в журнал. Введіть код із застосунку-автентифікатора.
          </div>
          <div className="wfps-otp">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input key={i} maxLength={1} inputMode="numeric"
                value={code[i] || ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(-1);
                  const next = (code.slice(0, i) + v + code.slice(i + 1)).slice(0, 6);
                  setCode(next);
                  if (v && e.target.nextSibling) e.target.nextSibling.focus();
                }} />
            ))}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-subtle)', marginTop: 12 }}>// демо · підтвердиться будь-яким кодом</div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// 2FA-gated reveal</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={onClose}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={onConfirm}><Icon name="eye" size={13} />Розкрити</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Two-sided add form (17-А) — client adds a typed resource with flexible fields.
function PortalAddSecretModal({ onClose }) {
  const D = window.WF_C360 || {};
  const FK = D.FIELD_KINDS || {};
  const RT = D.RESOURCE_TYPES || {};
  const [type, setType] = _ps2('crm');
  const [fields, setFields] = _ps2([{ kind: 'url', value: '' }, { kind: 'login', value: '' }, { kind: 'password', value: '' }]);
  const [done, setDone] = _ps2(false);
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
                <div className="wfp-field"><label>Тип</label><select className="wfl-select" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(RT).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}</select></div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)', margin: '14px 0 8px' }}>Поля доступу — додавайте лише потрібні. Токени/ключі не потребують пароля.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fields.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select className="wfl-select" style={{ width: 150, flexShrink: 0 }} value={f.kind} onChange={(e) => setKind(i, e.target.value)}>{Object.entries(FK).map(([id, k]) => <option key={id} value={id}>{k.label}</option>)}</select>
                    <input placeholder={(FK[f.kind] || {}).secret ? '••••••' : 'значення'} type={(FK[f.kind] || {}).secret ? 'password' : 'text'} value={f.value} onChange={(e) => setVal(i, e.target.value)} style={{ flex: 1, height: 36, padding: '0 10px', border: '1px solid var(--wf-border)', borderRadius: 7, background: 'var(--wf-bg)', color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} />
                    <button className="wfp-iconbtn" onClick={() => rmField(i)} title="Прибрати"><Icon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {Object.keys(FK).map((k) => (
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

Object.assign(window, { PortalSecrets, Reveal2FAModal, PortalAddSecretModal });
