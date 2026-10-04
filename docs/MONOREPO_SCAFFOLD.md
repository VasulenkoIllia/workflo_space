# MONOREPO SCAFFOLD

> Точна файлова структура проекту. Що де лежить і чому.
> Версія: 1.0 | Оновлено: 12 квітня 2026

---

## ЗМІСТ

1. [Корінь репозиторію](#1-корінь-репозиторію)
2. [apps/api](#2-appsapi--fastify)
3. [apps/portal](#3-appsportal--react-vite)
4. [apps/workspace](#4-appsworkspace--react-vite)
5. [apps/landing](#5-appslanding--nextjs-15)
6. [apps/bot](#6-appsbot--grammy)
7. [packages/](#7-packages)
8. [.github/](#8-github)
9. [.env.example](#9-envexample)

---

## 1. КОРІНЬ РЕПОЗИТОРІЮ

```
workflo/                          ← корінь монорепо
│
├── .github/
│   ├── workflows/
│   │   ├── staging.yml           ← CI/CD: push dev → staging автодеплой
│   │   └── production.yml        ← CI/CD: manual approve → production
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
│
├── apps/
│   ├── api/                      ← Fastify API (port 4000)
│   ├── portal/                   ← React Vite SPA клієнти (port 3001)
│   ├── workspace/                ← React Vite SPA команда (port 3002)
│   ├── landing/                  ← Next.js 15 SSR/ISR (port 3000)
│   └── bot/                      ← grammY Telegram bot
│
├── packages/
│   ├── ui/                       ← React компоненти + ThemeProvider
│   ├── types/                    ← TypeScript enums, DTOs, Zod schemas, utils
│   ├── db/                       ← Prisma client singleton + schema + seed
│   ├── notifications/            ← Email + Telegram adapters + notify()
│   ├── i18n/                     ← uk/en переклади + react-i18next init
│   ├── storage/                  ← StorageAdapter (Local + Hetzner)
│   ├── payments/                 ← PaymentProvider (Manual + LiqPay Phase 2)
│   └── templates/                ← PDF шаблони (HTML→Puppeteer + DocToolkit)
│
├── scripts/
│   ├── backup.sh                 ← pg_dump + архів uploads → Hetzner Volume
│   ├── rollback.sh               ← відкат до попереднього Docker image
│   └── healthcheck.sh            ← перевірка всіх сервісів після деплою
│
├── docker/
│   ├── docker-compose.dev.yml    ← postgres + mailpit (тільки)
│   ├── docker-compose.staging.yml
│   └── docker-compose.prod.yml
│
├── .env.example                  ← шаблон змінних (БЕЗ секретів)
├── .gitignore
├── .eslintrc.js                  ← root ESLint config
├── .prettierrc                   ← Prettier config
├── tsconfig.base.json            ← базовий TypeScript config
├── turbo.json                    ← Turborepo pipeline
├── pnpm-workspace.yaml
└── package.json                  ← root package.json (devDeps, scripts)
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `package.json` (root)

```json
{
  "name": "workflo",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "clean": "turbo clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "prepare": "husky"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.4.0",
    "prettier": "^3.2.0",
    "eslint": "^9.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "@types/node": "^20.0.0"
  },
  "lint-staged": {
    "**/*.{ts,tsx}": ["eslint --fix --max-warnings=0", "prettier --write"],
    "**/*.{json,md,yaml,yml}": ["prettier --write"],
    "packages/db/prisma/schema.prisma": ["npx prisma format"]
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

### `.gitignore`

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/
.turbo/

# Environment
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Test
coverage/
playwright-report/
test-results/

# Prisma
packages/db/prisma/migrations/*.sql.bak

# Docker
docker/volumes/

# Uploads (local dev)
uploads/
```

### `.eslintrc.js` (root)

```javascript
module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended-type-checked'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['dist/', 'build/', '.next/', '*.js', '*.mjs'],
}
```

### `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

---

## 2. APPS/API — Fastify

```
apps/api/
├── src/
│   ├── index.ts                  ← entry: start server + graceful shutdown
│   ├── app.ts                    ← Fastify instance + register plugins + routes
│   │
│   ├── plugins/                  ← Fastify plugins (реєструються в app.ts)
│   │   ├── auth.ts               ← JWT verify → req.user
│   │   ├── cors.ts               ← @fastify/cors config
│   │   ├── multipart.ts          ← @fastify/multipart config
│   │   ├── rateLimiting.ts       ← @fastify/rate-limit global + per-route
│   │   ├── errorHandler.ts       ← global error handler + 404
│   │   └── swagger.ts            ← @fastify/swagger (розкомент. якщо потрібно)
│   │
│   ├── routes/                   ← кожен модуль = папка
│   │   ├── auth/
│   │   │   ├── index.ts          ← реєструє sub-routes
│   │   │   ├── register.ts
│   │   │   ├── login.ts
│   │   │   ├── logout.ts
│   │   │   ├── refresh.ts
│   │   │   ├── forgotPassword.ts
│   │   │   └── resetPassword.ts
│   │   ├── orders/
│   │   │   ├── index.ts
│   │   │   ├── list.ts
│   │   │   ├── create.ts
│   │   │   ├── getById.ts
│   │   │   ├── update.ts
│   │   │   ├── updateStatus.ts
│   │   │   ├── delete.ts
│   │   │   └── executors.ts
│   │   ├── comments/             ← + SSE stream
│   │   ├── files/
│   │   ├── billing/
│   │   ├── documents/
│   │   ├── notifications/        ← + SSE stream
│   │   ├── blog/
│   │   ├── team/
│   │   ├── settings/
│   │   ├── companies/
│   │   ├── search/
│   │   ├── referral/
│   │   ├── loyalty/
│   │   ├── exchange-rate/
│   │   └── health.ts             ← GET /health
│   │
│   ├── services/                 ← бізнес-логіка, відокремлена від роутів
│   │   ├── auth.service.ts
│   │   ├── orders.service.ts
│   │   ├── billing.service.ts
│   │   ├── loyalty.service.ts
│   │   ├── referral.service.ts
│   │   └── exchangeRate.service.ts
│   │
│   ├── middleware/
│   │   ├── requireAuth.ts        ← preHandler: перевіряє req.user
│   │   ├── requireRole.ts        ← preHandler: requireRole('owner')
│   │   └── requireCompanyAccess.ts ← перевіряє доступ клієнта до ресурсу
│   │
│   ├── cron/
│   │   ├── exchangeRate.ts       ← щодня 09:10 Kyiv → НБУ API
│   │   ├── subscriptions.ts      ← 1-го числа → recurring charges
│   │   ├── dueDateReminder.ts    ← щодня 09:00 Kyiv → dueDate alerts
│   │   └── cleanupFiles.ts       ← щодня → видалення deletedAt > 7 днів
│   │
│   └── utils/
│       ├── buildOrdersWhere.ts   ← query builder для фільтрів
│       ├── search.ts             ← buildSearchQuery helper
│       ├── pagination.ts         ← buildPaginationMeta helper
│       └── mapStatus.ts          ← internal → client status mapping
│
├── Dockerfile
├── package.json
└── tsconfig.json
```

### `apps/api/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `apps/api/package.json`

```json
{
  "name": "@workflo/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/cookie": "^10.0.0",
    "@fastify/multipart": "^9.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@fastify/jwt": "^9.0.0",
    "@sentry/node": "^8.0.0",
    "bcryptjs": "^2.4.3",
    "@workflo/db": "workspace:*",
    "@workflo/types": "workspace:*",
    "@workflo/notifications": "workspace:*",
    "@workflo/storage": "workspace:*",
    "@workflo/payments": "workspace:*",
    "@workflo/templates": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "@types/bcryptjs": "^2.4.6",
    "vitest": "^1.0.0"
  }
}
```

---

## 3. APPS/PORTAL — React Vite

```
apps/portal/
├── src/
│   ├── main.tsx                  ← ReactDOM.createRoot + Providers
│   ├── App.tsx                   ← Router + global Providers
│   ├── router.tsx                ← React Router routes definition
│   │
│   ├── lib/
│   │   ├── api.ts                ← fetch wrapper + auth interceptor
│   │   ├── queryClient.ts        ← TanStack Query client config
│   │   └── cn.ts                 ← clsx + tailwind-merge utility
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx       ← useAuth hook + AuthProvider
│   │   └── NotificationsContext.tsx ← SSE + bell state
│   │
│   ├── stores/
│   │   └── uiStore.ts            ← Zustand: sidebar, modals
│   │
│   ├── hooks/                    ← React Query hooks (data fetching)
│   │   ├── useOrders.ts          ← useOrders(), useOrder(id), useCreateOrder()
│   │   ├── useBilling.ts
│   │   ├── useDocuments.ts
│   │   ├── useComments.ts
│   │   └── useSettings.ts
│   │
│   ├── pages/                    ← Сторінки (відповідають router.tsx)
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── ForgotPasswordPage.tsx
│   │   │   ├── ResetPasswordPage.tsx
│   │   │   └── InvitePage.tsx
│   │   ├── orders/
│   │   │   ├── OrdersPage.tsx    ← список з фільтрами
│   │   │   └── OrderDetailPage.tsx ← деталі + чат + файли
│   │   ├── billing/
│   │   │   └── BillingPage.tsx
│   │   ├── documents/
│   │   │   └── DocumentsPage.tsx
│   │   └── settings/
│   │       ├── SettingsLayout.tsx
│   │       ├── ProfilePage.tsx
│   │       ├── CompanyPage.tsx
│   │       ├── MembersPage.tsx
│   │       ├── SecurityPage.tsx
│   │       └── NotificationsPage.tsx
│   │
│   ├── components/               ← Компоненти специфічні для portal
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx     ← sidebar + topbar wrapper
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── orders/
│   │   │   ├── OrderCard.tsx
│   │   │   ├── OrdersList.tsx
│   │   │   ├── OrderFilters.tsx
│   │   │   ├── CreateOrderModal.tsx
│   │   │   └── OrderChat.tsx
│   │   ├── billing/
│   │   │   ├── InvoiceCard.tsx
│   │   │   └── PaymentsList.tsx
│   │   ├── onboarding/
│   │   │   ├── WelcomeBanner.tsx
│   │   │   └── OnboardingChecklist.tsx
│   │   └── shared/
│   │       ├── ProtectedRoute.tsx
│   │       └── PageSkeleton.tsx
│   │
│   ├── i18n.ts                   ← react-i18next init
│   └── vite-env.d.ts
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── nginx.conf                    ← для Docker production
├── Dockerfile
├── package.json
└── tsconfig.json
```

### `apps/portal/src/main.tsx`

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@workflo/ui'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { App } from './App'
import './i18n'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <NotificationsProvider>
              <App />
              <Toaster position="top-right" richColors closeButton />
            </NotificationsProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
```

### `apps/portal/src/router.tsx`

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/shared/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
// ... imports

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />

      {/* Protected */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/orders" replace />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route path="profile" element={<ProfilePage />} />
            <Route path="company" element={<CompanyPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
```

---

## 4. APPS/WORKSPACE — React Vite

> Структура ідентична до portal — ті самі підходи, інші сторінки.

```
apps/workspace/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── lib/                      ← api.ts, queryClient.ts (копія portal)
│   ├── contexts/                 ← AuthContext, NotificationsContext
│   ├── stores/
│   │   ├── uiStore.ts
│   │   └── kanbanStore.ts        ← стан Kanban (drag & drop)
│   ├── hooks/
│   │   ├── useOrders.ts          ← розширений (internal view)
│   │   ├── useCompanies.ts
│   │   ├── useTeam.ts
│   │   ├── useBilling.ts
│   │   └── useBlog.ts
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── InvitePage.tsx    ← для executor invite
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx ← Kanban + stats + action items
│   │   ├── orders/
│   │   │   ├── OrdersPage.tsx    ← table view (всі замовлення)
│   │   │   └── OrderDetailPage.tsx ← internal view (3 колонки)
│   │   ├── companies/
│   │   │   ├── CompaniesPage.tsx
│   │   │   └── CompanyDetailPage.tsx
│   │   ├── billing/
│   │   │   ├── BillingPage.tsx
│   │   │   └── ServicesPage.tsx  ← recurring services
│   │   ├── team/
│   │   │   └── TeamPage.tsx
│   │   ├── blog/
│   │   │   ├── BlogPage.tsx
│   │   │   └── BlogPostPage.tsx  ← editor + AI
│   │   └── settings/
│   │       ├── SettingsLayout.tsx
│   │       ├── ProfilePage.tsx
│   │       ├── SystemPage.tsx    ← owner only: курс, налаштування
│   │       ├── TeamSettingsPage.tsx
│   │       ├── SecurityPage.tsx
│   │       └── ActivityPage.tsx  ← лог активності
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── kanban/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   └── KanbanCard.tsx
│   │   ├── orders/
│   │   │   ├── OrdersTable.tsx
│   │   │   ├── OrderFilters.tsx
│   │   │   ├── OrderChat.tsx     ← з вкладкою Internal notes
│   │   │   ├── StatusChangeDropdown.tsx
│   │   │   ├── ExecutorAssign.tsx
│   │   │   └── TimeLogForm.tsx
│   │   ├── companies/
│   │   │   └── CompanyCard.tsx
│   │   └── shared/
│   │       ├── ProtectedRoute.tsx
│   │       └── OwnerOnlyRoute.tsx ← redirect executor якщо owner-only сторінка
│   │
│   └── vite-env.d.ts
│
├── index.html
├── vite.config.ts                ← port: 3002
├── tailwind.config.ts
├── nginx.conf
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 5. APPS/LANDING — Next.js 15

```
apps/landing/
├── src/
│   └── app/
│       ├── [locale]/             ← next-intl (uk + en)
│       │   ├── layout.tsx        ← root layout з font, theme script, metadata
│       │   ├── page.tsx          ← Головна: Hero, Features, How It Works, Pricing, Blog, CTA
│       │   ├── blog/
│       │   │   ├── page.tsx      ← ISR список постів
│       │   │   └── [slug]/
│       │   │       └── page.tsx  ← ISR стаття
│       │   ├── pricing/
│       │   │   └── page.tsx      ← ISR тарифи
│       │   ├── terms/
│       │   │   └── page.tsx      ← ToS (статична)
│       │   └── privacy/
│       │       └── page.tsx      ← Privacy Policy (статична)
│       └── api/
│           └── revalidate/
│               └── route.ts      ← POST → on-demand ISR
│
├── src/
│   ├── components/
│   │   ├── sections/             ← Hero, Features, Pricing, Testimonials, CTA
│   │   ├── blog/                 ← BlogCard, BlogContent (react-markdown)
│   │   └── shared/
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── LanguageSwitcher.tsx
│   └── lib/
│       └── api.ts                ← server-side fetch helpers
│
├── public/
│   ├── favicon.ico
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── og-image.png              ← 1200×630 OG image
│   └── robots.txt
│
├── messages/                     ← next-intl переклади
│   ├── uk.json
│   └── en.json
│
├── middleware.ts                 ← next-intl routing
├── next.config.ts
├── tailwind.config.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 6. APPS/BOT — grammY

```
apps/bot/
├── src/
│   ├── index.ts                  ← init bot + polling/webhook mode
│   ├── bot.ts                    ← Bot instance + register commands
│   └── commands/
│       ├── start.ts              ← /start [OTP] — прив'язка акаунту
│       ├── status.ts             ← /status — перевірка прив'язки
│       ├── unlink.ts             ← /unlink — відключити Telegram
│       └── help.ts               ← /help — список команд
│
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 7. PACKAGES/

### packages/types

```
packages/types/
├── src/
│   ├── enums.ts                  ← OrderStatus, Priority, Role, etc.
│   ├── constants.ts              ← INTERNAL_TO_CLIENT_STATUS, ALLOWED_TRANSITIONS, тарифи
│   ├── errors.ts                 ← AppError клас + ApiErrorCode enum
│   ├── dto.ts                    ← TypeScript interfaces (ProfileDto, OrderDto, etc.)
│   ├── schemas/                  ← Zod schemas (шеряться між API і frontend)
│   │   ├── auth.schema.ts
│   │   ├── order.schema.ts
│   │   ├── billing.schema.ts
│   │   ├── blog.schema.ts
│   │   └── settings.schema.ts
│   └── utils/
│       └── dates.ts              ← formatKyiv, formatLocal, formatSmart
├── package.json
└── tsconfig.json
```

### packages/db

```
packages/db/
├── prisma/
│   ├── schema.prisma             ← фінальна схема
│   ├── seed.ts                   ← seed скрипт
│   └── migrations/               ← генерується prisma migrate dev
│       └── .gitkeep
├── src/
│   └── index.ts                  ← PrismaClient singleton + реекспорт типів
├── package.json
└── tsconfig.json
```

### packages/ui

```
packages/ui/
├── src/
│   ├── components/               ← всі компоненти (детально в FRONTEND_STANDARDS.md)
│   ├── providers/
│   │   └── ThemeProvider.tsx
│   ├── hooks/
│   │   ├── useTheme.ts
│   │   ├── useMediaQuery.ts
│   │   └── useDebounce.ts
│   ├── lib/
│   │   └── cn.ts                 ← clsx + tailwind-merge
│   └── index.ts                  ← реекспорт всього
├── package.json
└── tsconfig.json
```

### packages/notifications

```
packages/notifications/
├── src/
│   ├── notify.ts                 ← головна функція notify()
│   ├── adapters/
│   │   ├── EmailAdapter.ts
│   │   └── TelegramAdapter.ts
│   ├── email/
│   │   ├── mailer.ts             ← Nodemailer transporter
│   │   ├── renderTemplate.ts     ← HTML шаблон рендеринг
│   │   └── templates/            ← HTML файли (uk/en для кожного)
│   └── telegram/
│       └── messages.ts           ← шаблони Telegram повідомлень
├── package.json
└── tsconfig.json
```

### packages/storage

```
packages/storage/
├── src/
│   ├── StorageAdapter.ts         ← interface
│   ├── LocalStorageAdapter.ts    ← MVP implementation
│   └── HetznerStorageAdapter.ts  ← Phase 2 (stub в MVP)
├── package.json
└── tsconfig.json
```

### packages/payments

```
packages/payments/
├── src/
│   ├── PaymentProvider.ts        ← interface
│   └── ManualProvider.ts         ← MVP: ручне підтвердження
├── package.json
└── tsconfig.json
```

### packages/templates

```
packages/templates/
├── src/
│   ├── invoice/
│   │   ├── InvoiceTemplate.tsx   ← React → HTML → Puppeteer → PDF
│   │   └── types.ts
│   ├── completion-act/
│   ├── specification/
│   ├── contract/
│   ├── payslip/
│   ├── i18n/
│   │   ├── uk.ts                 ← переклади для PDF
│   │   └── en.ts
│   └── index.ts                  ← export generatePdf(type, data)
├── package.json
└── tsconfig.json
```

### packages/i18n

```
packages/i18n/
├── src/
│   ├── uk/
│   │   ├── common.json           ← загальні тексти
│   │   ├── orders.json
│   │   ├── billing.json
│   │   ├── errors.json           ← ApiErrorCode → user message
│   │   └── landing.json
│   ├── en/
│   │   └── ...                   ← дзеркало uk/
│   └── index.ts                  ← react-i18next init для portal/workspace
├── package.json
└── tsconfig.json
```

---

## 8. .GITHUB/

### `PULL_REQUEST_TEMPLATE.md`

```markdown
## Що зроблено

<!-- Короткий опис змін (1-3 речення) -->

## Тип змін

- [ ] `feat` — нова функція
- [ ] `fix` — виправлення бага
- [ ] `chore` — рефакторинг / налаштування / залежності
- [ ] `docs` — тільки документація

## Задача

<!-- ID задачі з TRACKER.md: S1-04 -->

Задача: **S\_-\_\_**

## Checklist

- [ ] `turbo lint` — без помилок
- [ ] `turbo type-check` — без помилок
- [ ] Тести написані / оновлені (якщо потрібно)
- [ ] Self-review пройдено
- [ ] Документація оновлена (якщо змінилась бізнес-логіка або API)

## Скріншоти

<!-- Якщо є UI зміни — до/після -->
```

### `CODEOWNERS`

```
# .github/CODEOWNERS
# Owner review обов'язковий для критичних файлів

# DB schema — тільки owner може approve
packages/db/prisma/schema.prisma    @owner-github-username
packages/db/prisma/migrations/      @owner-github-username

# Infrastructure — тільки owner
docker/                             @owner-github-username
.github/workflows/                  @owner-github-username
scripts/                            @owner-github-username

# Решта — будь-хто з команди може review
*                                   @owner-github-username
```

---

## 9. .ENV.EXAMPLE

```bash
# ===========================================
# WORKFLO.SPACE — Environment Variables
# Скопіюй у .env.local та заповни значення
# ===========================================

# ─── DATABASE ──────────────────────────────
DATABASE_URL="postgresql://workflo:password@localhost:5432/workflo"
DATABASE_URL_TEST="postgresql://workflo:password@localhost:5432/workflo_test"

# ─── AUTH ──────────────────────────────────
JWT_SECRET="change-this-to-a-random-64-char-string"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="30d"

# ─── API ───────────────────────────────────
API_PORT=4000
API_HOST="0.0.0.0"
NODE_ENV="development"
LOG_LEVEL="debug"

# ─── CORS (через кому) ─────────────────────
ALLOWED_ORIGINS="http://localhost:3001,http://localhost:3002"

# ─── SEED ──────────────────────────────────
SEED_OWNER_EMAIL="owner@workflo.space"
SEED_OWNER_PASSWORD="Admin123!"

# ─── SMTP (Mailcow) ────────────────────────
SMTP_HOST="mailpit"
SMTP_PORT=1025
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@workflo.space"

# ─── TELEGRAM BOT ──────────────────────────
BOT_TOKEN="your-bot-token-from-botfather"
BOT_MODE="polling"
BOT_WEBHOOK_URL=""
BOT_WEBHOOK_SECRET=""

# ─── STORAGE ───────────────────────────────
STORAGE_TYPE="local"
UPLOAD_DIR="/data/uploads"

# Hetzner Object Storage (Phase 2, залиш пустим в MVP)
HETZNER_ACCESS_KEY=""
HETZNER_SECRET_KEY=""
HETZNER_BUCKET=""
HETZNER_ENDPOINT=""
HETZNER_REGION=""

# ─── OPENAI ────────────────────────────────
OPENAI_API_KEY=""

# ─── FRONTEND URLS (для API → frontend links в email/bot) ─
PORTAL_URL="http://localhost:3001"
WORKSPACE_URL="http://localhost:3002"
LANDING_URL="http://localhost:3000"

# ─── NEXT.JS LANDING ───────────────────────
NEXT_REVALIDATION_SECRET="change-this-random-string"
NEXT_PUBLIC_API_URL="http://localhost:4000"

# ─── VITE APPS (Portal + Workspace) ────────
VITE_API_URL="http://localhost:4000"

# ─── SENTRY ────────────────────────────────
SENTRY_DSN=""
SENTRY_DSN_LANDING=""
SENTRY_DSN_PORTAL=""
SENTRY_DSN_WORKSPACE=""

# ─── MONITORING ────────────────────────────
TELEGRAM_DEPLOY_CHAT_ID=""
TELEGRAM_DEPLOY_BOT_TOKEN=""

# ─── PAYMENT SETTINGS ──────────────────────
# Реквізити для ручної оплати (зберігаються в БД через /settings/system)
# Не потрібні в ENV — вносяться через workspace UI
```
