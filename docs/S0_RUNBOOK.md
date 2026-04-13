# S0 Runbook (Foundation)

Цей runbook закриває задачі `S0-09..S0-17`, `S0-28`, `S0-30` через підготовлені скрипти та конфіги в репозиторії.

## 0) Поточний стан (станом на 13 квітня 2026)

- `dev` і `main` працюють через PR flow; production deploy йде через manual approval в GitHub Environment `production`.
- Staging/production деплої працюють із runtime-директоріями:
  - `/var/www/srv/workflo/staging`
  - `/var/www/srv/workflo/production`
- Домени зафіксовані:
  - staging: `dev.workflo.space`, `dev-portal.workflo.space`, `dev-work.workflo.space`, `dev-api.workflo.space`
  - production: `workflo.space`, `portal.workflo.space`, `work.workflo.space`, `api.workflo.space`
- API стабілізовано:
  - `/health` = liveness (без БД, HTTP 200)
  - `/ready` = readiness (200/503 залежно від БД)
  - Prisma/OpenSSL сумісність зафіксована для production runtime (`debian-openssl-3.0.x`).

## 1) Підготовка локально

```bash
pnpm install
./scripts/s0/s0-status.sh
cp .env.github.secrets.example .env.github.secrets
```

Заповни `.env.github.secrets` реальними значеннями.

## 2) GitHub (S0-09, S0-10, S0-11, S0-28)

Потрібен `gh` CLI та авторизація:

```bash
gh auth login
```

Для `GitHub Free`:
- `branch protection` і `required reviewer` працюють на `public` репозиторіях
- для `private` потрібен платний план (`Pro/Team`)

Зробити репозиторій public (якщо ти на Free):

```bash
gh repo edit your-org/your-repo --visibility public
```

Застосувати branch protection для `main` і `dev`:

```bash
./scripts/s0/github-branch-protection.sh your-org/your-repo
```

Для solo-розробки (direct push у `dev`, але `main` залишається protected):

```bash
./scripts/s0/github-branch-protection.sh your-org/your-repo --solo
```

Опціонально: залишити PR flow у `dev`, але без approve:

```bash
./scripts/s0/github-branch-protection.sh your-org/your-repo --approvals 0
```

Заповнити GitHub secrets:

```bash
./scripts/s0/github-secrets.sh your-org/your-repo .env.github.secrets
```

Мінімально для деплою через SSH мають бути:
- `HETZNER_HOST`
- `HETZNER_SSH_USER` (твій існуючий юзер на сервері)
- `HETZNER_SSH_KEY`

Створити/оновити environment `production` з required reviewer:

```bash
./scripts/s0/github-production-environment.sh your-org/your-repo your-github-login
```

Якщо reviewer-policy недоступна для поточного плану/visibility:

```bash
./scripts/s0/github-production-environment.sh your-org/your-repo none
```

## 3) Hetzner bootstrap (S0-12, S0-13, S0-14)

На сервері як `root`:

```bash
export DEPLOY_USER=workflo  # твій існуючий юзер на сервері
export RUNTIME_ROOT=/var/www/srv/workflo
export TRAEFIK_ROOT=/var/www/srv/traefik
export DB_MODE=docker  # default, PostgreSQL у docker-compose
export UFW_RESET=0     # не чіпати існуючі firewall-правила інших проєктів

# dry-run
bash /var/www/projects/workflo_space/scripts/s0/hetzner-bootstrap.sh

# apply
bash /var/www/projects/workflo_space/scripts/s0/hetzner-bootstrap.sh --apply
```

Що робить скрипт:
- встановлює Docker + Compose plugin + UFW
- створює `deploy` user і системні директорії `/var/www/srv/workflo/*`, `/var/www/srv/traefik`
- вмикає UFW правила для `22/80/443` і закриває `5432/19999`
- якщо потрібен host PostgreSQL: `DB_MODE=host` + `PROD_DB_PASSWORD/STAGING_DB_PASSWORD`

## 4) Traefik (S0-15)

Якщо Traefik вже встановлений і працює:
- не перевстановлюй його
- використовуй існуючий `certResolver` (наприклад `cf`)
- переконайся, що є Docker network для роутінгу (`traefik_network` або твій кастомний)
- в docker-compose для Workflo використовуй унікальні `traefik.http.routers/services/middlewares` імена з префіксом `workflo-`, щоб уникнути конфліктів із іншими проектами на тому ж Traefik host
- для сервісів, що мають більше однієї network (`api` тощо), зафіксуй `traefik.docker.network=${TRAEFIK_NETWORK}` в labels, щоб Traefik не обрав внутрішню `app_network` помилково
- зафіксуй `traefik.http.routers.<name>.tls=true` і явний `priority` (наприклад `10000`) для Workflo роутерів, щоб прибрати неоднозначність TLS/router matching на shared Traefik
- для staging/prod landing-роутера додай `tls.domains[0].main` + `tls.domains[0].sans` (включно з `dev-api`/`api`), щоб Traefik випускав SAN-сертифікат на весь набір публічних host у межах одного certresolver

Перевірка існуючого Traefik:

```bash
docker ps --filter name=traefik
docker network ls | grep traefik
```

Якщо Traefik ще не піднятий, тоді:

```bash
mkdir -p /var/www/srv/traefik
cp infra/traefik/traefik.yml /var/www/srv/traefik/traefik.yml
cp infra/traefik/docker-compose.yml /var/www/srv/traefik/docker-compose.yml
touch /var/www/srv/traefik/acme.json
chmod 600 /var/www/srv/traefik/acme.json

docker network create traefik_network || true
cd /var/www/srv/traefik
docker compose up -d
```

## 5) DNS + Mail (S0-16, S0-17)

DNS записи перевести на Hetzner IP:
- `workflo.space`, `www.workflo.space`
- `portal.workflo.space`, `work.workflo.space`, `api.workflo.space`
- `dev.workflo.space`, `dev-portal.workflo.space`, `dev-work.workflo.space`, `dev-api.workflo.space`
- `mail.workflo.space`

Mailcow:
- встановити окремим stack
- налаштувати `SPF`, `DKIM`, `DMARC`
- створити скриньки `hello@`, `noreply@`, `support@`

Важливо: відсутність Mailcow/SMTP на S0 не блокує staging/production deploy.  
`SMTP_USER`, `SMTP_PASS` можуть бути порожніми, доки email-функції не вводяться в експлуатацію.

## 6) Staging/Production deploy (S0-30)

На сервері (первинна ініціалізація, один раз):

```bash
mkdir -p /var/www/srv/workflo/staging /var/www/srv/workflo/production

cp .env.server.example /var/www/srv/workflo/staging/.env
cp .env.server.example /var/www/srv/workflo/production/.env
# заповнити реальними значеннями
```

Важливо: `docker-compose.staging.yml`, `docker-compose.production.yml` і `infra/maintenance` тепер синхронізуються автоматично з GitHub Actions на кожному deploy. Ручний `cp` цих файлів перед кожним релізом більше не потрібен.

В `.env` значення `GITHUB_REPOSITORY_OWNER` вкажи в lowercase (наприклад `vasulenkoillia`), бо GHCR чутливий до регістру.
Для dockerized PostgreSQL заповни:
- `POSTGRES_DB_STAGING`, `POSTGRES_USER_STAGING`, `POSTGRES_PASSWORD_STAGING`
- `POSTGRES_DB_PROD`, `POSTGRES_USER_PROD`, `POSTGRES_PASSWORD_PROD`
- `DATABASE_URL_STAGING` / `DATABASE_URL_PROD` з host `postgres`

Опційні змінні (`SMTP_USER`, `SMTP_PASS`, `BOT_TOKEN`) можуть бути порожніми на S0 етапі; compose-файли мають `:-` fallback і не повинні сипати warning під час `docker compose up`.

Push у `dev` запускає `staging.yml`, який робить:
- build/push Docker images у GHCR
- sync runtime-manifests на сервер (`docker-compose.staging.yml` + `infra/maintenance`)
- deploy контейнерів у `/var/www/srv/workflo/staging` з фіксованим compose project name `workflo-staging`
- автоматично прибирає legacy compose-проєкти (`staging` / `workflo_space`) і будь-які сторонні конфліктні контейнери, якщо вони перехоплюють `dev-api.workflo.space` Traefik router
- перевіряє, що після деплою реально запущені `postgres`, `api`, `bot`, `landing`, `portal`, `workspace`
- прогріває TLS/SNI для `dev`, `dev-portal`, `dev-work`, `dev-api` і чекає, поки зникне `TRAEFIK DEFAULT CERT`

Перевірка:

```bash
./scripts/healthcheck.sh --env staging --delay 20 --retries 6 --retry-delay 10
```

Примітка: `dev-work.workflo.space` тепер входить у дефолтний staging healthcheck, але з допустимими статусами `200/401/403` (через IP whitelist).
Примітка: в API `/health` використовується як чистий liveness (без звернення до БД, завжди HTTP 200), а `/ready` — як readiness (200/503 залежно від доступності БД).
Примітка: API image використовує `node:20-bookworm-slim` + встановлений `openssl`, а Prisma Client генерується з `binaryTargets = ["native", "debian-openssl-3.0.x"]`. Це прибирає runtime-помилку `libssl.so.1.1` на staging/production.

Після merge `dev -> main` і manual approval у GitHub:

```bash
./scripts/healthcheck.sh --env production --delay 20 --retries 6 --retry-delay 10
```

`production.yml` працює аналогічно: sync runtime-manifests + deploy у `/var/www/srv/workflo/production` з compose project name `workflo-production` після manual approval, cleanup legacy/conflict-стеків по `api.workflo.space`, перевіркою запущених сервісів і TLS warmup на всіх публічних host.

Перед rerun/production deploy перевір, що в `/var/www/srv/workflo/production/.env` не лишилось placeholder-значень:
- `GITHUB_REPOSITORY_OWNER` = реальний lowercase owner (`vasulenkoillia`)
- `POSTGRES_DB_PROD`, `POSTGRES_USER_PROD`, `POSTGRES_PASSWORD_PROD`, `DATABASE_URL_PROD`
- `JWT_SECRET_PROD`

Швидка перевірка:

```bash
cd /var/www/srv/workflo/production
for v in GITHUB_REPOSITORY_OWNER POSTGRES_DB_PROD POSTGRES_USER_PROD POSTGRES_PASSWORD_PROD DATABASE_URL_PROD JWT_SECRET_PROD; do
  val="$(grep -E "^${v}=" .env | tail -n1 | cut -d= -f2-)"
  [ -z "$val" ] && echo "MISSING/EMPTY: $v" || echo "OK: $v"
done
```

Post-deploy smoke-check (production):

```bash
curl -skI https://workflo.space
curl -skI https://portal.workflo.space/health
curl -skI https://api.workflo.space/health
curl -sk -i https://api.workflo.space/ready
curl -skI https://work.workflo.space/health
```

## 7) Backup/Rollback

Backup:

```bash
bash /var/www/projects/workflo_space/scripts/backup.sh
```

Rollback:

```bash
bash /var/www/projects/workflo_space/scripts/rollback.sh
# або на конкретний тег:
bash /var/www/projects/workflo_space/scripts/rollback.sh sha-xxxxxxxx
```
