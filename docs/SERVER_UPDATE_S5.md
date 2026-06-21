# Sprint 5 — План оновлення сервера (Hetzner)

> Що потрібно на сервері, щоб фінансове ядро S5 запрацювало. **Гарна новина: S5 НЕ потребує жодної нової змінної env.** Усе працює на наявних `DATABASE_URL` + `JWT_SECRET`. Деплой сам застосовує міграцію й піднімає крони. Нижче — точний чек-лист і єдиний реальний «footgun».

## TL;DR — що зробити

1. **Запушити 6 S5-комітів** на `dev` (staging) → CI задеплоїть на staging автоматично.
2. Переконатися, що деплой **застосував міграцію** `20260608_s5_00_financial_core` (one-shot `migrate`-сервіс — лог має бути «All migrations applied», exit 0, ПЕРЕД підняттям `api`).
3. Переконатися, що `RUN_WORKERS_INLINE` **не** виставлено в `false` (інакше крони не стартують).
4. Для тестів у **гривні (UAH)** — мати рядок `ExchangeRate` для агенції (FX-крон сам заповнить о 06:10 UTC; або засіяти вручну — див. нижче). **USD-платежі працюють одразу.**

---

## 1. Змінні env — звірка

**Нових для S5 НЕМАЄ.** Усі S5-крони/фічі читають лише наявні змінні. Звір, що в твоєму `.env` на сервері є:

### Обовʼязкові (без них API не стартує)

| Var                                   | Що                    | Примітка                                                     |
| ------------------------------------- | --------------------- | ------------------------------------------------------------ |
| `DATABASE_URL_STAGING` / `_PROD`      | Postgres DSN          | compose мапить → `DATABASE_URL` для `api`/`worker`/`migrate` |
| `JWT_SECRET_STAGING` / `_PROD`        | підпис access-токенів | **≥32 символи** інакше fail-fast                             |
| `POSTGRES_PASSWORD_STAGING` / `_PROD` | пароль БД             | має збігатися з тим, що в `DATABASE_URL_*`                   |

### Рекомендовані (фіча деградує, але API живий)

| Var                                      | Наслідок якщо нема                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `CORS_ALLOWED_ORIGINS_STAGING` / `_PROD` | падає на дефолтні prod-origin; для не-дефолтного домену **виставити** (інакше CORS + `/auth/refresh` CSRF зламані)             |
| `SMTP_HOST` (+ `SMTP_USER`/`SMTP_PASS`)  | email-нотифікації пишуться як `failed` (не критично для S5 — нотифікації все одно → S6)                                        |
| `COOKIE_DOMAIN` (prod: `.workflo.space`) | refresh-cookie host-only замість cross-subdomain                                                                               |
| `SENTRY_DSN`                             | без моніторингу помилок (Sentry = no-op)                                                                                       |
| `TEAM_IPS`                               | **workspace недоступний** (Traefik IP-whitelist, дефолт `127.0.0.1/32` = всіх заблоковано). Виставити свій IP/CIDR через кому. |

> **🌐 Без статичної (білої) IP (рішення власника 2026-06-21):** на staging workspace відкрито через
> `TEAM_IPS=0.0.0.0/0,::/0` — IP-whitelist знятий, доступ гейтить лише логін застосунку (JWT,
> owner/executor). Прийнятно для staging (тест-дані + auth). Застосувати:
>
> ```bash
> cd /var/www/srv/workflo/staging          # відредагувати .env: TEAM_IPS=0.0.0.0/0,::/0
> # ⚠️ ТЕГ: у .env *_TAG лишаються плейсхолдером `sha-initial` — деплой підставляє реальний
> # commit-sha тег лише у своїй SSH-сесії (export, НЕ пише в .env). Для ручного compose теж
> # підстав актуальний тег із .last_deploy, інакше `image ...:sha-initial: not found`.
> export TAG=$(cat .last_deploy)
> export LANDING_TAG=$TAG PORTAL_TAG=$TAG WORKSPACE_TAG=$TAG API_TAG=$TAG BOT_TAG=$TAG
> docker compose --project-name workflo-staging --env-file .env \
>   -f docker-compose.staging.yml up -d --force-recreate workspace
> ```
>
> (Traefik перечитує label `ipwhitelist.sourcerange` при перестворенні контейнера.) **На PROD так
> НЕ робити** — там лишити реальний `TEAM_IPS` (свій IP/VPN-CIDR) або перейти на Basic Auth / Cloudflare Access.

> **Висновок:** якщо S0-S4 у тебе вже працювали на staging — для S5 **нічого додавати не треба**. Просто переконайся, що список вище не зрегресував.

---

## 2. Міграція БД

- **Що:** `20260608_s5_00_financial_core` — 7 нових таблиць (`wallet_transactions`, `payment_allocations`, `referral_settings`, `loyalty_tier_history`, `executor_payouts`, `expenses`, `idempotency_keys`), 8 enum, розширення `ChargeStatus` (+`partial`/`written_off`), нові колонки на `companies`/`payments`/`service_charges`/`company_services`/`services`, + RLS-політики (inert, поки `RLS_ENFORCED` не ввімкнено).
- **Як застосовується:** автоматично — окремий one-shot compose-сервіс `migrate` робить `prisma migrate deploy` **до** підняття `api`, після pre-migrate `pg_dump`-бекапу.
- **Перевірити після деплою:**
  ```bash
  # на сервері
  docker compose -f docker-compose.staging.yml logs migrate | tail -20   # «All migrations applied»
  # або прямо в БД:
  docker compose exec postgres psql -U postgres -d <db> -c "\dt" | grep -E "wallet_transactions|expenses|idempotency_keys"
  ```
- **Ручної SQL не треба.** Якщо `migrate` впав — `api` не підніметься; дивись лог, відкат через `.previous_deploy`.

---

## 3. Крони / воркери

S5 додає **3 in-process крони** (чистий JS `setTimeout`/`setInterval`, не pg_cron). Стартують через `startWorkers()` якщо `RUN_WORKERS_INLINE !== 'false'`:

| Крон             | Розклад (UTC)   | Що робить                                 | Залежність                          |
| ---------------- | --------------- | ----------------------------------------- | ----------------------------------- |
| exchangeRate     | щодня 06:10     | NBU → `ExchangeRate` per-agency           | **вихідний HTTPS до `bank.gov.ua`** |
| recurringCharges | 1-ше міс. 00:05 | генерує charge по підписках (всі тенанти) | лише БД                             |
| loyaltyRecalc    | щоніч 02:30     | перерахунок loyalty-тірів                 | лише БД                             |

- **Default `RUN_WORKERS_INLINE=true`** → крони працюють усередині `api`-контейнера. **Нічого робити не треба.**
- ⚠️ **Єдиний footgun:** якщо хтось виставив `RUN_WORKERS_INLINE=false` БЕЗ підняття окремого `worker`-сервісу (`--profile workers`) — **жоден S5-крон не запуститься** (нема FX-курсів, нема місячних charge, нема recalc). На staging окремого `worker` нема → має лишатись inline.
- **Firewall:** дозволити вихідний `443` до `bank.gov.ua` (інакше FX-курс не заповниться → UAH-платежі 422).

---

## 4. Підготовка до тестування

- **USD-платежі** — працюють одразу після міграції (rateUsed=1).
- **UAH-платежі** — потребують `ExchangeRate` для агенції. FX-крон заповнить о 06:10 UTC; щоб не чекати — **засіяти вручну**:
  ```sql
  -- замінити <agencyId> на реальний id з таблиці agencies
  INSERT INTO exchange_rates ("id","agencyId","usdToUah","updatedAt","updatedBy")
  VALUES (gen_random_uuid(), '<agencyId>', 41.50, now(), 'manual-seed')
  ON CONFLICT ("agencyId") DO UPDATE SET "usdToUah"=EXCLUDED."usdToUah";
  ```
- **RLS:** лишається ВИМКНЕНим (`RLS_ENFORCED` не виставлено) — політики створені, але inert. Для S5 нічого робити не треба.

---

## 5. Чек-лист «готовий тестувати»

- [ ] 6 S5-комітів запушені, CI зелений, staging задеплоєний
- [ ] `migrate`-сервіс відпрацював (лог «All migrations applied»)
- [ ] нові таблиці присутні (`\dt | grep wallet_transactions`)
- [ ] `RUN_WORKERS_INLINE` ≠ `false` (крони inline)
- [ ] `TEAM_IPS` містить твій IP (для workspace)
- [ ] (для UAH) `ExchangeRate` засіяно або FX-крон відпрацював
- [ ] далі → [`S5_MANUAL_TEST_PLAN.md`](S5_MANUAL_TEST_PLAN.md)
