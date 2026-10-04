// workspace-finprojects-data.js — global fin-projects list (05, С1 separate list),
// team compensation (12-А triârus + 22-Д margin), contract templates (06-А).

(function () {
  // Global projects across all clients (separate Workspace list — TZ С1)
  const PROJECTS_ALL = [
    { id: 'pr-ops',  client: 'Brunky',    code: 'PRJ-118', name: 'Підтримка платформи',        model: 'fixed', amount: 3200, cur: 'USD', cycle: '1-е число', entity: 'ФОП Васюленко', status: 'active', margin: 63, hours: '47/60' },
    { id: 'pr-int',  client: 'Brunky',    code: 'PRJ-121', name: 'Інтеграція 1С ↔ Telegram',    model: 'hourly', rate: 45, cur: 'USD', cycle: '1-е число', entity: 'Workflo OÜ', status: 'active', margin: 64, hours: '28' },
    { id: 'pr-edu',  client: 'EduForge',  code: 'PRJ-109', name: 'LMS платформа · абонемент',    model: 'fixed', amount: 2800, cur: 'USD', cycle: '5-е число', entity: 'ФОП Васюленко', status: 'active', margin: 58, hours: '52/55' },
    { id: 'pr-tab',  client: 'Tably',     code: 'PRJ-112', name: 'API синхронізація',            model: 'hourly', rate: 50, cur: 'EUR', cycle: 'щотижня',   entity: 'Workflo OÜ', status: 'active', margin: 66, hours: '34' },
    { id: 'pr-nord', client: 'NordStream',code: 'PRJ-115', name: 'Лендинг + інтеграції',         model: 'hourly', rate: 40, cur: 'USD', cycle: 'вручну',    entity: 'ФОП Васюленко', status: 'paused', margin: 60, hours: '12' },
    { id: 'pr-flor', client: 'Florèal',   code: 'PRJ-104', name: 'E-commerce MVP',               model: 'fixed', amount: 4200, cur: 'USD', cycle: '1-е число', entity: 'Workflo OÜ', status: 'closed', margin: 65, hours: '—' },
  ];

  // Team compensation — triârus (12-А): base rate (profile) → project override → zeroCost flag
  const TEAM_COMP = [
    { id: 't1', name: 'Андрій Левченко', role: 'Lead Developer', dept: 'Розробка', model: 'rate_hours', base: 28, commission: 5, projects: [{ name: 'PRJ-121', override: 32 }], zeroCost: false },
    { id: 't2', name: 'Марія Слюсар',    role: 'Frontend',        dept: 'Розробка', model: 'rate', base: 22, commission: 0, projects: [], zeroCost: false },
    { id: 't3', name: 'Ігор Бондар',     role: 'Backend',         dept: 'Розробка', model: 'hours', base: 25, commission: 3, projects: [{ name: 'PRJ-118', override: 27 }], zeroCost: false },
    { id: 't4', name: 'Ілля Васюленко',  role: 'Owner',           dept: '—',        model: 'rate', base: 0, commission: 0, projects: [], zeroCost: true },
  ];
  const COMP_MODELS = {
    rate:       { label: 'Фіксована ставка', desc: 'Фіксована сума за період (без прив’язки до годин)', hasHours: false },
    rate_hours: { label: 'Ставка + години', desc: 'Ставка × відпрацьовані години', hasHours: true },
    hours:      { label: 'Лише години', desc: 'Оплата за фактичні години', hasHours: true },
  };

  // Contract templates (06-А)
  const CONTRACT_TEMPLATES = [
    { id: 'ct1', name: 'Договір про надання послуг (UA)', format: 'UA', updated: '03.06.2026', vars: 12, linkedProjects: 4, lang: 'uk' },
    { id: 'ct2', name: 'Абонентський договір (UA)',        format: 'UA', updated: '21.05.2026', vars: 9,  linkedProjects: 2, lang: 'uk' },
    { id: 'ct3', name: 'Service Agreement (EU)',            format: 'EU', updated: '28.05.2026', vars: 14, linkedProjects: 1, lang: 'en' },
    { id: 'ct4', name: 'NDA (двомовний)',                   format: 'UA', updated: '12.04.2026', vars: 6,  linkedProjects: 0, lang: 'uk/en' },
  ];
  const TEMPLATE_VARS = [
    { v: '{{agency.legalName}}', ex: 'ФОП Васюленко І.' },
    { v: '{{agency.edrpou}}', ex: '3214567890' },
    { v: '{{agency.iban}}', ex: 'UA47 3052…' },
    { v: '{{client.legalName}}', ex: 'ТОВ «Бранкі Фуд»' },
    { v: '{{client.edrpou}}', ex: '41255890' },
    { v: '{{project.name}}', ex: 'Підтримка платформи' },
    { v: '{{project.amount}}', ex: '$3 200 / міс' },
    { v: '{{billing.cycle}}', ex: 'кожного 1-го числа' },
    { v: '{{payment.terms}}', ex: 'Net 14' },
    { v: '{{date.today}}', ex: '15.06.2026' },
  ];

  const SAMPLE_CONTRACT = `ДОГОВІР ПРО НАДАННЯ ПОСЛУГ №{{contract.number}}

м. Київ                                  {{date.today}}

{{agency.legalName}} (ЄДРПОУ {{agency.edrpou}}), далі —
«Виконавець», та {{client.legalName}} (ЄДРПОУ
{{client.edrpou}}), далі — «Замовник», уклали договір:

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Виконавець надає послуги з проєкту «{{project.name}}».
1.2. Вартість послуг: {{project.amount}}.

2. ПОРЯДОК ОПЛАТИ
2.1. Білінг-цикл: {{billing.cycle}}.
2.2. Термін оплати рахунку: {{payment.terms}}.
2.3. Оплата на рахунок {{agency.iban}}.`;

  // План/факт годин (12-ПЛАН-ФАКТ) — норма capacity vs TimeLog, 4 рівні.
  const PLANFACT = {
    period: 'Червень 2026',
    team: { plan: 560, fact: 512, people: 4, normWeek: 40 },
    byPerson: [
      { name: 'Андрій Левченко', role: 'Lead Developer', plan: 160, fact: 184 },
      { name: 'Марія Слюсар',    role: 'Frontend',        plan: 160, fact: 132 },
      { name: 'Ігор Бондар',     role: 'Backend',         plan: 160, fact: 156 },
      { name: 'Ілля Васюленко',  role: 'Owner',           plan: 80,  fact: 40  },
    ],
    byProject: [
      { name: 'Підтримка платформи', code: 'PRJ-118', type: 'subscription', limit: 60, fact: 47 },
      { name: 'Інтеграція 1С ↔ Telegram', code: 'PRJ-121', type: 'estimate', limit: 80, fact: 28 },
      { name: 'LMS платформа', code: 'PRJ-109', type: 'subscription', limit: 55, fact: 52 },
      { name: 'API синхронізація', code: 'PRJ-112', type: 'estimate', limit: 120, fact: 34 },
    ],
    byOrder: [
      { num: 'ORD-2412', title: 'Інтеграція 1С ↔ Telegram-бот', plan: 64, fact: 52 },
      { num: 'ORD-2388', title: 'API синхронізації складу', plan: 40, fact: 44 },
      { num: 'ORD-2350', title: 'Лендинг + CMS', plan: 30, fact: 28 },
    ],
  };

  window.WF_FINPROJ = { PROJECTS_ALL, TEAM_COMP, COMP_MODELS, CONTRACT_TEMPLATES, TEMPLATE_VARS, SAMPLE_CONTRACT, PLANFACT };
})();
