# WORKFLO.SPACE — План реалізації

> Статус: Фінальна v1.0
> Дата: 12 квітня 2026

---

> ⚠️ **СТАТУС (doc-sync 1.06): «Engineering Standards & Historical Plan».** Секції **§4 (endpoints), §5 (DB-схема), §6 (фазовий план), §10 (seed)** — застаріли й обрізані до вказівників (канон: `modules/NN-*.md` · `SPEC.md` · `packages/db/prisma/schema.prisma` · `TRACKER.md` · `seed.ts`). Живі тут: **§3** (tsconfig/eslint), **§7** (turbo), **§8** (migration-ops), **§11** (онбординг/UX). Наскрізні API-стандарти винесено в **`ENGINEERING_STANDARDS.md`** (колишній §9).

> 🔄 **design-v2 (2026-06-20):** новий дизайн-бандл [`design-v2/`](../design-v2/) розширив скоуп (fin-model 2.0, 360°-картки, board, order-chat, EU-docs, hubs, рольова IA). Готовність дизайн✅ × бекенд + бекенд-гапи (clients-CRUD `CompanyService` викинуто P-1e · Document-route · board-columns · notify-feed) — у [`DESIGN_SYSTEM.md §5.13`](DESIGN_SYSTEM.md) і `TRACKER.md` (блок «DESIGN-V2 ДОСТАВЛЕНО»).

## ЗМІСТ

1. [Закриті рішення](#1-закриті-рішення)
2. [Shared packages — структура](#2-shared-packages--структура) _(включає повний enum/constant/DTO spec для packages/types)_
3. [TypeScript + ESLint конфіг](#3-typescript--eslint-конфіг)
4. [API Design — всі endpoints](#4-api-design--всі-endpoints)
5. [DB Schema — фінальна Prisma](#5-db-schema--фінальна-prisma)
6. [Фазовий план](#6-фазовий-план) _(детальний трекер — TRACKER.md)_
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
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth',
  maxAge: 30 * 24 * 60 * 60,
})
```

**CORS:**

```typescript
origin: ['https://portal.workflo.space', 'https://work.workflo.space',
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
→ invite_token → portal.workflo.space/invite/{token}
→ реєстрація або прив'язка до існуючого profile
```

**Password reset:**

```
POST /auth/forgot-password { email }
→ reset_token (UUID, TTL 1 год)
→ email → portal.workflo.space/reset-password/{token}
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
  NEW = 'new',
  CLARIFICATION = 'clarification',
  ESTIMATION = 'estimation',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

// Клієнтські статуси (4 — portal бачить тільки їх)
export enum OrderClientStatus {
  PENDING = 'pending', // new | clarification | estimation
  IN_WORK = 'in_work', // approved | in_progress | review | on_hold
  DONE = 'done', // done
  CANCELLED = 'cancelled', // cancelled
}

export enum OrderType {
  FIXED = 'fixed',
  HOURLY = 'hourly',
  RETAINER = 'retainer',
}

export enum OrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum BillingType {
  PREPAID = 'prepaid',
  POSTPAID = 'postpaid',
}

export enum UserRole {
  OWNER = 'owner',
  EXECUTOR = 'executor',
  CLIENT = 'client',
}

export enum Language {
  UK = 'uk',
  EN = 'en',
}

export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

export enum BlogPostType {
  ARTICLE = 'article',
  CASE = 'case',
}

export enum BlogPostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum InviteType {
  EXECUTOR = 'executor',
  COMPANY_MEMBER = 'company_member',
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

export enum DocumentType {
  INVOICE = 'invoice',
  ADVANCE_INVOICE = 'advance_invoice',
  COMPLETION_ACT = 'completion_act',
  SPECIFICATION = 'specification',
  CONTRACT = 'contract',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  SIGNED = 'signed',
  CANCELLED = 'cancelled',
}

export enum NotificationChannel {
  EMAIL = 'email',
  TELEGRAM = 'telegram',
  IN_APP = 'in_app',
}

export enum NotificationEvent {
  ORDER_CREATED = 'order.created',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  ORDER_COMMENT_ADDED = 'order.comment_added',
  ORDER_DUE_SOON = 'order.due_soon',
  ORDER_ASSIGNED = 'order.assigned',
  ORDER_FILE_UPLOADED = 'order.file_uploaded',
  PAYMENT_CONFIRMED = 'payment.confirmed',
  PAYMENT_PENDING = 'payment.pending',
  SUBSCRIPTION_EXPIRING = 'subscription.expiring',
  SUBSCRIPTION_CHARGED = 'subscription.charged',
  DOCUMENT_SENT = 'document.sent',
  INVITE_SENT = 'invite.sent',
  REFERRAL_REGISTERED = 'referral.registered',
  REFERRAL_BONUS_EARNED = 'referral.bonus_earned',
  LOYALTY_TIER_UPGRADED = 'loyalty.tier_upgraded',
  LOYALTY_POINTS_EARNED = 'loyalty.points_earned',
  SYSTEM_DISK_ALERT = 'system.disk_alert',
  EXCHANGE_RATE_STALE = 'exchange_rate.stale',
}
```

**constants.ts — повний перелік:**

```typescript
import { OrderInternalStatus, OrderClientStatus, LoyaltyTier } from './enums'

// Машина станів: які переходи дозволені (тільки owner/executor, не клієнт)
export const ALLOWED_TRANSITIONS: Record<OrderInternalStatus, OrderInternalStatus[]> = {
  [OrderInternalStatus.NEW]: [
    OrderInternalStatus.CLARIFICATION,
    OrderInternalStatus.ESTIMATION,
    OrderInternalStatus.CANCELLED,
  ],
  [OrderInternalStatus.CLARIFICATION]: [
    OrderInternalStatus.ESTIMATION,
    OrderInternalStatus.CANCELLED,
  ],
  [OrderInternalStatus.ESTIMATION]: [
    OrderInternalStatus.APPROVED,
    OrderInternalStatus.CLARIFICATION,
    OrderInternalStatus.CANCELLED,
  ],
  [OrderInternalStatus.APPROVED]: [
    OrderInternalStatus.IN_PROGRESS,
    OrderInternalStatus.ON_HOLD,
    OrderInternalStatus.CANCELLED,
  ],
  [OrderInternalStatus.IN_PROGRESS]: [
    OrderInternalStatus.REVIEW,
    OrderInternalStatus.ON_HOLD,
    OrderInternalStatus.CANCELLED,
  ],
  [OrderInternalStatus.REVIEW]: [OrderInternalStatus.DONE, OrderInternalStatus.IN_PROGRESS],
  [OrderInternalStatus.DONE]: [], // фінальний стан
  [OrderInternalStatus.CANCELLED]: [], // фінальний стан
  [OrderInternalStatus.ON_HOLD]: [OrderInternalStatus.IN_PROGRESS, OrderInternalStatus.CANCELLED],
}

// Маппінг: що бачить клієнт замість внутрішнього статусу
export const INTERNAL_TO_CLIENT_STATUS: Record<OrderInternalStatus, OrderClientStatus> = {
  [OrderInternalStatus.NEW]: OrderClientStatus.PENDING,
  [OrderInternalStatus.CLARIFICATION]: OrderClientStatus.PENDING,
  [OrderInternalStatus.ESTIMATION]: OrderClientStatus.PENDING,
  [OrderInternalStatus.APPROVED]: OrderClientStatus.IN_WORK,
  [OrderInternalStatus.IN_PROGRESS]: OrderClientStatus.IN_WORK,
  [OrderInternalStatus.REVIEW]: OrderClientStatus.IN_WORK,
  [OrderInternalStatus.ON_HOLD]: OrderClientStatus.IN_WORK,
  [OrderInternalStatus.DONE]: OrderClientStatus.DONE,
  [OrderInternalStatus.CANCELLED]: OrderClientStatus.CANCELLED,
}

export function mapToClientStatus(internal: OrderInternalStatus): OrderClientStatus {
  return INTERNAL_TO_CLIENT_STATUS[internal]
}

// Loyalty: межі для тіру (загальна сума оплат у USD)
export const LOYALTY_TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]: 0, // від $0
  [LoyaltyTier.SILVER]: 500, // від $500
  [LoyaltyTier.GOLD]: 2000, // від $2000
  [LoyaltyTier.PLATINUM]: 5000, // від $5000
}

// Loyalty: множник нарахування балів (1 USD paid = N points × multiplier)
export const LOYALTY_POINTS_MULTIPLIER: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]: 1.0,
  [LoyaltyTier.SILVER]: 1.25,
  [LoyaltyTier.GOLD]: 1.5,
  [LoyaltyTier.PLATINUM]: 2.0,
}

// Loyalty: бали за базовими подіями (до множника тіру)
export const LOYALTY_EVENTS = {
  PAYMENT: 100, // за кожен $1 оплати → 100 pts × multiplier
  FIRST_ORDER: 500, // бонус за перше замовлення
  PROFILE_COMPLETE: 200, // заповнено профіль повністю
  REFERRAL_INVITE: 300, // за кожного запрошеного реферала
} as const

// Loyalty: max знижка балами від суми замовлення
export const LOYALTY_MAX_DISCOUNT_PERCENT = 30

// Referral: відсоток винагороди рефером (від першої оплати реферала)
export const REFERRAL_COMMISSION_PERCENT = 10

// Files: дозволені MIME типи для завантаження
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'text/csv',
  'text/plain',
] as const

// Files: ліміт розміру одного файлу (10 MB)
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
```

**dto.ts — ключові інтерфейси:**

```typescript
import type {
  OrderInternalStatus,
  OrderClientStatus,
  OrderType,
  UserRole,
  LoyaltyTier,
} from './enums'

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
  balance: number // від'ємне = борг
}

export interface OrderListItemDto {
  id: string
  title: string
  internalStatus: OrderInternalStatus // тільки для workspace
  clientStatus: OrderClientStatus // тільки для portal
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
  isInternal: boolean // тільки workspace бачить isInternal=true
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
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  })
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export * from '@prisma/client'
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

> **Движок: HTML → Puppeteer → PDF** (рішення дизайн-фази, 2026-05-29 — див. `DESIGN_SYSTEM.md §5.5 + §8 row 4`). HTML/CSS-мокапи з `design/project/documents-screens.jsx` реюзяться 1:1 — точне повторення (QR, watermark SIGNED/DRAFT, Caveat-підпис). Уникає переписування дизайну в react-pdf-примітивах.
>
> _Примітка: попередній план використовував `@react-pdf/renderer`. Перейшли на Puppeteer для pixel-perfect-збігу з мокапами._

```
packages/templates/
├── src/
│   ├── toolkit/
│   │   ├── DocBrand.tsx     ← header (ASCII wordmark, № документа)
│   │   ├── DocParties.tsx   ← блок реквізитів (виконавець + замовник)
│   │   ├── DocTable.tsx     ← темна шапка, lime акцент на total
│   │   ├── DocSigs.tsx      ← підписи (Caveat, −3°, SIGNED/DRAFT watermark)
│   │   └── DocFoot.tsx      ← QR (IBAN + amount + ref), reference-text
│   ├── templates/
│   │   ├── invoice.tsx          ← Рахунок (INV)
│   │   ├── completion-act.tsx   ← Акт виконаних робіт (ACT)
│   │   ├── reconciliation.tsx   ← Акт звірки (REC)
│   │   ├── specification.tsx    ← Специфікація (SPC)
│   │   ├── contract.tsx         ← Договір (CTR)
│   │   └── credit-note.tsx      ← Credit-note (CRN, з r4)
│   ├── puppeteer.ts         ← singleton + lifecycle (browser pool, recycle)
│   └── index.ts             ← generatePdf(type, data, locale) → Buffer
└── package.json
```

```typescript
// packages/templates/src/index.ts
import { renderToStaticMarkup } from 'react-dom/server';
import { getBrowser } from './puppeteer'; // singleton headless-chrome
import * as Templates from './templates';

export async function generatePdf(
  type: DocumentType, // INV | ACT | REC | SPC | CTR | CRN
  data: DocumentData,
  locale: 'uk' | 'en' = 'uk',
): Promise<Buffer> {
  const Component = Templates[type];
  const html = renderToStaticMarkup(<Component data={data} locale={locale} />);

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true, // зберігає watermark + кольорові акценти
    margin: { top: 56, bottom: 64, left: 56, right: 56 },
  });
  await page.close();
  return pdf;
}
```

**Чому Puppeteer:** дизайн `design/project/documents-screens.jsx` уже HTML/CSS → реюз без переписування. Watermark `SIGNED/DRAFT`, QR-код, Caveat-підпис (−3°) працюють «з коробки». Browser-pool через singleton — амортизація запуску chrome (~300ms cold).

**Trade-off:** headless-chrome на сервері (~120MB пам'яті). Прийнятно для Hetzner VPS. Альтернатива — `@sparticuz/chromium` якщо переїдемо у serverless.

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
      "@workflo/ui": ["../../packages/ui/src/index.ts"],
      "@workflo/types": ["../../packages/types/src/index.ts"],
      "@workflo/db": ["../../packages/db/src/index.ts"],
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
}

// react.js — для portal, workspace, landing
module.exports = {
  extends: ['./index.js', 'plugin:react-hooks/recommended'],
  rules: { 'react-hooks/exhaustive-deps': 'error' },
}
```

---

## 4. API DESIGN — ВСІ ENDPOINTS

> ⚠️ **Обрізано (doc-sync 1.06).** Цей плоский список ендпоінтів застарів (pre-tenancy `/company/*`, без `/workspace/*`, без `switch-agency`, без модулів 26-29).
> **Канон ендпоінтів — `modules/NN-*.md` (секції «API») + `SPEC.md` §4.** Стандарт відповідей/помилок — `ENGINEERING_STANDARDS.md`.

---

## 5. DB SCHEMA — ФІНАЛЬНА PRISMA

> ⚠️ **Обрізано (doc-sync 1.06).** Рукописний знімок схеми застарів (предує Agency/`agencyId`, OutboxEvent, multi-company CompanyMember, OrderFile.sha256, Lead/Ticket, split internalStatus/clientStatus).
> **Канон схеми — `packages/db/prisma/schema.prisma`.** Заплановані дельти — `SPEC.md` §7 (schema-delta).

---

## 6. ФАЗОВИЙ ПЛАН

> ⚠️ **Обрізано (doc-sync 1.06).** Тижневий Sprint 0-7 / «16 модулів» / «171 задача» / v1.0.0 — застаріло.
> **Канон послідовності — `TRACKER.md`** (S0-S8 MVP + S9-S14 + GROWTH + SUPPORT, 29 модулів, backend-first, SaaS-foundation F1-F6).

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

| Команда                 | Де                 | Коли                                               |
| ----------------------- | ------------------ | -------------------------------------------------- |
| `prisma migrate dev`    | Локально           | При розробці нової функції (генерує нову міграцію) |
| `prisma migrate deploy` | CI/CD              | При кожному деплої на staging і production         |
| `prisma migrate status` | CI/CD              | Перевірка стану міграцій перед деплоєм             |
| `prisma db seed`        | Локально / Staging | Тільки вручну (ніколи автоматично в prod)          |

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

> 📦 **Винесено (doc-sync 1.06) у окремий док → [`ENGINEERING_STANDARDS.md`](ENGINEERING_STANDARDS.md)** (response-envelope, `ApiErrorCode`, `AppError`, Fastify error-handler, CORS, rate-limit, Zod, Pino, health, graceful-shutdown, DB-pooling, Husky). Це наскрізний інженерний стандарт — там його канонічний дім.

---

## 10. SEED ФАЙЛ

> ⚠️ **Обрізано (doc-sync 1.06).** Walkthrough використовував неіснуючі поля Profile (`displayName`/`preferredLanguage`/`isActive`/`role`) і не створював Agency.
> **Канон — `packages/db/prisma/seed.ts`** (реюзає `provisionAgency()`, TRACKER FDN-3).

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

| #   | Пункт                    | Умова виконання                                  | Дія                   |
| --- | ------------------------ | ------------------------------------------------ | --------------------- |
| 1   | Акаунт створено          | Завжди ✅                                        | —                     |
| 2   | Подайте перше замовлення | `orders.count > 0`                               | [Створити замовлення] |
| 3   | Підключіть Telegram      | `profile.telegramChatId != null`                 | [Підключити]          |
| 4   | Заповніть дані компанії  | `company.phone != null OR company.taxId != null` | [Заповнити]           |

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

---

## S1 ALIGNMENT UPDATE (27 травня 2026) — історичний S1-запис

> ⚠️ **Демоутовано (1.06):** цей блок БІЛЬШЕ НЕ «endpoint paths source of truth». Канон ендпоінтів — `modules/NN-*.md` + `SPEC.md`. Також застаріле: `switch-company`/`activeCompanyId` → tenant-root = **Agency** (`switch-agency`/`activeAgencyId`, ADR-004); модулів 26-29 тут немає. Лишено для історії.

Цей блок — канонічний список endpoints, доданих/змінених на S1 фазі. Старі секції вище зберігаємо для context, але **при розбіжностях цей блок має пріоритет**.

### Auth + multi-company

```
POST   /auth/register              → profile + company + member(owner) + welcome email
POST   /auth/login                 → access (15m) + refresh cookie (Lax, /auth/refresh)
POST   /auth/refresh               → rotate access; Origin-check CSRF guard
POST   /auth/logout                → clear refresh cookie (same path/domain)
POST   /auth/forgot-password       → 3/15min rate limit
POST   /auth/reset-password        → 5/1h per token
POST   /auth/switch-company        → { companyId } → new access with activeCompanyId
GET    /companies                  → my companies (owner + member)
POST   /companies                  → create + auto owner membership
POST   /companies/:id/transfer-ownership   → { newOwnerProfileId } (with accept step)
POST   /companies/:id/accept-ownership
POST   /companies/:id/members      → invite member
DELETE /companies/:id/members/:profileId
POST   /companies/:id/archive
POST   /companies/:id/restore
```

### Orders + triage + time tracking

```
GET    /orders?filter=unassigned   → owner-only triage queue
PATCH  /orders/:id                 → { assigneeId, ... } incl. assign executor
POST   /orders/:id/transition      → { to } status; owner-only for done/revision/cancel
POST   /orders/:id/timer/start     → auto-stops previous active timer
POST   /orders/:id/timer/stop
POST   /orders/:id/time-logs       → manual entry (started/ended/description)
GET    /executors/:id/time-logs?period=YYYY-MM
GET    /executors/:id/report?period=YYYY-MM
```

### Notifications

```
GET    /profile/settings/notifications          → matrix prefs
PATCH  /profile/settings/notifications          → { category, channel, enabled }
POST   /profile/settings/notifications/telegram → returns deep link with OTP
```

### Chat Hub

```
GET    /messages/conversations
GET    /messages/conversations/:orderId
POST   /messages/conversations/:orderId/read
GET    /messages/unread-count
GET    /sse/messages                            → SSE stream
```

### Billing + documents

```
POST   /payments                   → idempotency-key required; race-guarded
POST   /companies/:id/reconciliation-acts  → { from, to }
GET    /reports/time | /reports/revenue | /reports/debtors  (+ .csv variants)
```

### Credentials (owner-only)

```
GET    /companies/:id/credentials
POST   /companies/:id/credentials
PUT    /companies/:id/credentials/:credId
POST   /companies/:id/credentials/:credId/reveal   → 10/h rate limit, audit-logged
POST   /companies/:id/credentials/:credId/revoke
DELETE /companies/:id/credentials/:credId
GET    /companies/:id/credentials/:credId/audit
```

### Admin (admin-only)

```
GET/PUT  /admin/templates
GET/PUT  /admin/smtp
GET/PUT  /admin/branding
CRUD     /admin/nomenclature
CRUD     /admin/departments
GET      /admin/crons   + POST /admin/crons/:name/run
GET      /admin/system  → monitoring dashboard data
```

### Schema migrations (S1)

- `20260527_s1_00_multi_company`: drop Company.ownerId, backfill CompanyMember(owner), partial unique index.
- `20260527_s1_03_notification_matrix`: rename estimated→estimating, add reconciliation_act, refactor NotificationSettings, add NotificationPreference/NotificationLog/AuditLog.

### Package: @workflo/notifications

Public API: `notify(deps, input)`, `resolveTargetChannels()`, dispatchers, adapters, templates, config. Full implementation у `packages/notifications/src/`. Tests у `packages/notifications/tests/` (7 suites). Деталі — `modules/07-notifications.md`.
