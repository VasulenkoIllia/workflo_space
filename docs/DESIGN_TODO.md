# WORKFLO.SPACE — Дизайн: список на допрацювання (handoff дизайнеру)

> **Призначення:** цей файл передається дизайнеру. Тут — тільки те, **чого бракує в дизайні** і що треба домалювати.
> Аналіз «що вже є» + статус коду — в [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). Код-задачі сюди не пишемо.
> Версія: 2.0 · Round 3 active · 2026-05-29

---

## Як працює цикл (покроково)

1. **Фіксуємо** цей список (нижче) — після аналізу готового дизайну.
2. **Передаю** файл дизайнеру на допрацювання.
3. Дизайнер малює **у нашій візуальній мові** (див. «Рамки стилю» нижче) — бажано тим самим інструментом (Claude Design), щоб лягло в спільну систему.
4. **Повертаєш мені новий дизайн** (бандл / посилання).
5. Я **звіряю** кожен пункт за [`DESIGN_SYSTEM.md §5`](DESIGN_SYSTEM.md), оновлюю статуси (◑/❌ → ✅) і відмічаю тут «✅ готово».
6. Що неповне — лишається на наступну ітерацію. Так крок за кроком, поки §5 не стане без дизайн-гапів — тоді код і план на одному рівні з дизайном.

---

## Статус-трекер

| #         | Пакет                                                                                       | Раунд  | Статус                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1        | Email-шаблони (5 → у дизайні 15)                                                            | r1→r2  | ✅ готово (overshoot: 15 листів)                                                                                                                                         |
| G2        | Лендинг: Blog                                                                               | r1→r2  | ✅ готово                                                                                                                                                                |
| G3        | Лендинг: Pricing + Legal (+ bonus cookies)                                                  | r1→r2  | ✅ готово                                                                                                                                                                |
| G4        | Workspace: Blog/Cases + Credentials                                                         | r1→r2  | ✅ готово                                                                                                                                                                |
| —         | _Bonus від дизайнера (r2)_                                                                  | r2     | ✅ зараховано: onboarding 5-step, services-admin, billing-services, marketing/about/contact/services/cases-detail, notification center, toast system, avatars, error-500 |
| **G5**    | Admin Settings (templates / SMTP / branding / nomenclature / cron monitor)                  | **r3** | ⬜ не передано                                                                                                                                                           |
| **G6**    | System Monitoring dashboard                                                                 | **r3** | ⬜ не передано                                                                                                                                                           |
| **G7**    | Calendar / Meetings                                                                         | **r3** | ⬜ не передано                                                                                                                                                           |
| **G8**    | Client Wallet (Portal + admin + statement + referral settings)                              | **r3** | ⬜ не передано                                                                                                                                                           |
| **G9**    | Finance / Expenses (P&L + ledger + chart)                                                   | **r3** | ⬜ не передано                                                                                                                                                           |
| **G10**   | Leave Tracking (request + approval + calendar)                                              | **r3** | ⬜ не передано                                                                                                                                                           |
| **M1–M5** | Мінорні рефайменти (OAuth, tags/SLA/deps, chat-edit/reactions, revenue chart, chat-hub SSE) | **r3** | ⬜ не передано                                                                                                                                                           |

(Легенда: ⬜ не передано · 📤 передано дизайнеру · ⏳ в роботі · 🔁 повернулось, на звірці · ✅ готово)

---

## Історія раундів

- **R1 (2026-05-29):** передано G1–G4 (emails / blog / pricing+legal / workspace blog-cases+credentials).
- **R2 (2026-05-29):** повернувся новий бандл — **усе G1–G4 ✅** + bonus 15+ нових екранів. Документація паралельно виросла до 25 модулів → нові гапи G5–G10.
- **R3 (active):** передається цей файл — G5–G10 (модулі 17/20-25) + M1–M5 (мінори).

---

## Рамки стилю (обовʼязково для всіх пунктів)

Тримайся зафіксованої візуальної мови (повні токени — [`DESIGN_SYSTEM.md §3`](DESIGN_SYSTEM.md) / [`design/project/styles.css`](../design/project/styles.css)):

- **Акцент:** лайм `--wf-accent` `#A3D90D` (light) / `#C5F82A` (dark). Через CSS-змінні, не хардкод.
- **Нейтралі:** теплі stone — bg `#FAFAF9`, surface `#FFFFFF`, border `#E7E5E4`, текст `#0C0A09`.
- **Шрифти:** Geist (body) · JetBrains Mono (числа/коди/реквізити) · Caveat (підписи в документах).
- **Естетика:** «Engineer's Cut» — термінал (режим A — `[ ... ]`-кнопки, `// group`-лейбли, traffic-dots вікно). Light + Dark.
- **Локалі:** UA + EN.
- **Орієнтир:** brandbook + ws-admin / workspace-screens (для нових admin/internal екранів) у бандлі [`design/project/`](../design/project/).

---

## R1–R2 деталі (вже зроблено — для довідки)

<details>
<summary>G1 · Email-шаблони — ✅ (overshoot 5→15)</summary>

Дизайн повернувся з **15 листами** ([`design/project/email-templates.jsx`](../design/project/email-templates.jsx)): 5 transactional (invite/order-received/invoice/payment-ok/deadline) + 6 auth (verify/reset/changed/new-login/2FA/email-change) + 4 system (team-invite/mention/doc-ready/digest). У коді покрито 4 шаблони (welcome/inviteExecutor/inviteCompanyMember/passwordReset) — **код-TODO: додати 11 нових шаблонів і переписати inline-CSS під токени §3.**

</details>

<details>
<summary>G2 · Лендинг Blog — ✅</summary>

`/blog` (список + empty стан для тегу без статей) + `/blog/:slug` (TOC, long-read) + адаптив phone-375. Файл: [`design/project/landing-blog.jsx`](../design/project/landing-blog.jsx).

</details>

<details>
<summary>G3 · Лендинг Pricing + Legal — ✅ (+bonus cookies)</summary>

`/pricing` (тарифи + порівняння + FAQ + phone), `/terms`, `/privacy`, **`/legal/cookies`** (bonus). Спільний `LegalPage`-шаблон з TOC і нумерованими секціями. Файл: [`design/project/landing-pricing.jsx`](../design/project/landing-pricing.jsx).

</details>

<details>
<summary>G4 · Workspace Blog/Cases + Credentials — ✅</summary>

- `/vault` — сейф доступів (38 секретів × 6 клієнтів; reveal/edit/revoke; журнал; AES-256; zero-knowledge). [`workspace-screens.jsx`](../design/project/workspace-screens.jsx) (WorkspaceVault).
- `/blog` (list + split-editor markdown ↔ live preview) + `/cases` (картки результатів). [`workspace-content.jsx`](../design/project/workspace-content.jsx).
</details>

---

# Round 3 · нові гапи (G5–G10) + мінорі (M1–M5)

Усі — з 10 нових модулів документації (16-25) і нових фіч у модулях 01-15.

---

## G5 · Admin Settings (module 20)

**Контекст:** owner-керування системними налаштуваннями: шаблони листів, SMTP-відправники, брендинг PDF, номенклатура послуг, моніторинг крон-задач. Per-agency (ADR-004) — все scoped до агенції.

**Намалювати (естетика A · terminal; reference: `workspace-admin.jsx`):**

- **`/admin/templates`** — список email-шаблонів (event × channel × locale).
  - Editor-модал: textarea з підсвіткою `{{variables}}`, preview pane праворуч (рендер реального HTML), кнопки `[ Send test ]` / `[ Restore default ]` / `[ Save ]`.
  - Стани: list / edit / saving / error / preview-empty.
- **`/admin/smtp`** — картки відправників (status pill OK/FAIL/UNTESTED, last-test-at, кнопка `[ test ]`).
  - Edit-модал: host/port/encryption/user/password (з toggle reveal), envelope-from, reply-to. Кнопка `[ Test connection ]` з inline-результатом.
  - Tab "Mapping": який event-type yields який sender (table з dropdown'ами).
  - Стани: list / edit / testing / success / fail.
- **`/admin/branding`** — PDF-брендинг для документів.
  - Logo uploader (drag-drop + preview), color picker (accent), font dropdown (Geist / Inter / Roboto), wordmark style.
  - Live PDF preview iframe праворуч (показує invoice-приклад з застосованим брендингом).
  - Стани: default / dirty (unsaved) / saving.
- **`/admin/nomenclature`** — каталог послуг (внутрішня номенклатура — не плутати з публічним `/services-admin`).
  - CRUD-таблиця: code (NOM-001) / name / category / unit / price / active. Inline edit, bulk import CSV.
  - Стани: list / empty / create-row / import-modal / confirm-delete.
- **`/admin/crons`** — моніторинг крон-задач (доповнює G6 system-monitoring).
  - Таблиця: name / schedule (cron expr) / last-run / status (success/failed/skipped/running) / duration / next-run.
  - Кнопки per-row: `[ run now ]` / `[ pause ]` / `[ history ]`.
  - Drill-in модал: історія запусків (last 30), графік durations, error-traces.
  - Стани: live / refreshing / cron-stuck-in-running (red border) / empty (no runs yet).

**Готово коли:** усі 5 розділів + модалі + state-варіанти, єдина естетика A.

---

## G6 · System Monitoring dashboard (module 21)

**Контекст:** owner-only оперативний дашборд здоров'я системи.

**Намалювати:**

- **`/admin/system`** — один екран, 5 секцій (вертикально):
  1. **Health cards grid** (4-6 карток): uptime %, active users (last 5 min), DB pool usage, pending cron count, current deploy commit (з link на GitHub), Sentry events last hour.
  2. **Cron status heatmap** — таблиця 7 днів × всі crons; кольорові клітинки (green/red/gray), click → modal з логом запуску.
  3. **Notification health** — per-channel success rate (email/telegram/push/sms), blocked list (тих, кого Telegram заблокував), кнопка `[ retry failed ]`.
  4. **Audit log feed** — стрім останніх дій (live tail), фільтр за action-type (credentials.reveal / company.transfer / admin.\*), click row → modal з metadata.
  5. **Error log** — топ Sentry issues (title / count / last-seen / link to Sentry), кнопки `[ resolve ]` / `[ ignore ]`.
  6. (Phase 2) **DB metrics** — slow queries top-10, connection count, cache hit ratio.

**Стани:** live / loading / partial-failure (одна з секцій впала) / no-data per section.
**Компоненти:** health card з status-індикатором (✓ green, ! amber, ✗ red), кольорова cron-cell, audit row з actor-avatar + action badge.

**Reference стилю:** workspace internal density (як `/reports/audit` + `ws-billing-overview`).

---

## G7 · Calendar / Meetings (module 24)

**Контекст:** внутрішні + клієнтські зустрічі, RSVP, read-only проекції дедлайнів і відпусток. Найбільший пакет.

**Намалювати:**

- **`/calendar`** — основний екран, 3 view-режими (month / week / day):
  - Month: класична сітка 7×N, події як пігулки (час + title + кольорова смужка типу), max-stack 3 + "+N more".
  - Week: 24h × 7 col, події як блоки з висотою = тривалість, overlap-handling.
  - Day: вертикальна шкала годин, події як cards, sidebar з details обраної.
  - Toggle view вгорі, today/prev/next nav.
- **Create event modal** — title / description / type (internal/client/availability) / start/end (datepicker + timepicker) / timezone (IANA dropdown) / location / meeting URL (Zoom/Meet) / attendees (multi-select internal + free-text email) / reminders (1h, 1d before) / recurrence (Phase 2).
- **Edit event modal** — той самий form + delete + дублювати.
- **RSVP modal** — для запрошених: yes/no/maybe + comment + add to my calendar (.ics download).
- **`/calendar/view?from=&to=`** — aggregated read-only: events + order deadlines (з kanban) + approved leaves (G10). Color-coded.
- **Mobile calendar** (Portal) — month-only view + bottom-sheet event detail; tap "+" → create form sheet.
- **Empty state** — "поки що порожньо · click + щоб створити" + ASCII-кіт.

**Стани:** filled / empty / loading skeleton / RSVP-pending highlight / conflict warning (overlapping events).
**Компоненти:** calendar grid (3 variants), event card / pill / block, attendee selector (з avatar + status), timezone picker, meeting URL з валідацією, reminder pill-group.

**Reference:** workspace естетика A, але з кольоровою системою для типів подій.

---

## G8 · Client Wallet (module 25)

**Контекст:** клієнтський фінансовий рахунок — bonus balance (з referral/manual) + money balance (AR: invoices vs payments). Statement combining both. Owner-керування тірами реферала.

**Намалювати:**

- **Portal: `/wallet`** — dual balance hero (bonus $X, money $Y з підписом owes/prepaid + amount), кнопки `[ withdraw / apply ]` (Phase 2).
  - Tabs: Transactions (default) / Statement (unified) / Rules.
- **Portal: `/wallet/transactions`** — ledger таблиця (date / kind icon / title / amount / running balance / allocation). Filter chips (all / bonus / money / referral / manual).
- **Portal: `/wallet` statement** — unified timeline: charges (red), payments (green), bonuses (blue/lime), allocations (стрілки "цей платіж покрив ці інвойси").
- **Workspace: `/admin/wallet/companies`** — список усіх компаній (name / tier / bonus-balance / money-balance / last-transaction). Sort by balance, search.
- **Workspace: `/admin/wallet/companies/:id`** — full ledger per company + actions (manual adjustment, refund initiate, write-off).
- **Modal: Manual adjustment** — type (credit / debit), amount, **required** note (audit), preview new balance.
- **Workspace: `/admin/referral/settings`** — таблиця тірів (minEarned / percent → bonus%), enabled toggle, edit-modal з live formula preview ("$1000 → 5% → $50 bonus").

**Стани:** filled / empty (нові клієнти) / loading.
**Компоненти:** dual balance card (з статусом owes/prepaid + colour), transaction row з source-icon, allocation badge (показує invoice ↔ payment), tier-row з formula preview, statement timeline (3-color).

**Reference:** estetika A, mono для всіх сум.

---

## G9 · Finance / Expenses (module 22)

**Контекст:** ledger витрат (recurring + one-time), P&L (revenue − expenses), per-client margin (Phase 2). Внутрішнє для owner.

**Намалювати:**

- **`/admin/finance`** overview — 3 cards: income (period), expenses by-category (donut + legend), net profit % + delta.
- **Tab "Витрати"** — table: name / category (icon) / vendor / amount / frequency badge / start-date / linked-entity (company або executor). Inline edit, bulk-delete.
- **Tab "P&L chart"** — 3-series line chart (revenue / expenses / profit), period selector (month/quarter/year), legend toggleable.
- **Modal: Create/Edit expense** — form: type (recurring/one-time) → conditional frequency fields, category dropdown (infrastructure/software/salary/marketing/other), amount + currency, dates (start; for recurring also end-optional), linked company/executor autocomplete, notes textarea.
- **`/reports/pnl`** — табличний звіт: rows per month, columns (revenue / category breakdown / total expenses / profit / margin %). CSV export.

**Стани:** filled / empty (no expenses yet) / loading / period-filter active.
**Компоненти:** expense form (conditional fields), category badge з icon, 3-series line chart, donut chart, linked-entity selector.

**Reference:** workspace естетика A, reuse table-patterns з `/reports/timesheet`.

---

## G10 · Leave Tracking (module 23)

**Контекст:** виконавець подає запит на відпустку → owner приймає/відхиляє → схвалене показується в календарі (G7) + у timesheet/reports.

**Намалювати:**

- **Executor: `/leave`** — мій список запитів + кнопка `[ + Новий запит ]`.
  - Modal "Новий запит": type (vacation / sick / unpaid / personal), start/end (date range picker), reason textarea, attachment optional (medical cert).
  - Стан: pending (yellow) / approved (green) / rejected (red з reason).
- **Owner: `/admin/leave`** — таблиця всіх запитів: executor / type badge / dates / days count / status / actions.
  - Per-row кнопки `[ ✓ approve ]` `[ ✗ reject ]`. Bulk-actions.
  - Filters: pending only / by executor / by type / period.
- **Modal: Reject reason** — required textarea з reason.
- **Calendar integration (G7):** approved leaves як greyed-out date-range блоки в календарі (показує availability команди).
- **Leave balance card (Phase 2):** accrued / used / remaining per type.

**Стани:** filled / empty / pending-highlight / approved-banner.
**Компоненти:** date range picker, leave type badge (vacation=green, sick=orange, unpaid=gray, personal=blue), status badge, calendar event (range-block з grey fill).

**Reference:** workspace естетика A, патерн approval/reject як в `/orders/intake`.

---

## Мінорні рефайменти (M1–M5)

Дрібні UI-елементи, що з'явилися з нових фіч у модулях 01-15. Не блокують код, але добре б домалювати в одному пакеті.

| ID     | Що                             | Деталі                                                                                                                                                                       | Файл-орієнтир                                |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **M1** | Auth OAuth (01-auth)           | Кнопки `[ Continue with Google ]` `[ Continue with GitHub ]` на `/login` (під email-form, з divider "or"). Icon + brand color, але в нашій термінал-стилістиці.              | `portal-auth.jsx`                            |
| **M2** | Orders refinements (02-orders) | Tags input + tag badges на картці замовлення; dependencies UI (this blocks/is blocked by); templates dropdown у `/orders/new` (вибір шаблону → preset поля).                 | `portal-screens.jsx`, `portal-order-new.jsx` |
| **M3** | Chat refinements (03-chat)     | 15-min edit affordance (pencil icon hover); emoji reactions (picker popover + rendered reactions row); reply-to (quoted message block); read-receipts (👁 indicator) у чаті. | `inbox-screens.jsx`, `portal-screens.jsx`    |
| **M4** | Reports: revenue chart (19)    | Окремий `/reports/revenue` — line chart revenue/expenses/profit, period selector, breakdown table. Спільний з G9 chart-компонент.                                            | `workspace-reports.jsx`                      |
| **M5** | Chat hub refinements (18)      | SSE "new message" анімація (slide-in + pulse), mute/archive icon-кнопки у conversation row, унікальний unread badge style (vs sidebar).                                      | `inbox-screens.jsx`                          |

---

## Поза пріоритетом (за бажанням)

- **Workspace · особисті налаштування виконавця** (`/settings/profile`, `/settings/security`, `/settings/notifications`) — ймовірно реюз патернів з порталу (§5.3 у DESIGN_SYSTEM.md). Малювати окремо лише якщо потрібен інший вигляд.
- **Multi-agency switcher** (ADR-004) — якщо в майбутньому користувач буде у >1 агенції, потрібен switcher (схожий на company switcher). Зараз single-agency MVP — не критично.
- **Booking link** (Phase 2 від G7) — публічний `/book/:userSlug` з availability slots.

---

_Коли повернеш новий дизайн (round 3 result) — онови статус-трекер вгорі (⬜→🔁→✅), а я звірю покриття і синхронізую [`DESIGN_SYSTEM.md §5`](DESIGN_SYSTEM.md)._
