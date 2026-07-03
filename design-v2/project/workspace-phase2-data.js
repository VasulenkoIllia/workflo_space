// workspace-phase2-data.js — Phase-2 workspace features:
//   ADR-004 multi-agency switcher · G6 DB metrics · G9 per-client margin.

window.WFP_AGENCIES = [
  { id: 'workflo', name: 'workflo.space', role: 'owner', members: 6, clients: 12, active: true },
  { id: 'devhouse', name: 'DevHouse (партнер)', role: 'member', members: 14, clients: 31, active: false },
  { id: 'soloproj', name: 'Solo · мої проєкти', role: 'owner', members: 1, clients: 3, active: false },
];

window.WFP_DB_METRICS = {
  conn: { active: 12, max: 20, idle: 3 },
  cacheHit: 94.2,
  qps: 38,
  replicaLag: '0.4s',
  slowQueries: [
    { q: 'SELECT * FROM orders JOIN invoices ON …', calls: 1240, avg: 184, max: 920, table: 'orders' },
    { q: 'SELECT count(*) FROM time_entries WHERE …', calls: 880, avg: 142, max: 610, table: 'time_entries' },
    { q: 'UPDATE companies SET balance = … WHERE …', calls: 320, avg: 96, max: 410, table: 'companies' },
    { q: 'SELECT * FROM audit_log ORDER BY ts DESC …', calls: 2100, avg: 74, max: 280, table: 'audit_log' },
    { q: 'SELECT … FROM documents WHERE order_id = …', calls: 1560, avg: 52, max: 190, table: 'documents' },
  ],
};

window.WFP_CLIENT_MARGIN = {
  period: 'Травень 2026',
  totals: { revenue: 14800, cost: 6240, margin: 8560, marginPct: 57.8 },
  rows: [
    { client: 'Tably',      industry: 'saas',      revenue: 5200, cost: 1680, hours: 42, rate: 124 },
    { client: 'NordStream', industry: 'logistics', revenue: 3600, cost: 1820, hours: 38, rate: 95 },
    { client: 'Brunky',     industry: 'food',      revenue: 3200, cost: 1240, hours: 26, rate: 123 },
    { client: 'EduForge',   industry: 'education', revenue: 1800, cost: 980,  hours: 22, rate: 82 },
    { client: 'AquaLife',   industry: 'retail',    revenue: 1000, cost: 520,  hours: 11, rate: 91 },
  ],
};
