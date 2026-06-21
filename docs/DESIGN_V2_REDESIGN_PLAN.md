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

- [ ] **F1 Cmd-K палітра** (`⌘K`/`Ctrl+K`) — overlay + global hotkey + реєстр (навігація по екранах +
      швидкі дії) + keyboard-nav (↑↓↵, esc). CSS `.wfp-cmdk*` готовий. Обидва апи.
- [ ] **F2 Sidebar footer role-menu** (workspace) — user-card `.wfp-sb-user--menu` → меню owner/manager/
      executor (+описи) + «Дивитись як клієнт». Зараз — голий logout-кнопка.
- [ ] **F3 View-as banner** — sticky warning-банер над топбаром (read-only прев'ю ролі) + `AppShell`
      props `viewAs/onExitViewAs`. CSS `.wfp-viewas*` готовий.
- [ ] **F4 Bell dropdown** — ⚠️ нотифікації backend-blocked → відкласти або порожній стан.
- [ ] **F5 Company switcher (portal)** — footer `.wfp-sb-company` → popover компаній. (1 компанія в тесті → low.)
- [ ] **F6 Mobile drawer** — `sbOpen`+scrim+burger у `AppShell`/`Topbar` (responsive).
- [ ] **F7 Sidebar `muted` group flag** — `{group, muted}` → `.wfp-sb-group--muted`.

### Phase 2 — Workspace screens (бекенд ✅, найбільший візуальний дельта)

- [ ] **W-fin /finance** → 4 таби (Огляд/Витрати/Маржа/P&L) + **donut витрат** (reuse `components/Donut`) +
      **лінійний P&L-чарт** (3 серії × 6 міс — 6 monthly pnl-запитів) + **місячна P&L-таблиця**.
- [ ] **W-margin /margin** → group-by toggle (клієнти/проєкти/виконавці) + sort + totals-row + overhead-кол.
- [ ] **W-billing /billing** → 6-tab хаб (Рахунки/Платежі/Дебітори/Виплати/Сервіси/Гаманці) над наявними сторінками.
- [ ] **W-svc /services** → ServiceEditModal з two-axis економікою (cost×bill mode) + makes-task + category/type + live-margin.
- [ ] **W-proj /projects** → status-pills + колонки (model/cycle/margin/entity) + **ProjectCreateWizard** (multi-step: client→model→money→scope/services→cycle/contract→review).
- [ ] **W-orders /orders** → stats-strip + фільтри (status/client/executor) + bulk-select (assign/status/export) + SLA-кол.
- [ ] **W-proj360 /projects/:id** → новий (Project-360: KPI-hero + таби Overview/Team/Billing/Orders/Tasks/Finance). Partial backend.

### Phase 3 — Portal screens (бекенд ✅)

- [ ] **P-bill /billing** → copy-to-clipboard на реквізитах (IBAN/EDRPOU/USDT) + Recurring-таб.
- [ ] **P-loy /loyalty** → progress-meter + «як заробити» rule-cards (spending-chart — потребує history API, відкласти).
- [ ] **P-ref /referrals** → share-кнопки + 3-step how-it-works + masked-email/status/date колонки.
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
