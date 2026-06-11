# Повний аудит проекту — документація + код + інфраструктура (2026-06-11)

> Найширший аудит на сьогодні: **10 областей** (docs-core · docs-saas · db-schema · api-core · api-modules · billing · frontend · packages · infra · tests), 30 агентів (~1.3M токенів аналізу), кожна high/critical знахідка **адверсарно верифікована** (агент-скептик з мандатом спростувати) або звірена точково по коду. **0 знахідок спростовано.**
> Ремедіація — спринт **S5.5** у [`TRACKER.md`](TRACKER.md). Виконання: тільки `dev`; фронтенд-тести свідомо НЕ пишемо (рішення власника 11.06 — окремий пізніший прохід); бекапи реалізуємо, офсайт-тест після появи сховища.

---

## Вердикт

**Ядро закладене правильно.** Найдорожчі для ретрофіту рішення — тенантність (`agencyId` на всіх 46 моделях, FORCE RLS-скаффолд, `tenantTransaction`), грошова математика (Decimal, `FOR UPDATE`, ідемпотентність, append-only ledger), outbox, provider-сіми — уже в коді. Жодна знахідка не вимагає переписування: це «доскладання» поверх правильного фундаменту, що підтверджує стратегію SAAS.md.

**Топ-3 ризики — навколо коду, не в ньому:**

1. **DR = нуль** (CRITICAL): бекапи — локальний `pg_dump` на той самий диск, що й Postgres; cron непідтверджений; offsite відсутній; restore ніколи не тестувався. Один Hetzner-хост тримає prod + staging + PG + Mailcow + бекапи.
2. **Найсильніший тест-гейт ніколи не працював**: `db-integration` (RLS-ізоляція + грошові інваріанти на живому PG) тригериться лише на `pull_request` — а робота йде прямими push у `dev`. Job не виконався **жодного разу** (єдиний запуск ci.yml — 13.04, до існування інтеграційних тестів).
3. **Copy-paste ядро portal↔workspace** (14 дзеркальних файлів, 7+ байт-ідентичних) уже дав прод-баг: фікс `??`→`||` у `api.ts` зроблено лише у workspace.

| Шар            | Оцінка                | Підсумок                                                                                                       |
| -------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Документація   | ⭐ сильна             | канон-ієрархія, BACKLOG без лімбо, чесні HYPOTHESIS-мітки; слабкість — дрейф стану в TRACKER/CRON_JOBS/CONCEPT |
| SaaS-стратегія | ⭐ найсильніший актив | ADR-004/007 здорові; структурні обіцянки **звірені з кодом і збігаються**                                      |
| Схема БД       | ⭐ сильна             | Decimal/Timestamptz/NOT NULL agencyId/RLS; дірки — глобальні unique (нижче)                                    |
| API-ядро       | добра                 | auth по ADR-001 солідний, fp-wrap фікс коректний; дірки — fail-open RLS-ланцюг, SSE-shutdown                   |
| Білінг         | добра, вузька         | manual-ядро production-grade; провайдери/webhooks/refunds/dunning/VAT — тільки доки                            |
| Фронтенд       | середня               | патерни здорові (токен у памʼяті, single-flight refresh); copy-paste + фасадна i18n                            |
| Інфраструктура | слабка ланка          | CI-механіка зріла (drift-gate, rollback, TLS-verify), але один сервер і нуль DR                                |
| Тести          | бімодальна            | бекенд взірцевий (інваріанти на живому PG, ~572 зелених); UI — нуль, E2E нема                                  |

**Фактичний стан (звірено з git, не з TRACKER):** S0–S5 закодовано; S5 **уже запушений** (`origin/dev...dev = 0 0`, коміт `0ecefdb` «trigger staging redeploy») — всупереч TRACKER «НЕ запушено». S6+ не починалися. Ремедіація S5.5 НЕ додає функціональності S6+ — лише виправляє/зміцнює існуюче.

---

## CRITICAL / HIGH (усі верифіковані; диспозиція → S5.5 ID)

### Інфраструктура / DR

- **[CRITICAL] Offsite-бекапів немає; cron непідтверджений; дампи на диску БД** — `scripts/backup.sh` пише в `$PROD_DIR/backups` того ж хоста; жодного restic/rclone/wal-g/S3 у репо; чекліст INFRASTRUCTURE.md `□ Backup cron` незакритий; bootstrap crontab не ставить. RPO best-case 24h, worst-case ∞. → **AR-51** (offsite-обвʼязка зараз, тест після появи сховища).
- **[HIGH] Pre-migrate бекап non-blocking на проді** — `|| echo "WARN: pre-migrate backup failed (continuing)"` (`production.yml:198`, так само staging) → міграція їде без бекапа; Prisma down-міграцій не має, rollback-план = restore. → **AR-03** (blocking + перевірка розміру).
- **[HIGH] Один сервер на все** — prod + staging + PG + Traefik + Mailcow + бекапи на одному Hetzner (всі 10 DNS-хостів → 49.12.219.133); staging-деплой ганяє `docker rm -f`/`image prune` проти спільного демона з продом. → довгостроково (перед зовнішнім тенантом) — рознести; зараз **AR-02** (serialize deploys) + **AR-51** (offsite) знижують радіус.
- **[HIGH] Traefik-конфіг у репо мертвий** — repo: `letsencrypt/httpChallenge`; live: `certresolver=cf` (CF DNS-challenge) у hand-managed `/var/www/proxy`; CI infra/traefik не синкає. Відновлення сервера з репо неможливе; wildcard `*.workflo.space` (FDN-5) впирається сюди ж. Плюс dashboard-роутер `api@internal` без auth у закоміченому конфігу. → **AR-52**.

### Процеси / CI

- **[HIGH] `db-integration` гейт ніколи не виконувався** — `ci.yml` only `pull_request`; гілка живе прямими push; staging/production ганяють `turbo test` без PG/`RUN_DB_TESTS` → усі 57 інтеграційних тестів скіпаються (локально verified: «345 passed | 57 skipped»). ENGINEERING_STANDARDS «CI гейтить кожен PR» — вакуумно. → **AR-01** (один рядок: `push: branches: [dev, main]`).
- **[HIGH] Нуль тестів UI + нема E2E** — 4 апки з `--passWithNoTests`; P0 (CORS/helmet/rate-limit мертві на всіх роутах) пійманий лише ручним браузер-тестом. → **свідомо відкладено** (рішення власника 11.06): Playwright-смоук — окремий пізніший прохід; зараз компенсація — `globalPlugins.test.ts` (API-рівень) + ручні плани.

### Гроші (S5)

- **[HIGH] Алокація без валютного guard** — `allocation.ts` не містить жодної згадки `currency` (verified grep): UAH-платіж може погасити USD-charge 1:1; `recomputeMoneyBalance` змішує одиниці (paid=amountUsd, owed=totalAmount у валюті компанії). → **AR-10**.
- **[HIGH] `Company.moneyBalance` застаріває** — `recomputeMoneyBalance` викликається лише з `allocatePayment` (єдиний call-site, verified); `confirmManualPayment` (no-order confirmed) і місячний cron нарахувань кеш не оновлюють, а Portal/Workspace показують його як живий AR. → **AR-11**.
- **[MEDIUM→в одному пакеті] `written_off` рахується як борг** у recompute (латентна корупція, коли write-off зʼявиться у UI) → **AR-12**; **TOCTOU статус-переходу ордера** (check поза атомарним write) → **AR-13**.

### Тенантність (перед RLS-активацією)

- **[HIGH] RLS fail-open** — `wf_in_tenant()`: GUC unset → permissive (свідомий rollout-дизайн, але «deny-on-unset» позначений optional). Ланцюг залежить від ALS `enterWith`. → **AR-23** (fail-closed при `RLS_ENFORCED=true` + guard у `tenantTransaction`: ctx відсутній → throw поза allowlist).
- **[HIGH] `tenantTransaction` мовчки деградує** — `if (!ctx) return fn(tx)`: втрачений ALS-контекст (timer/emitter) = крос-тенантний запит без лога. → **AR-23**.
- **[HIGH] notifications тенант-сліпий** — увесь DB I/O на сирому `prisma` поза withTenant (`services/notifications.ts:16`, verified); фліп RLS_ENFORCED його зламає/обійде. → **AR-24** (tenant-aware DI до фліпа).
- **[HIGH] Глобальні unique, що зламаються в SaaS** (verified, «робить гірше»-поправка скептика по payout):
  - `ExecutorPayout @@unique([executorId, period])` без agencyId — мульти-агенційний виконавець = unique violation на чужому рядку → **AR-20**;
  - `Referral` без `agencyId` — може звʼязати компанії двох агенцій; RLS-політика скоупить лише через referrer → **AR-21**;
  - `Company.slug`/`referralCode` глобально-unique → колізії між тенантами → **AR-22**.

### API-ядро

- **[HIGH] Graceful shutdown висне на живих SSE** — без `forceCloseConnections` `app.close()` чекає hijacked-сокети з heartbeat → SIGTERM висить до SIGKILL; `$disconnect`/`flushSentry` не виконуються (verified: опція відсутня). → **AR-30**.
- **[HIGH] Нема retry для нотифікацій** — `notify()` «never throws», outboxWorker ігнорує outcome → подія done навіть якщо всі канали failed; `retryAfter` від Telegram ніхто не читає (verified grep). Outbox уже вміє SKIP LOCKED + backoff + DLQ — треба лише кидати retryable. → **AR-32**.

### Фронтенд

- **[HIGH] Copy-paste ядро portal↔workspace** — 7+ байт-ідентичних файлів (sse/format/queryClient/password/i18n/FilesTab/PasswordStrengthMeter, verified diff), форки AuthContext/AppLayout/auth-сторінок. → **AR-42** (консервативна екстракція байт-ідентичного ядра).
- **[HIGH] Дрейф уже дав прод-баг** — portal `api.ts:4` `?? '/api'` vs workspace `|| '/api'` (фікс не бек-портований): образ без build-arg бейкає `API_URL=''` → auth мертвий. → **AR-40** (один символ).
- **[HIGH] i18n — фасад** — перемикач мови є, `t()` ніде не викликається (0 входжень, verified), ~224 хардкод-рядки UA. → **лишається Block 7b** (свідоме відкладення власника, TRACKER); у S5.5 НЕ входить.

---

## MEDIUM (ключове; повний перелік — у структурованому дампі аудиту)

**Диспозиція «S5.5»:** деплой без healthchecks/`--wait` (grep `compose ps` пропускає пізній crash) → **AR-04**; нема `concurrency:` на деплой-воркфлоу (гонка двох push) → **AR-02**; `.previous_deploy` пишеться до verify (rollback може цілитись у зламаний тег) → **AR-05**; staging `COOKIE_DOMAIN=.workflo.space` (сесії течуть між середовищами) → **AR-53**; single-stage образи api/landing/bot (devDeps+вихідники в проді; `migrate` мовчки залежить від devDeps) → **AR-50**; refresh-токени плейнтекстом у БД + таблиця росте без чистки → **AR-31**; Traefik dashboard без auth → у **AR-52**.

**Диспозиція «BACKLOG» (без баг-ризику зараз):** TOCTOU-сусіди (паралельні авторизаційні конвенції can()/inline); N+1 у алокаційному циклі під локами; list-ендпойнти без пагінації; env-валідація розкидана (2 змінні схемно); платформ-адмін = string-рівність `ADMIN_EMAIL` (до SaaS-фази); overdue/dunning відсутні; refund/credit-note шлях відсутній (enum `refunded` мертвий); VAT нуль у коді; Document/Invoice lifecycle стаб; storage Buffer-only без stream/presigned seam; ErrorBoundary відсутній у SPA (→ **AR-41**, дрібне — беремо в S5.5); eslint без react-hooks/jsx-a11y; Zod-помилки EN в UA-UI; RLS ховає NULL-agencyId рядки «nullable by design» таблиць; FK-less reference-колонки S5; ERD/CRON_JOBS дрейф (→ doc-sync у S5.5 фазі 3).

**Нюанси скептиків (підтверджено з поправками):** TRACKER-суперечності — top-секція «СТАН ЗАРАЗ» коректна, брехливі лише нижні таблиці (уважний top-down читач не постраждає, але AI-агенти читають усе); db-integration — severity high а не critical, бо RLS ще не активований (гейт вакуумний, не активний витік); CORS-P0 нині має API-регресійний guard, тож клас бага частково закритий і без E2E.

---

## Прогалини поза 29 модулями (gap-аналіз)

Модульне покриття аномально повне. Реальні прогалини — операційні та SaaS-специфічні:

1. **DR-дисципліна** — offsite + WAL/PITR + регулярний restore-drill (→ AR-51 структурно; drill — після сховища).
2. **Імперсонація для підтримки** («login as tenant» + аудит-трейл + банер) — ніде не специфікована; для SaaS-підтримки must. → нове в BACKLOG.
3. **Імпорт даних при онбордингу тенанта** (CSV клієнтів/замовлень) — wizard у E1 є, імпорту нема. Часто вирішує SaaS-конверсію. → BACKLOG (Phase 1).
4. **Email-доставність як продукт** — self-hosted Mailcow на тому ж хості; для відправки від імені тенантів: per-tenant DKIM/SPF, bounce/suppression (зараз S12-05), керований SMTP раніше планованого. → BACKLOG (тригер: перший зовнішній тенант).
5. **Email-верифікація на signup** — відкладена в S9; для самостійного SaaS-signup потрібна з дня 1 (анти-абʼюз/trial-фрод). → прив'язати до E1.
6. **MoR/Stripe-vs-Paddle + метрика білінгу** — PRICING чесно називає Phase-1-blocker, але рішення без дати/власника; формує UsageCounter. → рішення власника (підказка: MoR знімає VAT OSS ціною ~5%).
7. **PgBouncer + 2 репліки API** — in-memory rate-limit і SSE вже пінять до 1 репліки (відома заборгованість SC-D1); це ж закриє zero-downtime деплой.
8. **2FA раніше credentials vault** — модуль 17 зберігає чужі паролі; послідовність: 2FA команди (S9-01) ДО вмикання 17.
9. **Секрети у двох несинхронізованих сховищах** (GH Secrets vs server `.env`; частина GH-секретів не споживається ніким) → **AR-54** (зафіксувати джерело правди).
10. Дрібне: trivy-скан образів; GHCR retention; UptimeRobot/Netdata досі чекбокси; деяких скриптів з CRON_JOBS.md не існує (`disk-check.sh`, `uploads-backup.sh`) — doc-sync.

---

## Хибні спрацювання

Немає. Адверсарна верифікація (6 знахідок агентами-скептиками + 11 точкових звірок по коду) **не спростувала жодної**; три отримали уточнення-нюанси (вище).

## Свідомо відкладено (рішення власника, 11.06.2026)

- **Фронтенд-тести (компонентні + Playwright E2E)** — окремий пізніший прохід; S5.5 верифікує фронтенд через type-check/lint/build.
- **i18n Block 7b** (`t()`-світ + en) — лишається свідомим відкладенням; ремедіація не чіпає.
- **RLS-активація** (workflo_app LOGIN + `RLS_ENFORCED=true` + soak) — як і раніше, перед першим зовнішнім тенантом; S5.5 готує fail-closed механіку, але НЕ вмикає.
- **Offsite-бекап ТЕСТ** — після появи сховища (Hetzner Storage Box); код і автоматизація — зараз (AR-51).
- **Рознесення серверів / managed PG / PgBouncer / 2 репліки** — перед зовнішнім тенантом.
- **MoR/pricing-рішення** — власник.

## ✅ Ремедіація S5.5 — ВИКОНАНО (11.06.2026, той самий день)

Усі AR-01…AR-54 + AR-60 закрито (деталі/статуси — TRACKER §S5.5). Підсумок по хвилях:

- **A (CI/деплой):** reusable `db-gate.yml` — real-PG гейт (міграції+drift+RLS+money-інваріанти) тепер **блокує кожен staging/production деплой** (раніше — 0 виконань); `concurrency` групи; pre-migrate бекап blocking + size-check; healthchecks на landing/portal/workspace + `compose up --wait` замість grep `ps`; `.last_deploy` пишеться лише після verify.
- **B (гроші):** валютний guard в алокації (explicit 409 + FIFO фільтрує по валюті); `recomputeMoneyBalance` тепер викликається з `confirmManualPayment` (no-order) і після recurring-cron (`refreshMoneyBalance` експорт); `written_off` виключено з боргу; атомарний статус-перехід ордера (`updateMany WHERE internalStatus=from` → 409 на гонці).
- **C (тенантність/схема):** міграція `20260611_ar_s55_tenant_constraints` (drift-free, verified на throwaway PG16): `ExecutorPayout @@unique(agencyId,executorId,period)` + ключі в payout.ts/timeLogs; `Referral.agencyId NOT NULL` + backfill + column-RLS (замість referrer-join) + tenant-stamp у upsert; `Company.slug` per-agency + `generateUniqueCompanySlug(tx, agencyId, name)`; `tenantTransaction` **fail-closed** при `RLS_ENFORCED=true` без контексту (+ перші 5 тестів `packages/db`); notify — tenant-scoped фасад через `withTenant`.
- **D (API-ядро):** SSE-registry + `closeAllChatStreams()` на shutdown + `forceCloseConnections:'idle'` + watchdog 10s + ідемпотентний shutdown; refresh-токени = sha256 у БД (міграція `20260611_ar31` апгрейдить існуючі in-place — сесії живі) + daily sweep-cron; outbox: all-channels-failed → throw → backoff/DLQ, `retryAfter` шанується, partial-delivery лог без повторного відправлення.
- **E (фронтенд, БЕЗ тестів):** новий пакет **`@workflo/app-core`** — канонічні api/sse/queryClient/format/password/PSM/i18n-provider/ErrorBoundary; в апках — однорядкові re-export шими (нуль churn у call-sites); `??`→`||` помер як клас (одна копія); ErrorBoundary у корені обох SPA. Verified: build обох SPA + бейк-тест `VITE_API_URL` крізь пакет (env у бандлі; без env — `/api` fallback).
- **F (інфра):** Dockerfile-и api/landing/bot/portal/workspace — manifests-first шарування (verified docker build bot); devDeps-prune свідомо відкладено (BACKLOG AR-50b — migrate залежить від prisma CLI); `backup.sh` + offsite (restic/rclone, env-gated, голосний WARN без конфігу) + `install-backup-cron.sh`; **offsite-тест після появи сховища** (рішення власника); infra/traefik синхронізовано з live (cf DNS-challenge, env-токен) + dashboard за basicauth (синк на сервер ручний — інструкція в шапці traefik.yml); staging cookie host-only; github-secrets.sh обрізано до 3 реально вживаних (server `.env` = канон runtime-секретів).

**Гейт після ремедіації:** type-check 23/23 · lint 14/14 · test 22/22 (api **346 unit** + **62 integration на живому PG16** (+5 нових AR-тестів) · db 5 нових · решта без змін) · build 14/14 · обидві міграції накочені + drift-gate чистий · seed smoke OK.

## Метод

10 паралельних area-аудиторів (структуровані звіти: summary/strengths/findings/saas-readiness) → адверсарні верифікатори на кожну high/critical знахідку (мандат «спростуй; default refuted») → крос-звірки головного агента по коду (grep/diff/читання) для знахідок, чиї верифікатори не виконались через session-limit. Синтез прогалин — проти повного переліку 29 модулів + TRACKER S0–S14. Структурований дамп: 10 звітів, 95 знахідок з evidence (зберігався поза репо: `/tmp/workflo_audit/full.json`).
