# AUTH MODULE

> App: Portal (portal.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/notifications`, `packages/types`
> Оновлено: 12 квітня 2026

---

## Огляд

Модуль відповідає за автентифікацію та авторизацію всіх акторів системи: owner, executor (сторона команди) та Company Owner / Company Member (сторона клієнтів). Реалізується схема з access token у пам'яті та refresh token у httpOnly cookie з ротацією. Invite-flow розрізняється для виконавців і членів компанії.

**Ключові принципи безпеки:**

- Access token живе тільки в React context (in-memory) — зникає при закритті вкладки
- Refresh token у httpOnly cookie — недоступний через XSS
- `SameSite=Strict` на cookie — CSRF захист без додаткових токенів
- Rate limiting на всі `/auth/*` endpoints: **10 запитів / 15 хвилин / IP**

---

## Актори та доступ

| Актор                     | Де реєструється                       | Як потрапляє в систему                     |
| ------------------------- | ------------------------------------- | ------------------------------------------ |
| `owner`                   | Вручну (перший акаунт)                | Пряма реєстрація або seed                  |
| `executor`                | Тільки через invite від owner         | `work.workflo.space/invite/{token}`        |
| `client` (Company Owner)  | Самореєстрація                        | `portal.workflo.space/register` + referral |
| `client` (Company Member) | Тільки через invite від Company Owner | `portal.workflo.space/invite/{token}`      |

> Workspace (`work.workflo.space`) захищений на рівні Traefik — IP whitelist для команди. Клієнт фізично не може відкрити сторінку навіть якщо знає URL.

---

## Бізнес-логіка

### Реєстрація клієнта (`POST /auth/register`)

1. Клієнт вводить email, ім'я, пароль, (опціонально) referral code у форматі `workflo-XXXXXX`.
2. Система перевіряє унікальність email.
3. Якщо переданий `referralCode` — знаходимо компанію-реферера, фіксуємо зв'язок у таблиці `referrals` зі статусом `pending`.
4. Транзакційно створюються:
   - `profiles` запис із роллю `client`
   - `companies` запис (назва = ім'я клієнта за замовчуванням, slug = транслітерація)
   - `company_members` запис із роллю `owner` (Company Owner)
   - `notification_settings` запис із дефолтними налаштуваннями
5. Надсилається welcome email.
6. Повертаються access token + встановлюється refresh cookie.

**Referral code формат:** `workflo-XXXXXX`, де `XXXXXX` — перші 6 символів UUID компанії (генерується при створенні `companies`). Зберігається в полі `referralCode` таблиці `companies`.

### Логін (`POST /auth/login`)

1. Знаходимо профіль за email.
2. Перевіряємо `bcrypt.compare(password, passwordHash)`.
3. Якщо `is_active = false` → помилка 403 "Акаунт деактивовано".
4. Створюємо запис у `refresh_tokens` (UUID токен, `expiresAt = now + 30 днів`).
5. Підписуємо JWT access token (`userId`, `role`, `companyId` якщо клієнт, `exp = now + 15 хвилин`).
6. Повертаємо `{ accessToken }` у body + `Set-Cookie: refreshToken=...`.

### Refresh Token Rotation (`POST /auth/refresh`)

1. Читаємо refresh token з httpOnly cookie.
2. Знаходимо запис у `refresh_tokens`, перевіряємо `revokedAt IS NULL` та `expiresAt > now`.
3. Якщо токен не знайдено або протухлий → 401, очищуємо cookie.
4. Анулюємо старий токен (`revokedAt = now`).
5. Створюємо новий refresh token запис (ротація).
6. Видаємо новий access token + оновлений cookie.

> **Reuse detection:** якщо один і той самий refresh token використовується двічі (revokedAt вже встановлено) — це ознака крадіжки. Анулюємо **всі** refresh tokens цього профілю (`UPDATE refresh_tokens SET revokedAt = now WHERE profileId = X`).

### Logout (`POST /auth/logout`)

1. Читаємо refresh token з cookie.
2. Знаходимо і анулюємо запис у `refresh_tokens`.
3. `Set-Cookie: refreshToken=; Max-Age=0; Path=/auth` — очищуємо cookie.
4. Клієнт видаляє access token з пам'яті.

### Forgot Password (`POST /auth/forgot-password`)

1. Приймаємо `{ email }`.
2. Якщо email не знайдено — **відповідаємо 200** (не розкриваємо чи існує акаунт).
3. Генеруємо `PasswordResetToken` (UUID, `expiresAt = now + 1 година`).
4. Відправляємо email із посиланням: `portal.workflo.space/reset-password/{token}`.

### Reset Password (`POST /auth/reset-password`)

1. Приймаємо `{ token, newPassword }`.
2. Знаходимо `PasswordResetToken` де `token = X AND usedAt IS NULL AND expiresAt > now`.
3. Хешуємо новий пароль, оновлюємо `profiles.passwordHash`.
4. Позначаємо токен як використаний (`usedAt = now`).
5. Анулюємо **всі** активні refresh tokens профілю (примусовий logout скрізь).

### Invite Executor (`POST /workspace/team/invite`)

Тільки для ролі `owner`.

1. Приймаємо `{ email, name }`.
2. Перевіряємо що email ще не зареєстровано.
3. Створюємо `Invite` запис: `type = executor`, `expiresAt = now + 7 днів`.
4. Надсилаємо email із посиланням: `work.workflo.space/invite/{token}`.
5. Виконавець переходить за посиланням, встановлює пароль.
6. Транзакційно: `profiles` (роль `executor`) + позначаємо invite `usedAt = now`.

**Edge cases:**

- Токен протухнув (>7 днів) → сторінка показує "Запрошення недійсне" + CTA написати owner.
- Токен вже використаний (`usedAt IS NOT NULL`) → "Акаунт вже створено, увійдіть".
- Owner повторно запрошує той самий email → якщо є активний (невикористаний) invite → повертаємо 409 "Запрошення вже надіслано".

### Invite Company Member (`POST /company/members/invite`)

Тільки для Company Owner або member із `can_invite_members = true`.

1. Приймаємо `{ email, permissions: { can_create_tasks, can_view_billing, can_approve_estimates, can_invite_members } }`.
2. Якщо переданий email вже є профілем в системі і вже є member цієї компанії → 409.
3. Створюємо `Invite`: `type = company_member`, `companyId = поточна компанія`, `permissions = JSON`, `expiresAt = now + 7 днів`.
4. Надсилаємо email: `portal.workflo.space/invite/{token}`.
5. Якщо email вже є профілем (клієнт іншої компанії або новий) — invite page дозволяє прив'язати існуючий акаунт або зареєструватись.
6. Після прийняття: `company_members` запис із переданими permissions.

### OTP для Telegram (`POST /profile/telegram/connect`)

OTP — одноразовий код для прив'язки Telegram акаунту.

1. Генеруємо 6-значний цифровий код.
2. Зберігаємо в таблиці `otp_tokens`: `purpose = telegram_link`, `channel = email`, `expiresAt = now + 15 хвилин`.
3. Надсилаємо code на email профілю.
4. Клієнт відкриває Telegram bot і вводить `/start {код}`.
5. Bot API (окремий сервіс) отримує команду → `POST /internal/telegram/verify { code, chatId }`.
6. API знаходить `otp_tokens` запис → зберігає `profiles.telegramChatId = chatId`, `profiles.telegramConnected = true`.
7. Видаляємо використаний OTP.

---

## DB (relevant таблиці)

```prisma
model Profile {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  name          String
  role          Role      @default(client)  // owner | executor | client
  avatarUrl     String?
  language      Language  @default(uk)
  telegramChatId    String?   @unique
  telegramConnected Boolean   @default(false)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  refreshTokens RefreshToken[]
  invitesSent   Invite[]       @relation("InvitedBy")
  // ...
  @@map("profiles")
}

model RefreshToken {
  id        String    @id @default(uuid())
  profileId String
  token     String    @unique
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?
  @@index([token])
  @@map("refresh_tokens")
}

model Invite {
  id          String     @id @default(uuid())
  email       String
  token       String     @unique @default(uuid())
  type        InviteType              // executor | company_member
  invitedById String
  companyId   String?
  permissions Json?
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime   @default(now())
  @@index([token])
  @@map("invites")
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  email     String
  token     String    @unique @default(uuid())
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  @@index([token])
  @@map("password_reset_tokens")
}

-- OTP таблиця (окрема від password reset)
model OtpToken {
  id        String   @id @default(uuid())
  profileId String
  code      String                        // 6 цифр
  purpose   OtpPurpose                   // telegram_link | two_fa | email_verify
  channel   OtpChannel                   // email | telegram | sms
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  @@index([profileId, purpose])
  @@map("otp_tokens")
}
```

**Company Member permissions** зберігаються як JSON поле в `company_members.permissions`:

```json
{
  "can_create_tasks": true,
  "can_view_billing": false,
  "can_approve_estimates": false,
  "can_invite_members": false,
  "can_view_all_tasks": true,
  "can_comment": true
}
```

---

## API Endpoints

### Стандарт відповідей

```
Успіх:   { "data": { ...resource } }
Помилка: { "statusCode": 400, "error": "Bad Request", "message": "...", "details": {} }
```

---

### `POST /auth/register`

**Body:**

```json
{
  "email": "john@company.com",
  "name": "John Doe",
  "password": "SecurePass123!",
  "referralCode": "workflo-a1b2c3"
}
```

**Response 201:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@company.com",
      "name": "John Doe",
      "role": "client",
      "companyId": "660e8400-e29b-41d4-a716-446655440001"
    }
  }
}
```

**Set-Cookie:** `refreshToken=<uuid>; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=2592000`

**Errors:**

- `409` — email вже зареєстровано
- `400` — невалідний referralCode (не знайдено компанію)

---

### `POST /auth/login`

**Body:**

```json
{
  "email": "john@company.com",
  "password": "SecurePass123!"
}
```

**Response 200:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@company.com",
      "name": "John Doe",
      "role": "client",
      "companyId": "660e8400-e29b-41d4-a716-446655440001",
      "companyRole": "owner",
      "permissions": {
        "can_create_tasks": true,
        "can_view_billing": true,
        "can_approve_estimates": true,
        "can_invite_members": true
      }
    }
  }
}
```

**Errors:**

- `401` — невірний email або пароль (єдине повідомлення, не розкриваємо що саме)
- `403` — акаунт деактивовано

---

### `POST /auth/refresh`

Cookie `refreshToken` передається автоматично браузером.

**Response 200:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:**

- `401` — токен не знайдено, протухлий або відкликаний

---

### `POST /auth/logout`

Авторизований запит (Bearer token).

**Response 204** (No Content)

---

### `POST /auth/forgot-password`

**Body:**

```json
{ "email": "john@company.com" }
```

**Response 200** (завжди, незалежно від існування email):

```json
{ "data": { "message": "Якщо акаунт існує, лист надіслано" } }
```

---

### `POST /auth/reset-password`

**Body:**

```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "newPassword": "NewSecurePass456!"
}
```

**Response 200:**

```json
{ "data": { "message": "Пароль успішно змінено" } }
```

**Errors:**

- `400` — токен не знайдено або протухлий
- `400` — пароль не відповідає вимогам (мін. 8 символів)

---

### `GET /auth/me`

**Response 200:**

```json
{
  "data": {
    "id": "550e8400-...",
    "email": "john@company.com",
    "name": "John Doe",
    "role": "client",
    "avatarUrl": null,
    "language": "uk",
    "telegramConnected": false,
    "company": {
      "id": "660e8400-...",
      "name": "John's Company",
      "slug": "johns-company",
      "referralCode": "workflo-a1b2c3",
      "loyaltyTier": "new"
    },
    "companyRole": "owner",
    "permissions": { ... }
  }
}
```

---

### `POST /workspace/team/invite`

Тільки `owner`. Rate limit: 10 req/15min.

**Body:**

```json
{
  "email": "executor@gmail.com",
  "name": "Іван Петренко"
}
```

**Response 201:**

```json
{
  "data": {
    "inviteId": "770e8400-...",
    "email": "executor@gmail.com",
    "expiresAt": "2026-04-19T12:00:00.000Z"
  }
}
```

---

### `POST /company/members/invite`

Company Owner або member із `can_invite_members`.

**Body:**

```json
{
  "email": "colleague@company.com",
  "permissions": {
    "can_create_tasks": true,
    "can_view_billing": false,
    "can_approve_estimates": false,
    "can_invite_members": false
  }
}
```

**Response 201:**

```json
{
  "data": {
    "inviteId": "880e8400-...",
    "email": "colleague@company.com",
    "expiresAt": "2026-04-19T12:00:00.000Z"
  }
}
```

---

### `POST /profile/telegram/connect`

**Response 200:**

```json
{
  "data": {
    "message": "Код надіслано на email. Введіть /start {код} у Telegram боті.",
    "expiresInMinutes": 15
  }
}
```

---

## UI Flows

### Portal (portal.workflo.space) — клієнтська сторона

**Реєстрація:**

1. `/register` — форма: email, ім'я, пароль, (опціонально) referral code
2. Submit → `POST /auth/register` → при успіху redirect `/dashboard`
3. При `?ref=workflo-XXXXXX` у URL — referral code підставляється автоматично

**Логін:**

1. `/login` → форма email + пароль
2. "Забули пароль?" → `/forgot-password`
3. При success → access token в React context → redirect `/dashboard`

**Перезавантаження сторінки:**

- `App.tsx` при mount → `POST /auth/refresh` (silent)
- Якщо 401 → redirect `/login`
- Якщо 200 → оновлюємо access token в context, рендеримо app

**Invite flow (Company Member):**

1. `/invite/{token}` — страница перевіряє token через `GET /auth/invite-info/{token}`
2. Якщо нова людина → форма реєстрації (email підставлений з invite, readonly)
3. Якщо вже є акаунт → кнопка "Прийняти запрошення" → `POST /auth/accept-invite { token }`
4. Після прийняття → redirect `/dashboard`

**Прив'язка Telegram:**

1. `/settings/notifications` → кнопка "Прив'язати Telegram"
2. `POST /profile/telegram/connect` → показуємо інструкцію з кодом
3. Bot отримує `/start {код}` → verifies → UI polling або SSE оновлює статус

### Workspace (work.workflo.space) — сторона команди

**Invite Executor flow:**

1. `/team/invite` → форма email + ім'я → `POST /workspace/team/invite`
2. Виконавець отримує email → переходить на `work.workflo.space/invite/{token}`
3. Форма: показується ім'я (з invite) + поле нового пароля
4. Submit → `POST /auth/accept-executor-invite { token, password }` → автологін → redirect `/`

---

## Notifications

| Тригер                      | Канал            | Кому                    |
| --------------------------- | ---------------- | ----------------------- |
| Реєстрація клієнта          | Email            | Клієнт (welcome email)  |
| Invite Executor             | Email            | Виконавець (посилання)  |
| Invite Company Member       | Email            | Колега (посилання)      |
| Forgot Password             | Email            | Клієнт/виконавець       |
| OTP Telegram                | Email            | Профіль (6-значний код) |
| Telegram успішно прив'язано | Email + Telegram | Профіль (підтвердження) |

**Email шаблони** (packages/notifications):

- `sendWelcomeEmail(to, name)` — HTML шаблон з CTA увійти
- `sendInviteEmail(to, inviteUrl)` — кнопка прийняти запрошення
- `sendPasswordResetEmail(to, resetUrl)` — TTL 1 год
- `sendOtpEmail(to, code)` — 6-значний код + інструкція

---

## Edge Cases

| Ситуація                                                | Поведінка                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Реєстрація з вже існуючим email                         | 409 Conflict                                                                  |
| Логін із деактивованим акаунтом                         | 403 з повідомленням                                                           |
| Refresh token використано двічі (reuse)                 | Анулювати всі tokens профілю → force logout                                   |
| Refresh token протухнув                                 | 401 → клієнт редиректить на `/login`                                          |
| Reset password token протухнув (>1 год)                 | 400 "Посилання застаріло"                                                     |
| Invite token протухнув (>7 днів)                        | Сторінка: "Запрошення недійсне, зверніться до відправника"                    |
| Invite token вже використано                            | Сторінка: "Акаунт вже створено, увійдіть"                                     |
| Повторне запрошення того самого email (активний invite) | 409 "Запрошення вже надіслано"                                                |
| OTP код протухнув (>15 хв)                              | 400 "Код застарів, запросіть новий"                                           |
| OTP код введено невірно 3+ разів                        | Видаляємо OTP, просимо запросити новий                                        |
| Referral code не знайдено                               | 400, реєстрація не блокується (код просто ігнорується за бажанням — уточнити) |
| Rate limit перевищено                                   | 429 з `Retry-After` header                                                    |

---

## CORS та Rate Limiting конфіг

```typescript
// apps/api/src/plugins/cors.ts
fastify.register(cors, {
  origin: [
    'https://portal.workflo.space',
    'https://work.workflo.space',
    'http://localhost:3001',
    'http://localhost:3002',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// apps/api/src/plugins/rate-limit.ts
fastify.register(rateLimit, {
  global: false, // застосовуємо per-route
});

// На всіх /auth/* routes:
{
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '15 minutes',
      keyGenerator: (req) => req.ip,
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Забагато запитів. Спробуйте через 15 хвилин.',
      }),
    },
  },
}
```

---

## Phase 2

- **2FA (TOTP):** `purpose = two_fa` в `otp_tokens`, Google Authenticator або аналог
- **SSO / Google OAuth:** `POST /auth/google` → OAuth flow → прив'язка до профілю
- **Telegram OAuth:** вхід через Telegram Login Widget замість email+пароль
- **SMS OTP:** `channel = sms` в `otp_tokens`, Twilio або ukrainian provider
- **Session management UI:** сторінка в налаштуваннях "Активні сесії" — список refresh tokens з можливістю відкликати
- **IP-based suspicious login detection:** якщо логін з нового IP → email сповіщення

---

## S1 alignment update (17 квітня 2026 → 27 травня 2026)

### Multi-company per profile

Архітектурне рішення (S1-00 migration): один `profile` може мати **N companies** через `CompanyMember` rows з `role='owner'`. Унікальність забезпечена частковим унікальним індексом `company_members_one_owner_per_company` на `(company_id) WHERE role='owner'`.

`Company.ownerId` поле **видалено** в міграції `20260527_s1_00_multi_company`. Власника визначаємо через `CompanyMember`.

#### Нові endpoints

| Method   | Path                                | Auth    | Опис                                                                                                   |
| -------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `GET`    | `/companies`                        | client+ | Список компаній поточного profile (де я owner АБО member). Активна підсвічена.                         |
| `POST`   | `/auth/switch-company`              | client+ | Body `{ companyId }`. Перевіряє membership → видає новий access token з активною `companyId` у claims. |
| `POST`   | `/companies`                        | client+ | Створити нову компанію. Auto-creates `CompanyMember(role='owner')` для актора.                         |
| `POST`   | `/companies/:id/transfer-ownership` | owner   | Body `{ newOwnerProfileId }`. Запускає transfer flow з accept-step (див. LIFECYCLE.md).                |
| `POST`   | `/companies/:id/accept-ownership`   | invited | Підтверджує отримання ownership.                                                                       |
| `POST`   | `/companies/:id/members`            | owner   | Запросити member (створює Invite, email/telegram через `notify()`).                                    |
| `DELETE` | `/companies/:id/members/:profileId` | owner   | Видалити member (не себе).                                                                             |
| `POST`   | `/companies/:id/archive`            | owner   | Архівувати компанію (див. LIFECYCLE.md).                                                               |
| `POST`   | `/companies/:id/restore`            | owner   | Розархівувати.                                                                                         |

#### Access token claims (multi-company)

```json
{
  "sub": "profile-uuid",
  "email": "user@example.com",
  "role": "client",
  "activeCompanyId": "company-uuid",
  "memberships": [
    { "companyId": "co-1", "role": "owner" },
    { "companyId": "co-2", "role": "owner" },
    { "companyId": "co-3", "role": "member" }
  ],
  "iat": 1234567890,
  "exp": 1234568790
}
```

`activeCompanyId` — поточна "робоча" компанія (з якою працює user у поточній session). Перемикається через `/auth/switch-company`. UI у Portal: company switcher у header.

### Refresh cookie strategy

Див. **ADR-001** (`docs/adr/001-refresh-cookie-strategy.md`).

Короко: `SameSite=Lax; Path=/auth/refresh; HttpOnly=true; Secure=production-only; Domain=.workflo.space у prod`. CSRF guard через Origin-check.

### Welcome notification на register

Після успішного `POST /auth/register`:

1. Create `Profile` + `Company` + `CompanyMember(role='owner')` у 1 transaction.
2. Create `NotificationSettings` + 21 default `NotificationPreference` rows (`ensureNotificationSettings()` helper).
3. Issue access + refresh tokens.
4. Async dispatch (не блокує response):
   ```typescript
   await notify(deps, {
     profileId,
     event: 'auth.welcome',
     vars: { portalUrl: env.APP_PORTAL_URL },
   })
   ```

### Password reset rate limit

Окремо від email-критичності (`CRITICAL_EVENTS`) — захист від abuse:

- `POST /auth/forgot-password`: 3 req / 15 min per email.
- `POST /auth/reset-password`: 5 attempts / 1h per token.
- Перевищення → 429 + audit_log entry.

### Auth-related audit_logs events

Див. **модуль 21 → секцію "Audit log → Authentication"**. Все логуємо: success/failed login, refresh used, password change, account deactivation.

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

> Результат module-audit + вибору власника. Ця секція **авторитетна** — при розбіжностях зі старими (квітневими) частинами вище пріоритет тут. Pre-S1 секції підлягають видаленню в doc-sync.

### A. Обов'язкові reconcile

- **Canonical permissions** — єдиний набір флагів (snake_case, з `tokens.ts`): `can_create_tasks`, `can_view_all_tasks`, `can_view_billing`, `can_approve_estimates`, `can_invite_members`. Старі camelCase/інші набори в 01/13 — видалити. `can()` знає лише ці.
- **Tenancy (ADR-004)** — claims `activeAgencyId` + `agencyMemberships[]`; новий `POST /auth/switch-agency`; `can()` tenant-guard.
- **Last-owner protection** — `DELETE /companies/:id/members/:profileId` і `transfer-ownership` забороняють видалити/демоутити єдиного owner → `409 CONFLICT` (не raw-500 від partial-unique).
- **Audit** — login_success / login_failed(reason) / refresh_used / **refresh_reuse_detected** (security!) / password_changed / account_deactivated → `audit_logs`.
- **`Profile.tokenVersion Int @default(0)`** — інкремент при reset/2FA-зміні/compromise → інвалідовує **живі access-токени** (не лише refresh). `jwtVerify` звіряє `tokenVersion`.
- Оновити stale `Profile`-модель у доці під реальну схему (`theme`, `telegramConnected`, `telegramOtp*`).

### B. Email-верифікація ✅

- `Profile.emailVerifiedAt DateTime?` (null = не верифіковано). Реєстрація НЕ блокує вхід, але непідтверджений email обмежує чутливі дії (виставлення рахунків, credentials) до підтвердження.
- Register → `auth.email_verification` (CRITICAL_EVENT, завжди email) з посиланням `…/verify-email?token=`. Токен у `otp_tokens(purpose=email_verify)`, TTL 24h.
- `POST /auth/verify-email { token }` → set `emailVerifiedAt`. `POST /auth/resend-verification` (rate 3/15хв).

### C. 2FA (TOTP) ✅ — owner/admin

- `Profile.totpSecretEnc Bytes?` (envelope-encrypted, як credentials), `totpEnabledAt DateTime?`, `Profile.backupCodesHash String[]` (bcrypt-хеші 10 одноразових кодів).
- Setup: `POST /auth/2fa/setup` → повертає `otpauthUrl` + QR (secret НЕ показуємо повторно). `POST /auth/2fa/enable { code }` → перевірка TOTP → enable + видати backup-коди (показати 1 раз). `POST /auth/2fa/disable { code | password }`.
- **Login flow зміна:** якщо `totpEnabledAt` → після пароля НЕ видаємо токени, повертаємо `{ require2fa: true, challengeId }`; `POST /auth/2fa/verify { challengeId, code }` (TOTP або backup) → видаємо access+refresh. Rate-limit 5/15хв на verify.
- Reset паролю / зміна 2FA → `tokenVersion++`.

### D. Active sessions (управління) ✅

- `RefreshToken` додає `ip String?`, `userAgent String?`, `lastUsedAt DateTime?` (оновлюється на кожному `/auth/refresh`).
- `GET /auth/sessions` → список активних refresh-токенів (поточний помічений), `DELETE /auth/sessions/:id` (revoke один), `DELETE /auth/sessions` (revoke всі крім поточного).
- Reuse-detection: якщо приходить уже-revoked токен → revoke-all для profile + audit `refresh_reuse_detected` + notify `auth.login_from_new_device`-стиль попередження.

### E. Social login (Google OAuth) ✅

- `OAuthAccount { id, profileId, provider('google'|'github'), providerAccountId, email, createdAt, @@unique([provider, providerAccountId]) }`.
- `GET /auth/oauth/google` → redirect на Google; `GET /auth/oauth/google/callback` → обмін code→profile: якщо `OAuthAccount` існує → login; інакше якщо email збігається з наявним `Profile` → лінкуємо (після підтвердження); інакше → новий Profile (email авто-верифікований) + Company + Agency-tenant #1.
- `POST /auth/oauth/google/link` / `DELETE /auth/oauth/:provider` для linked-акаунтів (потребує ≥1 способу входу — не можна відлінкувати останній).
- Env: `GOOGLE_OAUTH_CLIENT_ID/SECRET/CALLBACK_URL`. CSRF: `state` param.

### Schema-зміни (зведення, у foundation-міграцію)

```
Profile: + emailVerifiedAt, tokenVersion, totpSecretEnc, totpEnabledAt, backupCodesHash[]
RefreshToken: + ip, userAgent, lastUsedAt
OAuthAccount: нова таблиця
(+ agencyId scoping — з tenancy)
```

### Нові endpoints (зведення)

`/auth/switch-agency`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/2fa/{setup,enable,disable,verify}`, `/auth/sessions` (GET/DELETE), `/auth/sessions/:id` (DELETE), `/auth/oauth/google` (+callback/link), `/auth/oauth/:provider` (DELETE).
