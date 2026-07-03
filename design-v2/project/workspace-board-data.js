// workspace-board-data.js — дані для головної дошки задач команди (module 02/12).
// Єдиний потік задач: клієнтські · внутрішні · абонплата · авто.
// Кожна команда має власну дошку з власними колонками; перша колонка завжди
// kind:'intake' (Вхідні/розподіл), остання — kind:'review' (На перевірці/здача).

window.WF_BOARD = (function () {
  // ── люди (виконавці) ──
  const PEOPLE = {
    illia:  { name: 'Ілля Васюленко', short: 'Ілля В.',  team: 'dev',     color: '#A3D90D' },
    oleh:   { name: 'Олег Демченко',  short: 'Олег Д.',  team: 'dev',     color: '#22B8CF' },
    taras:  { name: 'Тарас Мороз',    short: 'Тарас М.', team: 'dev',     color: '#FFB000' },
    maryna: { name: 'Марʼяна Кравець', short: 'Марʼяна К.', team: 'design', color: '#FF7A45' },
    yana:   { name: 'Яна Литвин',     short: 'Яна Л.',   team: 'content', color: '#A78BFA' },
    dmytro: { name: 'Дмитро Савчук',  short: 'Дмитро С.', team: 'ops',     color: '#2DD4A7' },
  };

  // ── команди = окремі дошки з власними статусами ──
  // kind: intake (перша, локнута) · wip (налаштовується) · review (остання, локнута)
  const TEAMS = [
    { id: 'all', name: 'Усі команди', color: 'var(--wf-fg)', aggregate: true, columns: [
      { id: 'intake', title: 'Вхідні',       kind: 'intake' },
      { id: 'wip',    title: 'В роботі',      kind: 'wip' },
      { id: 'review', title: 'На перевірці',  kind: 'review' },
    ] },
    { id: 'dev', name: 'Розробка', color: '#A3D90D', columns: [
      { id: 'intake',     title: 'Вхідні',      kind: 'intake' },
      { id: 'analysis',   title: 'Аналіз',      kind: 'wip' },
      { id: 'doing',      title: 'В роботі',     kind: 'wip' },
      { id: 'codereview', title: 'Code review', kind: 'wip' },
      { id: 'review',     title: 'На перевірці', kind: 'review' },
    ] },
    { id: 'design', name: 'Дизайн', color: '#FF7A45', columns: [
      { id: 'intake',  title: 'Вхідні',      kind: 'intake' },
      { id: 'concept', title: 'Концепт',     kind: 'wip' },
      { id: 'design',  title: 'Дизайн',      kind: 'wip' },
      { id: 'fixes',   title: 'Правки',      kind: 'wip' },
      { id: 'review',  title: 'На перевірці', kind: 'review' },
    ] },
    { id: 'ops', name: 'Підтримка · Абонплата', color: '#22B8CF', columns: [
      { id: 'intake',    title: 'Вхідні',      kind: 'intake' },
      { id: 'scheduled', title: 'Заплановано', kind: 'wip' },
      { id: 'doing',     title: 'Виконується', kind: 'wip' },
      { id: 'review',    title: 'На перевірці', kind: 'review' },
    ] },
    { id: 'content', name: 'Контент', color: '#A78BFA', columns: [
      { id: 'intake', title: 'Вхідні',      kind: 'intake' },
      { id: 'draft',  title: 'Чернетка',    kind: 'wip' },
      { id: 'edit',   title: 'Редактура',   kind: 'wip' },
      { id: 'review', title: 'На перевірці', kind: 'review' },
    ] },
  ];

  // ── типи задач ──
  const TYPES = {
    client:       { label: 'Клієнтська', short: 'клієнт', icon: 'building', color: '#A3D90D' },
    internal:     { label: 'Внутрішня',  short: 'внутр',  icon: 'home',     color: '#94A3B8' },
    subscription: { label: 'Абонплата',  short: 'абон',   icon: 'receipt',  color: '#22B8CF' },
    auto:         { label: 'Авто',       short: 'авто',   icon: 'bell',     color: '#A78BFA' },
  };

  // today = 15.06.2026
  // ── задачі ──
  const TASKS = [
    // ── РОЗРОБКА ──
    { id: 'T-1041', team: 'dev', col: 'doing', type: 'client', title: 'Інтеграція 1С ↔ Telegram-бот', client: 'Brunky', order: 'ORD-2412', assignees: ['illia', 'oleh'], due: '18.06', prio: 'high' },
    { id: 'T-1042', team: 'dev', col: 'intake', type: 'client', title: 'Webhook retry queue для логістики', client: 'Trasa', order: 'ORD-2415', assignees: [], due: '22.06', prio: 'normal' },
    { id: 'T-1043', team: 'dev', col: 'analysis', type: 'internal', title: 'Оновити CI/CD pipeline + кеш', client: null, order: null, assignees: ['oleh'], due: '20.06', prio: 'normal' },
    { id: 'T-1044', team: 'dev', col: 'intake', type: 'subscription', title: 'Оновити SSL-сертифікат brunky.com', client: 'Brunky', order: null, assignees: [], due: '14.06', prio: 'high', late: true, auto: true, recur: 'що 90 днів' },
    { id: 'T-1045', team: 'dev', col: 'intake', type: 'auto', title: 'Бекап продакшн-БД', client: null, order: null, assignees: [], due: '16.06', prio: 'normal', auto: true, recur: 'щомісяця' },
    { id: 'T-1046', team: 'dev', col: 'codereview', type: 'client', title: 'AI-агент саппорту v2 — escalation logic', client: 'EduForge', order: 'ORD-2409', assignees: ['illia', 'taras'], due: '12.06', prio: 'high', late: true },
    { id: 'T-1047', team: 'dev', col: 'review', type: 'client', title: 'Парсер прайсів конкурентів', client: 'Brunky', order: 'ORD-2411', assignees: ['illia'], due: '02.06', prio: 'normal', done: true },
    { id: 'T-1048', team: 'dev', col: 'doing', type: 'client', title: 'API синхронізації складу', client: 'EduForge', order: 'ORD-2419', assignees: ['taras'], due: '24.06', prio: 'normal' },

    // ── ДИЗАЙН ──
    { id: 'T-1051', team: 'design', col: 'design', type: 'client', title: 'Лендінг redesign — hero + features', client: 'Tably', order: 'ORD-2410', assignees: ['maryna'], due: '19.06', prio: 'normal' },
    { id: 'T-1052', team: 'design', col: 'concept', type: 'client', title: 'Іконки для клієнтського дашборду', client: 'EduForge', order: null, assignees: ['maryna'], due: '25.06', prio: 'low' },
    { id: 'T-1053', team: 'design', col: 'fixes', type: 'internal', title: 'Оновити внутрішній брендбук', client: null, order: null, assignees: ['maryna'], due: '13.06', prio: 'normal', late: true },
    { id: 'T-1054', team: 'design', col: 'intake', type: 'subscription', title: 'Банери для соцмереж — червень', client: 'Brunky', order: null, assignees: [], due: '17.06', prio: 'normal', recur: 'щомісяця' },

    // ── ПІДТРИМКА · АБОНПЛАТА ──
    { id: 'T-1061', team: 'ops', col: 'scheduled', type: 'subscription', title: 'Оновити сертифікат хостингу', client: 'NordStream', order: null, assignees: ['dmytro'], due: '21.06', prio: 'normal', auto: true, recur: 'що 90 днів' },
    { id: 'T-1062', team: 'ops', col: 'review', type: 'client', title: 'Налаштування CRM воронок', client: 'Tably', order: 'ORD-2410', assignees: ['dmytro'], due: '28.05', prio: 'normal', done: true },
    { id: 'T-1063', team: 'ops', col: 'intake', type: 'auto', title: 'Місячний звіт клієнту — травень', client: 'NordStream', order: null, assignees: [], due: '16.06', prio: 'normal', auto: true, recur: 'щомісяця' },
    { id: 'T-1064', team: 'ops', col: 'doing', type: 'internal', title: 'Планова ротація доступів (vault)', client: null, order: null, assignees: ['dmytro'], due: '15.06', prio: 'high', soon: true },
    { id: 'T-1065', team: 'ops', col: 'doing', type: 'subscription', title: 'Підтримка 2 год — абонплата (червень)', client: 'EduForge', order: null, assignees: ['dmytro'], due: '30.06', prio: 'normal', recur: 'щомісяця' },

    // ── КОНТЕНТ ──
    { id: 'T-1071', team: 'content', col: 'draft', type: 'internal', title: 'Стаття в блог: міграція з Excel', client: null, order: null, assignees: ['yana'], due: '24.06', prio: 'normal' },
    { id: 'T-1072', team: 'content', col: 'edit', type: 'subscription', title: 'SMM-пости — тиждень 24', client: 'Brunky', order: null, assignees: ['yana'], due: '16.06', prio: 'normal', recur: 'щотижня' },
    { id: 'T-1073', team: 'content', col: 'review', type: 'client', title: 'Кейс: Trasa — логістика', client: 'Trasa', order: null, assignees: ['yana'], due: '10.06', prio: 'low', done: true },
  ];

  const CLIENTS = ['Brunky', 'EduForge', 'Trasa', 'NordStream', 'Tably'];

  // ── абон-контракти (підписки) по клієнтах ──
  // Задачі типу subscription зв'язуються сюди → години течуть у пул (zero-billed).
  // Узгоджено з Workspace · Послуги (workspace-services-data.js).
  const SUBS = {
    Brunky:     { code: 'SUB-118', name: 'Підтримка платформи · абонплата', hoursIncluded: 40, amount: 3200, cur: '$' },
    EduForge:   { code: 'SUB-204', name: 'SEO + контент · 10 год/міс',      hoursIncluded: 10, amount: 180,  cur: '$' },
    NordStream: { code: 'SUB-119', name: 'API-моніторинг трекінгу',          hoursIncluded: 8,  amount: 260,  cur: '$' },
    Tably:      { code: 'SUB-221', name: 'AI-саппорт · retainer',            hoursIncluded: 12, amount: 320,  cur: '$' },
    Trasa:      { code: 'SUB-160', name: 'Підтримка інтеграцій',             hoursIncluded: 6,  amount: 150,  cur: '$' },
  };

  // ── проекти (батьківська сутність) ──
  // Проект визначає: клієнта · команду · модель білінгу · ставку.
  // Нова задача/замовлення чіпляється до проекту → команда і ставка успадковуються.
  // billing: fixed (разово за обсяг) · hourly (T&M, $/год) · retainer (абонплата + пул годин).
  const BILLING = {
    fixed:    { label: 'Fixed-price', short: 'fixed', taskType: 'client',       tone: 'muted'  },
    hourly:   { label: 'Погодинно',   short: 'hourly', taskType: 'client',       tone: 'info'   },
    retainer: { label: 'Абонплата',   short: 'retainer', taskType: 'subscription', tone: 'accent' },
  };
  const PROJECTS = [
    { id: 'PRJ-118', name: 'Підтримка платформи Brunky', client: 'Brunky',     team: 'dev',     billing: 'retainer', amount: 3200, hoursIncluded: 40, cur: '$', sub: 'Brunky',     status: 'active' },
    { id: 'PRJ-241', name: '1С ↔ Telegram-бот',          client: 'Brunky',     team: 'dev',     billing: 'fixed',    amount: 4200,                    cur: '$',                     order: 'ORD-2412', status: 'active' },
    { id: 'PRJ-150', name: 'Webhook retry / логістика',  client: 'Trasa',      team: 'dev',     billing: 'hourly',   rate: 45,                        cur: '$',                     order: 'ORD-2415', status: 'active' },
    { id: 'PRJ-119', name: 'API-моніторинг трекінгу',    client: 'NordStream', team: 'ops',     billing: 'retainer', amount: 260,  hoursIncluded: 8,  cur: '$', sub: 'NordStream', status: 'active' },
    { id: 'PRJ-221', name: 'AI-саппорт retainer',        client: 'Tably',      team: 'dev',     billing: 'retainer', amount: 320,  hoursIncluded: 12, cur: '$', sub: 'Tably',      status: 'active' },
    { id: 'PRJ-130', name: 'Лендінг redesign',           client: 'Tably',      team: 'design',  billing: 'fixed',    amount: 3800,                    cur: '$',                     status: 'active' },
    { id: 'PRJ-204', name: 'SEO + контент',              client: 'EduForge',   team: 'content', billing: 'retainer', amount: 1800, hoursIncluded: 10, cur: '$', sub: 'EduForge',   status: 'active' },
    { id: 'PRJ-209', name: 'AI-агент саппорту v2',       client: 'EduForge',   team: 'dev',     billing: 'fixed',    amount: 5200,                    cur: '$',                     order: 'ORD-2409', status: 'active' },
    { id: 'PRJ-160', name: 'Підтримка інтеграцій Trasa', client: 'Trasa',      team: 'ops',     billing: 'retainer', amount: 150,  hoursIncluded: 6,  cur: '$', sub: 'Trasa',      status: 'active' },
  ];
  const projectById = (id) => PROJECTS.find((p) => p.id === id) || null;
  // людський опис ставки проекту
  function rateLabel(p) {
    if (!p) return '—';
    if (p.billing === 'hourly')   return `${p.cur}${p.rate}/год`;
    if (p.billing === 'retainer') return `${p.cur}${p.amount}/міс · ${p.hoursIncluded}h`;
    return `${p.cur}${p.amount} · разово`;
  }

  function estHours(t) {
    const byPrio = { high: 16, normal: 10, low: 6 };
    let e = byPrio[t.prio] || 10;
    if (t.type === 'subscription') e = 4;
    else if (t.type === 'auto') e = 2;
    else if (t.type === 'internal') e = Math.max(4, e - 2);
    return e;
  }

  // частка виконаного за поточною колонкою (для демо-розрахунку залогованих годин)
  function progressFraction(t, teams) {
    if (t.done) return 1.0;
    const bd = (teams || TEAMS).find((b) => b.id === t.team);
    if (!bd) return 0.3;
    const col = bd.columns.find((c) => c.id === t.col);
    if (!col || col.kind === 'intake') return 0;
    if (col.kind === 'review') return 0.9;
    const wip = bd.columns.filter((c) => c.kind === 'wip').map((c) => c.id);
    const wp = wip.indexOf(t.col);
    return 0.28 + (wip.length > 1 ? (wp / (wip.length - 1)) * 0.5 : 0.25);
  }

  // derive card status: done · overdue · soon · wip
  function statusOf(t) {
    if (t.done) return 'done';
    if (t.late) return 'overdue';
    if (t.soon) return 'soon';
    return 'wip';
  }

  return { PEOPLE, TEAMS, TYPES, TASKS, CLIENTS, SUBS, BILLING, PROJECTS, projectById, rateLabel, statusOf, estHours, progressFraction };
})();
