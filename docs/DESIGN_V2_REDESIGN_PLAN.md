# 🎨 Design-v2 — повний редизайн фронту (portal + workspace)

> Канон-план редизайну під `design-v2/`. Рішення власника (2026-06-21): **перероблюємо весь
> фронт під новий дизайн; тестування — ПІСЛЯ редизайну.** Джерело істини дизайну — `design-v2/project/*`;
> матриця — `DESIGN_SYSTEM.md §5`. Прогрес фіксуємо тут + у `TRACKER.md`.

## Орієнтир (з 3-агентного аналізу бандла, 2026-06-21)

**Гарна новина: CSS-фундамент ~90% уже портовано** в `packages/ui/src/styles/` (`product.css`
містить `.wfp-cmdk*`/`.wfp-bell-pop*`/`.wfp-co-pop*`/`.wfp-window*`/`.wfp-viewas*`/`.wfp-sb-rolemenu*`;
`ia-roles.css` повністю). Розрив = **React-компоненти + wiring**, не стилі.

**Важливий нюанс IA:** design-v2 production-shell — це **плоска рольова групована нав** (як зараз),
а «7 хабів» = **екранний патерн** (один пункт нав → контейнер із in-page sub-tabs), НЕ згортання
сайдбару. Тобто хаби — це кілька контейнер-екранів, а не реструктуризація сайдбару.

**Бекенд-межа (НЕ будуємо екрани без API):** ✅ є — billing/projects/finance/margin/payouts/
services/wallet/loyalty/referral/orders/chat/files/requisites(read). ❌ нема — documents/PDF,
secrets-vault, inbox/notifications, support, board/tasks, leads, calendar, integrations, audit,
testimonials, cases, reports-subtabs, order-create(POST). Ці екрани — за S6–S13, НЕ зараз.

---

## Фази

### Phase 1 — Shell / IA foundation (наскрізне, найвищий важіль)

Net-new React-компоненти над уже-портованим CSS:

- [x] **F1 Cmd-K палітра** ✅ (`a07eb12`) — `packages/ui/CommandPalette` + ⌘K у обох AppLayout +
      реєстр з nav + keyboard-nav. Бонус: theme-toggle у portal-топбар.
- [x] **F2 Sidebar footer user-menu** (workspace) ✅ — `components/SidebarUserMenu` (`.wfp-sb-user--menu` + `.wfp-sb-rolemenu` попап зі scrim): Профіль / Налаштування(owner) / Вийти. БЕЗ role-switch
      (hard RBAC server-side). Заміна голого logout-кнопки.
- [~] **F3 View-as banner** — ⏸️ **ВІДКЛАДЕНО**: погано лягає на hard-RBAC (роль із JWT, не клієнтський
  override; справжня імперсонація = SaaS SA-1, не зараз). Косметичний прев'ю-режим низькоцінний для
  тесту + плутає (роути все одно enforced server-side). Повернутись із SA-1/SaaS.
- [~] **F4 Bell dropdown** — ⏸️ **BACKEND-BLOCKED** (нотифікацій-feed нема → S6). Bell-кнопка вже є (no-op).
- [~] **F5 Company switcher (portal)** — ⏸️ відкладено (1 компанія/клієнт у тесті, multi-company = SaaS-фаза). Low.
- [x] **F6 Mobile drawer** ✅ — `AppShell` сам керує `mobileOpen` (контекст→`Topbar` бургер `.wfp-tb-burger`,
      scrim `.wfp-sb-scrim`, `data-mobile-open`, nav-close через display:contents-wrapper). Обидва апи
      автоматично (без wiring). CSS responsive ≤900px уже був.
- [~] **F7 Sidebar `muted` group flag** — N/A: у нашій наві всі групи = наявні екрани, muted-груп нема.

### Phase 2 — Workspace screens (бекенд ✅, найбільший візуальний дельта)

- [x] **W-fin /finance** ✅ — 3 таби (Огляд/Витрати/P&L): Огляд = KPI + **donut витрат** + **LineChart
      тренд 6 міс** (3 серії, `useMonthlyPnl` через useQueries); P&L = місячна таблиця. Нові
      `components/LineChart` + `lib/expenseCategories` (спільні кольори з дашборд-donut). Маржа — окремий /margin.
- [x] **W-margin /margin** ✅ — toggle За клієнтами/За проєктами (один набір `useAllClientMargins`
      через useQueries — client-margin уже несе projects) + stats (дохід/маржа%/оплачено/збиткових) +
      сортування за маржею + totals-row + loss-підсвітка. (Виконавці/overhead — дані не покривають, відкладено.)
- [x] **W-billing /billing** ✅ — хаб-таби **Рахунки / Платежі / Дебітори** (Tabs) над stats-стрічкою:
      Рахунки = погодження(pending/all)+release; Платежі = `useWsPayments` історія; Дебітори = повний
      список боргів. (Виплати/Сервіси/Гаманці лишаються окремими nav-екранами — не дублюємо.)
- [~] **W-svc /services** — ✅ feasible-частина: stats-стрічка (усього/активних/абонентських) + пошук.
  ⚠️ **two-axis економіка / makes-task / category/type — BACKEND-BLOCKED** (Service-модель має лише
  name/desc/price/hours/recurring; cost/billMode/category/makesTask-полів нема → потребує schema-зміни,
  окреме рішення власника, НЕ будуємо масковані поля).
- [x] **W-proj /projects** ✅ — status-pills (Усі/Активні/Неактивні) + лічильник + **ProjectCreateWizard**
      (4 кроки: Клієнт→Модель і гроші→Цикл і погодження→Огляд, з stepper + per-step валідація + review).
      Edit лишається single-form ProjectModal. (Scope/services-крок + contract — потребують
      estimate-line/document-UI, відкладено; колонки model/cycle/approval/rate уже в рядку.)
- [x] **W-orders /orders** ✅ — stats-strip (всього/в роботі/прострочено/не призначені) + фільтри
      (статус/клієнт/виконавець, server-side via useOrders) + **bulk-select + bulk-assign** (`useBulkAssign`
      fan-out PATCH /assign) + SLA-badge «прострочено» у таблиці. (Bulk change-status/export — далі;
      per-row assignee не показуємо — WorkspaceOrder DTO без assigneeId.)
- [ ] **W-proj360 /projects/:id** → новий (Project-360: KPI-hero + таби Overview/Team/Billing/Orders/Tasks/Finance). Partial backend.

### Phase 3 — Portal screens (бекенд ✅)

- [x] **P-bill /billing** ✅ — copy-to-clipboard на реквізитах (IBAN/Отримувач/USDT) у Req-компоненті (⧉→✓).
- [x] **P-loy /loyalty** ✅ — progress-meter (totalPaid→наступний тір, бар + «ще $X до…») + VIP-max-нота +
      3 rule-cards «як працює». (spending-chart — потребує history API, відкладено.)
- [x] **P-ref /referrals** ✅ — кнопка «копіювати посилання» (`/register?ref=код`) + 3-step how-it-works
      (StepCard). (masked-email/status — DTO referral не несе email/status, відкладено.)
- [ ] **P-set /settings** → sub-nav (Profile/Security/Notifications) — частина секцій backend-blocked.
- [ ] **P-order-detail /orders/:id** → approval-banner з кнопками Погодити/Запросити-правки (потребує order-approval API).

### Backend-blocked (НЕ чіпаємо до відповідних спринтів S6–S13)

documents/signing · secrets-vault · inbox/notify-feed · support · board/tasks · leads · calendar ·
integrations · audit · testimonials · cases · reports-subtabs · order-create(POST) · /company-requisites-write.

---

## Порядок виконання (рекомендований)

F1 (cmd-K) → F2/F3 (role-menu+view-as) → **W-fin** (де власник зараз дивиться) → W-margin → W-billing-hub →
P-bill → W-svc → W-proj(+wizard) → W-orders → решта. F4-F7 — по ходу. Бекенд-blocked — окремий трек за планом.

## Принципи

- Тільки `--wf-*` токени + `.wfp-*` класи (нічого хардкод-hex поза палітрою чартів).
- Кожен крок: type-check/lint/build **+ повний `pnpm test`** (урок CI — types-тест!) → коміт+пуш.
- Фронт-тести не пишемо (процес-правило); верифікація — гейт + ручний огляд власника після фази.
- НЕ будувати екрани без бекенду (масковані дані приховують баги).
