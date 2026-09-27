# 🔐 PERMISSIONS — права доступу агенції (PERM, з 27.09.2026)

> Рішення власника 27.09.2026: «зробити права доступу — щоб можна було надавати права різним
> ролям і людям; пройтися по всіх роутах і можливостях». Замінює ad-hoc перевірки ролей
> (`isInternalTeam`/`isAgencyManager`/`requireOwnerAgency`/`can()`) єдиною системою прав.
> Канон каталогу — `packages/types/src/permissions.ts`. Інвентаризація — 3 агенти, 349 роутів.

## 1. Модель

- **Право** — ключ каталогу (`orders.accept`, `billing.view`, …), 45 шт., згруповані в області.
- **Рівні:** `none` · `own` (лише призначене/своє) · `team` (свій підрозділ) · `all`. Кожне
  право оголошує, які рівні має сенс (`BIN` none/all, `TEAMED`, `OWNED`, `SCOPED`).
- **Ролі матриці:** `manager` · `lead` (executor, що є `Team.leadId`) · `executor`.
  `owner` — завжди `all` на все, не редагується (не можна заблокувати власника).
- **Резолюція:** персональне право людини → рядок матриці агенції → дефолт ролі (каталог) → `none`.
- **Зберігання:** у БД лише відхилення від дефолтів — `agency_role_permissions`,
  `agency_member_permissions` (міграція `20260725_permissions`, RLS tenant_isolation).
- **Керування правами** — лише власник (НЕ право каталогу — інакше самопідвищення).
  API: `GET /workspace/permissions`, `PUT /workspace/permissions/roles/:role`,
  `PUT /workspace/permissions/members/:profileId` (`level: null` — скинути). Audit на кожну зміну.
- **Бекенд:** `requirePermission(request, key, min?)` (`apps/api/src/auth/permissions.ts`) —
  резолв на запит, кеш 30 с (відкликання діє швидко, не чекає спливу JWT); `invalidatePermissions`
  при зміні матриці/людини/тімліда/підрозділу. Юніт-тести — `tests/setup/permissionStore.mock.ts`.
- **Фронт:** `/auth/me` → `permissions` (ключ → рівень) + `permissionRole`. Меню/маршрути/кнопки
  гейтяться правами; бек однаково перевіряє кожен роут.
- **Секрети (vault):** поза матрицею — власник бачить усе, решта лише персонально розшарене
  (17-SHARE, з терміном і журналом); менеджер — ні (канон модуля 17).
- **Портал (клієнт):** окрема вісь — `CompanyMember.permissions` (`can_view_billing`,
  `can_approve_estimates`, `can_invite_members`), керує власник компанії (PORTAL-MEMBER).

## 2. Дефолти (рішення власника 27.09)

| Роль     | Суть                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| manager  | Веде замовлення, клієнтів, лідів, команду (інвайти, підрозділи, KPI, відсутності). БЕЗ фінансів. |
| lead     | Як виконавець + приймає роботу, призначає, бачить KPI/час СВОГО підрозділу, налаштовує дошку.    |
| executor | Своя робота: призначені замовлення/чати, задачі, час, здача. Без фінансів/видалень/інвайтів.     |

Усе фінансове (рахунки, платежі, P&L, виплати, фін-проєкти, юр-особи, каталоги з цінами) — лише
власник за замовчуванням; видається вибірково (напр. бухгалтеру — `billing.*` персонально).

## 3. Знахідки інвентаризації (що система закриває)

### 🔴 Критичні (виконавець має доступ до грошей — патерн `!isInternalTeam || isAgencyManager` + `can()` пропускає executor на `payment.*`/`invoice.*`/`order.*`)

- Запис грошей: `POST /workspace/billing/payments`, `…/payments/:id/allocate`,
  `POST /workspace/billing/charges/:id/approval` (випуск чернеток + контр-сума),
  `POST /workspace/billing/charges/generate`, `POST /workspace/projects/:id/close-cycle`.
- Ціни: `PATCH /orders/:id` (billing-поля), `PUT /orders/:orderId/estimate`,
  `POST …/submit-approval`, `POST/PATCH/DELETE /workspace/services`, estimate-lines проєктів,
  `POST/PATCH/DELETE /workspace/projects` (ставки, approver).
- Юр/банк: усі `…/legal-entities` (IBAN агенції), `GET/PATCH /workspace/clients/:id/requisites`.
- Читання грошей: billing overview/charges/payments, admin-wallets + statement, loyalty
  `lifetimePaidUsd`, client activity (суми оплат), monthly-report PDF, рахунки/PDF замовлень,
  `GET /orders/:id` (ціни, `payableHours` усіх), payment settings, referral settings.
- Рахунки: `POST /orders/:orderId/documents` (invoice), send, public-link — будь-хто з команди.

### 🟠 Безпека/тенантність

- `POST /orders` — міжтенантний запис: не перевіряє, що `activeCompanyId` належить `activeAgencyId`.
- `GET /workspace/nomenclature` — без фільтра `agencyId` (при вимкненому RLS — каталоги всіх
  агенцій) і доступний клієнтам.
- `createExecutorInvite` supersede `updateMany` без `agencyId` — скасовує інвайти інших агенцій.
- Застарілий `Team.leadId` після переведення ліда в інший підрозділ (зберігає права на колонки).
- Клієнт бачить не надіслані (лише сформовані) документи замовлення + PDF.
- `/public/documents/:token` — токен без строку дії, статус документа не перевіряється.
- CMS/testimonials — платформні рядки, редагує власник будь-якої агенції (S14 platform-admin).

### 🟡 Менеджер заблокований там, де веде роботу

`GET /workspace/companies` (реєстр клієнтів, вибір компанії), client members/activity,
керування учасниками клієнта, контракти/документи клієнта, lead-stages, кошик замовлень,
не-фінансові звіти (hours/SLA/departments/timesheet), власні виплати, інвайти команди.

### ⚪ Дрібне

Leave reject без self-check · `status` у leave-списку без валідації · KPI віддає `revenueUsd`
менеджеру · лід не реалізований ніде, крім колонок дошки · `assigneeId` лідів не валідується ·
executor бачить усі чати агенції · `DELETE /files/:id` будь-який файл · задачі — hard-delete.

## 4. Мапа роутів → права (скорочено; повні таблиці — звіти агентів у сесії 27.09)

| Область       | Роути (файли)                                                                                                                         | Право(а)                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Фінанси       | billing/overview, charges (GET), listPayments, adminWallet (GET), statement                                                           | `billing.view`                                                    |
|               | createPayment, allocatePayment, chargeApproval, generateCharges, reversals, charge discount, wallet adjust, loyalty override, dunning | `billing.manage`                                                  |
|               | orderDocuments (invoice/advance/reconciliation), publicInvoice                                                                        | `billing.manage` (генерація/надсилання), `billing.view` (читання) |
|               | billing/projects (GET) · (write, close-cycle)                                                                                         | `projects.view` (суми з `billing.view`) · `projects.manage`       |
|               | finance/expenses (GET · write), margin, reports revenue/mom/retention/pnl                                                             | `finance.view` · `finance.manage`                                 |
|               | team/payouts (усі · approve/generate/mark-paid), rates (write)                                                                        | `payouts.view_team` · `payouts.manage`; свої — self               |
| Замовлення    | listOrders/getOrder (+ маска цін без `orders.estimate`/`billing.view`)                                                                | `orders.view`                                                     |
|               | createWorkspaceOrder, templates (from-template)                                                                                       | `orders.create`                                                   |
|               | updateOrder (не-цінові), dependencies, tags (assign), files DELETE (чужі)                                                             | `orders.edit`                                                     |
|               | updateOrder (ціни), estimate, submitOrderApproval                                                                                     | `orders.estimate`                                                 |
|               | assignOrder, coAssignees, chat-owner                                                                                                  | `orders.assign`                                                   |
|               | transitionOrderStatus (триаж/пауза/скасування · робочі · приймання)                                                                   | `orders.status` · `orders.work` · `orders.accept`                 |
|               | reconciliation (billable · payable)                                                                                                   | `orders.reconcile` · `payouts.manage`                             |
|               | deleteOrder, restoreOrder, deleted-list                                                                                               | `orders.delete`                                                   |
|               | comments/conversations/chats unanswered · comment edit/delete чужих                                                                   | `chats.view` · `chats.moderate`                                   |
| Задачі й час  | internalTasks (create/patch · delete), coAssignees задач                                                                              | `tasks.manage` · `tasks.delete`                                   |
|               | teams columns                                                                                                                         | `boards.configure`                                                |
|               | timeLogs (чужі), reports timesheet                                                                                                    | `time.edit_others` · `time.view_team`                             |
| Клієнти       | listCompanies (без loyalty/currency), clientActivity (суми — `billing.view`), client members (GET)                                    | `clients.view`                                                    |
|               | client members invite/reset/role/delete, company approval mode, createMemberInvite (агентство)                                        | `clients.manage`                                                  |
|               | requisites (workspace)                                                                                                                | `clients.requisites`                                              |
|               | leads, lead-stages                                                                                                                    | `leads.manage`                                                    |
|               | contracts, companyDocuments (clients/:id/documents, /documents/:id/file), acts/specs                                                  | `documents.manage`                                                |
|               | vault (reveal/list · manage/shares/audit)                                                                                             | `vault.access` · власник (vault.manage не видається)              |
|               | workspace tickets PATCH                                                                                                               | `support.handle`                                                  |
| Команда       | createExecutorInvite (+ list/resend/cancel)                                                                                           | `team.invite`                                                     |
|               | teams CRUD, member→team, capacity                                                                                                     | `team.departments`                                                |
|               | executorKpi (+ `revenueUsd` лише з `finance.view`)                                                                                    | `team.kpi`                                                        |
|               | leave approve/reject (+ список усіх)                                                                                                  | `leave.approve`                                                   |
|               | calendar events PATCH/cancel чужих                                                                                                    | `calendar.manage`                                                 |
|               | executors/:id/role, керування правами                                                                                                 | лише власник (не в каталозі)                                      |
| Агенція       | reports hours/sla/departments                                                                                                         | `reports.ops`                                                     |
|               | reports audit                                                                                                                         | `reports.audit`                                                   |
|               | content (cms, testimonials)                                                                                                           | `content.manage` (+ S14: platform-admin)                          |
|               | announcements · broadcasts                                                                                                            | `announcements.manage` · `broadcasts.manage`                      |
|               | services write, nomenclature write, order-tags/templates write, SLA                                                                   | `settings.catalogs` (SLA — `settings.manage`)                     |
|               | legal-entities, payment settings                                                                                                      | `settings.legal`                                                  |
|               | workflow/report/email/doc templates/pdf-branding/smtp/crons/security/referral settings                                                | `settings.manage`                                                 |
| Self / public | auth/_, profile/_, notifications/\*, telegram, timer/свої логи, leave свої, rates/payouts свої, public docs/blog/contact              | без права (self/public)                                           |

## 5. План зрізів

1. **PERM-1** ✅ фундамент: каталог + дефолти, таблиці + RLS, резолвер + кеш, `/auth/me`,
   API керування (owner-only), тести.
2. **PERM-2** ✅ (27.09) фінанси й юр-дані (усі 🔴) + тенант-фікси `POST /orders`/nomenclature/invites;
   `team.invite` (менеджер може, виконавець ні); менеджер отримав реєстр клієнтів (без тіру/валюти);
   маски сум (проєкти, послуги, лояльність, активність клієнта, виручка лідів, специфікація);
   клієнт бачить лише надіслані документи; регресійна матриця `tests/permGates.test.ts`.
3. **PERM-3** ✅ (27.09) команда: виплати/ставки (свої — кожному, чужі — `payouts.view_team`, запис —
   `payouts.manage`), KPI (`team.kpi`: тімлід — свій підрозділ; виручка — `finance.view`), підрозділи/
   ємність (`team.departments`), колонки дошки (`boards.configure`), відсутності (`leave.approve`,
   self-check і для відхилення, валідація статусу), **приймання тімлідом** (`orders.accept`=team:
   проєкт підрозділу або виконавець у ньому), звірка (`orders.reconcile` + `payouts.manage` для
   годин до виплати), керівні переходи статусу — `orders.status`; `GET /orders/:id` → `viewerCan`.
4. **PERM-4** ✅ (27.09) — див. ROADMAP.
5. **PERM-5** ✅ (27.09) налаштування агенції/шаблони/SMTP/крони — `settings.manage`; режим погодження
   клієнта — `clients.manage`; контент — `content.manage`; оголошення/розсилки — свої права;
   політика безпеки (2FA) і ролі людей — лише власник; секрети — поза матрицею (шари).
6. **PERM-6** ✅ (27.09) фронт: меню (`perm` у nav) і маршрути (`PermRoute`) за правами; вкладки
   «Звіти»/«Налаштування»/картки клієнта 360° за правами; кнопки дій (створити/кошик/масове
   призначення/документи/теги/залежності/виконавці) за `can()`; **«Команда → Права доступу»** —
   матриця ролей (дефолт / змінено / ↺) + «Люди» (персональні права поверх ролі), лише власник.
