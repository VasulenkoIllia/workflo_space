// onboarding.jsx — first-run wizard for a new workspace owner.
// 5 steps: workspace → company (industry avatar) → team (role avatars) →
// channels → done. Fully interactive (step state + selections). Uses WfAvatar.

const WFO_STEPS = [
  { t: 'Робочий простір', s: 'назва · ви' },
  { t: 'Профіль компанії', s: 'галузь · аватар' },
  { t: 'Команда',          s: 'виконавці · ролі' },
  { t: 'Канали',           s: 'telegram · email' },
  { t: 'Готово',           s: 'запуск' },
];

const WFO_INDUSTRIES = ['logistics', 'retail', 'food', 'saas', 'fintech', 'agency', 'manufacture', 'education', 'health', 'construction', 'startup'];
const WFO_ROLES = ['developer', 'designer', 'devops', 'lead', 'qa', 'copywriter', 'analyst', 'ai', 'support'];

function OnboardingFlow({ initStep = 0 }) {
  const [step, setStep] = React.useState(initStep);
  const [industry, setIndustry] = React.useState('food');
  const [team, setTeam] = React.useState([
    { name: 'Олег Шевченко', mail: 'oleh@gmail.com', role: 'designer' },
    { name: 'Павло Кравець', mail: 'pavlo@gmail.com', role: 'devops' },
  ]);
  const [channels, setChannels] = React.useState({ telegram: true, email: true, digest: false });
  const roleLabel = (k) => (window.WFA_ROLE_META && window.WFA_ROLE_META[k] && window.WFA_ROLE_META[k].label) || k;
  const indLabel = (k) => (window.WFA_CLIENT_META && window.WFA_CLIENT_META[k] && window.WFA_CLIENT_META[k].label) || k;

  const go = (d) => setStep((s) => Math.max(0, Math.min(WFO_STEPS.length - 1, s + d)));
  const pct = Math.round((step / (WFO_STEPS.length - 1)) * 100);

  return (
    <div className="wfob">
      {/* rail */}
      <div className="wfob-rail">
        <div className="wfob-brand">workflo<span className="dot">.</span>space</div>
        <div className="wfob-brand-sub">// налаштування простору</div>
        <div className="wfob-steps">
          {WFO_STEPS.map((s, i) => (
            <div key={i} className="wfob-step" data-state={i === step ? 'active' : i < step ? 'done' : 'todo'} onClick={() => setStep(i)}>
              <span className="wfob-step-num">{i < step ? <Icon name="check" size={13} /> : i + 1}</span>
              <span className="wfob-step-l">
                <div className="wfob-step-t">{s.t}</div>
                <div className="wfob-step-s">{s.s}</div>
              </span>
            </div>
          ))}
        </div>
        <div className="wfob-rail-foot">
          <div className="wfob-progress-track"><div className="wfob-progress-fill" style={{ width: `${pct}%` }} /></div>
          крок {step + 1} з {WFO_STEPS.length} · {pct}%
        </div>
      </div>

      {/* body */}
      <div className="wfob-body">
        {step === 0 && (
          <React.Fragment>
            <div className="wfob-eyebrow"><span className="dot" /> ласкаво просимо</div>
            <h1 className="wfob-h1">Створімо ваш простір</h1>
            <p className="wfob-lead">workflo.space збере замовлення, клієнтів, документи й команду в одному місці. Почнемо з основ — це займе пару хвилин.</p>
            <div className="wfob-form">
              <div className="wfob-field">
                <label className="wfob-label">назва простору</label>
                <input className="wfob-input" defaultValue="Ілля · workflo" placeholder="напр. Моя студія" />
                <span className="wfob-hint">буде в адресі: illia.workflo.space</span>
              </div>
              <div className="wfob-field">
                <label className="wfob-label">ваше ім'я</label>
                <input className="wfob-input" defaultValue="Ілля Когут" placeholder="Ім'я Прізвище" />
              </div>
            </div>
          </React.Fragment>
        )}

        {step === 1 && (
          <React.Fragment>
            <div className="wfob-eyebrow"><span className="dot" /> профіль компанії</div>
            <h1 className="wfob-h1">Чим ви займаєтесь?</h1>
            <p className="wfob-lead">Оберіть галузь — ми підберемо тематичну аватарку й налаштуємо доречні шаблони документів та воронок.</p>
            <div className="wfob-form">
              <div className="wfob-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, maxWidth: 'none' }}>
                <WfAvatar kind={industry} size="xl" shape="circle" bracket />
                <div>
                  <div className="wfob-team-name" style={{ fontSize: 16 }}>{indLabel(industry)}</div>
                  <div className="wfob-team-mail">// аватар компанії · {industry}</div>
                </div>
              </div>
              <div className="wfob-picker">
                {WFO_INDUSTRIES.map((k) => (
                  <div key={k} className="wfob-pick" data-on={industry === k || undefined} onClick={() => setIndustry(k)}>
                    <WfAvatar kind={k} size="md" shape="circle" />
                    <span className="wfob-pick-label">{indLabel(k)}</span>
                  </div>
                ))}
              </div>
            </div>
          </React.Fragment>
        )}

        {step === 2 && (
          <React.Fragment>
            <div className="wfob-eyebrow"><span className="dot" /> команда</div>
            <h1 className="wfob-h1">Запросіть виконавців</h1>
            <p className="wfob-lead">Додайте команду й призначте ролі — кожна отримає свою тематичну аватарку. Можна пропустити й зробити пізніше.</p>
            <div className="wfob-form">
              <div className="wfob-team">
                {team.map((m, i) => (
                  <div className="wfob-team-row" key={i}>
                    <WfAvatar kind={m.role} size="sm" />
                    <div>
                      <div className="wfob-team-name">{m.name}</div>
                      <div className="wfob-team-mail">{m.mail}</div>
                    </div>
                    <span className="wfob-role-select">
                      <WfAvatar kind={m.role} size="xs" />
                      {roleLabel(m.role)}
                      <Icon name="chevron" size={12} />
                    </span>
                    <button className="wfp-iconbtn" title="Прибрати" onClick={() => setTeam((t) => t.filter((_, j) => j !== i))}><Icon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} /></button>
                  </div>
                ))}
              </div>
              <div className="wfob-team-add" onClick={() => setTeam((t) => [...t, { name: 'Новий учасник', mail: 'name@email.com', role: WFO_ROLES[t.length % WFO_ROLES.length] }])}>
                <Icon name="plus" size={14} /> Додати виконавця
              </div>
              <div className="wfob-field" style={{ maxWidth: 660 }}>
                <label className="wfob-label">доступні ролі</label>
                <div className="wfob-picker">
                  {WFO_ROLES.map((k) => (
                    <div key={k} className="wfob-pick" style={{ padding: '12px 8px' }}>
                      <WfAvatar kind={k} size="sm" />
                      <span className="wfob-pick-label" style={{ fontSize: 11.5 }}>{roleLabel(k)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </React.Fragment>
        )}

        {step === 3 && (
          <React.Fragment>
            <div className="wfob-eyebrow"><span className="dot" /> канали зв'язку</div>
            <h1 className="wfob-h1">Підключіть сповіщення</h1>
            <p className="wfob-lead">Звідки отримувати оновлення по замовленнях, оплатах і згадках. Усе можна змінити в налаштуваннях.</p>
            <div className="wfob-form">
              <div className="wfob-channels">
                <div className="wfob-channel">
                  <span className="wfob-channel-ico"><Icon name="external" size={18} /></span>
                  <div><div className="wfob-channel-t">Telegram-бот</div><div className="wfob-channel-s">миттєві сповіщення + швидкі відповіді</div></div>
                  <span className="wfob-toggle" data-on={channels.telegram} onClick={() => setChannels((c) => ({ ...c, telegram: !c.telegram }))} />
                </div>
                <div className="wfob-channel">
                  <span className="wfob-channel-ico"><Icon name="mail" size={18} /></span>
                  <div><div className="wfob-channel-t">Email</div><div className="wfob-channel-s">рахунки, акти й копії листувань</div></div>
                  <span className="wfob-toggle" data-on={channels.email} onClick={() => setChannels((c) => ({ ...c, email: !c.email }))} />
                </div>
                <div className="wfob-channel">
                  <span className="wfob-channel-ico"><Icon name="clock" size={18} /></span>
                  <div><div className="wfob-channel-t">Тижневий дайджест</div><div className="wfob-channel-s">короткий звіт щопонеділка</div></div>
                  <span className="wfob-toggle" data-on={channels.digest} onClick={() => setChannels((c) => ({ ...c, digest: !c.digest }))} />
                </div>
              </div>
            </div>
          </React.Fragment>
        )}

        {step === 4 && (
          <React.Fragment>
            <div className="wfob-eyebrow"><span className="dot" /> усе готово</div>
            <div className="wfob-done">
              <span className="wfob-done-check"><Icon name="check" size={30} /></span>
              <h1 className="wfob-h1">Простір налаштовано 🎉</h1>
              <p className="wfob-lead">Можна створювати перше замовлення. Ось що ми налаштували:</p>
            </div>
            <div className="wfob-summary">
              <div className="wfob-summary-cell">
                <WfAvatar kind={industry} size="md" shape="circle" />
                <div><div className="wfob-summary-k">компанія</div><div className="wfob-summary-v">{indLabel(industry)}</div></div>
              </div>
              <div className="wfob-summary-cell">
                <span className="wfob-channel-ico" style={{ width: 36, height: 36 }}><Icon name="users" size={16} /></span>
                <div><div className="wfob-summary-k">команда</div><div className="wfob-summary-v">{team.length} виконавці</div></div>
              </div>
              <div className="wfob-summary-cell">
                <span className="wfob-channel-ico" style={{ width: 36, height: 36 }}><Icon name="external" size={16} /></span>
                <div><div className="wfob-summary-k">канали</div><div className="wfob-summary-v">{[channels.telegram && 'Telegram', channels.email && 'Email', channels.digest && 'Дайджест'].filter(Boolean).join(' · ') || '—'}</div></div>
              </div>
              <div className="wfob-summary-cell">
                <span className="wfob-channel-ico" style={{ width: 36, height: 36, background: 'color-mix(in oklab, var(--wf-accent) 14%, transparent)', color: 'var(--wf-accent)' }}><Icon name="check" size={16} /></span>
                <div><div className="wfob-summary-k">простір</div><div className="wfob-summary-v">illia.workflo.space</div></div>
              </div>
            </div>
          </React.Fragment>
        )}

        {/* footer nav */}
        <div className="wfob-foot">
          {step > 0
            ? <span className="wfob-skip" onClick={() => go(-1)}>← назад</span>
            : <span className="wfob-skip">потрібна допомога?</span>}
          <div className="wfob-foot-r">
            {step < WFO_STEPS.length - 1 && step > 0 && <span className="wfob-skip" onClick={() => go(1)}>пропустити</span>}
            {step < WFO_STEPS.length - 1
              ? <button className="wfp-btn wfp-btn--primary" onClick={() => go(1)}>{step === 0 ? 'Почати' : 'Далі'} <Icon name="chev_r" size={14} /></button>
              : <button className="wfp-btn wfp-btn--primary"><Icon name="home" size={14} /> До дашборду</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingFlow });
