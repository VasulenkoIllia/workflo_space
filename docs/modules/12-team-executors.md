# TEAM & EXECUTORS MODULE
> App: Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`
> Оновлено: 12 квітня 2026

---

## Огляд

Управління внутрішньою командою (виконавці + власник). Включає: запрошення нових виконавців, управління правами, трекінг робочого часу (time tracking), перегляд навантаження на команду.

---

## Ролі в команді

| Роль | Доступ |
|---|---|
| `owner` | Повний доступ до всього в workspace. Єдиний хто може запрошувати/видаляти executors, бачити всі фінанси |
| `executor` | Бачить тільки свої призначені замовлення, може логувати час, коментувати |

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
    upcomingDeadlines: { orderId: string; title: string; dueDate: string }[]
  }[]
}
```

---

## API Endpoints

| Метод | URL | Хто | Опис |
|---|---|---|---|
| `GET` | `/team` | Workspace | Список членів команди |
| `POST` | `/team/invite` | Owner | Запросити виконавця |
| `GET` | `/team/invites` | Owner | Список запрошень |
| `DELETE` | `/team/invites/:id` | Owner | Скасувати запрошення |
| `PATCH` | `/team/:profileId` | Owner | Оновити дані (активний/неактивний) |
| `DELETE` | `/team/:profileId` | Owner | Деактивувати виконавця |
| `GET` | `/team/workload` | Owner | Навантаження на команду |
| `GET` | `/time-logs` | Workspace | Список тайм-логів з фільтрами |
| `POST` | `/orders/:id/time-logs` | Executor | Додати тайм-лог |
| `PATCH` | `/time-logs/:id` | Executor (автор) | Редагувати тайм-лог |
| `DELETE` | `/time-logs/:id` | Executor (автор) / Owner | Видалити |
| `GET` | `/orders/:id/time-logs` | Workspace | Тайм-логи замовлення |

---

## DTO

### `POST /team/invite`

```typescript
{
  email: string
  role: 'executor'   // тільки executor через workspace
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
  }[]
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
  executor: { id: string; displayName: string }
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

| Модуль | Зв'язок |
|---|---|
| **Auth** | Invite flow, деактивація |
| **Orders** | `order_executors` — призначення на замовлення |
| **Notifications** | Нотифікації виконавцям |
| **Billing** | Тайм-логи → розрахунок вартості (Phase 2) |
| **Bot** | Telegram прив'язка виконавця |
