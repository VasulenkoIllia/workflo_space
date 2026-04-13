# NOTIFICATIONS MODULE
> App: API (api.workflo.space) / Bot (Telegram)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`
> Оновлено: 12 квітня 2026

---

## Огляд

Централізований модуль нотифікацій. Всі нотифікації в системі відправляються через єдину функцію `notify()` з `packages/notifications`. Підтримувані канали в MVP: **Email** + **Telegram**. SMS — Phase 3.

---

## Архітектура (Channel Adapter Pattern)

```typescript
// packages/notifications/src/NotificationAdapter.ts
interface NotificationAdapter {
  send(to: string, payload: NotificationPayload): Promise<void>
}

interface NotificationPayload {
  subject?: string      // для email
  text: string          // plain text fallback
  html?: string         // для email
}

// packages/notifications/src/adapters/EmailAdapter.ts
class EmailAdapter implements NotificationAdapter {
  async send(email: string, payload): Promise<void> {
    await nodemailer.sendMail({ to: email, subject: payload.subject, html: payload.html })
  }
}

// packages/notifications/src/adapters/TelegramAdapter.ts
class TelegramAdapter implements NotificationAdapter {
  async send(chatId: string, payload): Promise<void> {
    await bot.api.sendMessage(chatId, payload.text, { parse_mode: 'HTML' })
  }
}

// packages/notifications/src/notify.ts
export async function notify(
  profileId: string,
  event: NotificationEvent,
  context: Record<string, any>
): Promise<void> {
  const settings = await getNotificationSettings(profileId)
  const profile = await getProfile(profileId)

  const channels = resolveChannels(event, settings)  // визначаємо які канали активні

  for (const channel of channels) {
    if (channel === 'email' && profile.email && settings.emailEnabled) {
      const html = renderEmailTemplate(event, context, profile.language)
      await emailAdapter.send(profile.email, { subject: getSubject(event), html })
    }
    if (channel === 'telegram' && profile.telegramChatId && settings.telegramEnabled) {
      const text = renderTelegramMessage(event, context, profile.language)
      await telegramAdapter.send(profile.telegramChatId, { text })
    }
  }

  // Зберігаємо в таблицю notifications (для in-app history)
  await saveNotification(profileId, event, context)
}
```

### Додавання нового каналу (Phase 3 — SMS)

1. Створити `SmsAdapter implements NotificationAdapter`
2. Додати `smsEnabled` в `NotificationSettings` + міграція
3. Додати `profile.phoneNumber` lookup
4. Зареєструвати в `resolveChannels()`
5. **Нуль змін у бізнес-логіці замовлень/чату**

---

## Events (NotificationEvent enum)

```typescript
enum NotificationEvent {
  // Orders
  ORDER_CREATED = 'order.created',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  ORDER_ASSIGNED = 'order.assigned',
  ORDER_DUE_SOON = 'order.due_soon',

  // Chat
  COMMENT_CREATED = 'comment.created',
  COMMENT_MENTION = 'comment.mention',

  // Billing
  PAYMENT_RECEIVED = 'payment.received',
  INVOICE_SENT = 'invoice.sent',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  SUBSCRIPTION_EXPIRING = 'subscription.expiring',

  // Documents
  DOCUMENT_SENT = 'document.sent',
  DOCUMENT_SIGNED = 'document.signed',

  // Auth
  WELCOME = 'auth.welcome',
  PASSWORD_RESET = 'auth.password_reset',
  INVITE_SENT = 'auth.invite_sent',

  // Referral
  REFERRAL_ACTIVATED = 'referral.activated',
  REFERRAL_BONUS = 'referral.bonus',

  // System
  BACKUP_DONE = 'system.backup_done',
  BACKUP_FAILED = 'system.backup_failed',
  DEPLOY_DONE = 'system.deploy_done',
}
```

---

## NotificationSettings (налаштування юзера)

```prisma
model NotificationSettings {
  id              String  @id @default(uuid())
  profileId       String  @unique
  emailEnabled    Boolean @default(true)
  telegramEnabled Boolean @default(true)

  // Які події надсилати по email
  emailOrderStatus    Boolean @default(true)
  emailComments       Boolean @default(true)
  emailBilling        Boolean @default(true)
  emailDocuments      Boolean @default(true)

  // Які події надсилати в Telegram
  telegramOrderStatus Boolean @default(true)
  telegramComments    Boolean @default(true)
  telegramBilling     Boolean @default(true)
  telegramMentions    Boolean @default(true)

  profile Profile @relation(fields: [profileId], references: [id])
}
```

---

## Таблиця notifications (in-app history)

```prisma
model Notification {
  id        String            @id @default(uuid())
  profileId String
  event     String            // NotificationEvent value
  title     String
  body      String
  meta      Json?             // orderId, commentId, etc. для клікабельних лінків
  isRead    Boolean           @default(false)
  createdAt DateTime          @default(now())

  profile Profile @relation(fields: [profileId], references: [id])

  @@index([profileId, isRead])
  @@index([profileId, createdAt])
}
```

In-app нотифікації (bell icon) показуються з `notifications` таблиці. SSE stream для bell — при `INSERT` в `notifications` → `pg_notify('notifications_{profileId}', ...)`.

---

## API Endpoints

| Метод | URL | Опис |
|---|---|---|
| `GET` | `/notifications` | Список нотифікацій юзера (з пагінацією) |
| `PATCH` | `/notifications/:id/read` | Позначити як прочитано |
| `PATCH` | `/notifications/read-all` | Позначити всі як прочитано |
| `GET` | `/notifications/stream` | SSE stream для bell icon |
| `GET` | `/notifications/settings` | Налаштування нотифікацій |
| `PATCH` | `/notifications/settings` | Оновити налаштування |

---

## DTO

### `GET /notifications`

```typescript
// Query
{
  page?: number
  limit?: number  // default 20
  isRead?: boolean
}

// Response
{
  items: {
    id: string
    event: string
    title: string
    body: string
    meta: { orderId?: string; commentId?: string } | null
    isRead: boolean
    createdAt: string
  }[]
  unreadCount: number
  total: number
}
```

### `PATCH /notifications/settings`

```typescript
{
  emailEnabled?: boolean
  telegramEnabled?: boolean
  emailOrderStatus?: boolean
  emailComments?: boolean
  emailBilling?: boolean
  emailDocuments?: boolean
  telegramOrderStatus?: boolean
  telegramComments?: boolean
  telegramBilling?: boolean
  telegramMentions?: boolean
}
```

---

## Telegram прив'язка

Прив'язка Telegram акаунту до профілю через OTP flow:

1. Юзер відкриває "Підключити Telegram" в налаштуваннях
2. API генерує OTP (`otp_tokens` з `purpose=telegram_link`, `channel=telegram`)
3. Юзеру показується посилання на бота: `https://t.me/workflo_bot?start=OTP_CODE`
4. Юзер натискає → бот отримує `/start OTP_CODE`
5. Бот перевіряє OTP, знаходить `profileId`, зберігає `telegramChatId` в `profiles`
6. Бот відправляє підтвердження: "✅ Telegram успішно прив'язано до вашого акаунту Workflo"

```prisma
// В profiles:
telegramChatId String?  // chat_id від Telegram
```

---

## Черга нотифікацій (Phase 2)

В MVP `notify()` викликається синхронно (fire-and-forget з `catch` щоб не блокувати API). В Phase 2 — перехід на Redis Queue (BullMQ) для:
- Retry при невдачі
- Rate limiting (Telegram: 30 msg/sec)
- Пріоритети
- Dead letter queue

---

## Зв'язки з іншими модулями

| Модуль | Де викликається `notify()` |
|---|---|
| **Auth** | welcome, password_reset, invite_sent |
| **Orders** | order_created, status_changed, assigned, due_soon |
| **Chat** | comment_created, mention |
| **Billing** | payment_received, invoice_sent, subscription events |
| **Documents** | document_sent, document_signed |
| **Referral** | referral_activated, referral_bonus |
| **Bot** | Telegram-бік: відправляє повідомлення через `TelegramAdapter` |
