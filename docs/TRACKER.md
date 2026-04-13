# WORKFLO.SPACE — Tracker

> Оновлено: 14 квітня 2026 (S0 closed + audit hardening package applied)
> Статуси: ⬜ pending | 🔄 in progress | ✅ done | 🧪 tested | 🚀 deployed | ❌ blocked

---

## SPRINT 0 — Foundation (Тиждень 1)

> Ціль: CI зелений, БД на staging, dev environment у всіх 5 людей
> 30 задач
> Додатково після закриття S0: non-root Docker runtime, compose resource/log limits, TIMESTAMPTZ migration, cleanup дублюючих індексів, `@fastify/helmet` інтеграція.

| ID    | Задача                                                                                         | Модуль  | Хто | Статус | Тест | Deploy |
| ----- | ---------------------------------------------------------------------------------------------- | ------- | --- | ------ | ---- | ------ |
| S0-01 | pnpm workspace + turbo.json                                                                    | Infra   | —   | ✅     | —    | —      |
| S0-02 | tsconfig.base.json + eslint-config                                                             | Infra   | —   | ✅     | —    | —      |
| S0-03 | packages/types — enums, DTOs, constants                                                        | [types] | —   | ✅     | —    | —      |
| S0-04 | packages/db — schema.prisma фінальна                                                           | [db]    | —   | ✅     | —    | —      |
| S0-05 | Перша міграція (prisma migrate dev)                                                            | [db]    | —   | ✅     | —    | —      |
| S0-06 | packages/db seed.ts                                                                            | [db]    | —   | ✅     | —    | —      |
| S0-07 | docker-compose.dev.yml (postgres + mailpit)                                                    | Infra   | —   | ✅     | —    | —      |
| S0-08 | .env.example повний                                                                            | Infra   | —   | ✅     | —    | —      |
| S0-09 | GitHub repo + branch protection rules                                                          | Infra   | —   | ✅     | —    | —      |
| S0-10 | GitHub Secrets заповнені                                                                       | Infra   | —   | ✅     | —    | —      |
| S0-11 | GitHub Environment "production" + reviewer                                                     | Infra   | —   | ✅     | —    | —      |
| S0-12 | Hetzner сервер — PostgreSQL 16 (dockerized) + pg_cron enablement в CI deploy                   | Infra   | —   | ✅     | —    | —      |
| S0-13 | Hetzner — deploy user + SSH key                                                                | Infra   | —   | ✅     | —    | —      |
| S0-14 | Hetzner — UFW firewall rules                                                                   | Infra   | —   | ✅     | —    | —      |
| S0-15 | Traefik launch + traefik_network                                                               | Infra   | —   | ✅     | —    | —      |
| S0-16 | DNS records (всі домени → Hetzner IP)                                                          | Infra   | —   | ✅     | —    | —      |
| S0-17 | Mail baseline для S0: DNS `mail.*` + SMTP env readiness (Mailcow rollout відкладено до S1 Ops) | Infra   | —   | ✅     | —    | —      |
| S0-18 | staging.yml GitHub Actions                                                                     | Infra   | —   | ✅     | —    | —      |
| S0-19 | production.yml GitHub Actions                                                                  | Infra   | —   | ✅     | —    | —      |
| S0-20 | Skeleton apps — Dockerfiles для всіх 5                                                         | Infra   | —   | ✅     | —    | —      |
| S0-21 | GET /health endpoint (всі сервіси)                                                             | [Infra] | —   | ✅     | ✅   | —      |
| S0-22 | Fastify plugins: CORS, rate-limit, error handler, Pino                                         | [Infra] | —   | ✅     | —    | —      |
| S0-23 | AppError клас + ApiErrorCode enum в packages/types                                             | [types] | —   | ✅     | —    | —      |
| S0-24 | Zod схеми для базових DTO в packages/types                                                     | [types] | —   | ✅     | —    | —      |
| S0-25 | Husky + lint-staged налаштування                                                               | [Infra] | —   | ✅     | —    | —      |
| S0-26 | .env.example — повний файл в репо                                                              | [Infra] | —   | ✅     | —    | —      |
| S0-27 | CODEOWNERS + PR template в .github/                                                            | [Infra] | —   | ✅     | —    | —      |
| S0-28 | Branch protection rules (main + dev)                                                           | [Infra] | —   | ✅     | —    | —      |
| S0-29 | turbo build без помилок (CI green)                                                             | Infra   | —   | ✅     | —    | —      |
| S0-30 | Перший деплой на staging                                                                       | Infra   | —   | ✅     | ✅   | 🚀     |

---

## SPRINT 1 — Auth + Core API (Тиждень 2-3)

> Ціль: реєстрація, логін, JWT, invite flow

| ID    | Задача                                    | Модуль             | Хто | Статус | Тест | Deploy |
| ----- | ----------------------------------------- | ------------------ | --- | ------ | ---- | ------ |
| S1-01 | packages/notifications — email functions  | [07-notifications] | —   | ⬜     | —    | —      |
| S1-02 | packages/notifications — telegram adapter | [07-notifications] | —   | ⬜     | —    | —      |
| S1-03 | packages/notifications — notify() unified | [07-notifications] | —   | ⬜     | —    | —      |
| S1-04 | POST /auth/register (profile + company)   | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-05 | POST /auth/login                          | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-06 | POST /auth/logout                         | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-07 | POST /auth/refresh (token rotation)       | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-08 | POST /auth/forgot-password                | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-09 | POST /auth/reset-password                 | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-10 | GET /auth/me                              | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-11 | JWT middleware + role guard               | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-12 | Rate limiting /auth/\* (10 req/15min)     | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-13 | PATCH /profile, /profile/password         | [13-settings]      | —   | ⬜     | ⬜   | —      |
| S1-14 | PATCH /profile/notifications              | [13-settings]      | —   | ⬜     | —    | —      |
| S1-15 | POST /workspace/team/invite (executor)    | [12-team]          | —   | ⬜     | ⬜   | —      |
| S1-16 | GET /invite/:token + прийняти запрошення  | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-17 | POST /company/members/invite              | [01-auth]          | —   | ⬜     | ⬜   | —      |
| S1-18 | Welcome email при реєстрації              | [08-email]         | —   | ⬜     | ⬜   | —      |
| S1-19 | Invite email (executor + company member)  | [08-email]         | —   | ⬜     | ⬜   | —      |
| S1-20 | Reset password email                      | [08-email]         | —   | ⬜     | ⬜   | —      |
| S1-21 | packages/i18n — uk/en локалі базові       | [13-settings]      | —   | ⬜     | —    | —      |
| S1-22 | Deploy Sprint 1 → staging                 | Infra              | —   | ⬜     | —    | 🚀     |

---

## SPRINT 2 — Orders API (Тиждень 3-4)

> Ціль: повний CRUD замовлень, коментарі SSE, файли

| ID    | Задача                                         | Модуль             | Хто | Статус | Тест | Deploy |
| ----- | ---------------------------------------------- | ------------------ | --- | ------ | ---- | ------ |
| S2-01 | GET /orders, POST /orders                      | [02-orders]        | —   | ⬜     | ⬜   | —      |
| S2-02 | GET /orders/:id                                | [02-orders]        | —   | ⬜     | ⬜   | —      |
| S2-03 | POST /orders/:id/approve                       | [02-orders]        | —   | ⬜     | ⬜   | —      |
| S2-04 | POST /orders/:id/accept                        | [02-orders]        | —   | ⬜     | ⬜   | —      |
| S2-05 | GET/POST /orders/:id/comments                  | [03-chat]          | —   | ⬜     | ⬜   | —      |
| S2-06 | GET /orders/:id/comments/stream (SSE)          | [03-chat]          | —   | ⬜     | ⬜   | —      |
| S2-07 | packages/storage — LocalStorageAdapter         | [04-files]         | —   | ⬜     | ⬜   | —      |
| S2-08 | POST /orders/:id/files (multipart)             | [04-files]         | —   | ⬜     | ⬜   | —      |
| S2-09 | GET /orders/:id/files                          | [04-files]         | —   | ⬜     | ⬜   | —      |
| S2-10 | GET /files/serve/:key (authenticated download) | [04-files]         | —   | ⬜     | ⬜   | —      |
| S2-11 | DELETE /orders/:id/files/:fileId               | [04-files]         | —   | ⬜     | ⬜   | —      |
| S2-12 | GET/POST/PATCH/DELETE /workspace/orders        | [02-orders]        | —   | ⬜     | ⬜   | —      |
| S2-13 | PATCH /workspace/orders/:id/status             | [02-orders]        | —   | ⬜     | ⬜   | —      |
| S2-14 | Internal status → client status mapping        | [02-orders]        | —   | ⬜     | ⬜   | —      |
| S2-15 | CRUD internal tasks                            | [02-orders]        | —   | ⬜     | ⬜   | —      |
| S2-16 | CRUD time logs                                 | [12-team]          | —   | ⬜     | ⬜   | —      |
| S2-17 | Activity log — запис при кожній дії            | [03-chat]          | —   | ⬜     | —    | —      |
| S2-18 | Notification при зміні статусу                 | [07-notifications] | —   | ⬜     | ⬜   | —      |
| S2-19 | Deploy Sprint 2 → staging                      | Infra              | —   | ⬜     | —    | 🚀     |

---

## SPRINT 3 — Portal Frontend (Тиждень 4-5)

> Ціль: клієнт може зареєструватися, бачити задачі, спілкуватися

| ID    | Задача                                        | Модуль        | Хто | Статус | Тест | Deploy |
| ----- | --------------------------------------------- | ------------- | --- | ------ | ---- | ------ |
| S3-01 | packages/ui — Button, Input, Badge, Modal     | [UI]          | —   | ⬜     | —    | —      |
| S3-02 | packages/ui — Table, Spinner, Avatar          | [UI]          | —   | ⬜     | —    | —      |
| S3-03 | packages/ui — AuthLayout, DashboardLayout     | [UI]          | —   | ⬜     | —    | —      |
| S3-04 | packages/ui — ThemeProvider (light/dark)      | [13-settings] | —   | ⬜     | —    | —      |
| S3-05 | Portal — Auth context (token in memory)       | [01-auth]     | —   | ⬜     | —    | —      |
| S3-06 | Portal — /login, /register                    | [01-auth]     | —   | ⬜     | —    | —      |
| S3-07 | Portal — /forgot-password, /reset-password    | [01-auth]     | —   | ⬜     | —    | —      |
| S3-08 | Portal — /invite/:token                       | [01-auth]     | —   | ⬜     | —    | —      |
| S3-09 | Portal — /dashboard                           | [02-orders]   | —   | ⬜     | —    | —      |
| S3-10 | Portal — /tasks (список + фільтри)            | [02-orders]   | —   | ⬜     | —    | —      |
| S3-11 | Portal — /tasks/new                           | [02-orders]   | —   | ⬜     | —    | —      |
| S3-12 | Portal — /tasks/:id (статус + етапи)          | [02-orders]   | —   | ⬜     | —    | —      |
| S3-13 | Portal — /tasks/:id чат (SSE)                 | [03-chat]     | —   | ⬜     | —    | —      |
| S3-14 | Portal — /tasks/:id файли                     | [04-files]    | —   | ⬜     | —    | —      |
| S3-15 | Portal — /tasks/:id activity log              | [03-chat]     | —   | ⬜     | —    | —      |
| S3-16 | Portal — /team (члени + invite)               | [01-auth]     | —   | ⬜     | —    | —      |
| S3-17 | Portal — /settings (профіль + пароль)         | [13-settings] | —   | ⬜     | —    | —      |
| S3-18 | Portal — /settings нотифікації + мова + тема  | [13-settings] | —   | ⬜     | —    | —      |
| S3-19 | i18n UA+EN в portal                           | [13-settings] | —   | ⬜     | —    | —      |
| S3-20 | Error handling — toast/popup для всіх помилок | [UI]          | —   | ⬜     | —    | —      |
| S3-21 | Mobile responsive portal                      | [UI]          | —   | ⬜     | —    | —      |
| S3-22 | Deploy Sprint 3 → staging                     | Infra         | —   | ⬜     | —    | 🚀     |

---

## SPRINT 4 — Workspace Frontend (Тиждень 5-6)

> Ціль: власник і виконавець можуть повноцінно працювати

| ID    | Задача                                     | Модуль        | Хто | Статус | Тест | Deploy |
| ----- | ------------------------------------------ | ------------- | --- | ------ | ---- | ------ |
| S4-01 | Workspace — Auth context + /login          | [01-auth]     | —   | ⬜     | —    | —      |
| S4-02 | Workspace — /invite/:token (executor flow) | [01-auth]     | —   | ⬜     | —    | —      |
| S4-03 | Executor — / kanban своїх задач            | [02-orders]   | —   | ⬜     | —    | —      |
| S4-04 | Executor — /tasks/:id статус + коментарі   | [02-orders]   | —   | ⬜     | —    | —      |
| S4-05 | Executor — /tasks/:id time log             | [12-team]     | —   | ⬜     | —    | —      |
| S4-06 | Executor — /profile заробіток              | [12-team]     | —   | ⬜     | —    | —      |
| S4-07 | Owner — / overview dashboard               | [02-orders]   | —   | ⬜     | —    | —      |
| S4-08 | Owner — /orders kanban + таблиця + пошук   | [02-orders]   | —   | ⬜     | —    | —      |
| S4-09 | Owner — /orders/:id повне управління       | [02-orders]   | —   | ⬜     | —    | —      |
| S4-10 | Owner — /clients список компаній           | [02-orders]   | —   | ⬜     | —    | —      |
| S4-11 | Owner — /clients/:id картка клієнта        | [02-orders]   | —   | ⬜     | —    | —      |
| S4-12 | IP whitelist middleware для workspace      | Infra         | —   | ⬜     | —    | —      |
| S4-13 | i18n UA+EN в workspace                     | [13-settings] | —   | ⬜     | —    | —      |
| S4-14 | Deploy Sprint 4 → staging                  | Infra         | —   | ⬜     | —    | 🚀     |

---

## SPRINT 5 — Billing + Services + Team (Тиждень 6-7)

| ID    | Задача                                             | Модуль        | Хто | Статус | Тест | Deploy |
| ----- | -------------------------------------------------- | ------------- | --- | ------ | ---- | ------ |
| S5-01 | API — /billing/summary, /charges                   | [05-billing]  | —   | ⬜     | ⬜   | —      |
| S5-02 | API — POST /workspace/billing/payments             | [05-billing]  | —   | ⬜     | ⬜   | —      |
| S5-03 | Advance payment логіка (orderId + type)            | [05-billing]  | —   | ⬜     | ⬜   | —      |
| S5-04 | ExchangeRate — НБУ API cron (09:10 Kyiv)           | [05-billing]  | —   | ⬜     | ⬜   | —      |
| S5-05 | API — Services CRUD + assign to company            | [05-billing]  | —   | ⬜     | ⬜   | —      |
| S5-06 | pg_cron — recurring charges 1-го числа             | [05-billing]  | —   | ⬜     | ⬜   | —      |
| S5-07 | API — Team invite + rates + earnings               | [12-team]     | —   | ⬜     | ⬜   | —      |
| S5-08 | API — Company members + permissions                | [01-auth]     | —   | ⬜     | ⬜   | —      |
| S5-09 | API — Referral bonus при payment                   | [09-referral] | —   | ⬜     | ⬜   | —      |
| S5-10 | API — Loyalty tier update при payment              | [10-loyalty]  | —   | ⬜     | ⬜   | —      |
| S5-11 | Portal — /billing                                  | [05-billing]  | —   | ⬜     | —    | —      |
| S5-12 | Portal — /referrals                                | [09-referral] | —   | ⬜     | —    | —      |
| S5-13 | Portal — /loyalty                                  | [10-loyalty]  | —   | ⬜     | —    | —      |
| S5-14 | Workspace — /billing dashboard                     | [05-billing]  | —   | ⬜     | —    | —      |
| S5-15 | Workspace — /billing/payouts                       | [12-team]     | —   | ⬜     | —    | —      |
| S5-16 | Workspace — /services                              | [05-billing]  | —   | ⬜     | —    | —      |
| S5-17 | Workspace — /team                                  | [12-team]     | —   | ⬜     | —    | —      |
| S5-18 | Workspace — /settings (payment settings, referral) | [13-settings] | —   | ⬜     | —    | —      |
| S5-19 | Deploy Sprint 5 → staging                          | Infra         | —   | ⬜     | —    | 🚀     |

---

## SPRINT 6 — Documents + Notifications + Bot (Тиждень 7-8)

| ID    | Задача                                      | Модуль             | Хто | Статус | Тест | Deploy |
| ----- | ------------------------------------------- | ------------------ | --- | ------ | ---- | ------ |
| S6-01 | packages/templates — InvoiceTemplate PDF    | [06-documents]     | —   | ⬜     | —    | —      |
| S6-02 | packages/templates — CompletionActTemplate  | [06-documents]     | —   | ⬜     | —    | —      |
| S6-03 | packages/templates — SpecificationTemplate  | [06-documents]     | —   | ⬜     | —    | —      |
| S6-04 | API — POST /workspace/orders/:id/documents  | [06-documents]     | —   | ⬜     | ⬜   | —      |
| S6-05 | API — GET /workspace/documents/:id/download | [06-documents]     | —   | ⬜     | ⬜   | —      |
| S6-06 | API — POST /workspace/documents/:id/send    | [06-documents]     | —   | ⬜     | ⬜   | —      |
| S6-07 | Portal — /tasks/:id вкладка Документи       | [06-documents]     | —   | ⬜     | —    | —      |
| S6-08 | Workspace — /orders/:id вкладка Документи   | [06-documents]     | —   | ⬜     | —    | —      |
| S6-09 | Telegram bot — /start + OTP flow            | [15-bot]           | —   | ⬜     | ⬜   | —      |
| S6-10 | Bot — webhook mode (prod)                   | [15-bot]           | —   | ⬜     | ⬜   | —      |
| S6-11 | Bot — notification events handler           | [15-bot]           | —   | ⬜     | ⬜   | —      |
| S6-12 | POST /profile/telegram/connect (OTP)        | [13-settings]      | —   | ⬜     | ⬜   | —      |
| S6-13 | Notifications — in-app list GET/PATCH       | [07-notifications] | —   | ⬜     | ⬜   | —      |
| S6-14 | Email templates HTML дизайн (всі)           | [08-email]         | —   | ⬜     | —    | —      |
| S6-15 | Deploy Sprint 6 → staging                   | Infra              | —   | ⬜     | —    | 🚀     |

---

## SPRINT 7 — Landing + Blog (Тиждень 7-8, паралельно)

| ID    | Задача                                      | Модуль             | Хто | Статус | Тест | Deploy |
| ----- | ------------------------------------------- | ------------------ | --- | ------ | ---- | ------ |
| S7-01 | Landing — Hero секція                       | [14-landing]       | —   | ⬜     | —    | —      |
| S7-02 | Landing — Проблеми / Як працюємо / Кейси    | [14-landing]       | —   | ⬜     | —    | —      |
| S7-03 | Landing — Команда / Стек / FAQ / CTA        | [14-landing]       | —   | ⬜     | —    | —      |
| S7-04 | Landing — /blog + /blog/[slug] (ISR)        | [11-content]       | —   | ⬜     | —    | —      |
| S7-05 | Landing — /cases + /cases/[slug] (ISR)      | [11-content]       | —   | ⬜     | —    | —      |
| S7-06 | Landing — /team, /stack, /status            | [14-landing]       | —   | ⬜     | —    | —      |
| S7-07 | Landing — /terms, /privacy                  | [14-landing]       | —   | ⬜     | —    | —      |
| S7-08 | Landing — UA + EN (next-intl)               | [14-landing]       | —   | ⬜     | —    | —      |
| S7-09 | Landing — SEO metadata + sitemap + hreflang | [14-landing]       | —   | ⬜     | —    | —      |
| S7-10 | Landing — OG image autogeneration           | [14-landing]       | —   | ⬜     | —    | —      |
| S7-11 | Landing — Contact form → /api/contact       | [14-landing]       | —   | ⬜     | ⬜   | —      |
| S7-12 | API — AI content generation endpoint        | [11-content]       | —   | ⬜     | ⬜   | —      |
| S7-13 | Workspace — /content (AI draft + publish)   | [11-content]       | —   | ⬜     | —    | —      |
| S7-14 | Workspace — /messages + /inbox              | [07-notifications] | —   | ⬜     | —    | —      |
| S7-15 | Lighthouse ≥ 90 для landing                 | [14-landing]       | —   | ⬜     | —    | —      |
| S7-16 | Deploy Sprint 7 → staging                   | Infra              | —   | ⬜     | —    | 🚀     |

---

## SPRINT 8 — QA + Launch (Тиждень 9-10)

| ID    | Задача                                        | Модуль        | Хто | Статус | Тест | Deploy |
| ----- | --------------------------------------------- | ------------- | --- | ------ | ---- | ------ |
| S8-01 | Integration tests — auth flow                 | [01-auth]     | —   | ⬜     | ⬜   | —      |
| S8-02 | Integration tests — order lifecycle           | [02-orders]   | —   | ⬜     | ⬜   | —      |
| S8-03 | Integration tests — billing + payment         | [05-billing]  | —   | ⬜     | ⬜   | —      |
| S8-04 | Integration tests — referral bonus            | [09-referral] | —   | ⬜     | ⬜   | —      |
| S8-05 | Security review — OWASP checklist             | Infra         | —   | ⬜     | —    | —      |
| S8-06 | Sentry — всі 5 apps налаштовані               | Infra         | —   | ⬜     | —    | —      |
| S8-07 | UptimeRobot — 4 monitors                      | Infra         | —   | ⬜     | —    | —      |
| S8-08 | Netdata — встановлений на сервері             | Infra         | —   | ⬜     | —    | —      |
| S8-09 | Backup cron — налаштований + тест відновлення | Infra         | —   | ⬜     | —    | —      |
| S8-10 | pg_cron — recurring charges перевірка         | [05-billing]  | —   | ⬜     | ⬜   | —      |
| S8-11 | Перший реальний клієнт — ручне тестування     | All           | —   | ⬜     | —    | —      |
| S8-12 | Виправлення знайдених багів                   | All           | —   | ⬜     | —    | —      |
| S8-13 | git tag v0.1.0                                | Infra         | —   | ⬜     | —    | —      |
| S8-14 | 🚀 Production deploy v0.1.0                   | Infra         | —   | ⬜     | —    | 🚀     |

---

## ПРОГРЕС

| Sprint        | Всього  | ✅ Done | 🧪 Tested | 🚀 Deployed |
| ------------- | ------- | ------- | --------- | ----------- |
| S0 Foundation | 30      | 30      | 2         | 1           |
| S1 Auth       | 22      | 0       | 0         | 0           |
| S2 Orders API | 19      | 0       | 0         | 0           |
| S3 Portal     | 22      | 0       | 0         | 0           |
| S4 Workspace  | 14      | 0       | 0         | 0           |
| S5 Billing    | 19      | 0       | 0         | 0           |
| S6 Docs+Bot   | 15      | 0       | 0         | 0           |
| S7 Landing    | 16      | 0       | 0         | 0           |
| S8 QA+Launch  | 14      | 0       | 0         | 0           |
| **TOTAL**     | **171** | **30**  | **2**     | **1**       |
