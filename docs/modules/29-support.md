# SUPPORT MODULE (тікети підтримки — звернення поза замовленням)

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Portal (клієнт) + Workspace (команда) / API · Залежить від: **01-auth**, **03-chat** (thread-патерн), **07-notifications**, **18-chat-hub** (inbox).
> Статус: **Спец** · Створено: 1.06.2026 · Модуль **29** (рішення власника 1.06: окрема тікет-система).
> Закриває прогалину аудиту #2: чат привʼязаний до замовлення; загальні звернення/підтримка (без order) ніде не жили.

---

> 🔄 **design-v2 (2026-06-20):** доставлено **support-plus** — 7 екранів (canned replies з {{variables}}, KB-статті + статистика, portal help, CSAT-рейтинг): [`workspace-support-plus.jsx`](../../design-v2/project/workspace-support-plus.jsx). 🔴 **бекенд greenfield** (звірено): тікет/KB моделі/route нема. W2 за планом. Матриця — [`DESIGN_SYSTEM.md §5.13`](../DESIGN_SYSTEM.md).

## 0. Навіщо

Клієнт має канал звернутися **поза конкретним замовленням** (загальне питання, проблема, запит). Команда веде ці звернення як **тікети** зі статусами/пріоритетами/категоріями/призначенням/SLA. Окреме від per-order чату (03) і від лідів (26 — то ще-не-клієнти).

Tenant: agency-scoped. Клієнт бачить лише свої тікети; команда — всі тікети агенції (`isInternalTeam`).

---

## 1. Моделі

```prisma
model Ticket {
  id            String        @id @default(uuid())
  agencyId      String
  companyId     String?       // компанія-клієнт (null = звернення без компанії, рідко)
  openedById    String        // Profile, що відкрив
  subject       String
  category      String?       // конфігуровані категорії агенції
  priority      TicketPriority @default(normal)
  status        TicketStatus  @default(open) // open | pending | resolved | closed
  assignedToId  String?       // executor
  source        String        @default("portal") // portal | email | telegram
  firstResponseAt DateTime?   @db.Timestamptz(3) // для SLA
  resolvedAt    DateTime?     @db.Timestamptz(3)
  createdAt     DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime      @updatedAt @db.Timestamptz(3)

  @@index([agencyId, status])
  @@index([companyId])
  @@index([assignedToId])
  @@map("tickets")
}

model TicketMessage {
  id         String   @id @default(uuid())
  ticketId   String
  authorId   String
  content    String
  isInternal Boolean  @default(false) // team-only нотатка (leak-guard, як 03)
  createdAt  DateTime @default(now()) @db.Timestamptz(3)
  editedAt   DateTime? @db.Timestamptz(3)
  deletedAt  DateTime? @db.Timestamptz(3)
  @@index([ticketId, createdAt])
  @@map("ticket_messages")
}

enum TicketStatus   { open pending resolved closed }
enum TicketPriority { low normal high urgent }
```

> `TicketMessage` дзеркалить `OrderComment` (thread + `isInternal` leak-guard + edit/delete + SSE). Файли-вкладення — через модуль 04 (`OrderFile`-патерн з `ticketId` — або узагальнити attachment пізніше).

---

## 2. Флоу

1. **Клієнт відкриває** (Portal `/support/new`): subject + category + повідомлення (+файли) → `Ticket(status=open)` + перший `TicketMessage`. Notify команду (`support.new_ticket`).
2. **Команда** (Workspace `/support`): бачить чергу, призначає (`assignedToId`), відповідає (`firstResponseAt` ставиться на першу team-відповідь — SLA), статус `pending`(чекаємо клієнта)/`resolved`/`closed`. **Internal-нотатки** (`isInternal=true`) — клієнт не бачить (leak-guard як 03).
3. **Realtime**: SSE на тред (наявний `chatBus`-патерн) + у **chat-hub** (18) тікети показуються поряд із order-чатами (єдиний inbox).
4. **Конверсія**: тікет може стати **замовленням** (кнопка «Створити замовлення з тікета» → Order, лінк) або лишитись support-зверненням.

---

## 3. API

**Portal (клієнт):**
| Метод | URL | Опис |
| ----- | --- | ---- |
| `POST` | `/support/tickets` | Відкрити тікет |
| `GET` | `/support/tickets` | Мої тікети (фільтр status) |
| `GET` | `/support/tickets/:id` | Тред (лише public-повідомлення) |
| `POST` | `/support/tickets/:id/messages` | Відповісти |

**Workspace (команда, `isInternalTeam`):**
| Метод | URL | Опис |
| ----- | --- | ---- |
| `GET` | `/workspace/tickets` | Черга + фільтри (status/priority/assignee/category/company) |
| `GET` | `/workspace/tickets/:id` | Повний тред (incl. internal) |
| `POST` | `/workspace/tickets/:id/messages` | Відповісти (public/internal) |
| `PATCH` | `/workspace/tickets/:id` | Статус/пріоритет/призначення/категорія |
| `POST` | `/workspace/tickets/:id/convert-to-order` | → Order |
| `GET/POST/PATCH/DELETE` | `/settings/support/categories` | Категорії (owner) |

Leak-guard, participant-IDOR, tenant-guard — як у 03/02 (перевикористати `requireOrderParticipant`-патерн → `requireTicketParticipant`).

---

## 4. Фази

- **P1:** Ticket+TicketMessage, відкриття (portal), черга+відповідь+статуси (workspace), internal-нотатки, notify, SSE, категорії. Інтеграція в chat-hub.
- **P2:** SLA-політики+breach-cron, auto-assign-правила, canned-replies (шаблони), CSAT-оцінка після close, email/telegram як source (через модуль 27 inbound), KB-self-serve.
- **SaaS:** категорії/SLA per-agency; ліміти тікетів — через quota-seam.

## 5. Безпека

- Клієнт бачить лише свої тікети (companyId ∈ memberships) + лише public-повідомлення.
- Команда — всі тікети агенції; internal-нотатки невидимі клієнту.
- Усе agency-scoped + audit на статус/призначення/convert.

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

Власник: «це все варто додати» (підтверджено всі пункти модуля).

| ID   | Рішення                                                                                               | Вплив                 | Нюанси власника |
| ---- | ----------------------------------------------------------------------------------------------------- | --------------------- | --------------- |
| 29-А | **Canned replies** — СПІЛЬНА бібліотека шаблонів для тікетів і чатів замовлень (закриває борг з 03-Д) | [бек+екран]           | —               |
| 29-Б | **База знань у Portal** + підказка статей при створенні тікета; на SaaS — KB тенанта                  | [бек+екрани] середній | —               |
| 29-В | **CSAT після закриття тікета** (1-5 одним кліком)                                                     | [бек дрібний]         | —               |
| 29-Г | **Email-джерело тікетів** (support@ → тікет; відповідь → email) — разом з email-спринтом              | [бек] середній        | —               |

### ⭐ ГЛОБАЛЬНЕ (вимога власника, фаза «після фіксації функціоналу»): ПРОДУКТОВІ ТУРИ

Багаторівневі guided-тури «за руку»: (1) клієнт у Portal — що де налаштовується і як працювати; (2) виконавець у Workspace; (3) onboarding нового owner-тенанта на SaaS. **Рівні екскурсії залежать від ролі і відкритого функціоналу.** Реалізація — ПІСЛЯ закриття функціоналу (рішення власника: «на потім, але цікаво реалізувати»). → у план як окрема пізня фаза + дизайн-ТЗ на тур-оверлеї.

**Для ТЗ дизайнеру:** дизайн-ТЗ на тур-оверлеї продуктових турів (⭐, окрема пізня фаза).
