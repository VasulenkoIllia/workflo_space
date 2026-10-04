// workspace-content.jsx — G4 workspace screens:
//   WorkspaceVault     — encrypted access credentials per client (mask/reveal/log)
//   WorkspaceBlogCMS   — blog editor: posts table + split markdown/preview
//   WorkspaceCases     — case studies manager (cards)
// Uses WfAvatar (avatar-icons.jsx), PageHeader/StatsRow/Stat, Icon.

// ───────────────────────── Vault ─────────────────────────
const VAULT_KIND_ICON = { ssh: 'key', login: 'lock', token: 'shield', api: 'globe' };

function VaultItem({ it }) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="wfv-item">
      <span className="wfv-kind"><Icon name={VAULT_KIND_ICON[it.kind] || 'lock'} size={16} /></span>
      <div className="wfv-main">
        <div className="wfv-label">
          {it.label}
          {it.expiring && <span className="wfv-expiring">⚠ скоро спливе</span>}
        </div>
        <div className="wfv-cred">
          <span>{it.user}</span>
          <span style={{ color: 'var(--wf-fg-subtle)' }}>·</span>
          <span className="wfv-secret" data-revealed={shown || undefined}>{shown ? 'k7$Pq2-mZ9xL' : it.mask}</span>
          <span style={{ color: 'var(--wf-fg-subtle)' }}>· оновлено {it.updated}</span>
        </div>
      </div>
      <div className="wfv-meta-right">
        <div className="wfv-actions">
          <button className="wfp-iconbtn" title={shown ? 'Сховати' : 'Показати'} onClick={() => setShown((s) => !s)}>
            <Icon name={shown ? 'eye_off' : 'eye'} size={14} />
          </button>
          <button className="wfp-iconbtn" title="Копіювати"><Icon name="copy" size={14} /></button>
          <button className="wfp-iconbtn" title="Поділитись"><Icon name="users" size={14} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="wfv-strength" data-s={it.strength}>
            <span className="bar" /><span className="bar" /><span className="bar" />
            {it.strength === 'strong' ? 'надійний' : it.strength === 'medium' ? 'середній' : 'слабкий'}
          </span>
          <span className="wfv-shared"><Icon name="users" size={11} />{it.shared.length}</span>
        </div>
      </div>
    </div>
  );
}

function WorkspaceVault() {
  const v = window.WFP_VAULT;
  return (
    <React.Fragment>
      <PageHeader title="Сейф доступів" subtitle="// зашифроване сховище · логіни · ключі · токени · по клієнтах">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт (.kdbx) · демо', 'ok')}><Icon name="download" size={14} />Експорт (.kdbx)</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Додати доступ · демо', 'ok')}><Icon name="plus" size={14} />Додати доступ</button>
      </PageHeader>

      <StatsRow>
        <Stat k="усього секретів" v={v.stats.secrets} sub={`${v.stats.companies} компаній`} />
        <Stat k="розшарено в команді" v={v.stats.shared} kind="accent" sub="через RBAC" />
        <Stat k="скоро спливуть" v={v.stats.expiring} kind="warn" sub="потребують ротації" />
        <Stat k="шифрування" v="AES-256" sub="zero-knowledge" />
      </StatsRow>

      <div className="wfv">
        <div>
          <div className="wfp-filters" style={{ marginBottom: 18 }}>
            <div className="wfp-search">
              <Icon name="search" size={14} color="var(--wf-fg-muted)" />
              <input placeholder="Шукати доступ, клієнта, сервіс…" />
              <span className="wfp-search-kbd">⌘K</span>
            </div>
            <button className="wfp-pill" data-on="true">всі</button>
            <button className="wfp-pill">ssh</button>
            <button className="wfp-pill">токени</button>
            <button className="wfp-pill">api</button>
          </div>

          {v.groups.map((g) => (
            <div className="wfv-group" key={g.company}>
              <div className="wfv-group-h">
                <WfAvatar kind={g.avatar} size="sm" shape="circle" />
                <span className="wfv-group-name">{g.company}</span>
                <span className="wfv-group-meta">// tier: {g.tier}</span>
                <span className="wfv-group-count">{g.count} секретів</span>
              </div>
              {g.items.map((it) => <VaultItem key={it.id} it={it} />)}
            </div>
          ))}
        </div>

        <div className="wfv-rail">
          <div className="wfv-rail-card">
            <div className="wfv-enc">
              <span className="wfv-enc-ico"><Icon name="shield" size={17} /></span>
              <div>
                <div className="wfv-enc-t">End-to-end шифрування</div>
                <div className="wfv-enc-sub">Секрети шифруються на клієнті. Сервер бачить лише маски. Кожен перегляд — у логу. RBAC: доступ лише призначеним.</div>
              </div>
            </div>
          </div>

          <div className="wfv-rail-card">
            <div className="wfv-rail-h"><Icon name="clock" size={13} />// журнал доступу</div>
            {v.log.map((l, i) => (
              <div className="wfv-log-row" key={i}>
                <div className="wfv-log-ts">{l.ts}</div>
                <div className="wfv-log-txt"><strong>{l.who}</strong> {l.action} <strong>{l.what}</strong></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ───────────────────────── Blog CMS ─────────────────────────
function CmsStatus({ s }) {
  const label = { published: 'опубліковано', draft: 'чернетка', scheduled: 'заплановано' }[s] || s;
  return <span className="wfc-status" data-s={s}><span className="dot" />{label}</span>;
}

// tiny markdown source preview (purely visual, syntax-tinted)
const CMS_MD_SRC = `# Як вибратись з Excel у CRM
> 8 хв · process · automation

Excel не ворог. Він чесно тримав ваш
бізнес перші роки — і це нормально.

## коли саме час мігрувати

Не тоді, коли «таблиця незручна», а коли
помилки в ній починають **коштувати грошей**.

- 5+ людей редагують одну таблицю
- є процеси, що повторюються 1-в-1
- дані потрібні на телефоні

> Перенесли 4 роки замовлень за вихідні.
> — Олена · Brunky

\`\`\`bash
$ wc -l orders.csv
  2417 orders.csv
\`\`\``;

function MdSource({ src }) {
  // naive tint: headings, tokens, quotes
  return (
    <pre className="wfc-src">
      {src.split('\n').map((line, i) => {
        let cls = '';
        if (/^#{1,6}\s/.test(line)) cls = 'md-h';
        else if (/^>/.test(line)) cls = 'md-quote';
        else if (/^[-*]\s/.test(line) || /^```/.test(line) || /^\$/.test(line)) cls = 'md-tok';
        return <div key={i} className={cls}>{line || ' '}</div>;
      })}
    </pre>
  );
}

function WorkspaceBlogCMS({ view = 'list' }) {
  const posts = window.WFP_CMS.posts;
  if (view === 'editor') {
    return (
      <React.Fragment>
        <PageHeader title="Редактор статті" subtitle="// /blog/excel-to-crm-without-pain · markdown ↔ прев'ю наживо">
          <button className="wfp-btn"><Icon name="eye" size={14} />Прев'ю на сайті</button>
          <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Зберегти чернетку · демо', 'ok')}>Зберегти чернетку</button>
          <button className="wfp-btn wfp-btn--primary"><Icon name="check" size={14} />Опублікувати</button>
        </PageHeader>

        <div className="wfc-meta-bar">
          <div className="wfc-meta-field"><span className="wfc-meta-k">статус</span><CmsStatus s="published" /></div>
          <div className="wfc-meta-field"><span className="wfc-meta-k">slug</span><span className="wfc-meta-v" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>/excel-to-crm-without-pain</span></div>
          <div className="wfc-meta-field"><span className="wfc-meta-k">автор</span><span className="wfc-meta-v">Ілля</span></div>
          <div className="wfc-meta-field"><span className="wfc-meta-k">теги</span><span className="wfc-meta-v">process · automation</span></div>
          <div className="wfc-meta-field"><span className="wfc-meta-k">читання</span><span className="wfc-meta-v">8 хв</span></div>
          <div className="wfc-meta-field" style={{ marginLeft: 'auto' }}><span className="wfc-meta-k">переглядів</span><span className="wfc-meta-v" style={{ color: 'var(--wf-accent)' }}>1.2k</span></div>
        </div>

        <div className="wfc-editor">
          <div className="wfc-pane">
            <div className="wfc-pane-h">
              <Icon name="edit" size={13} /><span className="tag">markdown</span>
              <div className="wfc-toolbar">
                <span className="wfc-tool">H</span>
                <span className="wfc-tool" style={{ fontWeight: 800 }}>B</span>
                <span className="wfc-tool" style={{ fontStyle: 'italic' }}>i</span>
                <span className="wfc-tool">"</span>
                <span className="wfc-tool"><Icon name="list" size={13} /></span>
                <span className="wfc-tool"><Icon name="paperclip" size={13} /></span>
              </div>
            </div>
            <MdSource src={CMS_MD_SRC} />
          </div>
          <div className="wfc-pane">
            <div className="wfc-pane-h"><Icon name="eye" size={13} /><span className="tag">прев'ю</span> <span style={{ marginLeft: 'auto' }}>як на workflo.space/blog</span></div>
            <div className="wfc-preview">
              <h1>Як вибратись з Excel у CRM</h1>
              <div className="lead">// 8 хв · process · automation</div>
              <p>Excel не ворог. Він чесно тримав ваш бізнес перші роки — і це нормально.</p>
              <h2>коли саме час мігрувати</h2>
              <p>Не тоді, коли «таблиця незручна», а коли помилки в ній починають коштувати грошей.</p>
              <blockquote>Перенесли 4 роки замовлень за вихідні. — Олена · Brunky</blockquote>
              <p>CRM не робить команду продуктивнішою сама по собі. Її робить такою прибрана структура даних.</p>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }

  // list view
  return (
    <React.Fragment>
      <PageHeader title="Блог" subtitle="// статті публічного сайту · 3 опубліковано · 1 чернетка · 1 заплановано">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Відкрити блог · демо', 'ok')}><Icon name="globe" size={14} />Відкрити блог</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Нова стаття · демо', 'ok')}><Icon name="plus" size={14} />Нова стаття</button>
      </PageHeader>

      <StatsRow>
        <Stat k="опубліковано" v="3" sub="на сайті" />
        <Stat k="чернетки" v="1" kind="warn" sub="в роботі" />
        <Stat k="заплановано" v="1" kind="accent" sub="02.06" />
        <Stat k="переглядів · 30 дн" v="4.2k" sub="+22% до квітня" />
      </StatsRow>

      <table className="wfp-table">
        <thead>
          <tr>
            <th style={{ width: '46%' }}>Стаття</th>
            <th>Статус</th>
            <th>Автор</th>
            <th>Дата</th>
            <th className="wfp-num">Перегляди</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.slug}>
              <td>
                <div style={{ fontWeight: 500 }}>{p.title}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 3 }}>/{p.slug} · {p.reading} · {p.tags.join(' · ')}</div>
              </td>
              <td><CmsStatus s={p.status} /></td>
              <td>{p.author}</td>
              <td className="wfp-mono">{p.date}</td>
              <td className="wfp-num">{p.views}</td>
              <td>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Редагувати · демо', 'ok')}><Icon name="edit" size={12} />Редагувати</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ───────────────────────── Cases ─────────────────────────
function WorkspaceCases() {
  const cases = window.WFP_CMS.cases;
  return (
    <React.Fragment>
      <PageHeader title="Кейси" subtitle="// портфоліо для лендінгу · історії клієнтів з результатами">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Відкрити на сайті · демо', 'ok')}><Icon name="globe" size={14} />Відкрити на сайті</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Новий кейс · демо', 'ok')}><Icon name="plus" size={14} />Новий кейс</button>
      </PageHeader>

      <div className="wfc-cases">
        {cases.map((c) => (
          <div className="wfc-case" key={c.slug}>
            <div className="wfc-case-top">
              <WfAvatar kind={c.industry} size="md" shape="circle" />
              <div>
                <div className="wfc-case-client">{c.client}</div>
                <div className="wfc-case-ind">// {c.slug}</div>
              </div>
              {c.featured && <span style={{ marginLeft: 'auto' }}><Icon name="star" size={15} color="var(--wf-accent)" /></span>}
            </div>
            <div className="wfc-case-body">
              <div className="wfc-case-title">{c.title}</div>
              <span className="wfc-case-result"><Icon name="check" size={12} />{c.result}</span>
            </div>
            <div className="wfc-case-foot">
              <CmsStatus s={c.status} />
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Редагувати · демо', 'ok')}><Icon name="edit" size={12} />Редагувати</button>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { WorkspaceVault, WorkspaceBlogCMS, WorkspaceCases });
