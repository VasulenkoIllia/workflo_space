# SERVER UPDATE 2026-07 — серверний чек-лист під інфра-зріз 02.07

> Разовий ранбук (патерн `archive/SERVER_UPDATE_S5.md`): що оновити на Hetzner-боксі **до**
> пушу інфра-зрізу. Після виконання — переїде в `archive/`.
> Контекст: [`AUDIT_2026-07.md`](AUDIT_2026-07.md) раунд 3. Директорії на сервері:
> staging `= /var/www/srv/workflo/staging`, production `= /var/www/srv/workflo/production`,
> у кожній — власний `.env` (compose читає його через `--env-file .env`).

## Порядок (важливо)

```
1. Оновити staging/.env і production/.env (кроки 1–2 нижче)   ← ДО пушу
2. Закомітити + запушити dev → staging-деплой сам застосує все
3. Верифікація на staging (крок 3)
4. Ротація старих seed-паролів (крок 4)
5. dev → main (коли готовий) → prod-деплой
6. RLS-флip — ОКРЕМА фаза пізніше, staging-соак першим (крок 6)
```

Причина порядку: нові змінні прокидаються **новим** compose-манифестом, який scp'їться лише
під час деплою. Правиш `.env` зараз → усе підхопиться самим деплоєм, без ручних рестартів.

---

## Крок 1 — staging `.env` (`/var/www/srv/workflo/staging/.env`)

```bash
ssh <user>@<hetzner-host>
cd /var/www/srv/workflo/staging

# 1a. Перевір, чого ще нема:
grep -E '^(SEED_OWNER_PASSWORD|SEED_EXECUTOR_PASSWORD|SEED_CLIENT_PASSWORD|CREDENTIALS_KEK_BASE64_STAGING|TEAM_IPS)=' .env

# 1b. Додай (свої значення; паролі — сильні, це інтернет-доступний стенд):
cat >> .env <<'ENV'
SEED_OWNER_PASSWORD=<сильний-пароль>
SEED_EXECUTOR_PASSWORD=<сильний-пароль>
SEED_CLIENT_PASSWORD=<сильний-пароль>
ENV
echo "CREDENTIALS_KEK_BASE64_STAGING=$(openssl rand -base64 32)" >> .env

# 1c. TEAM_IPS: тепер гейтить і dev-api + dev-portal (не лише workspace).
#     Перевір, що твій поточний IP у списку (CIDR через кому):
#     на своїй машині: curl -s ifconfig.me
grep '^TEAM_IPS=' .env
```

Нотатки:

- **Сід без цих паролів тепер відмовляється сіяти** (fail-closed при `NODE_ENV=production`);
  крок у деплої non-fatal — деплой пройде, але в лозі Actions буде `WARN: seed step failed`.
- **KEK можна генерувати свіжий**: vault на staging досі віддавав 503 (KEK не прокидався),
  тож зашифрованих даних, які б зламались від зміни ключа, немає. Надалі ключ НЕ міняти —
  секрети стануть нерозшифровними.
- `SEED_OWNER_EMAIL` можна не чіпати (дефолт `owner@workflo.space`).

## Крок 2 — production `.env` (`/var/www/srv/workflo/production/.env`)

```bash
cd /var/www/srv/workflo/production
echo "CREDENTIALS_KEK_BASE64_PROD=$(openssl rand -base64 32)" >> .env
```

- **Інший ключ, ніж staging** (не копіювати).
- `SEED_*` на проді не потрібні — сід там не запускається (а тепер ще й fail-closed).
- RLS-змінні (`DATABASE_APP_URL_PROD`, `RLS_ENFORCED_PROD`) — НЕ зараз, див. крок 6.

## Крок 3 — після пушу в dev: верифікація staging

```bash
# 3a. В Actions-лозі деплою: крок "Seeding staging baseline data" — БЕЗ "WARN: seed step failed".

# 3b. /health лишився публічним (carve-out для CI):
curl -s -o /dev/null -w '%{http_code}\n' https://dev-api.workflo.space/health        # → 200
curl -s -o /dev/null -w '%{http_code}\n' https://dev-portal.workflo.space/health    # → 200

# 3c. Whitelist працює: з IP ПОЗА TEAM_IPS (напр., телефон без wifi):
#     https://dev-api.workflo.space/ і dev-portal → 403 (Traefik forbidden).
#     З твого (team) IP — все працює як раніше.

# 3d. Vault: у workspace відкрий клієнта → таб «Секрети» → додати секрет → «показати».
#     Reveal працює (не 503) = KEK доїхав.
```

## Крок 4 — ротація staging-акаунтів, які вже сіялись дефолтом

Сід **не перезаписує** пароль наявним акаунтам (upsert не чіпає `passwordHash`), тож якщо
`owner@workflo.space` / `executor@workflo.space` / `client@example.com` колись сіялись з
`Admin123!` / `Exec123!` / `Client123!` — вони так і лишились.

1. Перевір: спробуй залогінитись старим дефолтом на `dev-work.workflo.space`.
2. Якщо заходить — зміни пароль через UI (профіль → зміна пароля) для всіх трьох акаунтів.
3. Після whitelist'а (крок 3c) вікно експозиції закрите, але відомий пароль лишається boргом —
   не пропускай.

## Крок 5 — production-деплой (коли готовий merge у main)

- Нічого додатково: KEK уже в `.env` (крок 2), manual approve → деплой → перевір
  `https://api.workflo.space/health` і vault на проді.
- **Свіжий `scripts/rollback.sh` тепер їде з деплоєм** (доданий у scp-список production.yml)
  і ляже в `/var/www/srv/workflo/production/scripts/rollback.sh`. Якщо на сервері є стара
  копія деінде — видали її, щоб у день інциденту не запустити стару (вона піднімала другий
  стек). Запуск: `bash scripts/rollback.sh [sha-tag]` (через `bash` — scp не гарантує +x).

## Крок 6 — RLS-флip (окрема фаза, НЕ зараз; staging-соак ≥ спринт)

За чеклістом `ENGINEERING_STANDARDS.md → "RLS rollout"`:

```bash
# 6a. staging: дати роли LOGIN (роль workflo_app уже створена міграцією F4, NOLOGIN):
cd /var/www/srv/workflo/staging
docker compose --project-name workflo-staging --env-file .env -f docker-compose.staging.yml \
  exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "ALTER ROLE workflo_app LOGIN PASSWORD '<згенерований-пароль>';"

# 6b. staging/.env — той самий host/db, що в DATABASE_URL_STAGING, лише user/pass інші:
#     DATABASE_APP_URL_STAGING=postgresql://workflo_app:<пароль>@postgres:5432/workflo_staging
#     RLS_ENFORCED_STAGING=true
# 6c. Передеплой (або: compose up -d api) → у лозі api буде гучний WARN-нагадування.
# 6d. Соак на staging повний спринт (усі екрани, звіти, ліди, vault) → потім те саме
#     з _PROD-змінними на проді. migrate/worker НЕ чіпати — вони лишаються на owner-URL.
```

## Крок 7 — активація INFRA-DR1 (після деплою зрізу 03.07)

Зріз 03.07 привіз: `restore.sh` (drill + справжній restore), uploads на named volume,
`--clean --if-exists` у денних дампах, uploads-tar щоночі, **фікс project-name у backup.sh**
(до цього `up -d postgres` міг піднімати ДРУГИЙ порожній postgres і дампити його — перевірте
`backups/backup.log`: якщо ночами були tiny-dump FAILED — це воно).

```bash
cd /var/www/srv/workflo/production

# 7a. Оновлений cron (додався щомісячний drill 1-го числа о 04:20):
sudo REPO_DIR=/var/www/srv/workflo bash scripts/install-backup-cron.sh

# 7b. Перший ручний бекап + drill (двічі перевіряємо ланцюг):
bash scripts/backup.sh          # очікуємо: DB OK + uploads OK (або skipped) у Telegram
bash scripts/restore.sh --drill # очікуємо: "Restore drill OK: ... tables=..., profiles=..."

# 7c. Офсайт (restic; storage box має існувати):
sudo apt-get install -y restic
# у production/.env: RESTIC_REPOSITORY="sftp:uXXXX@...:/backups/workflo" + RESTIC_PASSWORD=...
restic init   # один раз, з тими ж env
bash scripts/backup.sh   # тепер лог має сказати "Offsite (restic) OK"
```

Нотатки:

- Файли, залиті ДО цього зрізу, жили в шарі контейнера і вже втрачались на кожному
  деплої — рятувати нічого; нові підуть у volume `uploads_data` і в нічний tar.
- Справжнє відновлення: `bash scripts/restore.sh --restore [dump]` — попросить
  надрукувати RESTORE, зупинить api/bot, застосує дамп, підніме назад з `--wait`.

---

**Після виконання кроків 1–5:** відміть тут дату виконання і перенеси файл у `docs/archive/`
(+ рядок у `archive/README.md`). Крок 6 живе окремо в беклозі до свого часу.
