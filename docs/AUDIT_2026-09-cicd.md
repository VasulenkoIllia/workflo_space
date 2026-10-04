# Аудит CI/CD і деплою (2026-09-27)

> Re-audit після [`AUDIT_INFRA_DEVOPS_2026-06.md`](AUDIT_INFRA_DEVOPS_2026-06.md) (26.06). Беклог
> інфра-блоку — [`BACKLOG.md`](BACKLOG.md) (INFRA-\*), таблиця фаз — [`ROADMAP.md`](ROADMAP.md) → «🛠 Інфра / DevOps».
> Тут — **що змінилося з червня і що нове**; вже відомі пункти не дублюю, лише оновлюю статус.

## Як зараз влаштовано (коротко)

- **Гілки:** `dev` → staging (`dev.workflo.space`, `dev-portal`, `dev-work`, `dev-api`), `main` → прод.
  `main` захищена: PR + статус `check`, force-push заборонено.
- **Staging (`staging.yml`, пуш у `dev`):** `check` (type-check · lint · test) ‖ `db` (міграції на
  чистій PG + drift + RLS-ізоляція) ‖ `smoke` (Playwright на тимчасовому стеку) → `build` 5 образів у
  GHCR (`sha-<commit>`) → SCP compose-файлів + SSH: pull з ретраями → **бекап БД перед міграцією
  (fail-closed)** → `migrate` → seed → `up --wait` → перевірка TLS → health-check.
- **Прод (`production.yml`, пуш у `main`):** те саме + ручне **approval** (environment) + **авто-rollback**
  на попередній перевірений тег, без seed.
- Час одного деплою staging: ~8–9 хв.

## Статус пунктів червневого аудиту

| Пункт                                                                             | Статус 27.09                                                                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| DR-b `restore.sh`, uploads volume + tar                                           | ✅ у репо (03.07)                                                                                      |
| DR-a офсайт-бекап (restic)                                                        | ⏳ код є; **серверна активація + перший restore-drill не підтверджені** (SERVER_UPDATE_2026-07 крок 7) |
| Sentry                                                                            | ✅ код (`observability/sentry.ts`); DSN на сервері — перевірити                                        |
| `/ready` health                                                                   | ✅                                                                                                     |
| appleboy ssh/scp на SHA                                                           | ✅                                                                                                     |
| Notify-on-failure, uptime-моніторинг                                              | ❌ відкрито — **підтверджено інцидентом нижче (N1)**                                                   |
| Staging-rollback                                                                  | ❌ відкрито                                                                                            |
| Dependabot, SSH known_hosts, edge security-headers, IaC, runbooks, AR-50b / CI-D1 | ❌ відкрито (рішення 26.06: беклог до першого платного тенанта)                                        |

## Нові знахідки

### 🔴 N1 — сьогоднішній деплой на staging не пройшов, і ніхто не дізнався

- Run 36313722572 (пуш 27.09, `80b5132`): `smoke` впав → `build` / `deploy` пропущено. **На staging досі
  версія від 15.07.**
- Причина: smoke-тест заповнював реквізити на порталі `/settings`, а DEDUP-IA (2b9fafe) переніс їх у
  «Моя компанія» (`/company`). Unit-гейти (`turbo type-check lint test`) цього не бачать.
- **Виправлено** (27.09): `e2e/tests/smoke.spec.ts` → крок на `/company` + `/company` у списку сторінок
  порталу; локально `scripts/e2e.sh` — 2/2 ✓. Потрібен пуш, щоб staging розгорнувся.
- Системні висновки:
  1. **Notify-on-failure** (INFRA-OBS1) — не «колись», а наступний крок: падіння деплою має
     приходити в Telegram за хвилину, а не випадково при огляді.
  2. **Локальний гейт перед пушем**, коли змінюються маршрути, підписи полів чи кнопок у
     порталі / workspace: окрім `turbo type-check lint test` — ще `bash scripts/e2e.sh` (~3 хв).

### 🔴 N2 — прод відстає від `dev` на 500 комітів

- `main` востаннє оновлено 13.04.2026. Перший реліз принесе на прод увесь продукт і всі міграції з
  квітня разом — це найризикованіший деплой проєкту.
- Потрібна **генеральна репетиція релізу** до мерджу в `main`:
  1. дамп прод-БД → відновити на тимчасовій PG → `prisma migrate deploy` → smoke;
  2. звірити `.env` на прод-сервері з усіма змінними, що зʼявилися з квітня (compose,
     `.env.example`);
  3. активувати офсайт-бекап і зробити перший restore-drill (DR-a) — **до** першого релізу, не після;
  4. staging-rollback (INFRA-OPS1), щоб поведінка staging і проду збігалась.
- Далі — релізити регулярно (напр., раз на 1–2 тижні або після кожного закритого блоку), щоб
  розрив не накопичувався.

### 🟠 N3 — Node 20 більше не підтримується

- Node.js 20 — end-of-life з 30.04.2026 (без security-патчів). Він у CI (`setup-node` 20) і в усіх
  Dockerfile (`node:20-*`).
- GitHub уже примусово запускає екшени на Node 24 (warning у логах: `actions/checkout@v4`,
  `setup-node@v4`, `cache@v4`, `upload-artifact@v4`, `pnpm/action-setup@v4`).
- Рекомендація: перейти на **Node 22 або 24 LTS** одним зрізом (CI + 5 Dockerfile + `engines`) з
  повними гейтами + smoke; оновити екшени до мажорних версій на Node 24.
- Поруч: `nginx-unprivileged:1.27` і `nginx:1.27` (mainline-гілка, застаріла) → стабільна 1.28.

### 🟠 N4 — staging і прод-воркфлоу — дві копії одного файлу

- `staging.yml` і `production.yml` збігаються на ~90% (~330 рядків кожен). Вже розійшлися: у staging
  немає rollback і синхронізації `scripts/`. Кожна правка деплою = дві правки.
- Рекомендація: один reusable `deploy.yml` з параметрами (середовище, домени, API URL, approval, seed)
  → staging автоматично отримує rollback. Робити разом з INFRA-OPS1.

### 🟡 N5 — дрібниці

- **Docs-only пуш запускає повний деплой** (5 образів, ~9 хв). → `paths-ignore: ['docs/**', '**/*.md']`
  у `staging.yml` (прод лишити як є — туди йде лише через PR).
- **Лендінг не покритий smoke** — додати перевірку ключових сторінок (`/`, `/services/*`,
  `/cases/*`, `/blog`, `/en` → 200 + `h1`) разом із SEO-треком ([`LANDING_SEO_PLAN.md`](LANDING_SEO_PLAN.md)).
- **Smoke ганяє vite dev-сервери, а не зібрані образи** — зібраний образ уперше запускається вже на
  сервері. Прийнятно, поки є health-gate + rollback; на проді — ок, на staging rollback немає (N4).
- **Traefik `ipwhitelist`** — у Traefik v3 застаріла назва; перейменувати на `ipallowlist` при
  наступній правці compose.
- Репозиторій **публічний** — GHCR-образи безкоштовні, але seed-паролі staging теж публічні; staging
  API за IP-allowlist (`TEAM_IPS`) — тримати так.

## Пріоритети

| Коли                             | Що                                                                                                         | Зусилля     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------- |
| **Зараз**                        | Пуш фіксу smoke (N1) → staging розгортається                                                               | хвилини     |
| **Зараз**                        | Notify-on-failure у Telegram для staging і проду (INFRA-OBS1, частина)                                     | ~1 год      |
| **Зараз**                        | `paths-ignore` для docs у staging (N5)                                                                     | ~10 хв      |
| **Перед першим релізом на прод** | Репетиція релізу + звірка `.env` + офсайт-бекап і restore-drill (N2, DR-a)                                 | ~0.5–1 день |
| **Перед першим релізом на прод** | Node 22/24 LTS + оновлення екшенів і nginx (N3)                                                            | ~0.5 дня    |
| **Перед першим релізом на прод** | Один reusable `deploy.yml` + staging-rollback (N4 + INFRA-OPS1)                                            | ~0.5 дня    |
| Перед першим платним тенантом    | Решта червневого беклогу: Dependabot, known_hosts, security-headers, uptime, IaC, runbooks, AR-50b / CI-D1 | за BACKLOG  |

## Ремедіація (04.10.2026)

| Знахідка | Що зроблено                                                                                                                                                                                                                                                                      | Перевірено                                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1 smoke | `e2e/tests/smoke.spec.ts` → реквізити на `/company`                                                                                                                                                                                                                              | локально `scripts/e2e.sh` 2/2                                                                                                                                                                 |
| N1 тиша  | job `notify` у `deploy.yml` → Telegram (✅ розгорнуто · ❌ не розгорнуто · ❌ відкочено · 🔥 відкат теж упав); секрети `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ALERT_CHAT_ID`, без них — warning                                                                                        | actionlint + shellcheck                                                                                                                                                                       |
| N2 прод  | `release-preflight.yml` (read-only: env-імена, лічильники БД, контейнери, диск, бекапи; сам на PR у `main`) · `bootstrap:owner` для порожньої прод-БД · ранбук [`RELEASE_2026-10.md`](RELEASE_2026-10.md)                                                                        | bootstrap — на чистій PG з усіма міграціями: створення, ідемпотентність, відмова 2-му власнику, bcrypt-звірка                                                                                 |
| N3 Node  | Node 24 LTS: `.nvmrc`, `engines`, `@types/node` 24, 5 Dockerfile; екшени на node24-мажорах (checkout/setup-node/cache v5, upload-artifact v6, pnpm v5, docker login/buildx v4, build-push v7); nginx 1.28                                                                        | на Node 24.21: turbo 51/51, інтеграційні 162/162, build 14/14, `docker build` 5/5                                                                                                             |
| N4 дубль | спільний `deploy.yml` + `scripts/deploy-remote.sh` (deploy · record · rollback); staging отримав verify + auto-rollback; rollback іде на останній **перевірений** тег (`.last_deploy`) — коректно й тоді, коли деплой упав до власного bookkeeping; `rollback.sh` делегує туди ж | симуляція з підробленим `docker`: прод-викат із збереженим лендінгом, worker-профіль, запис, падіння → відкат, staging + seed, відмова без попереднього тегу, крихітний бекап блокує міграцію |
| N5       | `paths-ignore` docs/\*\*, \*\*/\*.md у staging · Traefik `ipwhitelist` → `ipallowlist`                                                                                                                                                                                           | actionlint                                                                                                                                                                                    |

Прод за рішенням 27.09 **не викочує лендінг** (`apps` у `production.yml` без `landing`) — `workflo.space`
лишається на своєму тегу; `deploy-remote.sh` зберігає тег незадеплоєних застосунків у `.env`.
