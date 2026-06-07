# TELEGRAM BOT MODULE

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Bot (grammY) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`
> Оновлено: 12 квітня 2026

---

## Огляд

Telegram бот `@workflo_bot` — додатковий канал для нотифікацій команди та клієнтів. В MVP бот **тільки надсилає** сповіщення (push-only). Команди бота мінімальні: `/start` для прив'язки акаунту, `/status` для перевірки з'єднання.

В Phase 3 — інтерактивні команди (перегляд замовлень, зміна статусу).

---

## Технічний стек

- **grammY** — TypeScript-first Telegram Bot framework
- **BOT_MODE**: `polling` (dev) / `webhook` (prod) через ENV
- Запускається як окремий Docker контейнер

---

## Режими роботи

### Development (`BOT_MODE=polling`)

```typescript
// apps/bot/src/index.ts
if (process.env.BOT_MODE === 'webhook') {
  const { webhookCallback } = await import('grammy')
  // webhook mode
} else {
  await bot.start() // long polling
}
```

### Production (`BOT_MODE=webhook`)

```typescript
// Реєстрація webhook при старті
await bot.api.setWebhook(`${process.env.BOT_WEBHOOK_URL}/bot/webhook`, {
  secret_token: process.env.BOT_WEBHOOK_SECRET,
})

// Fastify endpoint для webhook
// apps/api/src/routes/bot-webhook.ts
fastify.post(
  '/bot/webhook',
  {
    config: { rawBody: true },
    preHandler: verifyWebhookSecret,
  },
  async (req, reply) => {
    await webhookHandler(req.body)
    return reply.send({ ok: true })
  }
)
```

> Webhook отримує повідомлення через API (Fastify), а не окремий порт бота — спрощує Traefik конфіг.

---

## Команди бота

### `/start` або `/start {OTP_CODE}`

**Без коду:** Привітання + інструкція як прив'язати акаунт

```
Привіт! 👋 Я бот Workflo.Space.

Щоб отримувати сповіщення, прив'яжи свій акаунт:
1. Відкрий налаштування на portal.workflo.space або work.workflo.space
2. Перейди в розділ "Безпека"
3. Натисни "Підключити Telegram"
4. Перейди по отриманому посиланню
```

**З кодом (OTP flow):**

```typescript
bot.command('start', async (ctx) => {
  const startPayload = ctx.match // OTP code після /start

  if (startPayload) {
    const otp = await db.otpToken.findFirst({
      where: {
        token: startPayload,
        purpose: 'telegram_link',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    if (!otp) {
      return ctx.reply('❌ Код недійсний або прострочений. Спробуй ще раз.')
    }

    // Прив'язуємо
    await db.$transaction([
      db.profile.update({
        where: { id: otp.profileId },
        data: {
          telegramChatId: String(ctx.chat.id),
          telegramUsername: ctx.from?.username ?? null,
        },
      }),
      db.otpToken.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      }),
    ])

    await ctx.reply(
      "✅ Telegram успішно прив'язано до вашого акаунту Workflo.Space!\n\nТепер ви будете отримувати сповіщення тут."
    )
  } else {
    await ctx.reply('👋 Привіт! Я бот Workflo.Space...')
  }
})
```

### `/status`

```
📊 Статус підключення:
✅ Акаунт прив'язано: Іван Петренко (ivan@example.com)
🔔 Нотифікації: увімкнено

Для відключення: /unlink
```

### `/unlink`

Відключає `telegramChatId` від профілю.

### `/help`

Список доступних команд.

---

## Нотифікаційні повідомлення

Бот надсилає повідомлення через `TelegramAdapter` з `packages/notifications`. Формат — HTML (підтримується через `parse_mode: 'HTML'`).

### Приклади повідомлень

#### Нове замовлення (команді)

```
🆕 <b>Нове замовлення</b>

📋 <b>Назва:</b> Автоматизація звітності в Excel
🏢 <b>Клієнт:</b> ТОВ Ромашка
⚡ <b>Пріоритет:</b> Високий
💰 <b>Сума:</b> $500

<a href="https://work.workflo.space/orders/uuid">Відкрити замовлення →</a>
```

#### Зміна статусу (клієнту)

```
📦 <b>Статус замовлення змінено</b>

📋 <b>Замовлення:</b> Автоматизація звітності
📊 <b>Новий статус:</b> ✅ Виконано, очікує вашого підтвердження

<a href="https://portal.workflo.space/orders/uuid">Переглянути →</a>
```

#### Нове повідомлення в чаті

```
💬 <b>Нове повідомлення</b> від команди Workflo

📋 <b>Замовлення:</b> Автоматизація звітності
✉️ Підготували фінальний звіт, перевірте будь ласка...

<a href="https://portal.workflo.space/orders/uuid#chat">Відповісти →</a>
```

#### Рахунок виставлено

```
🧾 <b>Новий рахунок</b>

📄 <b>№ рахунку:</b> INV-2026-0042
💰 <b>Сума:</b> $500 / ₴20,750
📅 <b>Дата:</b> 12 квітня 2026

<a href="https://portal.workflo.space/documents/uuid">Завантажити PDF →</a>
```

---

## TelegramAdapter

```typescript
// packages/notifications/src/adapters/TelegramAdapter.ts
import { Bot } from 'grammy'

class TelegramAdapter implements NotificationAdapter {
  private bot: Bot

  constructor(token: string) {
    this.bot = new Bot(token)
  }

  async send(chatId: string, payload: NotificationPayload): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, payload.text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      })
    } catch (error) {
      // Якщо користувач заблокував бота — очищаємо telegramChatId
      if (error.error_code === 403) {
        await db.profile.updateMany({
          where: { telegramChatId: chatId },
          data: { telegramChatId: null },
        })
      }
      logger.error('Telegram send failed', { chatId, error })
    }
  }
}
```

---

## Структура apps/bot

```
apps/bot/
├── src/
│   ├── index.ts          // Ініціалізація бота, підключення до Fastify або polling
│   ├── commands/
│   │   ├── start.ts
│   │   ├── status.ts
│   │   ├── unlink.ts
│   │   └── help.ts
│   ├── middleware/
│   │   └── logger.ts     // Логування всіх апдейтів
│   └── bot.ts            // Екземпляр бота, реєстрація handlers
├── Dockerfile
└── package.json
```

---

## Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

---

## ENV Variables

| Variable             | Значення                           |
| -------------------- | ---------------------------------- |
| `BOT_TOKEN`          | Telegram Bot token від @BotFather  |
| `BOT_MODE`           | `polling` (dev) / `webhook` (prod) |
| `BOT_WEBHOOK_URL`    | `https://api.workflo.space` (prod) |
| `BOT_WEBHOOK_SECRET` | Секрет для верифікації webhook     |
| `DATABASE_URL`       | PostgreSQL connection string       |

---

## BotFather налаштування

```
/setcommands
start - Прив'язати акаунт Workflo.Space
status - Перевірити статус підключення
unlink - Відключити Telegram
help - Список команд
```

```
/setdescription
Офіційний бот Workflo.Space. Отримуй сповіщення про замовлення, платежі та документи.

/setabouttext
workflo.space — платформа для управління замовленнями та командою.
```

---

## Phase 3 — Інтерактивні команди

- `/orders` — список активних замовлень (inline keyboard)
- `/order {id}` — деталі замовлення
- Inline кнопки: "Змінити статус", "Додати коментар"
- Callback query handlers для кнопок
- Notification channels через bot menu

---

## Зв'язки з іншими модулями

| Модуль            | Зв'язок                                        |
| ----------------- | ---------------------------------------------- |
| **Auth**          | `/start OTP` — прив'язка Telegram до профілю   |
| **Notifications** | `TelegramAdapter` — відправка всіх нотифікацій |
| **Orders**        | Посилання на замовлення в повідомленнях        |
| **Billing**       | Повідомлення про рахунки та платежі            |
| **Documents**     | Повідомлення про нові документи                |

---

## S1 alignment update (17 квітня 2026 → 27 травня 2026)

### OTP rate limit

`/start <code>` flow для Telegram linking:

- 5 attempts / 15 min per (chat_id OR ip).
- 6-digit code, 10 min TTL у `otp_tokens`.
- Wrong code → `otp_tokens.attempts++`, при `attempts >= 5` → invalidate token.
- Audit log: `auth.otp_failed` per attempt; `auth.otp_blocked` коли rate-limited.

```typescript
const recentAttempts = await prisma.otpToken.count({
  where: {
    purpose: 'telegram_link',
    createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
    metadata: { path: ['ip'], equals: requestIp },
  },
})
if (recentAttempts >= 5) {
  return ctx.reply('Забагато спроб. Спробуйте через 15 хв.')
}
```

### BOT_WEBHOOK_SECRET — fail-fast

При старті bot процесу:

```typescript
import { loadTelegramConfig } from '@workflo/notifications'

const cfg = loadTelegramConfig()
if (process.env.NODE_ENV !== 'development' && !cfg.BOT_WEBHOOK_SECRET) {
  console.error('FATAL: BOT_WEBHOOK_SECRET required in non-dev environments')
  process.exit(1)
}
```

У dev (Mailpit / local PG) — webhook не використовується, працюємо в long-polling. У staging/prod — обов'язковий webhook з secret для верифікації:

```typescript
fastify.post('/bot/webhook', async (req, reply) => {
  const secret = req.headers['x-telegram-bot-api-secret-token']
  if (secret !== env.BOT_WEBHOOK_SECRET) {
    return reply.code(401).send({ error: 'invalid_secret' })
  }
  await bot.handleUpdate(req.body)
  return { ok: true }
})
```

### Bot commands

| Command           | Опис                                                  |
| ----------------- | ----------------------------------------------------- |
| `/start [<code>]` | Welcome / link account if code provided               |
| `/help`           | Показує доступні команди                              |
| `/orders`         | Список активних orders (для linked client)            |
| `/timer`          | Поточний таймер (для linked executor)                 |
| `/balance`        | Баланс company (для linked client)                    |
| `/unsubscribe`    | Розриває link (chatId removed з NotificationSettings) |

`/unsubscribe` flow:

1. Bot отримує команду.
2. Знаходить `NotificationSettings` за `telegramChatId`.
3. Set `telegramChatId = null`, `telegramLinkedAt = null`.
4. Disable всі telegram preference rows для цих settings.
5. Audit log: `notifications.telegram_unsubscribed`.
6. Reply "Ви відписані. Знову підключити можна у /profile/settings."

### Sentry для bot

Окремий DSN (`SENTRY_DSN_BOT`). Tag `tag.module=bot`. Captures unhandled errors з grammY handlers.

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

`OtpToken`: поле `code` (не `token`) + додати `attempts Int` + `ipAddress` (rate-limit query зараз не працює); дозволити переви́дачу telegram-link токена (unique `(profileId,purpose)` → або allow-reissue). **Telegram split-brain**: `NotificationSettings.telegramChatId` = авторитетне для dispatch; bot пише туди; прибрати inline-adapter дубль (використовувати shipped `TelegramAdapter`). Webhook: dedup по update-id (Telegram-retry). Інтерактивні команди = **Phase** (не «готово»).

### B. Інтерактивні команди ✅

- grammY-хендлери: `/orders` (активні), `/timer` (поточний таймер, start/stop), `/balance` (баланс компанії), `/help`. Rate-limit per-user. Linked-only.

### C. Inline-кнопки (швидкі дії) ✅

- Callback-кнопки під повідомленнями: approve/reject оцінку, «відповісти» (force-reply → коментар), «позначити виконано». Безпека: callback несе підписаний payload + перевірка прав через `can()`.

### D. Сповіщення для виконавців ✅

- Окремий executor-потік (нове призначення/дедлайн/згадка) через матрицю telegram-каналу. Виконавець лінкує Telegram так само (OTP).

```
OtpToken: + attempts, ipAddress (поле code канонічне)
NotificationSettings.telegramChatId = single source of truth
```
