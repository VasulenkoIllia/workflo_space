// workspace-margin.jsx — Margin breakdown (22-Д): revenue − cost = margin,
// grouped by client / project / executor. Loss rows red. "оплачено N%" (accrual vs cash).
// Multi-currency normalised to USD (snapshot rate). Owner-only; lives in FinanceHub.

const _mg = React.useState;
const mgUsd = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const EUR_USD = 1.08; // snapshot rate (П7)

// Synthetic margin dataset — revenue, direct cost, allocated overhead, paid %.
const MARGIN = {
  clients: [
    { name: 'Brunky',     rev: 6400, direct: 3800, alloc: 600, paid: 88 },
    { name: 'EduForge',   rev: 2800, direct: 2400, alloc: 400, paid: 62 },
    { name: 'Tably',      rev: 3200, direct: 3600, alloc: 300, paid: 40 },  // loss
    { name: 'NordStream', rev: 1600, direct: 900,  alloc: 200, paid: 75 },
    { name: 'Florèal',    rev: 4200, direct: 2800, alloc: 300, paid: 100 },
  ],
  projects: [
    { name: 'PRJ-118 · Підтримка',   client: 'Brunky',     rev: 3200, direct: 1700, alloc: 300, paid: 90 },
    { name: 'PRJ-121 · Інтеграція',  client: 'Brunky',     rev: 3200, direct: 2100, alloc: 300, paid: 85 },
    { name: 'PRJ-109 · LMS',         client: 'EduForge',   rev: 2800, direct: 2400, alloc: 400, paid: 62 },
    { name: 'PRJ-112 · API sync',    client: 'Tably',      rev: 3200, direct: 3600, alloc: 300, paid: 40 },  // loss
    { name: 'PRJ-115 · Лендинг',     client: 'NordStream', rev: 1600, direct: 900,  alloc: 200, paid: 75 },
  ],
  executors: [
    { name: 'Андрій Левченко', role: 'Lead Dev', rev: 4200, direct: 2600, alloc: 0, paid: 80 },
    { name: 'Ігор Бондар',     role: 'Backend',  rev: 3800, direct: 2700, alloc: 0, paid: 78 },
    { name: 'Марія Слюсар',    role: 'Frontend', rev: 2400, direct: 1980, alloc: 0, paid: 70 },
    { name: 'Ілля Васюленко',  role: 'Owner · zeroCost', rev: 3800, direct: 0, alloc: 0, paid: 90 },
  ],
};

function MarginTab() {
  const [grp, setGrp] = _mg('clients');
  const [sort, setSort] = _mg('margin'); // margin | marginPct | rev
  const rows = MARGIN[grp].map((r) => {
    const cost = r.direct + r.alloc;
    const margin = r.rev - cost;
    const pct = r.rev ? Math.round((margin / r.rev) * 100) : 0;
    return { ...r, cost, margin, pct };
  }).sort((a, b) => sort === 'rev' ? b.rev - a.rev : sort === 'marginPct' ? b.pct - a.pct : b.margin - a.margin);

  const totRev = rows.reduce((s, r) => s + r.rev, 0);
  const totMargin = rows.reduce((s, r) => s + r.margin, 0);
  const totPct = totRev ? Math.round((totMargin / totRev) * 100) : 0;
  const losses = rows.filter((r) => r.margin < 0).length;

  const GRP = [['clients', 'по клієнтах'], ['projects', 'по проєктах'], ['executors', 'по виконавцях']];
  const label = grp === 'clients' ? 'Клієнт' : grp === 'projects' ? 'Проєкт' : 'Виконавець';

  return (
    <React.Fragment>
      <StatsRow>
        <Stat k="виручка · період" v={mgUsd(totRev)} sub="нараховано (USD-eq)" />
        <Stat k="маржа разом" v={mgUsd(totMargin)} sub={`${totPct}% по портфелю`} kind={totMargin >= 0 ? 'accent' : 'danger'} />
        <Stat k="збиткових" v={losses} sub={losses ? 'маржа < 0' : 'усі в плюсі'} kind={losses ? 'danger' : undefined} />
        <Stat k="курс знімок" v="€1 = $1.08" sub="мультивалюта → USD (П7)" />
      </StatsRow>

      <div className="wfmg-bar">
        <div className="wff-seg">
          {GRP.map(([id, l]) => <button key={id} className="wff-seg-opt" data-on={grp === id || undefined} onClick={() => setGrp(id)}>{l}</button>)}
        </div>
        <div style={{ flex: 1 }} />
        <label className="wfb-sel"><span>сортувати</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="margin">маржа $</option>
            <option value="marginPct">маржа %</option>
            <option value="rev">виручка</option>
          </select>
        </label>
      </div>

      <table className="wfp-table wfmg-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th className="wfp-num">Виручка</th>
            <th className="wfp-num">Прямі</th>
            <th className="wfp-num">Розподілені</th>
            <th className="wfp-num">Маржа $</th>
            <th className="wfp-num">Маржа %</th>
            <th>Оплачено</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} data-loss={r.margin < 0 || undefined}>
              <td>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                {r.client && <div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{r.client}</div>}
                {r.role && <div className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>{r.role}</div>}
              </td>
              <td className="wfp-num">{mgUsd(r.rev)}</td>
              <td className="wfp-num" style={{ color: 'var(--wf-fg-muted)' }}>{mgUsd(r.direct)}</td>
              <td className="wfp-num" style={{ color: 'var(--wf-fg-muted)' }}>{r.alloc ? mgUsd(r.alloc) : '—'}</td>
              <td className="wfp-num" style={{ fontWeight: 600, color: r.margin < 0 ? 'var(--wf-destructive)' : 'var(--wf-fg)' }}>{mgUsd(r.margin)}</td>
              <td className="wfp-num"><span className="wfmg-pct" data-loss={r.margin < 0 || undefined}>{r.pct}%</span></td>
              <td>
                <span className="wfmg-paid">
                  <span className="wfmg-paid-bar"><span className="wfmg-paid-fill" data-low={r.paid < 60 || undefined} style={{ width: r.paid + '%' }} /></span>
                  {r.paid}%
                </span>
              </td>
            </tr>
          ))}
          <tr className="wfmg-total">
            <td>Разом</td>
            <td className="wfp-num">{mgUsd(totRev)}</td>
            <td className="wfp-num">{mgUsd(rows.reduce((s, r) => s + r.direct, 0))}</td>
            <td className="wfp-num">{mgUsd(rows.reduce((s, r) => s + r.alloc, 0))}</td>
            <td className="wfp-num" style={{ fontWeight: 700, color: totMargin < 0 ? 'var(--wf-destructive)' : 'var(--wf-accent)' }}>{mgUsd(totMargin)}</td>
            <td className="wfp-num">{totPct}%</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div className="wfmg-note">
        <Icon name="shield" size={14} color="var(--wf-accent)" />
        <span>Маржа = виручка − (прямі + розподілені витрати). <strong>«Оплачено»</strong> показує cash vs accrual: нарахування може бути в плюсі, поки оплата ще не надійшла. zeroCost-виконавці (owner) мають собівартість 0 — уся їхня виручка йде в маржу.</span>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { MarginTab });
