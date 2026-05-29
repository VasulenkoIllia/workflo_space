# WORKFLO.SPACE — Документація

> Версія: 1.0 | Оновлено: 12 квітня 2026
> **Головний індекс проекту. Всі зміни вносяться спочатку сюди, потім у відповідний модульний документ.**

---

## ПОРЯДОК ЧИТАННЯ ДЛЯ НОВОГО РОЗРОБНИКА

> Читай в цьому порядку — кожен документ будує знання на попередньому.

```
1. docs/README.md               ← цей файл, огляд проекту (5 хв)
2. docs/CONCEPT_v2.md           ← що будуємо і навіщо (15 хв)
3. docs/IMPLEMENTATION_PLAN.md  ← DB schema, API, enums, standards (30 хв)
4. docs/FRONTEND_STANDARDS.md   ← frontend стек, auth flow, компоненти (20 хв)
5. docs/MONOREPO_SCAFFOLD.md    ← файлова структура, .env.example (10 хв)
6. docs/TRACKER.md              ← поточний спринт і твоя задача (5 хв)
7. docs/modules/XX-*.md         ← тільки модуль на який призначено (10 хв)
```

Після цього — запускай локально (`turbo dev`) і стартуй з задачі в поточному спринті.

---

## ШВИДКИЙ СТАРТ

```bash
git clone git@github.com:yourname/workflo.git && cd workflo
pnpm install
cp .env.example .env.local          # заповнити змінні
docker compose -f docker-compose.dev.yml up -d
pnpm --filter db prisma migrate dev
pnpm --filter db prisma db seed
turbo dev
# Landing:   http://localhost:3000
# Portal:    http://localhost:3001
# Workspace: http://localhost:3002
# API:       http://localhost:4000
# Mailpit:   http://localhost:8025
```

---

## СТРУКТУРА ДОКУМЕНТІВ

### Ключові документи

| Документ                                         | Що містить                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [CONCEPT_v2.md](CONCEPT_v2.md)                   | Продуктова концепція, бізнес-логіка, фінансова модель                                                            |
| [INFRASTRUCTURE.md](INFRASTRUCTURE.md)           | Docker, CI/CD, Traefik, backup, rollback, моніторинг                                                             |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | DB schema, API endpoints, API standards, packages/types enums, Turbo, Seed, Migrations                           |
| [FRONTEND_STANDARDS.md](FRONTEND_STANDARDS.md)   | Frontend стек, API client, Auth стан, UI компоненти, тести                                                       |
| [UX_PAGES.md](UX_PAGES.md)                       | Структура сторінок Portal + Workspace, Dashboard, Kanban                                                         |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)             | **Дизайн ↔ код:** токени, інвентар усіх екранів, матриця покриття, workflow-гейт. Дивись СЮДИ перед будь-яким UI |
| [DESIGN_TODO.md](DESIGN_TODO.md)                 | **Список на допрацювання дизайну** (handoff дизайнеру). Що домалювати + цикл звірки                              |
| [design/](../design/)                            | Готовий хендофф з Claude Design (HTML/CSS/JS-прототип) — джерело правди для візуалу                              |
| [MONOREPO_SCAFFOLD.md](MONOREPO_SCAFFOLD.md)     | Точна файлова структура всіх apps і packages + .env.example                                                      |
| [GIT_WORKFLOW.md](GIT_WORKFLOW.md)               | Гілки, commit conventions, PR процес, деплой, hotfix                                                             |
| [CRON_JOBS.md](CRON_JOBS.md)                     | Всі 8 cron задач (Node.js + pg_cron): код, розклад, логіка                                                       |
| [TRACKER.md](TRACKER.md)                         | Трекер прогресу — всі 171 задача по спринтах S0–S8, статуси                                                      |
| [S0_RUNBOOK.md](S0_RUNBOOK.md)                   | Практичний runbook для закриття S0 (GitHub, Hetzner, Traefik, deploy)                                            |
| [README.md](README.md)                           | **Цей файл** — глобальний індекс                                                                                 |

> **CHANGELOG.md** знаходиться в корені репо (`/CHANGELOG.md`) — не в docs/.

### Модульні документи

| #                                  | Модуль             | Стосується              | Статус |
| ---------------------------------- | ------------------ | ----------------------- | ------ |
| [01](modules/01-auth.md)           | Auth               | Portal, Workspace, API  | MVP    |
| [02](modules/02-orders.md)         | Orders             | Portal, Workspace, API  | MVP    |
| [03](modules/03-chat-comments.md)  | Chat & Comments    | Portal, Workspace, API  | MVP    |
| [04](modules/04-files.md)          | Files & Storage    | Portal, Workspace, API  | MVP    |
| [05](modules/05-billing.md)        | Billing & Payments | Portal, Workspace, API  | MVP    |
| [06](modules/06-documents.md)      | Documents (PDF)    | Workspace, Portal, API  | MVP    |
| [07](modules/07-notifications.md)  | Notifications      | API, Bot                | MVP    |
| [08](modules/08-email.md)          | Email Templates    | API, Mailcow            | MVP    |
| [09](modules/09-referral.md)       | Referral System    | Portal, Workspace, API  | MVP    |
| [10](modules/10-loyalty.md)        | Loyalty & Bonuses  | Portal, Workspace, API  | MVP    |
| [11](modules/11-content-blog.md)   | Content & Blog     | Workspace, Landing, API | MVP    |
| [12](modules/12-team-executors.md) | Team & Executors   | Workspace, API          | MVP    |
| [13](modules/13-settings.md)       | Settings           | Portal, Workspace, API  | MVP    |
| [14](modules/14-landing.md)        | Landing Page       | Landing                 | MVP    |
| [15](modules/15-bot.md)            | Telegram Bot       | Bot, API                | MVP    |
| [16](modules/16-search.md)         | Search & Filters   | Portal, Workspace, API  | MVP    |

---

## ТЕХНІЧНИЙ СТЕК (quick reference)

| Компонент     | Рішення                                                 | Версія |
| ------------- | ------------------------------------------------------- | ------ |
| Монорепо      | Turborepo + pnpm workspaces                             | latest |
| Landing       | Next.js (App Router, SSR/ISR)                           | 15     |
| Portal        | React + Vite SPA                                        | 18     |
| Workspace     | React + Vite SPA                                        | 18     |
| API           | Fastify                                                 | 5      |
| Bot           | grammY                                                  | latest |
| DB            | PostgreSQL                                              | 16     |
| ORM           | Prisma                                                  | 5      |
| Auth          | JWT (access in memory) + httpOnly refresh cookie        | —      |
| Styles        | Tailwind CSS (darkMode: class)                          | 4      |
| UI primitives | Radix UI                                                | latest |
| Server state  | TanStack Query v5                                       | 5      |
| UI state      | Zustand                                                 | 4      |
| Routing (SPA) | React Router                                            | 6      |
| Forms         | React Hook Form + Zod                                   | latest |
| Tables        | TanStack Table                                          | 8      |
| Drag & Drop   | dnd-kit                                                 | latest |
| Icons         | lucide-react                                            | latest |
| Toasts        | Sonner                                                  | latest |
| Dates         | date-fns + date-fns-tz                                  | latest |
| i18n          | next-intl (landing) + react-i18next (portal/workspace)  | —      |
| Testing       | Vitest + React Testing Library + MSW + Playwright (E2E) | —      |
| PDF           | @react-pdf/renderer                                     | latest |
| Email         | Nodemailer → Mailcow                                    | —      |
| Storage       | LocalStorageAdapter (MVP) → HetznerAdapter (Phase 2)    | —      |
| Payments      | ManualProvider (MVP) → LiqPay/Stripe (Phase 2)          | —      |
| Cron          | node-cron (Node.js) + pg_cron (PostgreSQL)              | —      |
| Logging       | Pino (Fastify built-in)                                 | —      |
| Errors        | Sentry (backend + frontend)                             | —      |
| Proxy         | Traefik                                                 | 3      |
| Server        | Hetzner                                                 | —      |
| CI/CD         | GitHub Actions → ghcr.io → SSH deploy                   | —      |
| Monitoring    | Sentry + UptimeRobot + Netdata                          | —      |

---

## ДОМЕНИ

| App       | Production                          | Staging                  |
| --------- | ----------------------------------- | ------------------------ |
| Landing   | workflo.space                       | dev.workflo.space        |
| Portal    | portal.workflo.space                | dev-portal.workflo.space |
| Workspace | work.workflo.space _(IP whitelist)_ | dev-work.workflo.space   |
| API       | api.workflo.space                   | dev-api.workflo.space    |
| Mail      | mail.workflo.space                  | —                        |

---

## КЛЮЧОВІ РІШЕННЯ (зафіксовано)

| Рішення           | Вибір                                             | Причина                         |
| ----------------- | ------------------------------------------------- | ------------------------------- |
| Репо              | Monorepo (один приватний GitHub репо)             | Shared packages, один PR flow   |
| API               | Fastify (не Next.js API routes)                   | 3 frontend apps + SSE streaming |
| Auth              | Access token in memory + httpOnly refresh cookie  | XSS-safe                        |
| DB migrations     | Тільки additive в MVP                             | Zero-downtime                   |
| File storage      | Docker Volume → Hetzner Object Storage (Phase 2)  | StorageAdapter pattern          |
| Payments          | Manual → LiqPay/Stripe (Phase 2)                  | PaymentProvider pattern         |
| Реферали          | Depth = 1 (прямі тільки)                          | Не MLM, юридично чисто          |
| Валюта            | USD base + UAH через НБУ API                      | Офіційний курс                  |
| Timezone          | UTC в БД, Kyiv у workspace, browser у portal      | —                               |
| Blog content      | Markdown (AI генерує)                             | Простіше ніж TipTap JSON        |
| Версіонування     | SemVer без `/v1/` prefix в MVP                    | Не потрібно до breaking change  |
| Bot mode          | `BOT_MODE=polling` (dev) / `webhook` (prod)       | ENV switch                      |
| Теми              | Light / Dark / System, Tailwind `darkMode: class` | CSS variables                   |
| Мови              | UA + EN скрізь, `next-intl` / `react-i18next`     | —                               |
| OTP               | Таблиця `otp_tokens` (purpose + channel)          | Розширюваність                  |
| Нотифікації       | Email + Telegram (MVP), SMS (Phase 3)             | Channel adapter pattern         |
| Invoice нумерація | Скидається 1 січня (INV-2026-0001)                | Стандарт бухгалтерії            |
| Referral code     | `workflo-XXXXXX` (6 символів)                     | Читабельно                      |

---

## SHARED PACKAGES

```
packages/
├── ui/            React компоненти (Button, Input, Badge...) + ThemeProvider
├── types/         TypeScript enums, DTOs, constants (статуси, loyalty, referral %)
├── db/            Prisma client singleton + всі типи
├── notifications/ Email + Telegram adapters + unified notify()
├── i18n/          Переклади uk/en + react-i18next ініціалізація
├── storage/       StorageAdapter interface + Local + Hetzner adapters
├── payments/      PaymentProvider interface + Manual + LiqPay/Stripe (Phase 2)
└── templates/     PDF шаблони (@react-pdf/renderer)
```

---

## АКТОРИ

| Актор              | Де        | Права                                  |
| ------------------ | --------- | -------------------------------------- |
| **Owner**          | Workspace | Повний доступ до всього                |
| **Executor**       | Workspace | Свої задачі + time tracking            |
| **Company Owner**  | Portal    | Всі задачі компанії + білінг + команда |
| **Company Member** | Portal    | Налаштовується company owner           |
| **Guest**          | Landing   | Читання                                |

---

## ПРАВИЛА РОБОТИ З ДОКУМЕНТАЦІЄЮ

1. **Зміна в продукті** → спочатку оновити відповідний module doc → потім CONCEPT_v2.md якщо змінюється бізнес-логіка → потім IMPLEMENTATION_PLAN.md якщо змінюється DB/API → потім TRACKER.md
2. **Новий модуль** → створити `docs/modules/XX-name.md` → додати в цей README.md в таблицю
3. **Зміна DB schema** → оновити `IMPLEMENTATION_PLAN.md` → написати міграцію `packages/db/prisma/migrations/`
4. **Зміна API endpoint** → оновити `modules/XX-name.md` → оновити `IMPLEMENTATION_PLAN.md` якщо змінюється загальний список
5. **Завершена задача** → оновити `TRACKER.md` статус
6. **Ніколи не вносити зміни хаотично** — завжди через відповідний документ

---

## ФАЗИ ПРОЕКТУ

| Фаза              | Зміст                                                                      | Ціль                   |
| ----------------- | -------------------------------------------------------------------------- | ---------------------- |
| **MVP (Phase 1)** | Всі модулі з позначкою MVP                                                 | Перший реальний клієнт |
| **Phase 2**       | Stripe/LiqPay, 2FA, Object Storage, Invoice PDF advanced, кастомні статуси | Масштабування          |
| **Phase 3**       | SMS нотифікації, мобільний застосунок, Bot команди, VIP tier               | Зростання              |

---

## КОНТАКТИ ПРОЕКТУ

```
GitHub:     github.com/yourname/workflo (public for GitHub Free, or private with Pro/Team)
Server:     Hetzner (IP: xxx.xxx.xxx.xxx)
Registry:   ghcr.io/yourname/workflo-*
Mail:       hello@workflo.space
Deploy:     Telegram → @workflo_deploy_bot
```
