# ORDERS MODULE
> App: Portal (portal.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`, `packages/storage`
> Оновлено: 12 квітня 2026

---

## Огляд

Центральний модуль системи. Замовлення (`orders`) — основна бізнес-одиниця: клієнт створює запит → команда виконує роботу → виставляється рахунок → закривається актом. Є два різних «погляди» на замовлення: внутрішній (workspace, 9 статусів) та клієнтський (portal, 4 статуси).

---

## Статусна машина

### Внутрішні статуси (Workspace)

```
new → in_review → approved → in_progress → on_hold → in_review_final → revision → done → cancelled
```

| Статус | Значення |
|---|---|
| `new` | Щойно надійшло, ніхто не взяв |
| `in_review` | Менеджер розглядає |
| `approved` | Підтверджено, починаємо роботу |
| `in_progress` | Виконавець активно працює |
| `on_hold` | Заморожено (чекаємо клієнта/оплату) |
| `in_review_final` | Здали клієнту, чекаємо підтвердження |
| `revision` | Клієнт просить правки |
| `done` | Закрито, акт підписано |
| `cancelled` | Скасовано |

### Клієнтські статуси (Portal)

| Клієнтський статус | Внутрішні статуси |
|---|---|
| `pending` | `new`, `in_review` |
| `in_progress` | `approved`, `in_progress`, `on_hold`, `revision` |
| `review` | `in_review_final` |
| `completed` | `done`, `cancelled` |

> Маппінг відбувається автоматично у відповіді API через `mapToClientStatus(internalStatus)` функцію в `packages/types`.

### Дозволені переходи статусів

```typescript
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['in_review', 'cancelled'],
  in_review: ['approved', 'cancelled'],
  approved: ['in_progress'],
  in_progress: ['on_hold', 'in_review_final'],
  on_hold: ['in_progress', 'cancelled'],
  in_review_final: ['done', 'revision'],
  revision: ['in_progress'],
  done: [],
  cancelled: [],
}
```

---

## Бізнес-логіка

### Пріоритети

| Пріоритет | Значення |
|---|---|
| `low` | Не горить |
| `medium` | Стандарт (за замовчуванням) |
| `high` | Важливо |
| `urgent` | Критично, спливаюче сповіщення |

### Фінансова логіка

- `totalAmount` — загальна вартість у USD (встановлює owner/executor)
- Аванс — це платіж типу `advance` в таблиці `payments` з прив'язкою до `orderId`
- `balance_due = totalAmount - SUM(payments WHERE type IN ('advance','partial') AND status = 'confirmed')`
- При закритті (`done`) — виставляється фінальний рахунок на `balance_due`
- Якщо `balance_due = 0` — замовлення вже повністю оплачено авансом

### Soft delete

- `deletedAt` поле. `null` = активне, timestamp = видалене
- Всі запити автоматично фільтрують `WHERE deletedAt IS NULL`
- Видалені замовлення доступні тільки через `GET /orders?includeDeleted=true` (тільки owner)

### Виконавці (Executors)

- До одного замовлення можна прив'язати кількох виконавців через `order_executors`
- Кожен виконавець бачить тільки замовлення, де він призначений
- `order_executors.assignedAt` — коли призначили, `assignedBy` — хто

### Дедлайн і нагадування

- `dueDate` — опціональний дедлайн
- Cron job: щодня 09:00 Kyiv — перевіряє замовлення де `dueDate` = сьогодні або завтра → надсилає нотифікацію виконавцям

---

## API Endpoints

### Portal (клієнт)

| Метод | URL | Опис |
|---|---|---|
| `GET` | `/orders` | Список замовлень своєї компанії |
| `POST` | `/orders` | Створити нове замовлення |
| `GET` | `/orders/:id` | Деталі замовлення (client view) |
| `PATCH` | `/orders/:id` | Редагувати (тільки `new`/`in_review` статуси) |

### Workspace (команда)

| Метод | URL | Опис |
|---|---|---|
| `GET` | `/orders` | Список всіх замовлень з фільтрами |
| `GET` | `/orders/:id` | Деталі замовлення (internal view) |
| `PATCH` | `/orders/:id/status` | Змінити статус |
| `PATCH` | `/orders/:id` | Редагувати будь-яке поле |
| `DELETE` | `/orders/:id` | Soft delete |
| `POST` | `/orders/:id/executors` | Призначити виконавця |
| `DELETE` | `/orders/:id/executors/:userId` | Зняти виконавця |

### Query параметри для `GET /orders` (workspace)

```
status=in_progress,on_hold
priority=high,urgent
companyId=uuid
executorId=uuid
dateFrom=2026-01-01
dateTo=2026-12-31
search=текст (шукає по title, description)
page=1
limit=20
sortBy=createdAt|dueDate|priority
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
  clientStatus: 'pending'|'in_progress'|'review'|'completed'
  priority: string
  totalAmount: number | null
  balanceDue: number | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
}
```

### Response (Workspace view — додаткові поля)

```typescript
{
  // ... всі поля Portal view +
  internalStatus: OrderStatus
  deletedAt: string | null
  executors: { id: string; name: string; assignedAt: string }[]
  payments: PaymentSummary[]
  company: { id: string; name: string }
}
```

### `PATCH /orders/:id/status`

```typescript
{
  status: OrderStatus   // перевіряємо ALLOWED_TRANSITIONS
  comment?: string      // запис в activity log
}
```

---

## DB Schema (основні поля)

```prisma
model Order {
  id          String      @id @default(uuid())
  companyId   String
  title       String
  description String?
  status      OrderStatus @default(new)
  priority    Priority    @default(medium)
  totalAmount Decimal?    @db.Decimal(10,2)
  dueDate     DateTime?
  deletedAt   DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  company     Company           @relation(fields: [companyId], references: [id])
  executors   OrderExecutor[]
  payments    Payment[]
  comments    Comment[]
  files       FileAttachment[]
  documents   Document[]
  timeLogs    TimeLog[]

  @@index([companyId])
  @@index([status])
  @@index([deletedAt])
  @@index([dueDate])
}

model OrderExecutor {
  orderId    String
  userId     String
  assignedAt DateTime @default(now())
  assignedBy String

  order  Order   @relation(fields: [orderId], references: [id])
  user   Profile @relation(fields: [userId], references: [id])

  @@id([orderId, userId])
}
```

---

## Нотифікації при зміні статусу

| Подія | Кому | Канал |
|---|---|---|
| Нове замовлення від клієнта | Owner + всі executors (кому assigned) | Email + Telegram |
| Статус → `approved` | Company Owner | Email + Telegram |
| Статус → `in_review_final` | Company Owner | Email + Telegram |
| Статус → `revision` | Executors | Telegram |
| Статус → `done` | Company Owner | Email + Telegram |
| Статус → `cancelled` | Company Owner + Executors | Email + Telegram |
| `dueDate` = завтра | Executors | Telegram |

---

## ActivityLog

Кожна зміна статусу, призначення виконавця, редагування суми — записується в `activity_log`:

```typescript
{
  entityType: 'order'
  entityId: orderId
  action: 'status_changed' | 'executor_assigned' | 'amount_updated' | ...
  actorId: profileId
  meta: { from: 'in_progress', to: 'on_hold', comment: '...' }
}
```

---

## Зв'язки з іншими модулями

| Модуль | Зв'язок |
|---|---|
| **Chat** | Коментарі прив'язані до `orderId` |
| **Files** | Файли прив'язані до `orderId` |
| **Billing** | Платежі прив'язані до `orderId` |
| **Documents** | Рахунки, акти, специфікації прив'язані до `orderId` |
| **Search** | `tsvector` по `title` + `description` |
| **Notifications** | Статусні зміни → нотифікації |
