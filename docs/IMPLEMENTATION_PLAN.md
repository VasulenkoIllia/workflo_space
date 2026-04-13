# WORKFLO.SPACE — План реалізації
> Статус: Фінальна v1.0
> Дата: 12 квітня 2026

---

## ЗМІСТ

1. [Закриті рішення](#1-закриті-рішення)
2. [Shared packages — структура](#2-shared-packages--структура) *(включає повний enum/constant/DTO spec для packages/types)*
3. [TypeScript + ESLint конфіг](#3-typescript--eslint-конфіг)
4. [API Design — всі endpoints](#4-api-design--всі-endpoints)
5. [DB Schema — фінальна Prisma](#5-db-schema--фінальна-prisma)
6. [Фазовий план](#6-фазовий-план) *(детальний трекер — TRACKER.md)*
7. [Turbo Pipeline](#7-turbo-pipeline-turbojson)
8. [Prisma Migrations](#8-prisma-migrations)
9. [API Standards & Best Practices](#9-api-standards--best-practices)
10. [Seed файл](#10-seed-файл)
11. [Онбординг та Empty State](#11-онбординг-та-empty-state)

---

## 1. ЗАКРИТІ РІШЕННЯ

### Файли у задачах (MVP)

**Рішення: Hetzner Volume, змонтований в API контейнер.**

```yaml
# docker-compose.production.yml — api service
volumes:
  - uploads_data:/srv/uploads

volumes:
  uploads_data:
```

```
Структура на диску:
/srv/uploads/orders/{order_id}/{uuid}_{original_name}.ext
```

**Таблиця order_files** — метадані (id, filename, storedAs, mimeType, sizeBytes).
**Роздача:** `GET /api/orders/:id/files/:fileId` з перевіркою прав (JWT).
**Ліміти:** 10 MB на файл, типи: pdf, jpg, jpeg, png, gif, zip, docx, xlsx, csv, txt.
**Phase 2:** мігруємо тільки storage adapter → Hetzner Object Storage, таблиця і endpoint не змінюються.

---

### Auth Flow

**Схема:** Access token у пам'яті (React state/context) + Refresh token у httpOnly cookie.

```
Реєстрація / Логін
  → { accessToken } в body (клієнт зберігає в React context)
  → Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/auth

Перезавантаження сторінки / Access token expire
  → POST /auth/refresh (cookie відправляється автоматично)
  → нові access + refresh токени (rotation)

Logout
  → анулює refresh token в БД
  → Set-Cookie: refreshToken=; Max-Age=0
```

**Чому так:**
- httpOnly cookie → refresh token недоступний через XSS
- Access token в пам'яті → зникає при закритті вкладки (безпечно)
- SameSite=Strict → CSRF захист без CSRF токенів

**Cookie конфіг Fastify:**
```typescript
reply.setCookie('refreshToken', token, {
  httpOnly: true, secure: true, sameSite: 'strict',
  path: '/auth', maxAge: 30 * 24 * 60 * 60,
});
```

**CORS:**
```typescript
origin: ['https://app.workflo.space', 'https://work.workflo.space',
         'http://localhost:3001', 'http://localhost:3002'],
credentials: true,
```

**Invite flow (executor):**
```
owner → POST /workspace/team/invite { email, name }
→ invite_token (UUID, TTL 7 днів) в БД
→ email → work.workflo.space/invite/{token}
→ виконавець встановлює пароль → profile створено
```

**Invite flow (company member):**
```
company owner → POST /portal/team/invite { email, permissions }
→ invite_token → app.workflo.space/invite/{token}
→ реєстрація або прив'язка до існуючого profile
```

**Password reset:**
```
POST /auth/forgot-password { email }
→ reset_token (UUID, TTL 1 год)
→ email → app.workflo.space/reset-password/{token}
POST /auth/reset-password { token, newPassword }
→ змінює пароль + анулює всі refresh tokens
```

---

### Процес оплати (Manual, без Stripe)

```
1. Замовлення завершено → owner вводить totalAmount в workspace
2. Portal /billing показує борг + реквізити (налаштовуються в /settings)
   Реквізити: банк IBAN, або USDT TRC20, або довільний текст
3. Клієнт платить самостійно (переказ / крипта)
4. Owner у workspace → /billing → "Підтвердити оплату"
   → вводить суму + note → payment record + борг зменшується
5. Клієнт отримує notification: "Оплата підтверджена"
```

**Таблиці:** `payments` (id, companyId, amount, note, confirmedBy, confirmedAt)
**`payment_settings`** (singleton: bankName, iban, accountName, cryptoUsdt, notes)

---

## 2. SHARED PACKAGES — СТРУКТУРА

### packages/types

```
packages/types/src/
├── enums.ts         всі enum значення (детально нижче)
├── constants.ts     ALLOWED_TRANSITIONS, INTERNAL_TO_CLIENT_STATUS, LOYALTY_TIERS, REFERRAL_*
├── dto.ts           ProfileDto, CompanyDto, OrderListItemDto, PaginatedResponse<T>
└── index.ts         реекспорт всього
```

Ключові константи живуть тут — один source of truth для API і обох frontend apps.

**enums.ts — повний перелік:**

```typescript
// Внутрішні статуси замовлення (9 — тільки workspace)
export enum OrderInternalStatus {
  NEW           = 'new',
  CLARIFICATION = 'clarification',
  ESTIMATION    = 'estimation',
  APPROVED      = 'approved',
  IN_PROGRESS   = 'in_progress',
  REVIEW        = 'review',
  DONE          = 'done',
  CANCELLED     = 'cancelled',
  ON_HOLD       = 'on_hold',
}

// Клієнтські статуси (4 — portal бачить тільки їх)
export enum OrderClientStatus {
  PENDING    = 'pending',    // new | clarification | estimation
  IN_WORK    = 'in_work',    // approved | in_progress | review | on_hold
  DONE       = 'done',       // done
  CANCELLED  = 'cancelled',  // cancelled
}

export enum OrderType {
  FIXED     = 'fixed',
  HOURLY    = 'hourly',
  RETAINER  = 'retainer',
}

export enum OrderPriority {
  LOW    = 'low',
  NORMAL = 'normal',
  HIGH   = 'high',
  URGENT = 'urgent',
}

export enum BillingType {
  PREPAID  = 'prepaid',
  POSTPAID = 'postpaid',
}

export enum UserRole {
  OWNER    = 'owner',
  EXECUTOR = 'executor',
  CLIENT   = 'client',
}

export enum Language {
  UK = 'uk',
  EN = 'en',
}

export enum LoyaltyTier {
  BRONZE   = 'bronze',
  SILVER   = 'silver',
  GOLD     = 'gold',
  PLATINUM = 'platinum',
}

export enum BlogPostType {
  ARTICLE  = 'article',
  CASE     = 'case',
}

export enum BlogPostStatus {
  DRAFT     = 'draft',
  PUBLISHED = 'published',
  ARCHIVED  = 'archived',
}

export enum InviteType {
  EXECUTOR       = 'executor',
  COMPANY_MEMBER = 'company_member',
}

export enum InviteStatus {
  PENDING  = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED  = 'expired',
}

export enum DocumentType {
  INVOICE          = 'invoice',
  ADVANCE_INVOICE  = 'advance_invoice',
  COMPLETION_ACT   = 'completion_act',
  SPECIFICATION    = 'specification',
  CONTRACT         = 'contract',
}

export enum DocumentStatus {
  DRAFT     = 'draft',
  SENT      = 'sent',
  SIGNED    = 'signed',
  CANCELLED = 'cancelled',
}

export enum NotificationChannel {
  EMAIL    = 'email',
  TELEGRAM = 'telegram',
  IN_APP   = 'in_app',
}

export enum NotificationEvent {
  ORDER_CREATED           = 'order.created',
  ORDER_STATUS_CHANGED    = 'order.status_changed',
  ORDER_COMMENT_ADDED     = 'order.comment_added',
  ORDER_DUE_SOON          = 'order.due_soon',
  ORDER_ASSIGNED          = 'order.assigned',
  ORDER_FILE_UPLOADED     = 'order.file_uploaded',
  PAYMENT_CONFIRMED       = 'payment.confirmed',
  PAYMENT_PENDING         = 'payment.pending',
  SUBSCRIPTION_EXPIRING   = 'subscription.expiring',
  SUBSCRIPTION_CHARGED    = 'subscription.charged',
  DOCUMENT_SENT           = 'document.sent',
  INVITE_SENT             = 'invite.sent',
  REFERRAL_REGISTERED     = 'referral.registered',
  REFERRAL_BONUS_EARNED   = 'referral.bonus_earned',
  LOYALTY_TIER_UPGRADED   = 'loyalty.tier_upgraded',
  LOYALTY_POINTS_EARNED   = 'loyalty.points_earned',
  SYSTEM_DISK_ALERT       = 'system.disk_alert',
  EXCHANGE_RATE_STALE     = 'exchange_rate.stale',
}
```

**constants.ts — повний перелік:**

```typescript
import { OrderInternalStatus, OrderClientStatus, LoyaltyTier } from './enums'

// Машина станів: які переходи дозволені (тільки owner/executor, не клієнт)
export const ALLOWED_TRANSITIONS: Record<OrderInternalStatus, OrderInternalStatus[]> = {
  [OrderInternalStatus.NEW]:           [OrderInternalStatus.CLARIFICATION, OrderInternalStatus.ESTIMATION, OrderInternalStatus.CANCELLED],
  [OrderInternalStatus.CLARIFICATION]: [OrderInternalStatus.ESTIMATION, OrderInternalStatus.CANCELLED],
  [OrderInternalStatus.ESTIMATION]:    [OrderInternalStatus.APPROVED, OrderInternalStatus.CLARIFICATION, OrderInternalStatus.CANCELLED],
  [OrderInternalStatus.APPROVED]:      [OrderInternalStatus.IN_PROGRESS, OrderInternalStatus.ON_HOLD, OrderInternalStatus.CANCELLED],
  [OrderInternalStatus.IN_PROGRESS]:   [OrderInternalStatus.REVIEW, OrderInternalStatus.ON_HOLD, OrderInternalStatus.CANCELLED],
  [OrderInternalStatus.REVIEW]:        [OrderInternalStatus.DONE, OrderInternalStatus.IN_PROGRESS],
  [OrderInternalStatus.DONE]:          [],  // фінальний стан
  [OrderInternalStatus.CANCELLED]:     [],  // фінальний стан
  [OrderInternalStatus.ON_HOLD]:       [OrderInternalStatus.IN_PROGRESS, OrderInternalStatus.CANCELLED],
}

// Маппінг: що бачить клієнт замість внутрішнього статусу
export const INTERNAL_TO_CLIENT_STATUS: Record<OrderInternalStatus, OrderClientStatus> = {
  [OrderInternalStatus.NEW]:           OrderClientStatus.PENDING,
  [OrderInternalStatus.CLARIFICATION]: OrderClientStatus.PENDING,
  [OrderInternalStatus.ESTIMATION]:    OrderClientStatus.PENDING,
  [OrderInternalStatus.APPROVED]:      OrderClientStatus.IN_WORK,
  [OrderInternalStatus.IN_PROGRESS]:   OrderClientStatus.IN_WORK,
  [OrderInternalStatus.REVIEW]:        OrderClientStatus.IN_WORK,
  [OrderInternalStatus.ON_HOLD]:       OrderClientStatus.IN_WORK,
  [OrderInternalStatus.DONE]:          OrderClientStatus.DONE,
  [OrderInternalStatus.CANCELLED]:     OrderClientStatus.CANCELLED,
}

export function mapToClientStatus(internal: OrderInternalStatus): OrderClientStatus {
  return INTERNAL_TO_CLIENT_STATUS[internal]
}

// Loyalty: межі для тіру (загальна сума оплат у USD)
export const LOYALTY_TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]:   0,       // від $0
  [LoyaltyTier.SILVER]:   500,     // від $500
  [LoyaltyTier.GOLD]:     2000,    // від $2000
  [LoyaltyTier.PLATINUM]: 5000,    // від $5000
}

// Loyalty: множник нарахування балів (1 USD paid = N points × multiplier)
export const LOYALTY_POINTS_MULTIPLIER: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]:   1.0,
  [LoyaltyTier.SILVER]:   1.25,
  [LoyaltyTier.GOLD]:     1.5,
  [LoyaltyTier.PLATINUM]: 2.0,
}

// Loyalty: бали за базовими подіями (до множника тіру)
export const LOYALTY_EVENTS = {
  PAYMENT:          100,   // за кожен $1 оплати → 100 pts × multiplier
  FIRST_ORDER:      500,   // бонус за перше замовлення
  PROFILE_COMPLETE: 200,   // заповнено профіль повністю
  REFERRAL_INVITE:  300,   // за кожного запрошеного реферала
} as const

// Loyalty: max знижка балами від суми замовлення
export const LOYALTY_MAX_DISCOUNT_PERCENT = 30

// Referral: відсоток винагороди рефером (від першої оплати реферала)
export const REFERRAL_COMMISSION_PERCENT = 10

// Files: дозволені MIME типи для завантаження
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // xlsx
  'text/csv',
  'text/plain',
] as const

// Files: ліміт розміру одного файлу (10 MB)
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
```

**dto.ts — ключові інтерфейси:**

```typescript
import type { OrderInternalStatus, OrderClientStatus, OrderType, UserRole, LoyaltyTier } from './enums'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface ProfileDto {
  id: string
  email: string
  name: string
  role: UserRole
  avatarUrl: string | null
  language: 'uk' | 'en'
  telegramConnected: boolean
}

export interface CompanyDto {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  referralCode: string
  balance: number  // від'ємне = борг
}

export interface OrderListItemDto {
  id: string
  title: string
  internalStatus: OrderInternalStatus  // тільки для workspace
  clientStatus: OrderClientStatus      // тільки для portal
  type: OrderType
  priority: string
  dueDate: string | null
  totalAmount: number | null
  balanceDue: number
  company: { id: string; name: string }
  executors: Array<{ id: string; name: string; avatarUrl: string | null }>
  createdAt: string
  updatedAt: string
}

export interface OrderDetailDto extends OrderListItemDto {
  description: string | null
  estimatedHours: number | null
  advanceAmount: number
  comments: OrderCommentDto[]
  files: OrderFileDto[]
  tasks: InternalTaskDto[]
}

export interface OrderCommentDto {
  id: string
  content: string
  isInternal: boolean  // тільки workspace бачить isInternal=true
  author: { id: string; name: string; avatarUrl: string | null }
  createdAt: string
  editedAt: string | null
}

export interface NotificationDto {
  id: string
  event: string
  title: string
  body: string
  isRead: boolean
  link: string | null
  createdAt: string
}
```

### packages/db

```
packages/db/
├── prisma/
│   ├── schema.prisma      ← фінальна схема (секція 5)
│   ├── seed.ts            ← тестові дані (owner, company, orders)
│   └── migrations/
├── src/
│   └── index.ts           ← singleton PrismaClient + реекспорт всіх типів
└── package.json
```

```typescript
// packages/db/src/index.ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export * from '@prisma/client';
```

### packages/ui

```
packages/ui/src/
├── components/
│   ├── Button/          variants: primary | secondary | ghost | danger; sizes: sm | md | lg
│   ├── Input/           label, error, helpText, startAdornment, endAdornment
│   ├── Badge/           StatusBadge (OrderClientStatus → color), generic Badge
│   ├── Avatar/          initials fallback + deterministic color, size: sm | md | lg
│   ├── Modal/           Radix Dialog wrapper, ConfirmDialog variant
│   ├── Table/           TanStack Table wrapper, sortable headers, pagination
│   ├── Skeleton/        skeleton-pulse для loading станів
│   ├── EmptyState/      icon + title + description + optional CTA button
│   ├── FileDropzone/    drag-and-drop + file type/size validation
│   ├── Spinner/         xs | sm | md | lg
│   ├── Tooltip/         Radix Tooltip wrapper
│   └── ThemeProvider/   light | dark | system, Tailwind darkMode: class
├── hooks/
│   └── useTheme.ts      читає/змінює тему з localStorage
└── index.ts
```

**Принцип:** тільки примітиви без бізнес-логіки. Layouts і domain-specific компоненти живуть у кожному app окремо — portal і workspace мають різний вигляд (клієнтський vs щільний робочий інтерфейс). Базується на Radix UI примітивах + Tailwind CSS 4. Повна специфікація кожного компонента в `docs/FRONTEND_STANDARDS.md` → розділ «packages/ui».

### packages/notifications

Реалізований за **Channel Adapter** патерном — кожен канал є окремим адаптером, що реалізує єдиний інтерфейс.

```
packages/notifications/src/
├── adapters/
│   ├── email.adapter.ts     Nodemailer → Mailcow (SMTP)
│   └── telegram.adapter.ts  grammY Bot API (надсилає через бота)
├── types.ts                 NotificationAdapter interface, NotificationPayload
├── notify.ts                уніфікована функція notify()
└── index.ts                 реекспорт
```

```typescript
// types.ts
export interface NotificationAdapter {
  send(to: string, event: NotificationEvent, payload: NotificationPayload): Promise<void>
}

// notify.ts
export async function notify(
  userId: string,
  event: NotificationEvent,
  payload: NotificationPayload
): Promise<void>
// Алгоритм:
// 1. Читає notification_settings з БД для userId
// 2. Для кожного enabled channel — викликає відповідний adapter.send()
// 3. Завжди створює запис у таблиці notifications (in-app, незалежно від settings)
// 4. Помилка одного channel не зупиняє інші (try/catch per channel)
```

Повна специфікація подій, шаблонів і налаштувань в `docs/modules/07-notifications.md` і `docs/modules/08-email.md`.

### packages/templates (новий — для PDF документів)

```
packages/templates/
├── src/
│   ├── invoice.tsx          ← @react-pdf/renderer компонент
│   ├── completion-act.tsx
│   ├── specification.tsx
│   ├── contract.tsx
│   └── index.ts             ← generatePdf(type, data) → Buffer
└── package.json
```

```typescript
// packages/templates/src/index.ts
import { renderToBuffer } from '@react-pdf/renderer';

export async function generatePdf(type: DocumentType, data: DocumentData): Promise<Buffer> {
  const components = {
    invoice: InvoiceTemplate,
    completion_act: CompletionActTemplate,
    specification: SpecificationTemplate,
    contract: ContractTemplate,
    advance_invoice: InvoiceTemplate,  // той самий шаблон, інший заголовок
  };
  const Component = components[type];
  return renderToBuffer(<Component data={data} />);
}
```

Генерований PDF → зберігається у `/srv/uploads/documents/{id}.pdf` → той самий volume що і файли задач.

---

## 3. TYPESCRIPT + ESLINT КОНФІГ

### tsconfig.base.json (корінь репо)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "paths": {
      "@workflo/ui":            ["../../packages/ui/src/index.ts"],
      "@workflo/types":         ["../../packages/types/src/index.ts"],
      "@workflo/db":            ["../../packages/db/src/index.ts"],
      "@workflo/notifications": ["../../packages/notifications/src/index.ts"]
    }
  }
}
```

### App-specific tsconfigs

```json
// apps/api/tsconfig.json
{ "extends": "../../tsconfig.base.json",
  "compilerOptions": { "module": "CommonJS", "moduleResolution": "node", "outDir": "./dist" } }

// apps/landing/tsconfig.json
{ "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "preserve", "plugins": [{ "name": "next" }] } }

// apps/portal/tsconfig.json + apps/workspace/tsconfig.json
{ "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"] } }

// packages/*/tsconfig.json
{ "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" } }
```

### packages/eslint-config

```javascript
// index.js — base (Node.js / packages)
module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended-type-checked'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};

// react.js — для portal, workspace, landing
module.exports = {
  extends: ['./index.js', 'plugin:react-hooks/recommended'],
  rules: { 'react-hooks/exhaustive-deps': 'error' },
};
```

---

## 4. API DESIGN — ВСІ ENDPOINTS

### Стандарт відповідей

```
Успіх (одиночний):  { "data": { ...resource } }
Успіх (список):     { "data": [...], "total": 47, "page": 1, "perPage": 20, "totalPages": 3 }
Помилка:            { "statusCode": 400, "error": "Bad Request", "message": "...", "details": {} }

HTTP коди:
200 OK | 201 Created | 204 No Content
400 Bad Request (validation) | 401 Unauthorized | 403 Forbidden
404 Not Found | 409 Conflict (duplicate) | 422 Unprocessable (business logic)
429 Too Many Requests | 500 Internal Server Error
```

### Всі endpoints

```
── AUTH ──────────────────────────────────────────────────────────
POST   /auth/register              profile + company + welcome email
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh               refresh token rotation
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me                    поточний user + компанія

── PROFILE ───────────────────────────────────────────────────────
PATCH  /profile                    name, avatarUrl, language
PATCH  /profile/password
PATCH  /profile/notifications
POST   /profile/telegram/connect   отримати OTP для прив'язки
DELETE /profile/telegram

── COMPANY (portal) ──────────────────────────────────────────────
GET    /company
GET    /company/members
POST   /company/members/invite     { email, permissions }
PATCH  /company/members/:id        права
DELETE /company/members/:id
GET    /company/referral           реферальне посилання + статистика

── ORDERS (portal — клієнт) ──────────────────────────────────────
GET    /orders                     ?status=&page=&perPage=
POST   /orders                     { title, description }
GET    /orders/:id
POST   /orders/:id/approve         підтвердити оцінку
POST   /orders/:id/accept          прийняти роботу
GET    /orders/:id/comments
POST   /orders/:id/comments        { content }
GET    /orders/:id/comments/stream SSE stream
GET    /orders/:id/files
POST   /orders/:id/files           multipart/form-data
DELETE /orders/:id/files/:fileId

── BILLING (portal) ──────────────────────────────────────────────
GET    /billing/summary            борг, services, payments total
GET    /billing/services           мої recurring послуги
GET    /billing/charges            ?month=2026-04
GET    /billing/payments           історія оплат
GET    /billing/payment-settings   реквізити (публічно)

── LOYALTY & REFERRAL (portal) ───────────────────────────────────
GET    /loyalty
GET    /bonus-balance

── NOTIFICATIONS ─────────────────────────────────────────────────
GET    /notifications              ?unreadOnly=true
PATCH  /notifications/:id/read
PATCH  /notifications/read-all

── WORKSPACE ORDERS (owner + executor) ───────────────────────────
GET    /workspace/orders           ?status=&assignee=&company=&page=
POST   /workspace/orders           від імені клієнта
GET    /workspace/orders/:id
PATCH  /workspace/orders/:id       assignee, deadline, billing, estimate
PATCH  /workspace/orders/:id/status { internalStatus }
DELETE /workspace/orders/:id       owner only
POST   /workspace/orders/:id/comments  { content, isInternal }
GET    /workspace/orders/:id/comments

── INTERNAL TASKS ────────────────────────────────────────────────
POST   /workspace/orders/:id/tasks
PATCH  /workspace/orders/:id/tasks/:taskId
DELETE /workspace/orders/:id/tasks/:taskId

── TIME LOGS ─────────────────────────────────────────────────────
GET    /workspace/orders/:id/time-logs
POST   /workspace/orders/:id/time-logs  { hours, comment, date }
PATCH  /workspace/time-logs/:logId
DELETE /workspace/time-logs/:logId

── CLIENTS (workspace — owner) ───────────────────────────────────
GET    /workspace/clients
GET    /workspace/clients/:id
PATCH  /workspace/clients/:id       notes
GET    /workspace/clients/:id/orders
GET    /workspace/clients/:id/billing

── BILLING (workspace — owner) ───────────────────────────────────
GET    /workspace/billing/overview
POST   /workspace/billing/payments  { companyId, amount, note }
GET    /workspace/billing/charges   ?month=
GET    /workspace/billing/payouts   розрахунок виплат команді

── SERVICES (workspace — owner) ──────────────────────────────────
GET    /workspace/services
POST   /workspace/services
PATCH  /workspace/services/:id
DELETE /workspace/services/:id
POST   /workspace/services/:id/assign   { companyId, customPrice }
PATCH  /workspace/services/:id/companies/:companyId
DELETE /workspace/services/:id/companies/:companyId

── TEAM (workspace — owner) ──────────────────────────────────────
GET    /workspace/team
POST   /workspace/team/invite       { email, name }
PATCH  /workspace/team/:id/rates    { monthlySalary, commissionPercent }
GET    /workspace/team/:id/earnings ?month=

── CONTENT (workspace) ───────────────────────────────────────────
GET    /workspace/content
POST   /workspace/content
GET    /workspace/content/:id
PATCH  /workspace/content/:id
DELETE /workspace/content/:id
POST   /workspace/content/ai-draft  { prompt } → { draft }

── PUBLIC (landing) ──────────────────────────────────────────────
GET    /api/blog                    ?page=&perPage=&type=
GET    /api/blog/:slug
GET    /api/cases
GET    /api/cases/:slug
POST   /api/contact                 { name, email, message } — rate limited: 3/год
GET    /api/status                  { status: 'ok' | 'degraded' }

── DOCUMENTS (workspace — owner) ─────────────────────────────────
GET    /workspace/orders/:id/documents        список документів задачі
POST   /workspace/orders/:id/documents        { type } → генерує PDF
GET    /workspace/documents                   всі документи (фільтр по type/status)
GET    /workspace/documents/:id/download      завантажити PDF
POST   /workspace/documents/:id/send          надіслати клієнту email + PDF
DELETE /workspace/documents/:id               видалити (тільки draft)

── DOCUMENTS (portal — клієнт) ───────────────────────────────────
GET    /orders/:id/documents                  документи задачі (тільки sent)
GET    /portal/documents/:id/download         завантажити PDF

── HEALTH ────────────────────────────────────────────────────────
GET    /health                      { status: 'ok', uptime, timestamp }
```

### Rate Limiting

```typescript
global:      100 req/min
/auth/*:     10 req/15min per IP
/api/contact: 3 req/hour per IP
```

---

## 5. DB SCHEMA — ФІНАЛЬНА PRISMA

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Profile {
  id                   String    @id @default(uuid())
  email                String    @unique
  passwordHash         String
  name                 String
  role                 Role      @default(client)
  avatarUrl            String?
  language             Language  @default(uk)
  telegramChatId       String?   @unique
  telegramConnected    Boolean   @default(false)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  company              Company?              @relation("CompanyOwner")
  companyMembership    CompanyMember[]
  ordersAssigned       Order[]               @relation("OrderAssignee")
  ordersCreated        Order[]               @relation("OrderCreatedBy")
  comments             OrderComment[]
  timeLogs             TimeLog[]
  notificationSettings NotificationSettings?
  refreshTokens        RefreshToken[]
  invitesSent          Invite[]              @relation("InvitedBy")
  executorRate         ExecutorRate?
  blogPosts            BlogPost[]
  uploadedFiles        OrderFile[]

  @@index([email])
  @@index([role])
  @@map("profiles")
}

model RefreshToken {
  id        String    @id @default(uuid())
  profileId String
  profile   Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  token     String    @unique
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  @@index([token])
  @@index([profileId])
  @@map("refresh_tokens")
}

model Invite {
  id          String     @id @default(uuid())
  email       String
  token       String     @unique @default(uuid())
  type        InviteType
  invitedById String
  invitedBy   Profile    @relation("InvitedBy", fields: [invitedById], references: [id])
  companyId   String?
  permissions Json?
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime   @default(now())

  @@index([token])
  @@index([email])
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

model Company {
  id           String      @id @default(uuid())
  name         String
  slug         String      @unique
  ownerId      String      @unique
  owner        Profile     @relation("CompanyOwner", fields: [ownerId], references: [id])
  loyaltyTier  LoyaltyTier @default(new)
  totalSpent   Decimal     @default(0) @db.Decimal(12, 2)
  bonusBalance Decimal     @default(0) @db.Decimal(12, 2)
  referralCode String      @unique @default(uuid())
  referredById String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  members           CompanyMember[]
  orders            Order[]
  serviceAssigns    CompanyService[]
  charges           ServiceCharge[]
  payments          Payment[]
  referralsSent     Referral[]      @relation("ReferrerCompany")
  referralsReceived Referral[]      @relation("ReferredCompany")

  @@index([slug])
  @@index([ownerId])
  @@index([referralCode])
  @@map("companies")
}

model CompanyMember {
  id          String   @id @default(uuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  profileId   String
  profile     Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  permissions Json     @default("{}")
  joinedAt    DateTime @default(now())

  @@unique([companyId, profileId])
  @@index([companyId])
  @@index([profileId])
  @@map("company_members")
}

model Order {
  id             String              @id @default(uuid())
  title          String
  description    String?
  type           OrderType           @default(client_order)
  companyId      String?
  company        Company?            @relation(fields: [companyId], references: [id])
  assigneeId     String?
  assignee       Profile?            @relation("OrderAssignee", fields: [assigneeId], references: [id])
  createdById    String
  createdBy      Profile             @relation("OrderCreatedBy", fields: [createdById], references: [id])
  internalStatus OrderInternalStatus @default(new)
  clientStatus   OrderClientStatus   @default(in_progress)
  billingType    BillingType         @default(fixed)
  fixedPrice     Decimal?            @db.Decimal(10, 2)
  hourlyRate     Decimal?            @db.Decimal(10, 2)
  estimatedHours Decimal?            @db.Decimal(8, 2)
  totalAmount    Decimal?            @db.Decimal(10, 2)
  deadline       DateTime?
  paidAt         DateTime?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  stages        OrderStage[]
  comments      OrderComment[]
  timeLogs      TimeLog[]
  files         OrderFile[]
  internalTasks InternalTask[]

  @@index([companyId])
  @@index([assigneeId])
  @@index([internalStatus])
  @@index([clientStatus])
  @@index([type])
  @@index([createdAt])
  @@map("orders")
}

model OrderStage {
  id          String      @id @default(uuid())
  orderId     String
  order       Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  title       String
  description String?
  status      StageStatus @default(pending)
  position    Int
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([orderId, position])
  @@map("order_stages")
}

model OrderComment {
  id         String   @id @default(uuid())
  orderId    String
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  authorId   String
  author     Profile  @relation(fields: [authorId], references: [id])
  content    String
  isInternal Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@index([orderId, createdAt])
  @@index([orderId, isInternal])
  @@map("order_comments")
}

model OrderFile {
  id         String   @id @default(uuid())
  orderId    String
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  uploadedBy String
  uploader   Profile  @relation(fields: [uploadedBy], references: [id])
  filename   String
  storedAs   String
  mimeType   String
  sizeBytes  Int
  createdAt  DateTime @default(now())

  @@index([orderId])
  @@map("order_files")
}

model InternalTask {
  id         String             @id @default(uuid())
  orderId    String
  order      Order              @relation(fields: [orderId], references: [id], onDelete: Cascade)
  title      String
  assigneeId String?
  status     InternalTaskStatus @default(todo)
  position   Int                @default(0)
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt

  @@index([orderId])
  @@map("internal_tasks")
}

model TimeLog {
  id         String   @id @default(uuid())
  orderId    String
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  executorId String
  executor   Profile  @relation(fields: [executorId], references: [id])
  hours      Decimal  @db.Decimal(5, 2)
  comment    String?
  date       DateTime @db.Date
  createdAt  DateTime @default(now())

  @@index([orderId])
  @@index([executorId])
  @@index([date])
  @@map("time_logs")
}

model Service {
  id             String          @id @default(uuid())
  name           String
  description    String?
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  companyAssigns CompanyService[]

  @@map("services")
}

model CompanyService {
  id          String   @id @default(uuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  serviceId   String
  service     Service  @relation(fields: [serviceId], references: [id])
  customPrice Decimal  @db.Decimal(10, 2)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  charges ServiceCharge[]

  @@unique([companyId, serviceId])
  @@index([companyId])
  @@map("company_services")
}

model ServiceCharge {
  id               String        @id @default(uuid())
  companyId        String
  company          Company       @relation(fields: [companyId], references: [id])
  companyServiceId String
  companyService   CompanyService @relation(fields: [companyServiceId], references: [id])
  amount           Decimal       @db.Decimal(10, 2)
  month            DateTime      @db.Date
  status           ChargeStatus  @default(pending)
  createdAt        DateTime      @default(now())

  @@unique([companyServiceId, month])
  @@index([companyId, month])
  @@map("service_charges")
}

model Payment {
  id          String   @id @default(uuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  amount      Decimal  @db.Decimal(10, 2)
  currency    String   @default("USD")
  note        String?
  confirmedBy String
  confirmedAt DateTime @default(now())

  @@index([companyId])
  @@index([confirmedAt])
  @@map("payments")
}

model PaymentSettings {
  id          String   @id @default(cuid())
  bankName    String?
  iban        String?
  accountName String?
  cryptoUsdt  String?
  notes       String?
  updatedAt   DateTime @updatedAt

  @@map("payment_settings")
}

model ExecutorRate {
  id                String   @id @default(uuid())
  executorId        String   @unique
  executor          Profile  @relation(fields: [executorId], references: [id], onDelete: Cascade)
  monthlySalary     Decimal? @db.Decimal(10, 2)
  commissionPercent Decimal  @default(0) @db.Decimal(5, 2)
  updatedAt         DateTime @updatedAt

  @@map("executor_rates")
}

model Referral {
  id          String   @id @default(uuid())
  referrerId  String
  referrer    Company  @relation("ReferrerCompany", fields: [referrerId], references: [id])
  referredId  String
  referred    Company  @relation("ReferredCompany", fields: [referredId], references: [id])
  totalEarned Decimal  @default(0) @db.Decimal(10, 2)
  createdAt   DateTime @default(now())

  bonuses ReferralBonus[]

  @@unique([referrerId, referredId])
  @@index([referrerId])
  @@map("referrals")
}

model ReferralBonus {
  id         String   @id @default(uuid())
  referralId String
  referral   Referral @relation(fields: [referralId], references: [id])
  amount     Decimal  @db.Decimal(10, 2)
  percent    Decimal  @db.Decimal(5, 2)
  sourceType String
  sourceId   String
  createdAt  DateTime @default(now())

  @@index([referralId])
  @@map("referral_bonuses")
}

model NotificationSettings {
  id                     String  @id @default(uuid())
  profileId              String  @unique
  profile                Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  emailOnStatusChange    Boolean @default(true)
  emailOnNewComment      Boolean @default(true)
  emailOnPayment         Boolean @default(true)
  telegramOnStatusChange Boolean @default(true)
  telegramOnNewComment   Boolean @default(false)
  telegramOnPayment      Boolean @default(true)

  @@map("notification_settings")
}

model BlogPost {
  id          String       @id @default(uuid())
  slug        String       @unique
  type        BlogPostType
  titleUk     String
  titleEn     String
  excerptUk   String
  excerptEn   String
  contentUk   Json
  contentEn   Json
  tags        String[]
  authorId    String
  author      Profile      @relation(fields: [authorId], references: [id])
  published   Boolean      @default(false)
  featured    Boolean      @default(false)
  publishedAt DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([slug])
  @@index([type, published])
  @@index([publishedAt])
  @@map("blog_posts")
}

model ContactForm {
  id        String   @id @default(uuid())
  name      String
  email     String
  message   String
  source    String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([isRead, createdAt])
  @@map("contact_forms")
}

enum Role            { owner executor client }
enum Language        { uk en }
enum LoyaltyTier     { new regular partner vip }
enum OrderType       { client_order internal_task }
enum OrderInternalStatus { new clarification estimated in_progress review revision done cancelled on_hold }
enum OrderClientStatus   { in_progress pending_approval completed cancelled }
enum BillingType     { fixed hourly }
enum StageStatus     { pending in_progress done }
enum InternalTaskStatus { todo in_progress done }
enum ChargeStatus    { pending paid cancelled }
enum InviteType      { executor company_member }
enum BlogPostType    { article case_study }
enum DocumentType    { contract advance_invoice invoice completion_act specification }
enum DocumentStatus  { draft generated sent }
```

### Таблиці яких не вистачало (додано)

```prisma
// Нотифікації (in-app список)
model Notification {
  id        String   @id @default(uuid())
  profileId String
  profile   Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  type      String   // order_status_changed | new_comment | payment_confirmed | ...
  title     String
  body      String
  isRead    Boolean  @default(false)
  metadata  Json?    // { orderId: '...', companyId: '...' }
  createdAt DateTime @default(now())

  @@index([profileId, isRead])
  @@index([profileId, createdAt])
  @@map("notifications")
}

// Activity log по задачі
model ActivityLog {
  id        String   @id @default(uuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  actorId   String
  actor     Profile  @relation(fields: [actorId], references: [id])
  action    String   // status_changed | comment_added | file_uploaded | stage_done | assignee_changed
  metadata  Json?    // { from: 'new', to: 'in_progress' }
  createdAt DateTime @default(now())

  @@index([orderId, createdAt])
  @@map("activity_logs")
}

// Документи (PDF)
model Document {
  id          String         @id @default(uuid())
  type        DocumentType
  number      String         // INV-2026-0001, ACT-2026-0001
  orderId     String?
  order       Order?         @relation(fields: [orderId], references: [id])
  companyId   String
  company     Company        @relation(fields: [companyId], references: [id])
  status      DocumentStatus @default(draft)
  storedAs    String?        // шлях до PDF у /srv/uploads/documents/
  sentAt      DateTime?
  generatedAt DateTime       @default(now())
  createdById String
  createdBy   Profile        @relation(fields: [createdById], references: [id])

  @@index([companyId])
  @@index([orderId])
  @@index([type])
  @@map("documents")
}

// Лічильник нумерації документів (по типу + рік)
model DocumentCounter {
  type  DocumentType @id
  count Int          @default(0)
  year  Int

  @@map("document_counters")
}

// OTP для прив'язки Telegram — поля на Profile (не окрема таблиця):
//   telegramOtp           String?
//   telegramOtpExpiresAt  DateTime?
```

### Додаткові поля (доповнення до схеми вище)

```prisma
// Profile — додати:
theme                 Theme     @default(system)
telegramOtp           String?
telegramOtpExpiresAt  DateTime?

// Company — додати:
currency  String  @default("USD")  // USD | EUR | UAH
notes     String?                  // внутрішні нотатки owner

// Order — додати:
currency   String    @default("USD")
deletedAt  DateTime?               // soft delete (null = активне)

// Payment — додати:
orderId    String?                 // для авансів
type       PaymentType @default(final)
order      Order?      @relation(fields: [orderId], references: [id])

// Document — додати (для payslip виконавцям):
executorId  String?
executor    Profile?   @relation(...)

enum Theme        { light dark system }
enum PaymentType  { advance final partial }
enum OtpPurpose   { telegram_link two_fa phone_verify email_verify }
enum OtpChannel   { email telegram sms }
```

### Додаткові таблиці (доповнення)

```prisma
// Курс валют (singleton — один запис, оновлюється вручну)
model ExchangeRate {
  id        String   @id @default(cuid())
  usdToUah  Decimal  @db.Decimal(8, 4)   // 41.5000
  eurToUah  Decimal  @db.Decimal(8, 4)
  updatedAt DateTime @updatedAt
  updatedBy String   // profile id

  @@map("exchange_rates")
}

// OTP токени (email/telegram/sms — єдина таблиця для всіх каналів)
model OtpToken {
  id        String     @id @default(uuid())
  profileId String
  profile   Profile    @relation(fields: [profileId], references: [id], onDelete: Cascade)
  code      String     // 6-digit numeric
  purpose   OtpPurpose
  channel   OtpChannel
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime   @default(now())

  @@index([profileId, purpose])
  @@index([code, purpose])
  @@map("otp_tokens")
}

// PaymentSettings — додати поля:
// invoiceCurrency  String  @default("UAH")   ← в чому PDF рахунки

// Payment — додати поля:
// provider           String  @default("manual")  // manual|liqpay|stripe|monobank
// providerPaymentId  String?
// paymentLink        String?
```

### Нові shared packages

```
packages/
├── i18n/          ← переклади (uk + en), react-i18next конфіг
├── storage/       ← StorageAdapter interface + LocalAdapter + HetznerAdapter
├── payments/      ← PaymentProvider interface + ManualProvider (Phase 2: LiqPay, Stripe)
└── templates/     ← PDF шаблони (@react-pdf/renderer)
```

**packages/storage:**
```typescript
export interface StorageAdapter {
  save(key: string, buffer: Buffer, mimeType: string): Promise<void>
  getStream(key: string): Promise<Readable>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
}
// MVP: LocalStorageAdapter('/srv/uploads')
// Phase 2: HetznerStorageAdapter (S3-compatible, env: HETZNER_BUCKET/ACCESS_KEY/SECRET_KEY)
```

**Вибір адаптера в API:**
```typescript
// STORAGE_ADAPTER=local (default) | hetzner
const storage = process.env.STORAGE_ADAPTER === 'hetzner'
  ? new HetznerStorageAdapter(process.env.HETZNER_BUCKET!)
  : new LocalStorageAdapter('/srv/uploads');
fastify.decorate('storage', storage);
```

**packages/payments:**
```typescript
// packages/payments/src/PaymentProvider.ts
export interface PaymentProvider {
  id: string  // 'manual' | 'liqpay' | 'stripe' | 'monobank'
  createPaymentLink(params: {
    orderId: string; amount: number; currency: string; description: string
  }): Promise<string | null>  // null для manual
  handleWebhook(payload: unknown): Promise<PaymentResult>
  verifyWebhookSignature(payload: unknown, signature: string): boolean
}

// MVP: ManualPaymentProvider (повертає null для createPaymentLink)
// Phase 2: LiqPayProvider | StripeProvider | MonobankProvider
```

```typescript
// apps/api — вибір провайдера:
// PAYMENT_PROVIDER=manual (default) | liqpay | stripe | monobank
const paymentProvider = createPaymentProvider(process.env.PAYMENT_PROVIDER ?? 'manual');
fastify.decorate('payment', paymentProvider);
```

---

## 6. ФАЗОВИЙ ПЛАН

> **Актуальний покроковий план реалізації знаходиться в [`docs/TRACKER.md`](TRACKER.md).**
> Там зафіксовані всі спринти S0–S8, статуси задач і загальний прогрес (171 задача).
> Нижче — лише структурний огляд паралелізації команди.

### Паралелізація команди

```
Week 1:    [Всі] Foundation — монорепо, БД, CI/CD, dev environment (Sprint S0)
Week 2-3:  [1-2] API auth + orders core (S1)
           [3]   packages/ui + portal scaffold
           [4]   Landing HTML/CSS
           [5]   packages/types + packages/notifications
Week 4-5:  [1-2] API workspace + billing (S2-S3)
           [3]   Portal основні screens
           [4]   Workspace executor views
           [5]   Workspace owner views
Week 6-7:  [1]   API services + team + content (S4-S5)
           [2]   Bot (S6)
           [3]   Portal billing + referrals
           [4-5] Landing + Blog
Week 8-10: [Всі] QA + polish + launch → v0.1.0 (S7-S8)
```

### Фази проекту

| Фаза | Зміст | Результат |
|---|---|---|
| **MVP (Phase 1)** | Sprint S0–S8, всі 16 модулів | Перший реальний клієнт, `v1.0.0` |
| **Phase 2** | LiqPay/Stripe, 2FA, Hetzner Object Storage, кастомні статуси | Масштабування |
| **Phase 3** | SMS нотифікації, мобільний застосунок, VIP tier | Зростання |

### Sprint 0 — Foundation (Тиждень 1)
> Ціль: CI зелений, БД на staging, dev environment у всіх

```
□ pnpm workspace + turbo.json
□ tsconfig.base.json + packages/eslint-config
□ packages/types (enums + constants + DTO)
□ packages/db (schema.prisma + перша міграція + seed)
□ docker-compose.dev.yml (postgres + mailpit)
□ .env.example заповнений
□ GitHub repo + branch protection (public repo on Free, or private with Pro/Team)
□ Сервер: PostgreSQL, Traefik, DNS
□ GitHub Secrets заповнені
□ staging.yml + production.yml — перший деплой
□ GitHub Environment "production" з reviewer (public on Free, or private with Pro/Team)
□ Skeleton apps — GET /health → { status: 'ok' }
□ turbo build без помилок
```

### Sprint 1 — Auth + Core API (Тиждень 2-3)
```
□ packages/notifications (email + telegram + notify())
□ POST /auth/register, /login, /logout, /refresh
□ POST /auth/forgot-password, /reset-password
□ GET  /auth/me
□ PATCH /profile, /profile/password, /profile/notifications
□ JWT middleware + role guard
□ Rate limiting на /auth/*
```

### Sprint 2 — Orders API (Тиждень 3-4)
```
□ GET/POST /orders (клієнтський)
□ GET /orders/:id
□ GET/POST /orders/:id/comments + SSE stream
□ POST/GET/DELETE /orders/:id/files (multipart)
□ POST /orders/:id/approve, /accept
□ GET/POST/PATCH /workspace/orders
□ PATCH /workspace/orders/:id/status
□ Internal tasks CRUD
□ Time logs CRUD
```

### Sprint 3 — Portal Frontend (Тиждень 4-5)
```
□ packages/ui primitives (Button, Input, Badge, Modal, Table)
□ Auth context (token в пам'яті + auto-refresh)
□ /login, /register, /forgot-password, /reset-password
□ /dashboard
□ /tasks (список + фільтри)
□ /tasks/new
□ /tasks/:id (статус, чат SSE, файли, activity)
□ /team (члени + invite)
□ /settings
```

### Sprint 4 — Workspace Frontend (Тиждень 5-6)
```
□ Executor: / kanban + /tasks/:id + /profile
□ Owner: / overview + /orders (kanban+table) + /orders/:id
□ Owner: /clients + /clients/:id
```

### Sprint 5 — Billing + Services + Team (Тиждень 6-7)
```
□ API: billing, services, team endpoints
□ pg_cron для service_charges
□ Portal: /billing, /referrals, /loyalty
□ Workspace: /billing, /services, /team, /settings
```

### Sprint 6 — Landing + Blog + Bot (Тиждень 7-8)
```
□ Landing: всі секції з реальним контентом
□ /blog, /cases (ISR), /team, /stack, /terms, /privacy
□ UA + EN (next-intl)
□ SEO: metadata, sitemap, OG images, schema markup
□ Workspace: /content (TipTap + AI draft), /messages, /inbox
□ Bot: /start, webhook notifications
```

### Sprint 7 — QA + Launch (Тиждень 9-10)
```
□ E2E тестування ключових flows
□ Email templates HTML дизайн
□ Lighthouse ≥ 90 для landing
□ Security review (OWASP)
□ Sentry + UptimeRobot + Netdata
□ Перший реальний клієнт — ручне тестування
□ git tag v0.1.0 → production
```

---

## 7. TURBO PIPELINE (turbo.json)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV", "DATABASE_URL", "VITE_API_URL"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**", "build/**"],
      "env": ["NEXT_PUBLIC_*", "VITE_*"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["DATABASE_URL_TEST"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "cache": false,
      "dependsOn": ["db:migrate"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Пояснення:**
- `"dependsOn": ["^build"]` — спочатку збирає всі залежні пакети (наприклад packages/types), потім поточний
- `"persistent": true` для `dev` — turbo не зупиняє процес
- `"cache": false` для db команд — не кешуємо (результат залежить від зовнішнього стану)
- `globalEnv` — якщо ці змінні змінились — інвалідуємо кеш

**Команди:**

```bash
turbo dev                          # Запустити всі apps в dev режимі
turbo build                        # Зібрати всі apps (паралельно)
turbo build --filter=portal        # Тільки portal
turbo type-check                   # TypeScript check по всьому монорепо
turbo lint                         # ESLint по всьому монорепо
turbo test                         # Всі unit/integration тести
turbo test --filter=packages/types # Тести тільки types package
```

---

## 8. PRISMA MIGRATIONS В PRODUCTION

**Принцип:** Міграції — частина деплою. Автоматично перед стартом нового контейнера.

### Команди

| Команда | Де | Коли |
|---|---|---|
| `prisma migrate dev` | Локально | При розробці нової функції (генерує нову міграцію) |
| `prisma migrate deploy` | CI/CD | При кожному деплої на staging і production |
| `prisma migrate status` | CI/CD | Перевірка стану міграцій перед деплоєм |
| `prisma db seed` | Локально / Staging | Тільки вручну (ніколи автоматично в prod) |

### GitHub Actions деплой (порядок кроків)

```yaml
# .github/workflows/production.yml
- name: Run migrations
  run: |
    # Перевіряємо що нема pending міграцій яких немає в БД
    docker exec workflo-api npx prisma migrate status
    # Застосовуємо нові міграції (safe, не впливає на дані)
    docker exec workflo-api npx prisma migrate deploy
  # Це відбувається ДО перезапуску контейнерів (zero-downtime)
```

### Правила (MVP)

1. **Тільки additive міграції** — `ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`
2. **Ніколи** — `DROP COLUMN`, `ALTER COLUMN` (тип), `DROP TABLE` в MVP
3. Нові поля — завжди nullable або з DEFAULT (старий код не знає про нові поля → не ламається)
4. Видалення колонки — тільки після того як новий код задеплоєний і не читає це поле (Phase 2)

### Rollback

Якщо міграція задеплоєна і щось пішло не так:
1. Rollback коду (попередній Docker image) — `./scripts/rollback.sh`
2. Код старий → нові nullable поля просто ігноруються → все працює
3. Видаляти міграцію вручну в prod — тільки в крайньому випадку, по процедурі

### Окрема тестова БД для CI

```bash
# .env.test
DATABASE_URL_TEST="postgresql://workflo:password@localhost:5432/workflo_test"

# В GitHub Actions:
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_DB: workflo_test
      POSTGRES_USER: workflo
      POSTGRES_PASSWORD: password
```

---

## 9. API STANDARDS & BEST PRACTICES

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

| Код | Коли використовувати |
|---|---|
| `200 OK` | GET, PATCH — успішно |
| `201 Created` | POST що створює новий ресурс |
| `204 No Content` | DELETE успішно (без тіла) |
| `400 Bad Request` | Zod валідація не пройшла |
| `401 Unauthorized` | Немає/невалідний токен |
| `403 Forbidden` | Авторизований, але немає прав |
| `404 Not Found` | Ресурс не існує |
| `409 Conflict` | Конфлікт (email вже зайнятий, slug існує) |
| `422 Unprocessable Entity` | Бізнес-логіка відхилила (неправильний перехід статусу) |
| `429 Too Many Requests` | Rate limit перевищено |
| `500 Internal Server Error` | Непередбачена помилка |
| `503 Service Unavailable` | Зовнішній сервіс недоступний (OpenAI, Mailcow) |

---

### 7.3 Error Codes (ApiErrorCode enum)

```typescript
// packages/types/src/errors.ts
export enum ApiErrorCode {
  // Auth
  INVALID_CREDENTIALS     = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED           = 'TOKEN_EXPIRED',
  TOKEN_INVALID           = 'TOKEN_INVALID',
  TOKEN_REUSE_DETECTED    = 'TOKEN_REUSE_DETECTED',
  ACCOUNT_INACTIVE        = 'ACCOUNT_INACTIVE',
  EMAIL_TAKEN             = 'EMAIL_TAKEN',
  INVITE_INVALID          = 'INVITE_INVALID',
  INVITE_EXPIRED          = 'INVITE_EXPIRED',

  // Validation & General
  VALIDATION_ERROR        = 'VALIDATION_ERROR',
  NOT_FOUND               = 'NOT_FOUND',
  FORBIDDEN               = 'FORBIDDEN',
  RATE_LIMITED            = 'RATE_LIMITED',
  CONFLICT                = 'CONFLICT',

  // Orders
  ORDER_NOT_FOUND         = 'ORDER_NOT_FOUND',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  ORDER_DELETED           = 'ORDER_DELETED',

  // Billing
  PAYMENT_ALREADY_CONFIRMED = 'PAYMENT_ALREADY_CONFIRMED',
  INSUFFICIENT_BALANCE    = 'INSUFFICIENT_BALANCE',

  // Loyalty
  INSUFFICIENT_LOYALTY_POINTS = 'INSUFFICIENT_LOYALTY_POINTS',
  LOYALTY_MAX_DISCOUNT_EXCEEDED = 'LOYALTY_MAX_DISCOUNT_EXCEEDED',

  // Referral
  INVALID_REFERRAL_CODE   = 'INVALID_REFERRAL_CODE',
  SELF_REFERRAL           = 'SELF_REFERRAL',

  // Files
  FILE_TOO_LARGE          = 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED   = 'FILE_TYPE_NOT_ALLOWED',
  FILE_NOT_FOUND          = 'FILE_NOT_FOUND',

  // External services
  EMAIL_SEND_FAILED       = 'EMAIL_SEND_FAILED',
  AI_GENERATION_FAILED    = 'AI_GENERATION_FAILED',
  AI_GENERATION_TIMEOUT   = 'AI_GENERATION_TIMEOUT',
  EXCHANGE_RATE_UNAVAILABLE = 'EXCHANGE_RATE_UNAVAILABLE',

  // System
  INTERNAL_ERROR          = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE     = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE        = 'MAINTENANCE_MODE',
}
```

### AppError клас

```typescript
// packages/types/src/AppError.ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    public readonly userMessage: string,   // показуємо користувачу
    public readonly details?: unknown,
  ) {
    super(userMessage)
    this.name = 'AppError'
  }
}

// Хелпери:
export const Errors = {
  notFound: (entity: string) =>
    new AppError(404, ApiErrorCode.NOT_FOUND, `${entity} не знайдено`),

  forbidden: () =>
    new AppError(403, ApiErrorCode.FORBIDDEN, 'У вас немає доступу до цього ресурсу'),

  invalidStatusTransition: (from: string, to: string) =>
    new AppError(422, ApiErrorCode.INVALID_STATUS_TRANSITION,
      `Неможливо змінити статус з "${from}" на "${to}"`),

  aiTimeout: () =>
    new AppError(503, ApiErrorCode.AI_GENERATION_TIMEOUT,
      'Генерація зайняла надто довго. Спробуйте ще раз або введіть текст вручну.'),

  serviceUnavailable: (service: string) =>
    new AppError(503, ApiErrorCode.SERVICE_UNAVAILABLE,
      `Сервіс тимчасово недоступний. Спробуйте через хвилину.`),
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
  fastify.setErrorHandler(async (error: FastifyError | AppError | ZodError, req: FastifyRequest, reply: FastifyReply) => {

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
          details: error.errors.map(e => ({
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
        error: { code: ApiErrorCode.VALIDATION_ERROR, message: 'Невірні вхідні дані', details: error.validation },
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
  })

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
  'https://app.workflo.space',
  'https://work.workflo.space',
  'https://workflo.space',
]

const ALLOWED_ORIGINS_DEV = [
  'http://localhost:3000',  // landing
  'http://localhost:3001',  // portal
  'http://localhost:3002',  // workspace
]

export async function setupCors(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? ALLOWED_ORIGINS_PROD
      : (origin, cb) => {
          // dev: дозволяємо всі localhost origin
          if (!origin || origin.startsWith('http://localhost')) return cb(null, true)
          cb(new Error('Not allowed by CORS'), false)
        },
    credentials: true,           // потрібно для cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400,               // preflight cache 24 год
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
    max: 300,           // дефолт: 300 req / хвилину / IP
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
  instance.addHook('onRequest', rateLimitHook({
    max: 10,
    timeWindow: '1 hour',
    keyGenerator: (req) => req.user?.id || req.ip,  // per user, не per IP
  }))
  instance.post('/blog/generate', generateBlogHandler)
})

// Публічні endpoints — менш строго
// /blog, /health — дефолт 300/хв
```

**Таблиця лімітів:**

| Endpoint | Ліміт | Вікно | По чому |
|---|---|---|---|
| `POST /auth/login` | 10 | 15 хв | IP |
| `POST /auth/register` | 10 | 15 хв | IP |
| `POST /auth/forgot-password` | 5 | 15 хв | IP |
| `POST /auth/refresh` | 60 | 1 хв | IP |
| `POST /files` | 30 | 1 хв | User |
| `POST /blog/generate` | 10 | 1 год | User |
| `POST /settings/telegram/link` | 5 | 10 хв | User |
| Решта API | 300 | 1 хв | IP |

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
  title: z.string().min(1, 'Назва обов\'язкова').max(255, 'Назва занадто довга'),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().datetime().optional().nullable(),
  serviceIds: z.array(z.string().uuid()).optional(),
})

export const updateOrderStatusSchema = z.object({
  status: z.enum(['new','in_review','approved','in_progress','on_hold',
                  'in_review_final','revision','done','cancelled']),
  comment: z.string().max(1000).optional(),
})

export type CreateOrderDto = z.infer<typeof createOrderSchema>
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>
```

```typescript
// apps/api/src/routes/orders.ts — використання в route
fastify.post('/orders', async (req, reply) => {
  const body = createOrderSchema.parse(req.body)  // кидає ZodError якщо невалідно
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
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
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

| Подія | Рівень | Поля |
|---|---|---|
| Server start/stop | `info` | `version`, `port`, `env` |
| Request/Response | `info` | автоматично Fastify |
| Auth: login success | `info` | `profileId`, `role` |
| Auth: login failed | `warn` | `email`, `ip` |
| Auth: token reuse | `warn` | `profileId`, `ip` |
| Status change | `info` | `orderId`, `from`, `to`, `actorId` |
| Payment confirmed | `info` | `paymentId`, `amount`, `confirmedBy` |
| Email sent | `info` | `to`, `template` |
| Email failed | `error` | `to`, `template`, `error` |
| File upload | `info` | `fileId`, `size`, `uploadedBy` |
| Cron job start/end | `info` | `job`, `duration` |
| Rate limit hit | `warn` | `ip`, `endpoint` |
| Unhandled error | `error` | `error`, `stack`, `url` |

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
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Для кожного сервісу:**

| Сервіс | Health endpoint | Порт |
|---|---|---|
| API | `GET /health` | 4000 |
| Landing | `GET /api/health` | 3000 |
| Portal | Nginx `location /health { return 200; }` | 3001 |
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

process.on('SIGTERM', () => shutdown('SIGTERM'))  // Docker stop
process.on('SIGINT', () => shutdown('SIGINT'))    // Ctrl+C
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
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
    : ['warn', 'error'],
})

// Dev: логуємо повільні запити
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    if (e.duration > 500) {  // > 500ms
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

| Параметр | Значення | Пояснення |
|---|---|---|
| `connection_limit` | `10` | Макс. відкритих з'єднань до PostgreSQL |
| `pool_timeout` | `20` | Секунди чекати вільне з'єднання (потім error) |
| `connect_timeout` | `10` | Секунди на початкове підключення |

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

| Збій | Технічна причина | Повідомлення користувачу |
|---|---|---|
| DB недоступна | Connection refused | "Сервіс тимчасово недоступний. Спробуйте через хвилину." |
| Email не відправився | SMTP timeout | (не показуємо — логуємо тихо, retry пізніше) |
| AI timeout | OpenAI > 30s | "Генерація зайняла надто довго. Спробуйте ще раз або введіть текст вручну." |
| OpenAI rate limit | 429 від OpenAI | "Сервіс генерації тимчасово недоступний. Введіть текст вручну." |
| НБУ API недоступне | Fetch error | (тихо використовуємо останній відомий курс) |
| Файл занадто великий | 413 | "Файл перевищує максимальний розмір (50 МБ)." |
| Невірний тип файлу | MIME check | "Цей тип файлу не підтримується. Дозволені: PDF, DOCX, XLSX, JPG, PNG, ZIP." |
| Telegram не відповів | 403 bot blocked | (тихо очищаємо telegramChatId, логуємо) |

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
    "**/*.{ts,tsx}": [
      "eslint --fix --max-warnings=0",
      "prettier --write"
    ],
    "**/*.{json,md,yaml,yml}": [
      "prettier --write"
    ],
    "packages/db/prisma/schema.prisma": [
      "npx prisma format"
    ]
  }
}
```

**Що перевіряється:**
- Pre-commit: ESLint (автофікс) + Prettier (автоформат)
- Pre-push: TypeScript `tsc --noEmit` по всьому монорепо

---

## 10. SEED ФАЙЛ

> `packages/db/prisma/seed.ts` — дані для старту розробки і тестування

### Що створює seed

```typescript
// packages/db/prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── 1. OWNER ─────────────────────────────────────────────
  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@workflo.space'
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'Admin123!'

  const owner = await prisma.profile.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      passwordHash: await bcrypt.hash(ownerPassword, 12),
      displayName: 'Workflo Owner',
      role: 'owner',
      isActive: true,
      preferredLanguage: 'uk',
      theme: 'system',
    },
  })
  console.log(`✅ Owner: ${ownerEmail} / ${ownerPassword}`)

  // ─── 2. EXECUTOR ──────────────────────────────────────────
  const executor = await prisma.profile.upsert({
    where: { email: 'executor@workflo.space' },
    update: {},
    create: {
      email: 'executor@workflo.space',
      passwordHash: await bcrypt.hash('Exec123!', 12),
      displayName: 'Петро Виконавець',
      role: 'executor',
      isActive: true,
      preferredLanguage: 'uk',
    },
  })
  console.log('✅ Executor: executor@workflo.space / Exec123!')

  // ─── 3. TEST COMPANY + COMPANY OWNER ──────────────────────
  const clientProfile = await prisma.profile.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: {
      email: 'client@example.com',
      passwordHash: await bcrypt.hash('Client123!', 12),
      displayName: 'Іван Клієнт',
      role: 'client',
      isActive: true,
    },
  })

  const company = await prisma.company.upsert({
    where: { slug: 'test-company' },
    update: {},
    create: {
      name: 'ТОВ Тестова Компанія',
      slug: 'test-company',
      referralCode: 'workflo-TEST01',
      preferredLanguage: 'uk',
      members: {
        create: { profileId: clientProfile.id, role: 'owner' },
      },
      loyaltyAccount: {
        create: { balance: 250, totalEarned: 250, tier: 'bronze' },
      },
      notificationSettings: {
        create: {},
      },
    },
  })
  console.log('✅ Company: ТОВ Тестова Компанія (client@example.com / Client123!)')

  // ─── 4. BILLING PLANS ─────────────────────────────────────
  const plans = [
    { name: 'Starter', slug: 'starter', priceUsd: 49, maxOrders: 5, maxMembers: 1, features: ['5 активних замовлень', 'Email підтримка'] },
    { name: 'Professional', slug: 'professional', priceUsd: 99, maxOrders: 20, maxMembers: 3, features: ['20 замовлень', 'Пріоритетна підтримка', 'API доступ'] },
    { name: 'Business', slug: 'business', priceUsd: 199, maxOrders: null, maxMembers: 10, features: ['Необмежено замовлень', '24/7 підтримка', 'Кастомні інтеграції'] },
  ]

  for (const plan of plans) {
    await prisma.billingPlan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: plan,
    })
  }
  console.log('✅ Billing plans: Starter / Professional / Business')

  // ─── 5. EXCHANGE RATE ─────────────────────────────────────
  await prisma.exchangeRate.upsert({
    where: { currency: 'UAH' },
    update: {},
    create: { currency: 'UAH', rateToUsd: 41.5, source: 'seed', updatedAt: new Date() },
  })
  console.log('✅ Exchange rate: 1 USD = 41.5 UAH')

  // ─── 6. TEST ORDERS ───────────────────────────────────────
  const orderData = [
    { title: 'Автоматизація звітності Excel', status: 'in_progress', priority: 'high', totalAmount: 500 },
    { title: 'Парсинг даних з сайту постачальника', status: 'new', priority: 'medium', totalAmount: null },
    { title: 'CRM інтеграція з 1C', status: 'in_review_final', priority: 'urgent', totalAmount: 1200 },
    { title: 'Telegram бот для сповіщень', status: 'done', priority: 'medium', totalAmount: 300 },
    { title: 'Google Sheets дашборд продажів', status: 'on_hold', priority: 'low', totalAmount: 250 },
  ]

  for (const order of orderData) {
    await prisma.order.create({
      data: {
        ...order,
        companyId: company.id,
        executors: { create: { userId: executor.id, assignedBy: owner.id } },
      },
    })
  }
  console.log('✅ Test orders: 5 замовлень в різних статусах')

  // ─── 7. NOTIFICATION SETTINGS ─────────────────────────────
  await prisma.notificationSettings.upsert({
    where: { profileId: owner.id },
    update: {},
    create: { profileId: owner.id },
  })
  await prisma.notificationSettings.upsert({
    where: { profileId: executor.id },
    update: {},
    create: { profileId: executor.id },
  })

  console.log('\n🎉 Seed completed!')
  console.log('─────────────────────────────────────────')
  console.log('Credentials for testing:')
  console.log(`  Owner:    ${ownerEmail} / ${ownerPassword}`)
  console.log(`  Executor: executor@workflo.space / Exec123!`)
  console.log(`  Client:   client@example.com / Client123!`)
  console.log('  Portal:   http://localhost:3001')
  console.log('  Workspace: http://localhost:3002')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**package.json скрипт:**

```json
// packages/db/package.json
{
  "scripts": {
    "seed": "tsx prisma/seed.ts",
    "seed:reset": "prisma migrate reset --force && tsx prisma/seed.ts"
  }
}
```

**ENV для seed:**

```bash
# .env.local
SEED_OWNER_EMAIL=owner@workflo.space
SEED_OWNER_PASSWORD=Admin123!
```

> ⚠️ В production seed запускається тільки один раз при першому деплої. Після цього owner сам змінює пароль через /settings.

---

## 11. ОНБОРДИНГ ТА EMPTY STATE

### 11.1 Portal — перший клієнт

**Стан після реєстрації:** порожній список замовлень. Замість білого екрану — welcome experience.

#### Welcome Modal (показується 1 раз після реєстрації)

```
┌─────────────────────────────────────┐
│  👋 Ласкаво просимо до Workflo!     │
│                                     │
│  Workflo — ваш особистий кабінет    │
│  для роботи з нашою командою.       │
│                                     │
│  Ось як це працює:                  │
│  ① Створіть замовлення              │
│  ② Ми беремося до роботи            │
│  ③ Ви отримуєте результат           │
│                                     │
│  [Розпочати роботу →]               │
└─────────────────────────────────────┘
```

Зберігається в `localStorage: 'workflo_welcome_shown'` — більше не показується.

#### Onboarding Checklist (Dashboard)

Блок з прогресом, зникає коли всі пункти виконані:

```
📋 Налаштуйте акаунт (3/4 виконано)
━━━━━━━━━░  75%

✅ Акаунт створено
✅ Перше замовлення подано
✅ Telegram підключено
□  Заповніть дані компанії  [Заповнити →]
```

**Пункти чеклісту:**

| # | Пункт | Умова виконання | Дія |
|---|---|---|---|
| 1 | Акаунт створено | Завжди ✅ | — |
| 2 | Подайте перше замовлення | `orders.count > 0` | [Створити замовлення] |
| 3 | Підключіть Telegram | `profile.telegramChatId != null` | [Підключити] |
| 4 | Заповніть дані компанії | `company.phone != null OR company.taxId != null` | [Заповнити] |

Зберігаємо прогрес в `company_onboarding` таблиці або просто рахуємо з реальних даних (preferred).

#### Empty State — список замовлень

```
┌─────────────────────────────────────┐
│                                     │
│          [Ілюстрація]               │
│                                     │
│     У вас ще немає замовлень        │
│                                     │
│  Опишіть завдання — ми візьмемось   │
│  до роботи та тримаємо вас в курсі  │
│  на кожному кроці.                  │
│                                     │
│    [+ Створити перше замовлення]    │
│                                     │
└─────────────────────────────────────┘
```

#### Empty State — чат замовлення

```
Почніть спілкування з командою.
Ставте запитання, надсилайте файли,
уточнюйте деталі.
```

---

### 11.2 Workspace — перший вхід виконавця

**Tooltip tour** при першому логіні (стан в `localStorage: 'workflo_tour_shown'`):

```
Крок 1/4:  Стрілка на список замовлень
           "Тут ваші поточні замовлення"

Крок 2/4:  Стрілка на фільтр статусів
           "Фільтруйте за статусом та пріоритетом"

Крок 3/4:  Стрілка на кнопку тайм-логу
           "Логуйте витрачений час на кожне замовлення"

Крок 4/4:  Стрілка на bell icon
           "Налаштуйте Telegram для швидких сповіщень"
```

Реалізація: **react-joyride** (lightweight, підтримує dark mode).

#### Empty State — немає призначених замовлень

```
У вас поки немає призначених замовлень.
Зверніться до власника для призначення
або зачекайте нових задач.
```

---

### 11.3 Загальні правила Empty State

1. **Завжди є дія** — кнопка або підказка що робити далі
2. **Ніяких технічних текстів** — не "No data found", а зрозуміла причина
3. **Ілюстрація** — SVG ілюстрація (не emoji). Файли в `packages/ui/src/assets/empty/`
4. **Короткий текст** — 1 заголовок + 1-2 рядки опису
5. **Узгодженість** — один компонент `<EmptyState icon={} title={} description={} action={} />` в `packages/ui`

```tsx
// packages/ui/src/components/EmptyState/EmptyState.tsx
interface EmptyStateProps {
  icon: 'orders' | 'comments' | 'files' | 'notifications' | 'generic'
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <EmptyStateIllustration type={icon} className="w-48 h-48 mb-6 opacity-60" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mb-6 max-w-xs">{description}</p>}
      {action && (
        <Button onClick={action.onClick} variant="primary">
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

---

### 11.4 Terms of Service / Privacy Policy

Статичні сторінки на лендингу: `/uk/terms` та `/uk/privacy` (і `/en/` версії).

В MVP — стандартний мінімум, достатній для початку роботи.

**Terms of Service — структура:**
1. Загальні положення (що таке сервіс, хто надає)
2. Умови реєстрації (вік 18+, відповідальність за дані)
3. Права та обов'язки сторін
4. Заборонені дії
5. Оплата та повернення коштів
6. Обмеження відповідальності
7. Зміни в умовах (повідомляємо email за 14 днів)
8. Контакти: hello@workflo.space

**Privacy Policy — структура:**
1. Які дані збираємо: email, ім'я, IP, cookie (session)
2. Як використовуємо: надання сервісу, нотифікації
3. Де зберігаємо: Hetzner (Євросоюз / Фінляндія)
4. Cookie: тільки сесійні (httpOnly refresh cookie)
5. Треті сторони: Sentry (помилки), OpenAI (генерація контенту — не зберігає)
6. Права користувача: видалення даних за запитом (email)
7. Контакти: hello@workflo.space

> Перед публічним запуском — показати юристу. До першого клієнта — стандартний текст достатній.

**Посилання в footer лендингу:**

```tsx
// apps/landing/src/components/Footer.tsx
<nav>
  <Link href={`/${locale}/terms`}>Умови використання</Link>
  <Link href={`/${locale}/privacy`}>Політика конфіденційності</Link>
</nav>
```
