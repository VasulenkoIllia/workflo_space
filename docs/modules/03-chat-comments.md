# CHAT & COMMENTS MODULE

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Portal (portal.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`, `packages/storage`
> Оновлено: 1 червня 2026 (doc-sync)

---

> 🔄 **design-v2 (2026-06-20):** доставлено **order-chat** — 9 екранів чату замовлення з медіа (зображення/аудіо/відео/файли, lightbox, pinned-повідомлення): [`order-chat.jsx`](../../design-v2/project/order-chat.jsx). 🟢 **core бекенд є** (звірено): `orders/comments.ts` (GET/POST + read) + `orders/commentsStream.ts` (SSE) + `OrderComment` модель. Медіа/lightbox — нове. Матриця — [`DESIGN_SYSTEM.md §5.13`](../DESIGN_SYSTEM.md).

## Огляд

Модуль коментарів дозволяє спілкуватися між командою та клієнтом у контексті конкретного замовлення. Коментарі прив'язані до `orderId`. Реальний час забезпечується через **SSE (Server-Sent Events)** з використанням PostgreSQL `LISTEN/NOTIFY`.

Підтримуються:

- Текстові повідомлення (Markdown-light: bold, italic, code block, lists)
- Прикріплені файли (один або кілька на повідомлення)
- Внутрішні нотатки (invisible для клієнта) — тільки для команди

---

## Архітектура real-time

> **Канонічна архітектура — див. «## S1 alignment update → SSE — multi-instance + reconnect strategy» нижче** (+ «## Аудит-фіналізація»). Стисло: **один** канал `pg_notify('chat_events', {orderId,commentId,authorId,isInternal,createdAt})` через **DB-тригер** (транзакційно звʼязаний з INSERT — обійти неможливо) → **один** shared `LISTEN`-конект на інстанс (`pg.Client`, не Prisma; reconnect-backoff 1→60s) → in-memory `chatBus` fan-out до локальних SSE-стрімів. На подію — re-fetch повного коментаря + повторний leak-guard з DB-істини. Heartbeat 30s.
>
> ⚠️ **Застарілий дизайн видалено** (суперечив shared-bus): per-order канал `order_comments_{id}`, per-connection `LISTEN`, payload `{event,commentId,authorId}` та крок «клієнт робить `GET /comments/:commentId`». Реальність: один канал `chat_events`, сервер пушить повний обʼєкт.

---

## Бізнес-логіка

### Типи повідомлень

| Тип        | Видно клієнту | Видно команді |
| ---------- | ------------- | ------------- |
| `public`   | ✅            | ✅            |
| `internal` | ❌            | ✅            |

- Внутрішні нотатки відображаються в workspace із жовтим/помаранчевим фоном
- В portal внутрішні коментарі не повертаються взагалі (`WHERE type = 'public'`)

### Редагування та видалення

- Можна редагувати власний коментар протягом **15 хвилин** після публікації (вікно рахується від `createdAt`; факт правки фіксує `editedAt`, не `updatedAt`)
- Видалення: soft delete (`deletedAt`). Замість тексту показується "Повідомлення видалено"
- Owner може видалити будь-який коментар у workspace

### Прикріплені файли

- Файли завантажуються через `POST /files` (модуль Files) і повертають `fileId`
- При створенні коментаря передаємо масив `fileIds`
- У відповіді — об'єкт `attachments: FileDTO[]`
- Ліміт: **10 файлів** на коментар, **50 МБ** кожен

### Згадки (@mentions)

- У тексті можна тегнути учасника → нотифікація згаданому (подія `chat.mention`)
- **Канонічно:** фронт надсилає явні `mentionedUserIds` через participant-picker (див. «## @-mentions: participant picker» нижче); regex `/@(\w+)/g` по `displayName` лишається лише legacy best-effort fallback
- MVP: тільки Telegram-нотифікація при згадці

---

## API Endpoints

| Метод    | URL                               | Хто                | Опис                             |
| -------- | --------------------------------- | ------------------ | -------------------------------- |
| `GET`    | `/orders/:id/comments`            | Portal + Workspace | Список коментарів (з пагінацією) |
| `POST`   | `/orders/:id/comments`            | Portal + Workspace | Новий коментар                   |
| `PATCH`  | `/orders/:id/comments/:commentId` | Автор (15 хв)      | Редагувати текст                 |
| `DELETE` | `/orders/:id/comments/:commentId` | Автор / Owner      | Soft delete                      |
| `GET`    | `/orders/:id/comments/stream`     | Portal + Workspace | SSE stream                       |
| `POST`   | `/orders/:id/comments/read`       | Portal + Workspace | Позначити тред прочитаним        |

> **Стан реалізації (S2, 31.05.2026):** ✅ `GET`/`POST /comments` (cursor-пагінація `before`+`limit`, internal-leak guard, `requireOrderParticipant` IDOR), ✅ `POST /comments/read` + unread/`lastReadAt` у відповіді `GET` (S2-08), ✅ `GET /comments/stream` (SSE, S2-07) — **DB-тригер** `pg_notify('chat_events', {ids})` (транзакційно звʼязаний з INSERT, неможливо обійти) → **один** shared `LISTEN`-конект на інстанс (`pg.Client`, reconnect-backoff 1→60s) → in-memory `chatBus` fan-out до локальних SSE-підписників; heartbeat 30s; на події re-fetch повного коментаря + повторний leak-guard з DB-істини. Обрано тригер (не app-level publish) заради стабільності на 1000+ конкурентних стрімах. ⬜ `PATCH`/`DELETE` (edit/soft-delete), реакції, mentions, read-receipts (`seenBy`), `Last-Event-ID` replay — enhancement-беклог (на reconnect клієнт re-fetch `GET /comments`).

### Query для `GET /orders/:id/comments`

```
page=1
limit=50
before=commentId   // курсорна пагінація (older messages)
```

---

## DTO

### `POST /orders/:id/comments`

```typescript
{
  text: string        // max 10000 символів, min 1
  type?: 'public' | 'internal'  // default: 'public'. Тільки workspace може писати 'internal'
  fileIds?: string[]  // масив id завантажених файлів, max 10
  mentionedUserIds?: string[]  // опційно, або парсити з тексту
}
```

### Comment Response

```typescript
{
  id: string
  orderId: string
  content: string // не `text`
  isInternal: boolean // не `type`-enum
  editedAt: string | null // факт правки (не `isEdited`/`updatedAt`)
  deletedAt: string | null
  createdAt: string
  author: {
    id: string
    name: string
  }
  // attachments — коли прив'язку файлів до коментаря увімкнено (OrderFile.commentId/context — беклог модуля 04)
}
```

---

## DB Schema

> **Канонічна модель — `OrderComment` у `packages/db/prisma/schema.prisma`** (стара `Comment` видалена з doc-sync).
> Поля: `id, agencyId, orderId, authorId, content, isInternal, editedAt?, deletedAt?, createdAt` (+ план foundation-міграції: `replyToId?`, `mentionedUserIds[]`). `isInternal Boolean` замість `type CommentType`; `content` замість `text`. Файли-вкладення — `OrderFile` (модуль 04). Повний reconcile + нові фічі (реакції/reply/read-receipts) — «## Аудит-фіналізація» нижче.

---

## Нотифікації

| Подія                                | Кому                         | Канал            |
| ------------------------------------ | ---------------------------- | ---------------- |
| Новий публічний коментар від клієнта | Owner + Executors замовлення | Telegram         |
| Новий публічний коментар від команди | Company Owner                | Email + Telegram |
| Внутрішній коментар                  | Всі executors замовлення     | Telegram         |
| `@mention`                           | Згаданий користувач          | Telegram         |

> Email при кожному коментарі — надто часто. Email надсилається **тільки з workspace** якщо новий публічний коментар від команди (як офіційна відповідь).

---

## Frontend — UI/UX деталі

### Workspace (work.workflo.space)

- Чат у правій панелі сторінки замовлення
- Таб-перемикач: "Всі" / "Внутрішні"
- Внутрішні нотатки виділені помаранчевою смужкою зліва
- Редагування inline: клік на повідомлення → edit mode → Save / Cancel
- Drag & drop файлів у вікно чату

### Portal (portal.workflo.space)

- Чат у секції замовлення
- Тільки публічні повідомлення
- Показуємо аватар + ім'я (для команди — "Команда Workflo" або реальне ім'я — конфіг)
- Відправлення: Enter (без Shift) — надіслати, Shift+Enter — новий рядок

### Загальне

- Автоскрол до останнього повідомлення при відкритті
- При новому SSE-повідомленні: якщо скролено вниз — автоскрол, якщо ні — "нові повідомлення ↓" кнопка
- Оптимістичний UI: повідомлення з'являється одразу (з індикатором "відправляється"), потім заміщується реальним

---

## Зв'язки з іншими модулями

| Модуль            | Зв'язок                                                        |
| ----------------- | -------------------------------------------------------------- |
| **Orders**        | Коментарі завжди в контексті замовлення                        |
| **Files**         | `FileAttachment` прив'язується до `commentId`                  |
| **Notifications** | Нові коментарі → push/email                                    |
| **Auth**          | `authorId` = `profileId`, визначає `type` доступних коментарів |

---

## S1 alignment update (17 квітня 2026 → 27 травня 2026)

### SSE — multi-instance + reconnect strategy

**Проблема:** при scale > 1 API replica, in-memory broadcaster per instance не бачить події з інших instances.

**Рішення:** PostgreSQL LISTEN/NOTIFY як shared bus + per-instance in-memory broadcaster для local SSE clients.

#### Архітектура

```
[Comment INSERT]
       ↓
   Postgres trigger pg_notify('chat_events', json_build_object(
     'orderId', NEW.order_id,
     'commentId', NEW.id,
     'authorId', NEW.author_id,
     'createdAt', NEW.created_at
   )::text)
       ↓
   [API instance A] LISTEN chat_events
       ↓
   in-memory broadcaster.emit('chat:newComment', payload)
       ↓
   SSE streams subscribed to that order push event to client
```

Кожен API instance:

- На старті: `LISTEN chat_events` + `LISTEN order_events`.
- Single shared connection (через `pg.Client`, не Prisma — для постійного LISTEN).
- Reconnect with backoff (1s → 2s → 4s → ... → max 60s) при втраті connection.

#### Client-side reconnect

EventSource у браузері auto-reconnects on disconnect. Стратегія:

- Server відправляє `event: heartbeat\ndata: {}\n\n` кожні 30 секунд (proxies можуть kill idle streams).
- Client: на reconnect, надсилає `Last-Event-ID` header → server повертає missed events з `notification_logs` (filter by createdAt > lastId).

#### Backpressure

Якщо client lagging > 100 messages → close stream, send 503. Client reconnects + does full refresh of conversation list.

### Read tracking

Див. **18-chat-hub.md** → `order_chat_reads` table.

### Notification triggers від chat

При новому коментарі:

1. INSERT у `order_comments`.
2. pg_notify відправляє у SSE (real-time live update).
3. `notify(event='chat.new_comment')` для усіх **інших** учасників розмови (не для author).
4. Якщо коментар містить `@username` → `notify(event='chat.mention')` adressed конкретно тій людині (separate event).

Rollup для chat events: див. `07-notifications.md` секція "Anti-spam: rollup".

---

## @-mentions: participant picker (аудит-доповнення, 29 травня 2026)

Поточний бекенд парсить `@ім'я` через regex по `displayName` — крихко (пробіли, кирилиця, тезки). Додаємо нормальний UX «показати людей у кімнаті + тегнути», який власник просив.

### Учасники кімнати

```
GET /orders/:id/participants
```

Повертає людей, що мають доступ до чату цього замовлення (для @-автокомпліту):

- усі члени company замовлення (`company_members` де companyId = order.companyId),
- призначений виконавець (`order.assigneeId`),
- owner агенції,
- автори коментарів у цьому order (на випадок, якщо хтось уже писав).

**Response 200:**

```json
{
  "data": [
    { "id": "uuid", "displayName": "Олена Петренко", "role": "owner", "avatarUrl": null },
    { "id": "uuid", "displayName": "Іван Клієнт", "role": "member", "avatarUrl": null }
  ]
}
```

Authz: будь-який учасник чату (member company або executor на order).

### Frontend @-picker

- Користувач друкує `@` → дропдаун зі списком `GET /orders/:id/participants` (фільтр по введеному тексту).
- Вибір вставляє токен `@[Ім'я](userId)` у текст (зберігає **explicit userId**, не покладаємось на ім'я).
- При сабміті фронт надсилає `content` + витягнуті `mentionedUserIds: string[]`.

### Бекенд

- `POST /orders/:id/comments { content, mentionedUserIds? }`:
  - якщо `mentionedUserIds` передані — використовуємо їх (надійно);
  - **fallback**: якщо не передані, парсимо `@[...](id)`-токени з `content`; якщо й тих нема — старий regex по displayName (legacy, best-effort).
  - валідація: кожен `mentionedUserId` має бути учасником кімнати (інакше ігноруємо — не можна тегнути сторонього).
- Для кожного валідного mentioned → `notify(event='chat.mention')` (окремо від `chat.new_comment`).

### DB

`OrderComment.mentionedUserIds String[]` — зберігаємо явний список тегнутих (для підсвітки в UI + повторних нотифікацій). Додається у схему разом з реалізацією чату (S2).

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

> Авторитетна секція. Стара `Comment`-модель вище → видалити в doc-sync.

### A. Обов'язкові reconcile

- `Comment`→`OrderComment` (`content` не `text`; `isInternal Boolean` не `type enum`).
- **SSE re-auth**: при закінченні access-токена в стрімі — close + клієнт reconnect з новим токеном; на reconnect віддаємо missed (Last-Event-ID).
- **Internal-leak guard**: NOTIFY несе лише IDs; follow-up fetch для portal-юзера повторно перевіряє `isInternal=false`. Stream для клієнта НЕ пушить internal.
- **Participant IDOR**: `GET /orders/:id/comments` + POST — лише учасник order (company-member або executor на order) + tenant-guard.
- **`agencyId`** денормалізація на `order_comments`.

### B. Редагування + видалення ✅

- `OrderComment` додає `editedAt DateTime?`, `deletedAt DateTime?`, `updatedAt DateTime @updatedAt`.
- `PATCH /orders/:id/comments/:commentId` — лише автор, вікно 15хв (owner — будь-коли); set `editedAt`. `DELETE` — soft (`deletedAt`), UI «повідомлення видалено». Видалення/редагування пушиться у SSE + оновлює inbox-preview (модуль 18).

### C. Реакції ✅

- `CommentReaction { id, commentId, profileId, emoji, createdAt, @@unique([commentId, profileId, emoji]) }`.
- `POST/DELETE /orders/:id/comments/:commentId/reactions { emoji }`. Агрегат `{emoji, count, reactedByMe}` у відповіді коментаря. Tenant/participant guard.

### D. Відповіді (reply-to) ✅

- `OrderComment.replyToId String?` (self-relation). UI цитує батьківський. При reply на чужий коментар — notify автору батьківського (event `chat.reply`).

### E. Read receipts ✅

- Базується на `order_chat_reads { orderId, profileId, lastReadAt }` (модуль 18). Коментар `seenBy` = учасники з `lastReadAt >= comment.createdAt`. UI: «прочитано» + аватари. `POST /orders/:id/read` оновлює.

### Schema-зміни (foundation-міграція)

```
OrderComment: + editedAt, deletedAt, updatedAt, replyToId, mentionedUserIds[], agencyId
New: CommentReaction, OrderChatRead (спільно з 18)
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID       | Рішення                                                                                                                                                               | Вплив                       | Нюанси власника                                                                                                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03-Б     | **Індикатор «друкує…»** — ефемерна подія через наявний SSE-bus, без запису в БД                                                                                       | [бек дрібний + 1 рядок UI]  | —                                                                                                                                                                                                                                                                            |
| 03-В     | **Пошук у чаті замовлення** — локальний пошук по коментарях конкретного order                                                                                         | [бек+екран дрібний]         | глобальний пошук — модуль 16, не плутати                                                                                                                                                                                                                                     |
| 03-Г     | **Закріплені повідомлення (pin)** — ТЗ/реквізити/домовленості зверху чату                                                                                             | [бек] + секція «закріплене» | owner/команда пінить; клієнт бачить                                                                                                                                                                                                                                          |
| 03-МЕДІА | **Медіа-вкладення в чат: фото/картинки, аудіо, відео** — з інлайн-відображенням: картинки прев'ю+лайтбокс, аудіо з плеєром, відео з плеєром                           | [бек+екран]                 | Розширити MIME-allowlist (@workflo/types) на audio/video; ліміти розміру для відео переглянути (зараз 100MB/файл); привʼязка файл→коментар (`OrderFile.commentId` — закрити беклог модуля 04). Запис голосу В БРАУЗЕРІ (ідея А) — відхилено; саме ЗАВАНТАЖЕННЯ готових медіа |
| 03-REPLY | **Reply-to (відповідь на повідомлення з цитатою)** — ПІДТВЕРДЖЕНО вже специфіковане (Аудит-фіналізація D, `replyToId`), пріоритет піднято: обовʼязково в план доробок | [бек+екран]                 | було specced-not-built у S10                                                                                                                                                                                                                                                 |

**Відхилено:** А (запис голосових у браузері), Д (canned replies — повернутись при модулі 29), Е (email-міст у чат — повернутись при модулі 08/S12), Ж (link preview).

**Для ТЗ дизайнеру:** рендер медіа в чаті обох апок — картинка-прев'ю + лайтбокс, аудіо-плеєр, відео-плеєр, стани завантаження великих файлів (03-МЕДІА); цитата-блок reply-to + UI «відповісти» (03-REPLY); рядок «друкує…» (Б); поле пошуку в чаті + підсвітка збігів (В); секція закріплених + дія pin/unpin (Г).
