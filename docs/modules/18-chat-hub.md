# CHAT HUB MODULE

> App: Portal + Workspace
> Статус: S4+ (post-MVP)
> Залежить від: `03-chat-comments`, SSE infra
> Оновлено: 27 травня 2026

---

## Огляд

**Чат-хаб** — глобальний inbox-екран, який зведено всі активні чати замовлень користувача у один список з UI на кшталт Telegram/Slack: список conversations зліва, повідомлення справа, real-time SSE.

Замість того щоб бігати по сторінках `/orders/:id` дивитися кожен чат, є один `/messages` (Portal) або `/inbox` (Workspace) — швидкий контекст.

---

## Use cases

- **Client (Portal)**: бачить всі **свої** чати по своїх компаніях у `/messages`. Counter unread bubble у sidebar.
- **Owner of agency / executor (Workspace)**: бачить всі чати orders в `/inbox` — own assigned + те де згаданий, в що мають увагу.

Чати **за orders** (з модуля 03-chat-comments) — основне джерело даних. Окремих чатів між profile-ами без order MVP не підтримує.

---

## API

| Method | Path | Auth | Опис |
|---|---|---|---|
| `GET` | `/messages/conversations` | client+ | List conversations (orders з якими user взаємодіяв або в які invited) |
| `GET` | `/messages/conversations/:orderId` | client+ (своя компанія/assigned) | Деталі: order metadata + messages (paginated) |
| `POST` | `/orders/:id/comments` | client+ | Існуючий endpoint з модуля 03 — використовується для send |
| `POST` | `/messages/conversations/:orderId/read` | client+ | Mark unread badge as seen |
| `GET` | `/messages/unread-count` | client+ | Total counter для sidebar badge |

### Response shape `GET /messages/conversations`:

```json
{
  "items": [
    {
      "orderId": "uuid",
      "orderTitle": "Land migration",
      "companyName": "Acme",
      "lastMessage": {
        "authorName": "Olena",
        "preview": "Можна додати ще одну...",
        "createdAt": "2026-05-27T10:23:00Z"
      },
      "unreadCount": 3,
      "clientStatus": "in_progress"
    }
  ],
  "totalUnread": 8,
  "cursor": "next-cursor"
}
```

Order: за `lastMessage.createdAt DESC`, з unread на верх.

---

## Unread tracking

Окрема таблиця `order_chat_reads`:

```prisma
model OrderChatRead {
  orderId      String
  profileId    String
  lastReadAt   DateTime @db.Timestamptz(3)

  @@id([orderId, profileId])
  @@map("order_chat_reads")
}
```

`unreadCount` = `SELECT COUNT(*) FROM order_comments WHERE orderId=? AND createdAt > lastReadAt AND authorId <> currentProfile`.

`POST /messages/conversations/:orderId/read` → upsert OrderChatRead set lastReadAt = NOW().

---

## SSE real-time

- Endpoint `GET /sse/messages` (один SSE-stream per session) — пушить події:
  - `chat.new_comment` — для conversations, що user має доступ.
  - `chat.read` — щоб синхронізувати read state між табами.
- Backend: окремий `notify`-pipeline → крім запису у `notifications` table, push у in-memory broadcaster → SSE clients.
- Multi-instance: API uses `pg_notify('chat_events', json)` → кожен API instance слухає LISTEN + relay у local SSE clients.

Детальніше про SSE infra — у `03-chat-comments.md` секція "SSE multi-instance".

---

## UI у Portal (`/messages`)

```
┌──────────────────┬──────────────────────────┐
│ Conversations    │ Selected: "Land migration"│
│                  │ (Acme · in progress)      │
│ ▢ Acme · Land    │ ──────────────────────   │
│   3 unread       │                          │
│                  │ Olena: Привіт, потрібно... │
│ ▢ Acme · Bitrix  │ Ivan:  Окей, в роботі     │
│   1 unread       │ Olena: Готово, перевір    │
│                  │ ──────────────────────   │
│ ✓ Foo · CRM      │ [Type message...] [Send]  │
│                  │                          │
└──────────────────┴──────────────────────────┘
```

Mobile: 2-screen flow (list → detail → back).

---

## UI у Workspace (`/inbox`)

Те саме але з додатковою колонкою клієнт/company (executor працює з багатьма) + filter "assigned to me" / "mentioned me" / "all".

---

## Sidebar badge

У layout sidebar обох додатків:
- "Messages" / "Inbox" з червоним bubble `unreadCount`.
- Live update через SSE (отримуємо `chat.new_comment` → +1 локально).

---

## Edge cases

- **Order soft-deleted** → conversation зникає з inbox. Якщо restored → знову з'являється з тією ж історією.
- **Profile lost access** (kicked from company): conversation не показується у списку, але історія НЕ видаляється з БД.
- **N+1 unread query**: solved через materialized cached `order_chat_unread_counters` (cached recomputed on insert + mark-as-read).

---

## Performance

- 1000+ conversations per user: pagination + cursor + composite index `(profileId, lastMessageAt DESC)`.
- Detail view: останні 50 messages, prev page via cursor.
- SSE limit: 1 stream per user-session; older streams disconnect after 5min idle.
