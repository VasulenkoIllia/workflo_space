// workspace-leave.jsx — G10 · Leave Tracking.
// LeaveExecutor (/leave) · LeaveAdmin (/admin/leave) · LeaveRequestModal · LeaveRejectModal.

const WFL_T = window.WFP_LEAVE.types;
const wflStatusLabel = { pending: 'очікує', approved: 'схвалено', rejected: 'відхилено' };

// ───────────── Executor /leave ─────────────
function LeaveExecutor() {
  const d = window.WFP_LEAVE;
  return (
    <React.Fragment>
      <PageHeader title="Мої відпустки" subtitle="// запити на відпустку, лікарняні, особисті дні">
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Новий запит · демо', 'ok')}><Icon name="plus" size={13} />Новий запит</button>
      </PageHeader>

      <div className="wfl-balances">
        {d.myBalance.map((b) => {
          const rem = b.accrued - b.used;
          return (
            <div className="wfl-bal" key={b.type}>
              <div className="wfl-bal-h"><span className="wfl-bal-dot" style={{ background: b.color }} />{b.label}</div>
              <div className="wfl-bal-nums"><span className="wfl-bal-rem">{rem}</span><span className="wfl-bal-tot">/ {b.accrued} днів</span></div>
              <div className="wfl-bal-bar"><span className="wfl-bal-bar-fill" style={{ width: `${(b.used / b.accrued) * 100}%`, background: b.color }} /></div>
              <div className="wfl-bal-sub">використано {b.used} · лишилось {rem}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)', margin: '6px 0 10px' }}>// мої запити</div>
      {d.my.map((r) => {
        const t = WFL_T[r.type];
        return (
          <div className="wfl-req" data-s={r.status} key={r.id}>
            <span className="wfl-type"><span className="wfl-type-dot" style={{ background: t.color }} />{t.label}</span>
            <div>
              <span className="wfl-req-dates">{r.from}–{r.to}</span> <span className="wfl-req-days">· {r.days} дн · подано {r.submitted}</span>
              <div className="wfl-req-reason">{r.reason}</div>
              {r.rejectReason && <div className="wfl-req-rej">✗ {r.rejectReason}</div>}
            </div>
            <span className="wfl-status" data-s={r.status}><span className="d" />{wflStatusLabel[r.status]}</span>
          </div>
        );
      })}
    </React.Fragment>
  );
}

// ───────────── Owner /admin/leave ─────────────
function LeaveAdmin() {
  const d = window.WFP_LEAVE.all;
  const names = { illia: 'Ілля', oleh: 'Олег', pavlo: 'Павло', maria: 'Марія', denys: 'Денис', anna: 'Анна' };
  return (
    <React.Fragment>
      <PageHeader title="Адмін · Відпустки команди" subtitle="// запити на погодження + календар доступності">
        <button className="wfp-btn"><Icon name="calendar" size={13} />У календарі</button>
      </PageHeader>

      <StatsRow>
        <Stat k="очікують" v={d.stats.pending} kind="warn" sub="потребують рішення" />
        <Stat k="схвалено · міс" v={d.stats.approvedMonth} kind="accent" sub="цього місяця" />
        <Stat k="у відпустці зараз" v={d.stats.onLeaveToday} sub="сьогодні" />
        <Stat k="команда" v={d.stats.team} sub="виконавців" />
      </StatsRow>

      <table className="wfp-table" style={{ marginTop: 14 }}>
        <thead><tr><th>Виконавець</th><th>Тип</th><th>Дати</th><th className="wfp-num">Днів</th><th>Подано</th><th>Статус</th><th>Дії</th></tr></thead>
        <tbody>
          {d.rows.map((r) => {
            const t = WFL_T[r.type];
            return (
              <tr key={r.id}>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <WfAvatar kind={(window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[r.who]) || 'developer'} size="xs" />{names[r.who] || r.who}
                  </span>
                </td>
                <td><span className="wfl-type"><span className="wfl-type-dot" style={{ background: t.color }} />{t.label}</span></td>
                <td className="wfp-mono">{r.from}–{r.to}</td>
                <td className="wfp-num">{r.days}</td>
                <td className="wfp-mono">{r.submitted}</td>
                <td><span className="wfl-status" data-s={r.status}><span className="d" />{wflStatusLabel[r.status]}</span></td>
                <td>
                  {r.status === 'pending'
                    ? <span className="wfl-act"><button className="wfp-btn wfp-btn--sm wfl-approve"><Icon name="check" size={12} />Схвалити</button><button className="wfp-btn wfp-btn--sm wfl-reject" onClick={() => window.wfToast && window.wfToast('Відхилити · демо', 'ok')}><Icon name="close" size={12} />Відхилити</button></span>
                    : <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-subtle)' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ───────────── New request modal ─────────────
function LeaveRequestModal() {
  const types = [{ id: 'vacation', l: 'Відпустка' }, { id: 'sick', l: 'Лікарняний' }, { id: 'unpaid', l: 'Без збереж.' }, { id: 'personal', l: 'Особистий' }];
  // mini range calendar (10–14 of a week)
  const days = [8, 9, 10, 11, 12, 13, 14];
  return (
    <div className="wfp-modal-overlay" style={{ position: 'relative', padding: 0, background: 'transparent', display: 'block' }}>
      <div className="wfp-modal" style={{ margin: 0, width: 480 }}>
        <div className="wfp-modal-h"><span className="wfp-modal-h-t">Новий запит на відпустку</span><span className="wfp-modal-h-aux">// leave.request</span><span className="wfp-modal-h-close"><Icon name="close" size={15} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfcal-form">
            <div className="wfcal-field"><span className="wfcal-field-label">// тип</span>
              <div className="wfas-seg">{types.map((t) => <span key={t.id} className="wfas-seg-opt" data-on={t.id === 'vacation' || undefined}>{t.l}</span>)}</div>
            </div>
            <div className="wfcal-field"><span className="wfcal-field-label">// період (10.06 – 14.06 · 5 днів)</span>
              <div className="wfl-range-cal">
                <div className="wfl-range-grid">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((w) => <div className="wfl-range-d is-out" key={w} style={{ fontSize: 9 }}>{w}</div>)}
                  {days.map((n) => {
                    const inRange = n >= 10 && n <= 14;
                    const edge = n === 10 || n === 14;
                    return <div key={n} className={`wfl-range-d${edge ? ' is-edge' : inRange ? ' is-in' : ''}`}>{n}</div>;
                  })}
                </div>
              </div>
            </div>
            <div className="wfcal-field"><span className="wfcal-field-label">// причина</span><textarea className="wfcal-input" rows={2} defaultValue="Сімейна поїздка" style={{ resize: 'vertical' }} /></div>
            <div className="wfcal-field"><span className="wfcal-field-label">// вкладення (опц. — довідка)</span>
              <div className="wfas-logo-drop" style={{ padding: 14 }}><span className="wfas-logo-drop-hint">перетягніть файл або клік</span></div>
            </div>
          </div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// 5 днів · лишиться 13 з 24</span>
          <div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасувати · демо', 'ok')}>Скасувати</button><button className="wfp-btn wfp-btn--primary">Подати запит</button></div>
        </div>
      </div>
    </div>
  );
}

// ───────────── Reject reason modal ─────────────
function LeaveRejectModal() {
  return (
    <div className="wfp-modal-overlay" style={{ position: 'relative', padding: 0, background: 'transparent', display: 'block' }}>
      <div className="wfp-modal" style={{ margin: 0, width: 440 }}>
        <div className="wfp-modal-h"><span className="wfp-modal-h-t">Відхилити запит · Олег</span><span className="wfp-modal-h-aux">// vacation · 10–14.06</span><span className="wfp-modal-h-close"><Icon name="close" size={15} /></span></div>
        <div className="wfp-modal-body">
          <div className="wfcal-form">
            <div className="wfcal-field"><span className="wfcal-field-label">// причина відмови (обовʼязково)</span><textarea className="wfcal-input" rows={3} defaultValue="Дедлайн ORD-2412 того тижня — перенесімо на липень?" style={{ resize: 'vertical' }} /></div>
          </div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// виконавець отримає сповіщення</span>
          <div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn">Назад</button><button className="wfp-btn wfp-btn--primary wfl-reject" style={{ background: 'var(--wf-destructive, #DC2626)', borderColor: 'var(--wf-destructive, #DC2626)', color: '#fff' }} onClick={() => window.wfToast && window.wfToast('Відхилити · демо', 'ok')}>Відхилити</button></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LeaveExecutor, LeaveAdmin, LeaveRequestModal, LeaveRejectModal });
