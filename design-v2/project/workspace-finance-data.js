// workspace-finance-data.js — G9 · Finance / Expenses (module 22) + M4 revenue chart.
// owner-only. Expense ledger + P&L (revenue − expenses).

window.WFP_FINANCE = {
  period: 'Травень 2026',
  overview: {
    income: 14800,
    expenses: 6240,
    net: 8560,
    margin: 57.8,
    delta: 6.2, // vs prev month
  },
  // expenses grouped by category (for donut)
  categories: [
    { id: 'salary',  label: 'Зарплати',      amount: 3360, color: 'oklch(0.62 0.13 250)' },
    { id: 'infra',   label: 'Інфраструктура', amount: 980,  color: 'oklch(0.58 0.09 185)' },
    { id: 'software', label: 'Софт / ліцензії', amount: 1240, color: 'oklch(0.56 0.13 295)' },
    { id: 'marketing', label: 'Маркетинг',    amount: 460,  color: 'oklch(0.64 0.13 65)' },
    { id: 'other',   label: 'Інше',           amount: 200,  color: 'oklch(0.6 0.05 90)' },
  ],
  expenses: [
    { id: 'e1', name: 'Виплати команді',        category: 'salary',   vendor: '6 виконавців', amount: 3360, freq: 'monthly', start: '01.05', linked: 'team', active: true },
    { id: 'e2', name: 'Vercel Pro',             category: 'infra',    vendor: 'Vercel',       amount: 240,  freq: 'monthly', start: '01.01', linked: '—', active: true },
    { id: 'e3', name: 'Supabase + Postgres',    category: 'infra',    vendor: 'Supabase',     amount: 320,  freq: 'monthly', start: '15.02', linked: '—', active: true },
    { id: 'e4', name: 'OpenAI + Anthropic API', category: 'software', vendor: 'AI',           amount: 680,  freq: 'monthly', start: '01.03', linked: 'Tably', active: true },
    { id: 'e5', name: 'Figma + Linear + GitHub', category: 'software', vendor: 'SaaS',        amount: 180,  freq: 'monthly', start: '01.01', linked: '—', active: true },
    { id: 'e6', name: 'Реклама Google',         category: 'marketing', vendor: 'Google Ads',  amount: 460,  freq: 'monthly', start: '01.05', linked: '—', active: true },
    { id: 'e7', name: 'Postmark (email)',       category: 'infra',    vendor: 'Postmark',     amount: 220,  freq: 'monthly', start: '10.02', linked: '—', active: false },
    { id: 'e8', name: 'Бухгалтер (квартал)',    category: 'other',    vendor: 'Аутсорс',      amount: 600,  freq: 'quarterly', start: '01.04', linked: '—', active: true },
    { id: 'e9', name: 'Домени + SSL',           category: 'other',    vendor: 'Namecheap',    amount: 200,  freq: 'yearly',  start: '03.05', linked: '—', active: true },
    { id: 'e10', name: 'Аудит безпеки',         category: 'other',    vendor: 'Pentest Co',   amount: 1200, freq: 'once',    start: '12.05', linked: '—', active: true },
  ],
  // P&L 3-series line chart, last 6 months
  pnl: {
    months: ['Грд', 'Січ', 'Лют', 'Бер', 'Кві', 'Тра'],
    revenue:  [9200, 10400, 11800, 12200, 13900, 14800],
    expenses: [5100, 5400, 5800, 5900, 6100, 6240],
    profit:   [4100, 5000, 6000, 6300, 7800, 8560],
  },
  // /reports/pnl table (per month breakdown)
  pnlTable: [
    { month: 'Бер 2026', revenue: 12200, salary: 3000, infra: 900, software: 1100, marketing: 500, total: 5900, profit: 6300, margin: 51.6 },
    { month: 'Кві 2026', revenue: 13900, salary: 3200, infra: 950, software: 1200, marketing: 460, total: 6100, profit: 7800, margin: 56.1 },
    { month: 'Тра 2026', revenue: 14800, salary: 3360, infra: 980, software: 1240, marketing: 460, total: 6240, profit: 8560, margin: 57.8 },
  ],
};
