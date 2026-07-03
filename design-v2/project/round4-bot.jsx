// round4-bot.jsx — G16 · Telegram bot admin + broadcast.
// Status card · connected accounts · broadcast composer (markdown preview +
// audience + schedule + confirm-countdown) · broadcast history · helper sidebar.

const _bo = React.useState;
const _boe = React.useEffect;

const BO_ACCOUNTS = [
  { name: 'Олег Демченко', un: '@oleg_dev', status: 'active', last: '12 хв тому' },
  { name: 'ТОВ «Брунки» (Іваненко)', un: '@ivanenko_op', status: 'active', last: '2 год тому' },
  { name: 'EduForge (бот-канал)', un: '@eduforge_ops', status: 'active', last: 'вчора' },
  { name: 'Mono Lab', un: '@monolab', status: 'blocked', last: '5 днів тому' },
];
const BO_HISTORY = [
  { date: '28.05 14:00', text: 'Реліз v0.6.2 — нові звіти', aud: 'команда', size: 9, ok: 9, fail: 0 },
  { date: '20.05 10:30', text: 'Планові роботи у нд 02:00–04:00', aud: 'усі', size: 41, ok: 39, fail: 2 },
  { date: '12.05 09:00', text: 'Знижка silver+ цього місяця', aud: 'portal-clients', size: 18, ok: 17, fail: 1 },
];

function R4BotConfirm({ aud, size, onClose, onSend }) {
  const [cd, setCd] = _bo(3);
  _boe(() => { const id = setInterval(() => setCd((c) => (c <= 1 ? (clearInterval(id), 0) : c - 1)), 1000); return () => clearInterval(id); }, []);
  return (
    <div className="wfp-modal-overlay" onClick={(e) => { if (e.target.classList.contains('wfp-modal-overlay')) onClose(); }}>
      <div className="wfp-modal" style={{ width: 420, margin: 0 }}>
        <div className="wfp-modal-h"><Icon name="send" size={18} color="var(--wf-accent)" /><span className="wfp-modal-h-t">Надіслати розсилку</span><span className="wfp-modal-h-close" onClick={onClose}><Icon name="alert" size={14} /></span></div>
        <div className="wfp-modal-body"><div className="wfs-modal-lead" style={{ marginBottom: 0 }}>Повідомлення отримають <strong>~{size}</strong> підписників ({aud}). Розсилку не можна відкликати після старту.</div></div>
        <div className="wfp-modal-foot"><span className="wfp-modal-foot-left">// telegram · sendMessage</span><div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={onClose}>Скасувати</button><button className="wfp-btn wfp-btn--primary" disabled={cd > 0} style={{ opacity: cd > 0 ? 0.6 : 1 }} onClick={cd > 0 ? undefined : onSend}>{cd > 0 ? `Підтвердити (${cd})` : 'Надіслати'}</button></div></div>
      </div>
    </div>
  );
}

function R4Bot() {
  const [text, setText] = _bo('*Планові роботи*\nУ неділю 02:00–04:00 можливі перебої. Дякуємо за розуміння!');
  const [aud, setAud] = _bo('all');
  const [when, setWhen] = _bo('now');
  const [confirm, setConfirm] = _bo(false);
  const [sent, setSent] = _bo(false);
  const auds = [{ id: 'all', l: 'Усі підписники', n: '~68' }, { id: 'clients', l: 'Клієнти порталу', n: '~22' }, { id: 'team', l: 'Команда workspace', n: '9' }, { id: 'tier', l: 'Сегмент: silver+', n: '~14' }];
  const audSize = { all: 68, clients: 22, team: 9, tier: 14 }[aud];
  const mdPrev = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Telegram-бот</h1><div className="wfp-ph-sub">// статус · акаунти · broadcast</div></div>
        <div className="wfp-ph-r"><span className="r4-conn" data-s="connected"><span className="r4-conn-dot" />online</span></div>
      </div>

      <div className="r4-statcard" style={{ marginBottom: 22 }}>
        <div className="r4-statcell"><span className="r4-statcell-k">бот</span><span className="r4-statcell-v" style={{ fontSize: 14 }}>@workflospace_bot</span></div>
        <div className="r4-statcell"><span className="r4-statcell-k">режим</span><span className="r4-statcell-v" style={{ fontSize: 14 }} data-ok="true">webhook</span></div>
        <div className="r4-statcell"><span className="r4-statcell-k">uptime</span><span className="r4-statcell-v" data-ok="true">99.9%</span></div>
        <div className="r4-statcell"><span className="r4-statcell-k">останній апдейт</span><span className="r4-statcell-v" style={{ fontSize: 14 }}>12с тому</span></div>
        <div className="r4-statcell"><span className="r4-statcell-k">заблокували бота</span><span className="r4-statcell-v" data-warn="true">3</span></div>
      </div>

      <div className="r4-subhead"><span className="r4-subhead-t">broadcast · нова розсилка</span></div>
      {sent && <div className="r4-banner" style={{ borderColor: 'color-mix(in oklab, var(--wf-success) 35%, var(--wf-border))', background: 'color-mix(in oklab, var(--wf-success) 9%, var(--wf-surface))' }}><span className="r4-banner-ic"><Icon name="check" size={16} color="var(--wf-success)" /></span>Розсилку поставлено в чергу · {audSize} отримувачів · доставка в процесі</div>}
      <div className="r4-compose" style={{ marginBottom: 12 }}>
        <div className="r4-compose-main">
          <textarea className="r4-md" value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст розсилки · підтримує *Markdown*…" />
          <div><div className="r4-note" style={{ marginBottom: 6 }}>// прев’ю в Telegram</div><div className="r4-mdprev" dangerouslySetInnerHTML={{ __html: mdPrev }} /></div>
        </div>
        <div>
          <div className="r4-note" style={{ marginBottom: 8 }}>// аудиторія</div>
          <div className="r4-aud">
            {auds.map((a) => <div key={a.id} className="r4-aud-opt" data-on={aud === a.id || undefined} onClick={() => setAud(a.id)}>{a.l}<span className="r4-aud-opt-n">{a.n}</span></div>)}
          </div>
          <div className="r4-note" style={{ margin: '14px 0 8px' }}>// коли</div>
          <div className="r4-seg" style={{ display: 'flex' }}>
            <div className="r4-seg-opt" data-on={when === 'now' || undefined} onClick={() => setWhen('now')} style={{ flex: 1, textAlign: 'center' }}>Зараз</div>
            <div className="r4-seg-opt" data-on={when === 'sched' || undefined} onClick={() => setWhen('sched')} style={{ flex: 1, textAlign: 'center' }}>За розкладом</div>
          </div>
          {when === 'sched' && <div className="r4-copyfield" style={{ marginTop: 10 }}><Icon name="clock" size={13} /><input defaultValue="02.06.2026 · 09:00" /></div>}
          <button className="wfp-btn wfp-btn--primary" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }} onClick={() => setConfirm(true)}><Icon name="send" size={14} />Прев’ю та надіслати</button>
          <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--wf-border)', borderRadius: 10, background: 'var(--wf-subtle)' }}>
            <div className="r4-note" style={{ marginBottom: 6 }}>// шаблони команд</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, lineHeight: 1.7, color: 'var(--wf-fg-secondary)' }}>/start · вітання + меню<br />/help · довідка<br /><span className="wfp-link">модуль 15-bot →</span></div>
          </div>
        </div>
      </div>

      <div className="r4-subhead"><span className="r4-subhead-t">історія розсилок</span></div>
      <table className="wfp-table">
        <thead><tr><th>Дата</th><th>Текст</th><th>Аудиторія</th><th className="wfp-num">Доставлено</th><th className="wfp-num">Помилки</th></tr></thead>
        <tbody>{BO_HISTORY.map((h, i) => (
          <tr key={i}><td className="wfp-mono">{h.date}</td><td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.text}</td><td><span className="r4-chan">{h.aud}</span></td><td className="wfp-num" style={{ color: 'var(--wf-success)' }}>{h.ok}/{h.size}</td><td className="wfp-num" style={{ color: h.fail ? 'var(--wf-destructive)' : 'var(--wf-fg-muted)' }}>{h.fail}</td></tr>
        ))}</tbody>
      </table>

      <div className="r4-subhead"><span className="r4-subhead-t">звʼязані акаунти</span></div>
      <table className="wfp-table">
        <thead><tr><th>Користувач</th><th>Username</th><th>Статус</th><th>Остання взаємодія</th><th></th></tr></thead>
        <tbody>{BO_ACCOUNTS.map((a, i) => (
          <tr key={i}><td>{a.name}</td><td className="wfp-mono">{a.un}</td><td><span className="r4-conn" data-s={a.status === 'active' ? 'connected' : 'error'}><span className="r4-conn-dot" />{a.status === 'active' ? 'активний' : 'заблокований'}</span></td><td className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{a.last}</td><td><div style={{ display: 'flex', justifyContent: 'flex-end' }}>{a.status === 'blocked' && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Запит розблок.</button>}</div></td></tr>
        ))}</tbody>
      </table>

      {confirm && <R4BotConfirm aud={auds.find((a) => a.id === aud).l} size={audSize} onClose={() => setConfirm(false)} onSend={() => { setConfirm(false); setSent(true); }} />}
    </React.Fragment>
  );
}

Object.assign(window, { R4Bot });
