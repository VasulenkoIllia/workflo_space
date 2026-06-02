# ENGINEERING STANDARDS & BEST PRACTICES

> Наскрізні інженерні стандарти API/бекенду workflo.space. Винесено з `IMPLEMENTATION_PLAN.md` §9 (doc-sync 1.06) — єдиний канонічний дім.
> Покриває: response-envelope, `ApiErrorCode`/`AppError`, глобальний Fastify error-handler, CORS, rate-limiting, Zod-валідація, Pino-логування, health-check, graceful shutdown, DB-pooling, обробка помилок зовнішніх сервісів, Husky/lint-staged.

---

> Єдиний стандарт для всього API. Всі endpoints дотримуються цих правил без винятків.

---

### 7.1 Response Format

**Успішна відповідь:**

```typescript
// Один об'єкт
{
  "success": true,
  "data": { ...object }
}

// Список з пагінацією
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 143,
      "totalPages": 8
    }
  }
}

// Без тіла (DELETE, деякі PATCH)
// HTTP 204 No Content — тіло відсутнє
```

**Помилка:**

```typescript
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",          // machine-readable, для frontend logic
    "message": "Замовлення не знайдено", // user-friendly, показувати напряму
    "details": null                      // або масив для validation errors
  }
}

// Validation error з details:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Перевірте правильність введених даних",
    "details": [
      { "field": "title", "message": "Обов'язкове поле" },
      { "field": "dueDate", "message": "Невірний формат дати" }
    ]
  }
}
```

---

### 7.2 HTTP Status Codes

| Код                         | Коли використовувати                                   |
| --------------------------- | ------------------------------------------------------ |
| `200 OK`                    | GET, PATCH — успішно                                   |
| `201 Created`               | POST що створює новий ресурс                           |
| `204 No Content`            | DELETE успішно (без тіла)                              |
| `400 Bad Request`           | Zod валідація не пройшла                               |
| `401 Unauthorized`          | Немає/невалідний токен                                 |
| `403 Forbidden`             | Авторизований, але немає прав                          |
| `404 Not Found`             | Ресурс не існує                                        |
| `409 Conflict`              | Конфлікт (email вже зайнятий, slug існує)              |
| `422 Unprocessable Entity`  | Бізнес-логіка відхилила (неправильний перехід статусу) |
| `429 Too Many Requests`     | Rate limit перевищено                                  |
| `500 Internal Server Error` | Непередбачена помилка                                  |
| `503 Service Unavailable`   | Зовнішній сервіс недоступний (OpenAI, Mailcow)         |

---

### 7.3 Error Codes (ApiErrorCode enum)

```typescript
// packages/types/src/errors.ts
export enum ApiErrorCode {
  // Auth
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_REUSE_DETECTED = 'TOKEN_REUSE_DETECTED',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  EMAIL_TAKEN = 'EMAIL_TAKEN',
  INVITE_INVALID = 'INVITE_INVALID',
  INVITE_EXPIRED = 'INVITE_EXPIRED',

  // Validation & General
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  CONFLICT = 'CONFLICT',

  // Orders
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  ORDER_DELETED = 'ORDER_DELETED',

  // Billing
  PAYMENT_ALREADY_CONFIRMED = 'PAYMENT_ALREADY_CONFIRMED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',

  // Loyalty
  INSUFFICIENT_LOYALTY_POINTS = 'INSUFFICIENT_LOYALTY_POINTS',
  LOYALTY_MAX_DISCOUNT_EXCEEDED = 'LOYALTY_MAX_DISCOUNT_EXCEEDED',

  // Referral
  INVALID_REFERRAL_CODE = 'INVALID_REFERRAL_CODE',
  SELF_REFERRAL = 'SELF_REFERRAL',

  // Files
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  // External services
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  AI_GENERATION_FAILED = 'AI_GENERATION_FAILED',
  AI_GENERATION_TIMEOUT = 'AI_GENERATION_TIMEOUT',
  EXCHANGE_RATE_UNAVAILABLE = 'EXCHANGE_RATE_UNAVAILABLE',

  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
}
```

### AppError клас

```typescript
// packages/types/src/AppError.ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    public readonly userMessage: string, // показуємо користувачу
    public readonly details?: unknown
  ) {
    super(userMessage)
    this.name = 'AppError'
  }
}

// Хелпери:
export const Errors = {
  notFound: (entity: string) => new AppError(404, ApiErrorCode.NOT_FOUND, `${entity} не знайдено`),

  forbidden: () =>
    new AppError(403, ApiErrorCode.FORBIDDEN, 'У вас немає доступу до цього ресурсу'),

  invalidStatusTransition: (from: string, to: string) =>
    new AppError(
      422,
      ApiErrorCode.INVALID_STATUS_TRANSITION,
      `Неможливо змінити статус з "${from}" на "${to}"`
    ),

  aiTimeout: () =>
    new AppError(
      503,
      ApiErrorCode.AI_GENERATION_TIMEOUT,
      'Генерація зайняла надто довго. Спробуйте ще раз або введіть текст вручну.'
    ),

  serviceUnavailable: (service: string) =>
    new AppError(
      503,
      ApiErrorCode.SERVICE_UNAVAILABLE,
      `Сервіс тимчасово недоступний. Спробуйте через хвилину.`
    ),
}
```

---

### 7.4 Global Error Handler (Fastify)

```typescript
// apps/api/src/plugins/errorHandler.ts
import { FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import * as Sentry from '@sentry/node'
import { AppError, ApiErrorCode } from '@workflo/types'

export function setupErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler(
    async (error: FastifyError | AppError | ZodError, req: FastifyRequest, reply: FastifyReply) => {
      // 1. Очікувані бізнес-помилки
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.userMessage, details: error.details ?? null },
        })
      }

      // 2. Zod валідація
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Перевірте правильність введених даних',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        })
      }

      // 3. Fastify validation (JSON Schema)
      if (error.validation) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Невірні вхідні дані',
            details: error.validation,
          },
        })
      }

      // 4. Непередбачені помилки — логуємо в Sentry
      req.log.error({ err: error }, 'Unhandled error')
      if (process.env.NODE_ENV === 'production') {
        Sentry.captureException(error, { extra: { url: req.url, method: req.method } })
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Щось пішло не так. Ми вже працюємо над виправленням.',
          details: null,
        },
      })
    }
  )

  // 404 handler
  fastify.setNotFoundHandler(async (req, reply) => {
    return reply.status(404).send({
      success: false,
      error: { code: ApiErrorCode.NOT_FOUND, message: 'Endpoint не знайдено', details: null },
    })
  })
}
```

---

### 7.5 CORS

```typescript
// apps/api/src/plugins/cors.ts
import cors from '@fastify/cors'

const ALLOWED_ORIGINS_PROD = [
  'https://portal.workflo.space',
  'https://work.workflo.space',
  'https://workflo.space',
]

const ALLOWED_ORIGINS_DEV = [
  'http://localhost:3000', // landing
  'http://localhost:3001', // portal
  'http://localhost:3002', // workspace
]

export async function setupCors(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin:
      process.env.NODE_ENV === 'production'
        ? ALLOWED_ORIGINS_PROD
        : (origin, cb) => {
            // dev: дозволяємо всі localhost origin
            if (!origin || origin.startsWith('http://localhost')) return cb(null, true)
            cb(new Error('Not allowed by CORS'), false)
          },
    credentials: true, // потрібно для cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // preflight cache 24 год
  })
}
```

> **Важливо:** `credentials: true` обов'язковий для refresh cookie. `allowedHeaders` — мінімально необхідні.

---

### 7.6 Rate Limiting

```typescript
// apps/api/src/plugins/rateLimiting.ts
import rateLimit from '@fastify/rate-limit'

// Стратегія: різні ліміти для різних типів endpoints
export async function setupRateLimiting(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    global: true,
    max: 300, // дефолт: 300 req / хвилину / IP
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers['x-forwarded-for']?.toString() || req.ip,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Забагато запитів. Зачекайте хвилину та спробуйте знову.',
        details: null,
      },
    }),
  })
}
```

**Специфічні ліміти по групах endpoints:**

```typescript
// Строгий ліміт — auth endpoints
fastify.register(async (instance) => {
  instance.addHook('onRequest', rateLimitHook({ max: 10, timeWindow: '15 minutes' }))
  instance.post('/auth/login', loginHandler)
  instance.post('/auth/register', registerHandler)
  instance.post('/auth/forgot-password', forgotPasswordHandler)
})

// Середній ліміт — file upload
fastify.register(async (instance) => {
  instance.addHook('onRequest', rateLimitHook({ max: 30, timeWindow: '1 minute' }))
  instance.post('/files', uploadFileHandler)
})

// Жорсткий ліміт — AI генерація (дорогий ресурс)
fastify.register(async (instance) => {
  instance.addHook(
    'onRequest',
    rateLimitHook({
      max: 10,
      timeWindow: '1 hour',
      keyGenerator: (req) => req.user?.id || req.ip, // per user, не per IP
    })
  )
  instance.post('/blog/generate', generateBlogHandler)
})

// Публічні endpoints — менш строго
// /blog, /health — дефолт 300/хв
```

**Таблиця лімітів:**

| Endpoint                       | Ліміт | Вікно | По чому |
| ------------------------------ | ----- | ----- | ------- |
| `POST /auth/login`             | 10    | 15 хв | IP      |
| `POST /auth/register`          | 10    | 15 хв | IP      |
| `POST /auth/forgot-password`   | 5     | 15 хв | IP      |
| `POST /auth/refresh`           | 60    | 1 хв  | IP      |
| `POST /files`                  | 30    | 1 хв  | User    |
| `POST /blog/generate`          | 10    | 1 год | User    |
| `POST /settings/telegram/link` | 5     | 10 хв | User    |
| Решта API                      | 300   | 1 хв  | IP      |

---

### 7.7 Validation (Zod)

Fastify підтримує JSON Schema нативно, але ми використовуємо **Zod** для:

- Автоматичних TypeScript типів з одного source of truth
- Кращих повідомлень про помилки
- Переіспользування схем між API і frontend

```typescript
// packages/types/src/schemas/order.schema.ts
import { z } from 'zod'

export const createOrderSchema = z.object({
  title: z.string().min(1, "Назва обов'язкова").max(255, 'Назва занадто довга'),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  deadline: z.string().datetime().optional().nullable(), // `deadline`, не `dueDate`
  serviceIds: z.array(z.string().uuid()).optional(),
})

// Канонічні 9 internal-статусів (OrderInternalStatus); on_hold/cancelled вимагають reason.
export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'new',
    'clarification',
    'estimating',
    'in_progress',
    'on_hold',
    'review',
    'revision',
    'done',
    'cancelled',
  ]),
  reason: z.string().max(1000).optional(), // → Order.onHoldReason / cancelledReason
  comment: z.string().max(1000).optional(),
})

export type CreateOrderDto = z.infer<typeof createOrderSchema>
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>
```

```typescript
// apps/api/src/routes/orders.ts — використання в route
fastify.post('/orders', async (req, reply) => {
  const body = createOrderSchema.parse(req.body) // кидає ZodError якщо невалідно
  // → global error handler перетворить ZodError у 400 response
  const order = await ordersService.create(body, req.user)
  return reply.status(201).send({ success: true, data: order })
})
```

**Правило:** Всі схеми Zod живуть в `packages/types/src/schemas/` — шеряться між API і frontend для валідації форм.

---

### 7.8 Structured Logging (Pino)

Fastify вбудований Pino — найшвидший logger для Node.js.

```typescript
// apps/api/src/index.ts
import Fastify from 'fastify'

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

    // Dev: читабельний формат
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          }
        : undefined,

    // Маскування sensitive полів — ОБОВ'ЯЗКОВО
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.passwordHash',
        'req.body.token',
        'req.body.refreshToken',
      ],
      censor: '[REDACTED]',
    },

    // Серіалізатори — контролюємо що логується
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          // headers НЕ логуємо (Authorization, Cookie)
          remoteAddress: request.socket?.remoteAddress,
        }
      },
      res(reply) {
        return { statusCode: reply.statusCode }
      },
    },
  },
})
```

**Log levels — правила використання:**

```typescript
// TRACE — дуже детально, тільки локальний дебаг
req.log.trace({ query: sql }, 'Raw SQL query')

// DEBUG — корисний контекст для дебагу (не в prod)
req.log.debug({ userId, orderId }, 'Fetching order')

// INFO — ключові бізнес-події (є в prod)
req.log.info({ orderId, newStatus, actorId }, 'Order status changed')
fastify.log.info({ version: '0.1.0' }, 'Server started')

// WARN — очікувані проблеми, не падаємо але треба моніторити
req.log.warn({ ip, attempts: 10 }, 'Rate limit reached')
req.log.warn({ profileId }, 'Refresh token reuse detected — all tokens revoked')
req.log.warn({ email }, 'Failed to send email — retrying')

// ERROR — непередбачені помилки, потрібна увага
req.log.error({ err: error, orderId }, 'Failed to generate PDF')
req.log.error({ err: error }, 'Database query failed')

// FATAL — сервіс не може працювати
fastify.log.fatal({ err }, 'Database connection failed on startup')
process.exit(1)
```

**Що логуємо обов'язково:**

| Подія               | Рівень  | Поля                                 |
| ------------------- | ------- | ------------------------------------ |
| Server start/stop   | `info`  | `version`, `port`, `env`             |
| Request/Response    | `info`  | автоматично Fastify                  |
| Auth: login success | `info`  | `profileId`, `role`                  |
| Auth: login failed  | `warn`  | `email`, `ip`                        |
| Auth: token reuse   | `warn`  | `profileId`, `ip`                    |
| Status change       | `info`  | `orderId`, `from`, `to`, `actorId`   |
| Payment confirmed   | `info`  | `paymentId`, `amount`, `confirmedBy` |
| Email sent          | `info`  | `to`, `template`                     |
| Email failed        | `error` | `to`, `template`, `error`            |
| File upload         | `info`  | `fileId`, `size`, `uploadedBy`       |
| Cron job start/end  | `info`  | `job`, `duration`                    |
| Rate limit hit      | `warn`  | `ip`, `endpoint`                     |
| Unhandled error     | `error` | `error`, `stack`, `url`              |

**Production log aggregation:**

В prod логи у JSON формат → збираємо через `docker logs` → можна підключити Loki + Grafana (Phase 2). В MVP — `docker logs api --tail 100 -f`.

---

### 7.9 Health Check

```typescript
// apps/api/src/routes/health.ts
fastify.get('/health', async (req, reply) => {
  const checks = {
    db: 'ok' as 'ok' | 'error',
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
  }

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    checks.db = 'error'
  }

  const status = checks.db === 'ok' ? 200 : 503
  const overall = checks.db === 'ok' ? 'ok' : 'degraded'

  return reply.status(status).send({ status: overall, checks })
})

// Response examples:
// 200: { "status": "ok", "checks": { "db": "ok", "uptime": 3600, "version": "0.1.0", ... } }
// 503: { "status": "degraded", "checks": { "db": "error", ... } }
```

**Traefik health check конфіг:**

```yaml
# docker-compose.prod.yml
services:
  api:
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:4000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Для кожного сервісу:**

| Сервіс    | Health endpoint                          | Порт |
| --------- | ---------------------------------------- | ---- |
| API       | `GET /health`                            | 4000 |
| Landing   | `GET /api/health`                        | 3000 |
| Portal    | Nginx `location /health { return 200; }` | 3001 |
| Workspace | Nginx `location /health { return 200; }` | 3002 |

---

### 7.10 Graceful Shutdown

```typescript
// apps/api/src/index.ts
const shutdown = async (signal: string) => {
  fastify.log.info({ signal }, 'Received shutdown signal')

  // 1. Зупиняємо прийом нових запитів
  // 2. Чекаємо завершення активних запитів (Fastify робить це при close())
  await fastify.close()
  fastify.log.info('HTTP server closed')

  // 3. Закриваємо DB connections
  await prisma.$disconnect()
  fastify.log.info('Database disconnected')

  // 4. Зупиняємо Telegram бот якщо polling mode
  if (process.env.BOT_MODE === 'polling') {
    await bot.stop()
  }

  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM')) // Docker stop
process.on('SIGINT', () => shutdown('SIGINT')) // Ctrl+C
```

---

### 7.11 Database Connection Pooling

```typescript
// packages/db/src/index.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
      // Connection pool параметри передаються в URL
    },
  },
  log:
    process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['warn', 'error'],
})

// Dev: логуємо повільні запити
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    if (e.duration > 500) {
      // > 500ms
      console.warn(`Slow query (${e.duration}ms): ${e.query}`)
    }
  })
}
```

**DATABASE_URL з pool параметрами:**

```bash
# .env.production
DATABASE_URL="postgresql://workflo:password@postgres:5432/workflo?connection_limit=10&pool_timeout=20&connect_timeout=10"
```

| Параметр           | Значення | Пояснення                                     |
| ------------------ | -------- | --------------------------------------------- |
| `connection_limit` | `10`     | Макс. відкритих з'єднань до PostgreSQL        |
| `pool_timeout`     | `20`     | Секунди чекати вільне з'єднання (потім error) |
| `connect_timeout`  | `10`     | Секунди на початкове підключення              |

**Правила:**

- В MVP (1 API instance) — `connection_limit=10` достатньо
- PostgreSQL `max_connections=100` (дефолт) → лишається запас для інших інструментів
- При кількох instances (Phase 2) — PgBouncer transaction pooling mode
- Не створювати новий `PrismaClient` в кожному request — тільки singleton

**Моніторинг connections:**

```sql
-- Переглянути активні з'єднання:
SELECT count(*), state, wait_event_type
FROM pg_stat_activity
WHERE datname = 'workflo'
GROUP BY state, wait_event_type;
```

---

### 7.12 Зовнішні сервіси — Error Handling

Принцип: **жоден збій зовнішнього сервісу не падає непоміченим, жодна помилка не показується як технічна**

```typescript
// packages/notifications/src/email/sendEmail.ts
export async function sendEmail(params: EmailParams): Promise<void> {
  try {
    await transporter.sendMail(params)
    logger.info({ to: params.to, template: params.template }, 'Email sent')
  } catch (error) {
    logger.error({ err: error, to: params.to, template: params.template }, 'Email send failed')
    // Не кидаємо помилку далі — email failure не повинна зламати основний flow
    // (наприклад, реєстрація проходить навіть якщо welcome email не відправився)
    // Але логуємо в Sentry для алерту
    Sentry.captureException(error, { extra: { to: params.to, template: params.template } })
  }
}

// apps/api/src/routes/blog.ts — AI generation
fastify.post('/blog/generate', async (req, reply) => {
  const { topic } = generateSchema.parse(req.body)

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({ ... }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 30000)  // 30s timeout
      ),
    ])
    return reply.send({ success: true, data: { content: completion.choices[0].message.content } })
  } catch (error) {
    if (error.message === 'timeout') {
      throw Errors.aiTimeout()
      // → "Генерація зайняла надто довго. Спробуйте ще раз або введіть текст вручну."
    }
    if (error.status === 429) {
      throw new AppError(503, ApiErrorCode.SERVICE_UNAVAILABLE,
        'OpenAI ліміт вичерпано. Спробуйте через годину або введіть текст вручну.')
    }
    throw Errors.serviceUnavailable('AI')
  }
})
```

**User-friendly повідомлення для типових збоїв:**

| Збій                 | Технічна причина   | Повідомлення користувачу                                                     |
| -------------------- | ------------------ | ---------------------------------------------------------------------------- |
| DB недоступна        | Connection refused | "Сервіс тимчасово недоступний. Спробуйте через хвилину."                     |
| Email не відправився | SMTP timeout       | (не показуємо — логуємо тихо, retry пізніше)                                 |
| AI timeout           | OpenAI > 30s       | "Генерація зайняла надто довго. Спробуйте ще раз або введіть текст вручну."  |
| OpenAI rate limit    | 429 від OpenAI     | "Сервіс генерації тимчасово недоступний. Введіть текст вручну."              |
| НБУ API недоступне   | Fetch error        | (тихо використовуємо останній відомий курс)                                  |
| Файл занадто великий | 413                | "Файл перевищує максимальний розмір (50 МБ)."                                |
| Невірний тип файлу   | MIME check         | "Цей тип файлу не підтримується. Дозволені: PDF, DOCX, XLSX, JPG, PNG, ZIP." |
| Telegram не відповів | 403 bot blocked    | (тихо очищаємо telegramChatId, логуємо)                                      |

---

### 7.13 Git Hooks (Husky + lint-staged)

```bash
# Встановлення при pnpm install
pnpm add -Dw husky lint-staged
npx husky init
```

**`.husky/pre-commit`:**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged
```

**`.husky/pre-push`:**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
# TypeScript check перед push
turbo run type-check
```

**`package.json` (root):**

```json
{
  "lint-staged": {
    "**/*.{ts,tsx}": ["eslint --fix --max-warnings=0", "prettier --write"],
    "**/*.{json,md,yaml,yml}": ["prettier --write"],
    "packages/db/prisma/schema.prisma": ["npx prisma format"]
  }
}
```

**Що перевіряється:**

- Pre-commit: ESLint (автофікс) + Prettier (автоформат)
- Pre-push: TypeScript `tsc --noEmit` по всьому монорепо

---

## RLS rollout (F4 / ADR-007) — tenant isolation backstop

Postgres Row-Level Security is the **default-on, DB-enforced second layer** beneath
the app-level guards (`can()` / `assertSameTenant` / loaders). The migration
`20260603_f4_rls_policies` lays it; it is **inert until activated** (policies are
permissive while the `app.current_agency_id` GUC is unset), so it ships safely
ahead of the flip.

**How it works**

- Every tenant table has `ENABLE + FORCE ROW LEVEL SECURITY` + a `tenant_isolation`
  policy: `wf_in_tenant("agencyId")` for column-scoped tables, a parent-join EXISTS
  for the agency-less children (order_stages/order_chat_reads → orders;
  company_members/company_services/referrals/referral_bonuses → companies).
- `wf_in_tenant(agency)` = **TRUE when the GUC is unset** (permissive), on
  `app.rls_bypass='on'`, or when `agency` equals `app.current_agency_id`.
- `@workflo/db` binds context via `AsyncLocalStorage` (`runWithAgency` /
  `runWithSystemContext`); the `authenticate` hook calls `enterAgencyContext(activeAgencyId)`.
  When `RLS_ENFORCED=true`, the Prisma client extension wraps each op in
  `$transaction([ set_config('app.current_agency_id', …, true), <op> ])` so the
  GUC scopes it.

**⚠️ RLS does NOT apply to superusers / the table owner without FORCE.** Enforcement
therefore requires the **web layer to connect as the non-superuser `workflo_app`
role** (created NOLOGIN by the migration). Migrations / worker / seed keep the owner
(admin) connection — they bypass RLS, which is exactly what they need.

**Activation checklist (the "one flip")**

1. `ALTER ROLE workflo_app LOGIN PASSWORD '…';` then point the **web** process's
   `DATABASE_URL` at `workflo_app`. Keep an admin URL for `migrate deploy` / seed /
   the worker container.
2. Set `RLS_ENFORCED=true` on the web process.
3. **Interactive transactions** (`prisma.$transaction(async tx => …)` in
   transitionOrderStatus / acceptInvite / register / refresh / password-reset) must
   set the GUC as their first statement —
   `await tx.$executeRaw\`SELECT set_config('app.current_agency_id', ${agencyId}, true)\``
   — because the per-op extension can't wrap ops already inside an interactive tx.
4. Worker/bootstrap: wrap DB work in `runWithSystemContext` (and add the bypass GUC
   to the raw outbox claim query) once policies flip from permissive to deny-on-unset.
5. Smoke-test: as `workflo_app`, confirm a cross-tenant `findUnique` returns null and
   a same-tenant read works (mirrors the throwaway-pg verification of the migration).

Verified on throwaway-pg (2-agency seed, `SET ROLE workflo_app`): column-scoped +
parent-scoped isolation hold, `rls_bypass` sees all, GUC-unset is permissive.

---
