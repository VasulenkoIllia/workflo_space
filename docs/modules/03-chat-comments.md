# CHAT & COMMENTS MODULE
> App: Portal (app.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`, `packages/storage`
> Оновлено: 12 квітня 2026

---

## Огляд

Модуль коментарів дозволяє спілкуватися між командою та клієнтом у контексті конкретного замовлення. Коментарі прив'язані до `orderId`. Реальний час забезпечується через **SSE (Server-Sent Events)** з використанням PostgreSQL `LISTEN/NOTIFY`.

Підтримуються:
- Текстові повідомлення (Markdown-light: bold, italic, code block, lists)
- Прикріплені файли (один або кілька на повідомлення)
- Внутрішні нотатки (invisible для клієнта) — тільки для команди

---

## Архітектура real-time

```
Client (Portal/Workspace)
    ↓ EventSource("/orders/:id/comments/stream")
API (Fastify SSE endpoint)
    ↓ LISTEN "order_comments_{orderId}"
PostgreSQL NOTIFY
    ↑ triggered by: INSERT INTO comments / UPDATE comments
```

### Postgres NOTIFY trigger

```sql
CREATE OR REPLACE FUNCTION notify_comment_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'order_comments_' || NEW.order_id,
    json_build_object(
      'event', 'new_comment',
      'commentId', NEW.id,
      'authorId', NEW.author_id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_notify_trigger
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION notify_comment_insert();
```

### SSE Connection lifecycle

1. Клієнт робить `GET /orders/:id/comments/stream` → Fastify тримає з'єднання відкритим
2. Fastify підключається до Postgres через `pg.connect()` і виконує `LISTEN order_comments_{id}`
3. При `NOTIFY` — Fastify відправляє `data: {...}\n\n` клієнту
4. Клієнт по отриманому `commentId` робить `GET /orders/:id/comments/:commentId` щоб отримати повний коментар (або API відправляє повний об'єкт в NOTIFY)
5. При закритті з'єднання — Fastify виконує `UNLISTEN` і звільняє з'єднання

> **Heartbeat:** кожні 30 секунд Fastify відправляє `data: {"event":"ping"}\n\n` щоб тримати з'єднання живим через проксі.

---

## Бізнес-логіка

### Типи повідомлень

| Тип | Видно клієнту | Видно команді |
|---|---|---|
| `public` | ✅ | ✅ |
| `internal` | ❌ | ✅ |

- Внутрішні нотатки відображаються в workspace із жовтим/помаранчевим фоном
- В portal внутрішні коментарі не повертаються взагалі (`WHERE type = 'public'`)

### Редагування та видалення

- Можна редагувати власний коментар протягом **15 хвилин** після публікації (`updatedAt - createdAt < 15 min`)
- Видалення: soft delete (`deletedAt`). Замість тексту показується "Повідомлення видалено"
- Owner може видалити будь-який коментар у workspace

### Прикріплені файли

- Файли завантажуються через `POST /files` (модуль Files) і повертають `fileId`
- При створенні коментаря передаємо масив `fileIds`
- У відповіді — об'єкт `attachments: FileDTO[]`
- Ліміт: **10 файлів** на коментар, **50 МБ** кожен

### Згадки (@mentions)

- У тексті можна написати `@ім'я` → система парсить і надсилає нотифікацію згаданому
- Парсинг на бекенді через regex `/@(\w+)/g` → lookup по `profiles.displayName`
- MVP: тільки Telegram-нотифікація при згадці

---

## API Endpoints

| Метод | URL | Хто | Опис |
|---|---|---|---|
| `GET` | `/orders/:id/comments` | Portal + Workspace | Список коментарів (з пагінацією) |
| `POST` | `/orders/:id/comments` | Portal + Workspace | Новий коментар |
| `PATCH` | `/orders/:id/comments/:commentId` | Автор (15 хв) | Редагувати текст |
| `DELETE` | `/orders/:id/comments/:commentId` | Автор / Owner | Soft delete |
| `GET` | `/orders/:id/comments/stream` | Portal + Workspace | SSE stream |

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
  text: string
  type: 'public' | 'internal'
  isEdited: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  author: {
    id: string
    displayName: string
    avatarUrl: string | null
    role: 'owner' | 'executor' | 'client'
  }
  attachments: {
    id: string
    fileName: string
    fileSize: number
    mimeType: string
    url: string
  }[]
}
```

---

## DB Schema

```prisma
model Comment {
  id        String      @id @default(uuid())
  orderId   String
  authorId  String
  text      String
  type      CommentType @default(public)
  isEdited  Boolean     @default(false)
  deletedAt DateTime?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  order       Order            @relation(fields: [orderId], references: [id])
  author      Profile          @relation(fields: [authorId], references: [id])
  attachments FileAttachment[]

  @@index([orderId, createdAt])
  @@index([authorId])
}

enum CommentType {
  public
  internal
}
```

---

## Нотифікації

| Подія | Кому | Канал |
|---|---|---|
| Новий публічний коментар від клієнта | Owner + Executors замовлення | Telegram |
| Новий публічний коментар від команди | Company Owner | Email + Telegram |
| Внутрішній коментар | Всі executors замовлення | Telegram |
| `@mention` | Згаданий користувач | Telegram |

> Email при кожному коментарі — надто часто. Email надсилається **тільки з workspace** якщо новий публічний коментар від команди (як офіційна відповідь).

---

## Frontend — UI/UX деталі

### Workspace (work.workflo.space)

- Чат у правій панелі сторінки замовлення
- Таб-перемикач: "Всі" / "Внутрішні"
- Внутрішні нотатки виділені помаранчевою смужкою зліва
- Редагування inline: клік на повідомлення → edit mode → Save / Cancel
- Drag & drop файлів у вікно чату

### Portal (app.workflo.space)

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

| Модуль | Зв'язок |
|---|---|
| **Orders** | Коментарі завжди в контексті замовлення |
| **Files** | `FileAttachment` прив'язується до `commentId` |
| **Notifications** | Нові коментарі → push/email |
| **Auth** | `authorId` = `profileId`, визначає `type` доступних коментарів |
