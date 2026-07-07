# TEAM & EXECUTORS MODULE

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`
> Оновлено: 12 квітня 2026

---

## Огляд

Управління внутрішньою командою (виконавці + власник). Включає: запрошення нових виконавців, управління правами, трекінг робочого часу (time tracking), перегляд навантаження на команду.

---

## Ролі в команді

| Роль       | Доступ                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`    | Повний доступ до всього в workspace. Єдиний хто може запрошувати/видаляти executors, бачити всі фінанси                                                                                                                                                 |
| `manager`  | Операційний доступ БЕЗ фінансів і налаштувань: веде замовлення/клієнтів/команду. Заблоковано (`can.ts` `MANAGER_BLOCKED`): `finance.*`, `admin.access`, налаштування й члени компанії, `credentials.*`, `executor.invite/deactivate`, `payment.confirm` |
| `executor` | Бачить тільки свої призначені замовлення, може логувати час, коментувати                                                                                                                                                                                |

> Канон ролей команди (`AgencyRole`) — `owner | manager | executor` (`packages/types` `tokens.ts`, enforced у `apps/api/src/auth/can.ts`). Старий `superadmin/lead` — не використовувати.

> Workspace захищений IP whitelist на рівні Traefik — клієнти фізично не можуть відкрити.

---

## Invite Flow для Executor

1. Owner відкриває "Запросити виконавця" в workspace
2. Вводить email нового виконавця
3. API створює `invites` запис (UUID token, `role=executor`, `expiresAt = now + 7 днів`)
4. Надсилається email з посиланням: `work.workflo.space/invite/{token}`
5. Виконавець переходить по посиланню → реєструється (ім'я + пароль)
6. `profiles` створюється з `role=executor`
7. Invite marked as `accepted`, `acceptedAt = now()`

### Invite DB

```prisma
model Invite {
  id          String    @id @default(uuid())
  token       String    @unique @default(uuid())
  email       String
  role        Role
  invitedBy   String    // profileId owner
  companyId   String?   // для company member invites
  status      String    @default("pending")  // pending|accepted|expired|cancelled
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime  @default(now())

  inviter Profile @relation(fields: [invitedBy], references: [id])

  @@index([token])
  @@index([email])
}
```

### Expire invites cron

Щодня о 00:00 UTC: `UPDATE invites SET status='expired' WHERE status='pending' AND expiresAt < NOW()`

---

## Time Tracking

Виконавець може логувати витрачений час на замовлення.

### Механіка

- **Ручне введення:** виконавець вводить кількість годин + дату + опис
- **Таймер (Phase 2):** Start/Stop кнопка з автоматичним підрахунком

### DB Schema

```prisma
model TimeLog {
  id          String   @id @default(uuid())
  orderId     String
  executorId  String
  date        DateTime @db.Date  // якого числа
  hours       Decimal  @db.Decimal(4,2)  // 1.5 = 1 год 30 хв
  description String?
  billable    Boolean  @default(true)  // враховувати в рахунку
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  order    Order   @relation(fields: [orderId], references: [id])
  executor Profile @relation(fields: [executorId], references: [id])

  @@index([orderId])
  @@index([executorId, date])
}
```

### Звіт по часу

- Workspace: фільтр по executor, по замовленню, по датам
- Агрегат: `SUM(hours)` по замовленню
- Можна позначити як `billable=false` (якщо час не виставляється клієнту)

---

## Навантаження (Workload)

Workspace dashboard показує:

- Скільки активних замовлень у кожного виконавця
- Загальний час за поточний тиждень/місяць
- Найближчі дедлайни по виконавцях

```typescript
// GET /team/workload
{
  executors: {
    id: string
    name: string
    avatarUrl: string | null
    activeOrders: number
    hoursThisWeek: number
    hoursThisMonth: number
    upcomingDeadlines: {
      orderId: string
      title: string
      dueDate: string
    }
    ;[]
  }
  ;[]
}
```

---

## API Endpoints

| Метод    | URL                     | Хто                      | Опис                               |
| -------- | ----------------------- | ------------------------ | ---------------------------------- |
| `GET`    | `/team`                 | Workspace                | Список членів команди              |
| `POST`   | `/team/invite`          | Owner                    | Запросити виконавця                |
| `GET`    | `/team/invites`         | Owner                    | Список запрошень                   |
| `DELETE` | `/team/invites/:id`     | Owner                    | Скасувати запрошення               |
| `PATCH`  | `/team/:profileId`      | Owner                    | Оновити дані (активний/неактивний) |
| `DELETE` | `/team/:profileId`      | Owner                    | Деактивувати виконавця             |
| `GET`    | `/team/workload`        | Owner                    | Навантаження на команду            |
| `GET`    | `/time-logs`            | Workspace                | Список тайм-логів з фільтрами      |
| `POST`   | `/orders/:id/time-logs` | Executor                 | Додати тайм-лог                    |
| `PATCH`  | `/time-logs/:id`        | Executor (автор)         | Редагувати тайм-лог                |
| `DELETE` | `/time-logs/:id`        | Executor (автор) / Owner | Видалити                           |
| `GET`    | `/orders/:id/time-logs` | Workspace                | Тайм-логи замовлення               |

---

## DTO

### `POST /team/invite`

```typescript
{
  email: string
  role: 'executor' // тільки executor через workspace
}
```

### `GET /team` Response

```typescript
{
  members: {
    id: string
    email: string
    displayName: string
    avatarUrl: string | null
    role: 'owner' | 'executor'
    isActive: boolean
    telegramLinked: boolean
    joinedAt: string
    lastSeenAt: string | null
    activeOrdersCount: number
  }
  ;[]
}
```

### `POST /orders/:id/time-logs`

```typescript
{
  date: string          // ISO date (YYYY-MM-DD)
  hours: number         // 0.5 — 24
  description?: string
  billable?: boolean    // default: true
}
```

### TimeLog Response

```typescript
{
  id: string
  orderId: string
  date: string
  hours: number
  description: string | null
  billable: boolean
  executor: {
    id: string
    displayName: string
  }
  createdAt: string
}
```

### `GET /time-logs` Query

```
executorId=uuid
orderId=uuid
dateFrom=2026-01-01
dateTo=2026-01-31
billable=true|false
page=1
limit=50
```

---

## Деактивація виконавця

При `DELETE /team/:profileId`:

1. `profiles.isActive = false` → виконавець не може логінитися
2. Refresh tokens анулюються (`revokedAt = now()`)
3. Замовлення залишаються з `order_executors` записом (для аудиту)
4. Виконавця **не видаляємо** — тільки деактивуємо

---

## Профіль виконавця

Виконавець може редагувати свій профіль в workspace:

- `displayName` — відображуване ім'я
- `avatarUrl` — завантаження через Files module
- Пароль (через `POST /auth/change-password`)
- Telegram прив'язка (через OTP flow)
- Мова інтерфейсу (`uk`/`en`)
- Тема (`light`/`dark`/`system`)

---

## Зв'язки з іншими модулями

| Модуль            | Зв'язок                                       |
| ----------------- | --------------------------------------------- |
| **Auth**          | Invite flow, деактивація                      |
| **Orders**        | `order_executors` — призначення на замовлення |
| **Notifications** | Нотифікації виконавцям                        |
| **Billing**       | Тайм-логи → розрахунок вартості (Phase 2)     |
| **Bot**           | Telegram прив'язка виконавця                  |

---

## S1 alignment update (17 квітня 2026 → 27 травня 2026)

### Departments — CRUD table (НЕ enum)

Departments — звичайна editable таблиця (модуль 20-admin-settings → секція 5).

Schema:

```prisma
model Department {
  id          String   @id @default(uuid())
  slug        String   @unique
  name        String
  description String?
  isActive    Boolean  @default(true)
  // ...
}
```

Default seed (`@workflo/types/constants.DEFAULT_DEPARTMENT_SLUGS`):
`design / dev / marketing / management / qa / devops / content`

Кожен executor має `ExecutorRate.departmentId` — primary department.

### Internal tasks + billing modes

Внутрішні задачі (`InternalTask` model) можуть бути billable per `billingMode` (`@workflo/types.BillingMode`):

| Mode            | Behavior                                                    |
| --------------- | ----------------------------------------------------------- |
| `client_paid`   | Час включається в client invoice (через order's company)    |
| `internal_paid` | Час оплачується компанією executor (не invoiced до клієнта) |
| `unpaid`        | Час tracked але не invoiced (research, training)            |

UI у workspace: задача має toggle "Billable" → owner вибирає mode.

### Time tracking повна специфікація

Див. **02-orders.md → секція "Time tracking (specification)"**.

Ключове для team module:

- `GET /executors/:id/time-logs?period=YYYY-MM` — список часу за період.
- `GET /executors/:id/report?period=YYYY-MM` — агрегований звіт:
  - Total hours.
  - Billable hours (по billing mode).
  - Per-department breakdown.
  - Per-order/per-internal-task breakdown.

### Executor rates (history)

`ExecutorRate` тримає поточну ставку + monthly salary. **Не оновлюється in-place** — нова ставка = новий row з `effectiveFrom` date:

```prisma
model ExecutorRate {
  id                  String   @id @default(uuid())
  executorId          String
  executor            Profile  @relation(fields: [executorId], references: [id])
  departmentId        String?
  department          Department? @relation(fields: [departmentId], references: [id])
  hourlyRateUsd       Decimal  @db.Decimal(10, 2)
  monthlySalaryUsd    Decimal  @db.Decimal(10, 2)
  commissionPercent   Decimal? @db.Decimal(5, 2)
  effectiveFrom       DateTime @db.Timestamptz(3)
  effectiveUntil      DateTime? @db.Timestamptz(3)
  createdAt           DateTime @default(now()) @db.Timestamptz(3)

  @@index([executorId, effectiveFrom])
}
```

Для розрахунку cost в reports використовуємо rate active на дату payment / time_log.

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

TimeLog → таймерна модель (T2); `ExecutorRate` додає `hourlyRateUsd` + `departmentId`; **`Department` таблиця** (зараз немає); `Invite` drift (`type`/`usedAt`, не `status`/`role`); ролі через **`AgencyMember`** (не глобальний Profile.role); deactivation → auto-stop таймера (`autoStopReason='user_deactivated'`) + переназначення open-orders; **lock time-logs** після інвойсингу (не редагувати історичні білабельні години); tenant-guard на `/team/*`.

### B. Авто-розрахунок виплат ✅

- `ExecutorPayout { id, agencyId, executorId, period(month), baseSalary, commissionAmount, billableHours, paidHours, hourlyEarned, referralBonusAmount, total, status(draft|approved|paid), approvedBy, createdAt }`.
- `total = baseSalary + hourlyEarned + commissionAmount + referralBonusAmount`:
  - **baseSalary** = `ExecutorRate.monthlySalary` активної у періоді ставки (окладні);
  - **commissionAmount** = `commissionPercent` × Σ підтверджених платежів по замовленнях виконавця;
  - **billableHours** = Σ `TimeLog.hours` у періоді — **залоговано** (інформаційно);
  - **paidHours** = Σ прийнятих `OrderExecutorSettlement.payableHours` по замовленнях, ПРИЙНЯТИХ
    (`Order.acceptedAt`) у періоді — **оплатні** години (ПРИЙМАННЯ→PAYROLL, 07.07);
  - **hourlyEarned** = `paidHours × ExecutorRate.hourlyRate` (погодинники; окладні → hourlyRate null → 0).
    Замикає money-loop приймання: платимо за ПРИЙНЯТІ години (owner/тімлід звірив), а не за сирі залоговані.
- `ExecutorRate.hourlyRate` = **і собівартість години** (маржа, rateResolution каскад §2.3) **і ставка
  оплати** погодинника (payout). Payout-відомість + `/team/payouts`, owner-only, ідемпотентна генерація.
- _Відкладено:_ hourly-cost у P&L (зараз P&L рахує лише monthlySalary; погодинники → 0 у expenses — окремий зріз реконсиляції).

### C. Timesheet approval ✅

- Тижневий grid time-logs виконавця → owner review → `approve` → **lock** (status='approved', edit заборонено). Незатверджені години не йдуть у білінг/payout.

### D. KPI / продуктивність ✅

- Метрики: avg time/task, utilization %, on-time delivery %, active orders, billable ratio. Owner-дашборд `/team/:id/kpi`. Дані з orders + time_logs.

```
ExecutorRate: + hourlyRateUsd, departmentId, agencyId
New: Department, ExecutorPayout; AgencyMember (tenancy)
```

> **→ BACKLOG:** навички/спеціалізації виконавців.

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

Вердикт власника: ✅ ПІДТВЕРДЖЕНО — «давай все це додамо».

| ID   | Рішення                                                                                                                                                               | Вплив               | Нюанси власника |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------- |
| 12-А | **Модель ставок: база + override** — базова ставка у працівника, опційний override на проєкті (05-ПРОЕКТИ); виплата по фактичних ставках, маржа рахується автоматично | [бек+поля ставок]   | —               |
| 12-Б | **Завантаженість (capacity)** — тижнева норма годин; дашборд owner: хто перевантажений/вільний                                                                        | [бек+віджет]        | —               |
| 12-В | **Міні-KPI виконавця** — вчасність, години, виручка за період (картка профілю)                                                                                        | [бек+картка]        | —               |
| 12-Г | **Онбординг-чекліст виконавця** (налаштовуваний)                                                                                                                      | [бек+екран дрібний] | —               |

### 12-КОМПЕНСАЦІЇ ⭐ (вимога власника): три формати оплати працівника

`CompensationModel` виконавця: **(1) Ставка** (фікс-оклад — є зараз) · **(2) Ставка + години** (оклад + погодинна за персональним рейтом) · **(3) Тільки години** (чиста погодинка). Комісія % (наявна механіка) — лишається опцією поверх. Потребує: `ExecutorRate.hourlyRate` (давно запланована колонка) + перемикач моделі + payout-розрахунок по моделі.

### 12-РЕФЕРАЛ-ПРАЦІВНИКА ⭐ (вимога власника): бонус від ЧИСТОГО доходу

Працівник привів клієнта → отримує налаштовуваний **% від ЧИСТОГО доходу агенції** з цього клієнта (або замовлення — рівень агрегації в налаштуваннях). Приклад власника: клієнт платить $20/год, виконавець робіт коштує $10/год → чистих $10/год; з них % рефереру-працівнику. **Неважливо, хто виконує роботи — важливо, хто привів клієнта.**
Механіка: `Company.referredByEmployeeId` + налаштування % (per-agency) → margin-розрахунок (виручка − собівартість по ставках виконавців; звʼязка з 05-ПРОЕКТИ і модулем 22 cost-allocation) → окремий компонент у payout працівника. Дизайн: поле «хто привів» на клієнті + рядок «реферальний бонус» у виплаті.

**Для ТЗ дизайнеру:** екран ставок з моделлю компенсації + override на проєкті (А/КОМПЕНСАЦІЇ); віджет завантаженості на owner-дашборді (Б); KPI-картка профілю (В); чекліст онбордингу (Г); «хто привів клієнта» + бонус-рядок у виплатах (РЕФЕРАЛ-ПРАЦІВНИКА).
