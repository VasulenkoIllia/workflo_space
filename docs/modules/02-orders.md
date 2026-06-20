# ORDERS MODULE

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Portal (portal.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`, `packages/storage`
> Оновлено: 1 червня 2026 (doc-sync)

---

> 🔄 **design-v2 (2026-06-20):** доставлено 3 повʼязані модулі — усі 🟢 **бекенд готовий** (звірено): **orders-v2** (крос-ордер реєстр, 9 статусів збігаються з `OrderInternalStatus`), **board** (kanban на `InternalTask` CRUD `/orders/:id/tasks`; фікс-колонки готові, кастомні — gap), **order-chat** (SSE-чат `orders/comments.ts`+`commentsStream.ts`). Файли: [`workspace-orders-v2.jsx`](../../design-v2/project/workspace-orders-v2.jsx), `workspace-board*.jsx`, `order-chat.jsx`. Матриця — [`DESIGN_SYSTEM.md §5.13`](../DESIGN_SYSTEM.md).

## Огляд

Центральний модуль системи. Замовлення (`orders`) — основна бізнес-одиниця: клієнт створює запит → команда виконує роботу → виставляється рахунок → закривається актом. Є два різних «погляди» на замовлення: внутрішній (workspace, 9 статусів) та клієнтський (portal, 4 статуси).

---

## Статусна машина

### Канонічна модель — 9 internal → 4 client

> **Джерело істини — «## S1 alignment update → Status enum: 9 internal → 4 client» нижче** (`INTERNAL_TO_CLIENT_STATUS` у `@workflo/types`) + enum `OrderInternalStatus`/`OrderClientStatus` у схемі. Стисло:
>
> **9 internal:** `new · clarification · estimating · in_progress · on_hold · review · revision · done · cancelled`.
> **4 client:** `in_progress · pending_approval · completed · cancelled`.
> Маппінг — `INTERNAL_TO_CLIENT_STATUS` (зберігається як `Order.clientStatus`, не лише обчислюється).
> Переходи — єдиний `ALLOWED_ORDER_TRANSITIONS` / `canTransitionOrder` над цими 9 станами.
>
> ⚠️ **Застаріла машина видалена** (суперечила реальним enum): станів `in_review`, `approved`, `in_review_final` НЕ існує; клієнтські `pending`/`review` → насправді `pending_approval`. Переходи + reason-поля (on_hold/cancelled) — S1-alignment + «## Аудит-фіналізація A».

---

## Бізнес-логіка

### Пріоритети

| Пріоритет | Значення                       |
| --------- | ------------------------------ |
| `low`     | Не горить                      |
| `medium`  | Стандарт (за замовчуванням)    |
| `high`    | Важливо                        |
| `urgent`  | Критично, спливаюче сповіщення |

### Фінансова логіка

- Біллінг-модель: `billingType('fixed'|'hourly')` + `fixedPrice`/`hourlyRate`/`estimatedHours`; `totalAmount` — **похідна** (не задається вручну як єдине джерело).
- Аванс — платіж типу `advance` в `payments`, прив'язаний до `orderId`.
- `balanceDue = totalAmount − SUM(payments WHERE type IN ('advance','partial') AND status='confirmed')`.
- При закритті (`done`) — фінальний рахунок на `balanceDue`; `balanceDue=0` → повністю оплачено авансом. `Order.paidAt` фіксує повну оплату.

### Soft delete

- `deletedAt` поле. `null` = активне, timestamp = видалене
- Всі запити автоматично фільтрують `WHERE deletedAt IS NULL`
- Видалені замовлення доступні тільки через `GET /orders?includeDeleted=true` (тільки owner)

### Виконавці (Executors)

- **Один виконавець на замовлення** — `Order.assigneeId String?` (НЕ many-to-many `order_executors`, якого в схемі немає).
- Виконавець бачить лише замовлення, де `assigneeId = me`; owner призначає через triage (variant B, див. S1-alignment).
- Зміна призначення → `ActivityLog(action='executor_assigned')`.

### Дедлайн і нагадування

- `deadline` — опціональний дедлайн (поле `deadline`, не `dueDate`).
- Cron `C03` (escalation): щодня — замовлення де `deadline` сьогодні/завтра → нотифікація виконавцю.

---

## API Endpoints

### Portal (клієнт)

| Метод   | URL           | Опис                                                   |
| ------- | ------------- | ------------------------------------------------------ |
| `GET`   | `/orders`     | Список замовлень своєї компанії                        |
| `POST`  | `/orders`     | Створити нове замовлення                               |
| `GET`   | `/orders/:id` | Деталі замовлення (client view)                        |
| `PATCH` | `/orders/:id` | Редагувати (лише ранні статуси: `new`/`clarification`) |

### Workspace (команда)

| Метод    | URL                              | Опис                                               |
| -------- | -------------------------------- | -------------------------------------------------- |
| `GET`    | `/orders`                        | Список всіх замовлень з фільтрами                  |
| `GET`    | `/orders/:id`                    | Деталі замовлення (internal view)                  |
| `PATCH`  | `/orders/:id/status`             | Змінити статус                                     |
| `PATCH`  | `/orders/:id`                    | Редагувати будь-яке поле                           |
| `DELETE` | `/orders/:id`                    | Soft delete                                        |
| `PATCH`  | `/orders/:id/assign`             | Призначити / зняти executor (triage)               |
| `GET`    | `/orders/:orderId/tasks`         | Внутрішні підзадачі (workspace-only)               |
| `POST`   | `/orders/:orderId/tasks`         | Створити підзадачу                                 |
| `PATCH`  | `/orders/:orderId/tasks/:taskId` | Оновити підзадачу (status/assignee/position/title) |
| `DELETE` | `/orders/:orderId/tasks/:taskId` | Видалити підзадачу                                 |

### Query параметри для `GET /orders` (workspace)

```
status=in_progress,on_hold      # 9 internal-станів (не старі approved/in_review_final)
priority=high,urgent
companyId=uuid
assigneeId=uuid                  # (не executorId); assigneeId=none → unassigned (triage, owner-only)
tags=bug,urgent                  # OrderTag (Аудит-фіналізація B)
dateFrom=2026-01-01
dateTo=2026-12-31
search=текст                     # title + description
page=1
limit=20
sortBy=createdAt|deadline|priority   # deadline, не dueDate
sortDir=asc|desc
```

---

## DTO

### `POST /orders` (Portal)

```typescript
{
  title: string           // обов'язково, max 255
  description?: string    // Markdown
  priority?: 'low'|'medium'|'high'|'urgent'  // default: 'medium'
  dueDate?: string        // ISO date
  serviceIds?: string[]   // прив'язка до сервісів (опційно)
}
```

### Response (Portal view)

```typescript
{
  id: string
  title: string
  description: string | null
  clientStatus: 'in_progress' | 'pending_approval' | 'completed' | 'cancelled' // 4 канонічні
  priority: string
  totalAmount: number | null
  balanceDue: number | null
  deadline: string | null // не dueDate
  createdAt: string
  updatedAt: string
}
```

### Response (Workspace view — додаткові поля)

```typescript
{
  // ... всі поля Portal view +
  internalStatus: OrderInternalStatus              // 9 станів
  assignee: { id: string; name: string } | null    // один виконавець (не executors[])
  deletedAt: string | null
  payments: PaymentSummary[]
  company: { id: string; name: string } | null     // companyId nullable (internal_task)
}
```

### `PATCH /orders/:id/status`

```typescript
{
  status: OrderInternalStatus   // перевіряємо ALLOWED_ORDER_TRANSITIONS / canTransitionOrder
  reason?: string               // ОБОВ'ЯЗКОВО для on_hold/cancelled → Order.onHoldReason/cancelledReason
  comment?: string              // запис у ActivityLog
}
```

---

## DB Schema (основні поля)

> **Канонічна модель — `Order` у `packages/db/prisma/schema.prisma`** (стара `Order`/`OrderExecutor` нижче — видалена з doc-sync).
> Ключове: `internalStatus OrderInternalStatus` + `clientStatus OrderClientStatus` (НЕ єдиний `status`); `deadline` (не `dueDate`); **`assigneeId String?`** — один виконавець (НЕ модель `OrderExecutor`); + `agencyId`, `type`, `createdById`, `billingType`/`fixedPrice`/`hourlyRate`/`estimatedHours`, `onHoldReason?`/`cancelledReason?`, `paidAt?`; `companyId` **nullable**. Зв'язані моделі (OrderStage/OrderTag/SlaPolicy/OrderDependency/OrderTemplate/TimeLog) + повний reconcile — «## Аудит-фіналізація» нижче.

---

## Нотифікації при зміні статусу

| Подія                       | Кому                         | Канал            |
| --------------------------- | ---------------------------- | ---------------- |
| Нове замовлення від клієнта | Owner (triage)               | Email + Telegram |
| Статус → `in_progress`      | Company Owner                | Email + Telegram |
| Статус → `review`           | Company Owner (на схвалення) | Email + Telegram |
| Статус → `revision`         | Assignee                     | Telegram         |
| Статус → `done`             | Company Owner                | Email + Telegram |
| Статус → `cancelled`        | Company Owner + Assignee     | Email + Telegram |
| `deadline` = завтра         | Assignee                     | Telegram         |

---

## ActivityLog

Кожна зміна статусу, призначення виконавця, редагування суми — записується в `activity_log`:

```typescript
{
  orderId: orderId               // реальна модель ActivityLog: orderId (не entityType/entityId)
  actorId: profileId
  action: 'status_changed' | 'executor_assigned' | 'amount_updated' | ...
  metadata: { from: 'in_progress', to: 'on_hold', comment: '...' }   // поле `metadata`, не `meta`
}
```

---

## Зв'язки з іншими модулями

| Модуль            | Зв'язок                                             |
| ----------------- | --------------------------------------------------- |
| **Chat**          | Коментарі прив'язані до `orderId`                   |
| **Files**         | Файли прив'язані до `orderId`                       |
| **Billing**       | Платежі прив'язані до `orderId`                     |
| **Documents**     | Рахунки, акти, специфікації прив'язані до `orderId` |
| **Search**        | `tsvector` по `title` + `description`               |
| **Notifications** | Статусні зміни → нотифікації                        |

---

## S1 alignment update (17 квітня 2026 → 27 травня 2026)

### Triage flow (variant B — owner-only)

Коли клієнт створює нове замовлення через portal:

- Order створюється з `internalStatus='new'`, `assigneeId=null`.
- **Тільки owner агенції** бачить unassigned orders у `/workspace/triage`.
- Executors бачать тільки order де `assigneeId = my profileId` (їх назначив owner).
- Owner призначає executor через `PATCH /orders/:id { assigneeId }` + status transition new → clarification/in_progress.

### Status enum: 9 internal → 4 client

Канонічна таблиця у `packages/types/src/constants.ts` → `INTERNAL_TO_CLIENT_STATUS`:

| Internal        | Client             | Owner control                                                       |
| --------------- | ------------------ | ------------------------------------------------------------------- |
| `new`           | `in_progress`      | Triage queue                                                        |
| `clarification` | `in_progress`      | Awaiting client info                                                |
| `estimating`    | `in_progress`      | Executor оцінює (раніше `estimated`, перейменовано в S1-03)         |
| `in_progress`   | `in_progress`      | Active work                                                         |
| `on_hold`       | `in_progress`      | Paused, з reason                                                    |
| `review`        | `pending_approval` | Owner перевіряє → схвалює done                                      |
| `revision`      | `in_progress`      | Owner повернув на доробку (тільки owner може зробити done→revision) |
| `done`          | `completed`        | Final, тільки owner може transition                                 |
| `cancelled`     | `cancelled`        | Final                                                               |

### Time tracking (specification)

Окремий блок у замовленнях:

#### Принципи

- **1 active timer per executor** глобально (не per-order; перемикання auto-stops попередній).
- Timer persistent у БД (`time_logs.started_at != null AND ended_at IS null`).
- Auto-stop через **8 годин** (safety net for forgotten timers) — cron `C15:timer_auto_stop` кожні 5хв.
- Manual time entry дозволено для historical work (ended_at < now()).
- Time logs прив'язані до `orders` (або до `internal_tasks` через нову колонку).

#### Schema (доповнення)

```prisma
model TimeLog {
  id          String    @id @default(uuid())
  orderId     String?
  order       Order?    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  internalTaskId String?
  internalTask InternalTask? @relation(fields: [internalTaskId], references: [id], onDelete: Cascade)
  executorId  String
  executor    Profile   @relation(fields: [executorId], references: [id])
  startedAt   DateTime  @db.Timestamptz(3)
  endedAt     DateTime? @db.Timestamptz(3)
  durationSec Int?      // computed when ended_at set
  description String?   // executor comment (used by Specification flow)
  autoStopped Boolean   @default(false)
  autoStopReason String?  // 'timeout' | 'switched_timer' | 'user_deactivated' | 'company_archived'
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)

  @@index([executorId, endedAt])
  @@index([orderId, startedAt])
  @@map("time_logs")
}
```

Partial unique index: `time_logs_one_active_per_executor ON (executor_id) WHERE ended_at IS NULL`.

#### Endpoints

- `POST /orders/:id/timer/start` (or `/internal-tasks/:id/timer/start`) — auto-stops previous active timer.
- `POST /orders/:id/timer/stop` — sets ended_at, computes duration.
- `POST /orders/:id/time-logs` — manual entry (started_at + ended_at + description).
- `GET /executors/:id/time-logs?period=...` — list для звітів.

### Specification flow (auto-generated)

Послідовність:

1. Executor під час роботи додає коментарі через `time_logs.description` (за task).
2. При transition order → `review`, система автоматично формує draft Specification:
   - Витягуємо всі `time_logs` для order, відсортовані за `startedAt`.
   - Concat descriptions → bullet list.
   - Зберігаємо як `Document(type='specification', status='draft')`.
3. Owner відкриває specification у workspace, **редагує** (виправляє текст, видаляє непотрібне).
4. Owner затверджує → `Document.status='generated'` → PDF render.
5. PDF додається до `completion_act` як appendix при closure → `status='sent'` після email клієнту.

### Departments (CRUD table)

Замість enum, departments — CRUD таблиця (модуль 20-admin-settings + 12-team-executors). Defaults seeded з `DEFAULT_DEPARTMENT_SLUGS` у `@workflo/types/constants`.

`ExecutorRate.departmentId` (FK на departments) — який відділ за замовчуванням для executor.

### Triage / unassigned-only owner view

`GET /orders?filter=unassigned`:

- Owner only (`can(user, 'admin.access')` OR `memberships.role === 'owner'` of agency).
- Returns orders WHERE `assigneeId IS NULL AND deletedAt IS NULL AND createdAt > now() - INTERVAL '30 days'`.
- UI `/workspace/triage` показує count badge у sidebar.

### Done → revision (owner-only)

Старий механізм: будь-хто міг повернути order у revision. Нова політика:

- Тільки **owner** компанії може transition done → revision (`can(user, 'order.transition_status', { companyId, from: 'done', to: 'revision' })`).
- Audit log: `order.reopened` з reason.
- Notification до executor `orders.status_changed` (revision = potentially negative для executor → email завжди + telegram).

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

> Авторитетна секція. Pre-S1 9-статусні блоки вище — підлягають видаленню в doc-sync.

### A. Обов'язкові reconcile

- **Один `ALLOWED_TRANSITIONS`** на реальні 9 internal-станів (new/clarification/estimating/in_progress/review/revision/done/cancelled/on_hold). Старі машини (`approved`, `in_review_final`…) видалити.
- **`OrderStage`** задокументувати (чеклист-етапи на замовленні: title/status/position) + endpoints CRUD + reorder.
- **`deadline`** (не `dueDate` — узгодити з cron C03/escalation), `companyId`/`assigneeId` nullable (internal_task без компанії).
- **`agencyId`** денормалізація + composite-індекси `(agencyId, internalStatus)`, `(agencyId, assigneeId)`, `(agencyId, deletedAt)`.
- **IDOR-guard**: `GET/PATCH /orders/:id` — executor лише свої (`assigneeId=me OR agency-owner`) + tenant-guard; client лише своєї компанії.
- **`Order.onHoldReason String?`, `cancelledReason String?`** (transition DTO вимагає reason).
- **TimeLog уніфікація** (крос-модуль T2): таймерна модель `{startedAt, endedAt, durationSec, autoStopped, autoStopReason, internalTaskId?, description}`.
- Ніколи не hard-delete (cascade знищив би time_logs/білінг) — лише `deletedAt`.

### B. Теги/мітки ✅

- `OrderTag { id, agencyId, name, color, createdAt, @@unique([agencyId, name]) }` (per-agency CRUD у admin).
- `OrderTagAssignment { orderId, tagId, @@id([orderId, tagId]) }`.
- Фільтр `GET /orders?tags=bug,urgent`; UI — кольорові чіпи. Endpoints: `POST/DELETE /orders/:id/tags`.

### C. SLA / терміни реакції ✅

- `SlaPolicy { id, agencyId, priority, firstResponseMins, resolutionMins, @@unique([agencyId, priority]) }` (per-agency конфіг у admin).
- `Order` додає `firstResponseDueAt`, `resolutionDueAt` (обчислюються при створенні з policy), `firstRespondedAt`, `slaBreachedAt`.
- Cron `C-sla_check` (кожні 15хв): прострочення first-response/resolution → `slaBreachedAt` + escalation owner'у (event `orders.sla_breached`).
- UI: badge «SLA: 1г 20хв» / червоний при breach. Звіти: % SLA-compliance.

### D. Залежності між замовленнями ✅

- `OrderDependency { id, orderId, dependsOnOrderId, type('blocks'), createdAt, @@unique([orderId, dependsOnOrderId]) }`.
- Валідація циклів при створенні (DFS) → 409 `dependency_cycle`.
- Guard: transition blocked-замовлення у `in_progress` заборонено поки всі `dependsOn` не `done` (UI показує «заблоковано задачею X»). Коли blocker→done → notify виконавцю розблокованого.
- Tenant: залежності лише в межах однієї агенції.

### E. Шаблони замовлень ✅

- `OrderTemplate { id, agencyId, name, type, defaultTitle, defaultDescription, defaultBillingType, defaultPrice?, defaultStages Json, nomenclatureCode?, isActive, @@unique([agencyId, name]) }`.
- `POST /orders/from-template/:templateId { companyId, overrides? }` → створює Order + OrderStage[] з шаблону. Admin CRUD шаблонів (модуль 20, пов'язано з н022 номенклатурою).

### Schema-зміни (у foundation-міграцію)

```
Order: + onHoldReason, cancelledReason, firstResponseDueAt, resolutionDueAt,
         firstRespondedAt, slaBreachedAt, agencyId
New: OrderTag, OrderTagAssignment, SlaPolicy, OrderDependency, OrderTemplate
TimeLog: повна таймерна модель (T2)
```

## Беклог-промоут (30.05) → у план

- **Soft-delete restore UI** (S10): відновлення видалених замовлень — admin-only, 30-денне вікно. Сховище вже soft-delete (`deletedAt`); потрібен лише UI + `POST /workspace/orders/:id/restore` (audit `order.restored`). Промоут із беклогу.

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID    | Рішення                                                                                                                                                                                                                                                                                                                                | Вплив                | Нюанси власника                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 02-А  | **Погодження оцінки клієнтом — ОПЦІЙНЕ.** Прапорець `requiresApproval` на замовленні (дефолт — налаштування компанії). Якщо увімкнено: owner виставляє оцінку → клієнт «Погодити / Відхилити з коментарем» → гейт переходу в роботу + audit. Якщо вимкнено — поточна поведінка без погодження                                          | [бек+екран]          | Працює, коли Є що погоджувати: fixed → сума; НЕфіксована (hourly) ціна теж можлива — тоді погоджується ставка + оцінка годин (орієнтир). Погодження НЕ обовʼязкове для всіх замовлень |
| 02-Б  | **Кошторис із позицій (`EstimateLine`)** — позиції будуються з каталогу послуг. Випливає: **кілька типів послуг** (разові + recurring в одному каталозі) і **налаштування «якому клієнту які послуги доступні»** (per-company доступність; CompanyService сьогодні покриває лише підписки — розширити на visibility/allowlist разових) | [бек+екран] середній | Звʼязати з наявним Services CRUD (S5-03b); кошторис = основа для рахунку/акту (S6)                                                                                                    |
| 02-В  | **Аванс-гейт — ОПЦІЙНИЙ.** Налаштування per-company (дефолт N%) + override per-order; якщо увімкнено — transition у `in_progress` чекає confirmed-авансу; бейдж «чекаємо аванс»                                                                                                                                                        | [бек] + бейдж        | Не обовʼязковий — саме опція                                                                                                                                                          |
| 02-Е′ | **Налаштування видимості задач у Portal на рівні КОМПАНІЇ** (а не лише per-member): режим «всі члени бачать усі задачі компанії» vs «кожен бачить свої (створені ним), власник компанії — усі». Company-рівневий дефолт; наявний member-флаг `can_view_all_tasks` стає override                                                        | [бек+екран] дрібний  | Замінює ідею watchers (відхилена): клієнт і так сам додає людей у свій простір                                                                                                        |

**Відхилено:** Г (алерт бюджету годин), Д (CSAT після done), Е-watchers (замінено на Е′), Ж (клонування), З (чернетки Portal).

**Для ТЗ дизайнеру:** Portal-деталь: блок оцінки з кнопками погодження/відхилення + стан «чекає погодження» (А); Workspace-деталь: тумблер requiresApproval + індикатор стану (А); екран/секція кошторису з позиціями в обох апках + рядки з каталогу послуг (Б); налаштування доступних послуг клієнта в Workspace (Б); бейдж «чекаємо аванс» (В); перемикач видимості задач у Portal /settings компанії (Е′).
