# RELEASE 2026-10 — перший реліз dev → main з квітня

> Разовий ранбук (патерн `SERVER_UPDATE_2026-07.md`). Контекст — [`AUDIT_2026-09-cicd.md`](AUDIT_2026-09-cicd.md)
> (N2: прод відстає на ~500 комітів, остання прод-збірка — 13.04.2026, `sha-5efd81c`).
> Після релізу — переїде в `archive/`.

## Що їде на прод

- Увесь продукт з квітня: api, worker, bot, portal, workspace + усі міграції БД.
- **Лендінг НЕ їде** — `workflo.space` лишається на своєму поточному тегу (рішення 27.09,
  [`LANDING_SEO_PLAN.md`](LANDING_SEO_PLAN.md) §0). Вмикається одним рядком — `apps` у `production.yml`.
- Node 24 LTS у всіх образах; nginx 1.28; Traefik `ipallowlist`.

## Кроки

| #   | Хто     | Що                                                                                                                                   |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | власник | GitHub → Settings → Secrets → Actions: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALERT_CHAT_ID` — алерти деплою (без них лише warning у лозі) |
| 1   | агент   | Пуш у `dev` → staging-деплой → перевірка (health, вхід, smoke)                                                                       |
| 2   | агент   | PR `dev → main` → CI (check · DB gate · smoke) + **Release preflight** (сам на PR) → прочитати лог                                   |
| 3   | власник | За лозом preflight — доповнити `production/.env` (див. нижче), за потреби активувати бекапи                                          |
| 4   | власник | Merge PR → Actions → «Deploy to Production» → **Review deployments → Approve**                                                       |
| 5   | агент   | Контроль: build → deploy → verify; при падінні — auto-rollback на `sha-5efd81c`                                                      |
| 6   | власник | Якщо preflight показав `rows in profiles: 0` — створити власника (нижче) і увійти на `work.workflo.space` (з IP із `TEAM_IPS`)       |

## Крок 3 — `production/.env`

```bash
ssh <user>@<hetzner-host>
cd /var/www/srv/workflo/production

# Сейф доступів (модуль 17): без ключа вкладка «Секрети» віддає 503. Ключ — свій для проду,
# НЕ копія staging, і після першого використання не міняти (секрети стануть нерозшифровними).
grep -q '^CREDENTIALS_KEK_BASE64_PROD=' .env || echo "CREDENTIALS_KEK_BASE64_PROD=$(openssl rand -base64 32)" >> .env
```

Решта змінних з розділу «Env vars» preflight-лога — за потребою: без `SMTP_*` не підуть листи
(запрошення, скидання пароля), без `BOT_TOKEN` — Telegram, без `SENTRY_DSN` — моніторинг помилок.
Жодна з них не валить API (фатальні лише `DATABASE_URL_PROD` / `JWT_SECRET_PROD`).

**Бекапи** (якщо preflight показав `no backup cron` / `restic: not installed`) —
`SERVER_UPDATE_2026-07.md`, крок 7: `install-backup-cron.sh` → `backup.sh` → `restore.sh --drill`.
Офсайт (restic + Storage Box) — до того, як на проді зʼявляться реальні клієнтські дані.

## Крок 6 — перший власник на проді

Демо-сід на проді не запускається ніколи. Порожня БД = нікому увійти. Разовий скрипт створює
лише власника + агенцію (без демо-даних); повторний запуск нічого не змінює.

```bash
cd /var/www/srv/workflo/production
read -rs BOOTSTRAP_OWNER_PASSWORD && export BOOTSTRAP_OWNER_PASSWORD   # ≥ 12 символів, не потрапить в історію
docker compose --project-name workflo-production --env-file .env -f docker-compose.production.yml \
  run --rm --no-deps -e BOOTSTRAP_OWNER_EMAIL=<ваша-пошта> -e BOOTSTRAP_OWNER_PASSWORD \
  api pnpm --filter @workflo/db run bootstrap:owner
unset BOOTSTRAP_OWNER_PASSWORD
```

## Postgres: alpine → bookworm

Квітневий прод крутив `postgres:16-alpine`; тепер — власний образ `postgres:16-bookworm` + pg_cron
(той самий том даних, та сама major-версія 16). Порядок сортування тексту в musl і glibc різний,
тож **якщо в БД уже є рядки** (preflight: `rows in …` > 0) — один раз після деплою:

```bash
docker compose --project-name workflo-production --env-file .env -f docker-compose.production.yml \
  exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "REINDEX DATABASE \"$POSTGRES_DB\";"'
```

Порожня БД (усі `rows in …: 0`) — нічого робити не треба.

## Відкат

- Автоматичний: job «Auto rollback» у деплої — на останній перевірений тег (`.last_deploy`).
- Ручний: `bash scripts/rollback.sh` (попередній) або `bash scripts/rollback.sh sha-<commit>`.
- Схема БД назад не відкочується (Prisma без down-міграцій) — аварійний вихід:
  `scripts/restore.sh` з `backups/pre-migrate-*.sql.gz`, який деплой робить перед кожною міграцією.
