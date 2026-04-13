# S0 Runbook (Foundation)

Цей runbook закриває задачі `S0-09..S0-17`, `S0-28`, `S0-30` через підготовлені скрипти та конфіги в репозиторії.

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
export PROD_DB_PASSWORD='replace-me'
export STAGING_DB_PASSWORD='replace-me'

# dry-run
bash /srv/workflo/scripts/s0/hetzner-bootstrap.sh

# apply
bash /srv/workflo/scripts/s0/hetzner-bootstrap.sh --apply
```

Що робить скрипт:
- встановлює Docker + Compose plugin + PostgreSQL + UFW
- створює `deploy` user і системні директорії `/srv/workflo/*`, `/srv/traefik`
- створює staging/prod БД і ролі
- вмикає UFW правила для `22/80/443`, закриває `5432/19999`

## 4) Traefik (S0-15)

Якщо Traefik вже встановлений і працює:
- не перевстановлюй його
- використовуй існуючий `certResolver` (наприклад `cf`)
- переконайся, що є Docker network для роутінгу (`traefik_network` або твій кастомний)

Перевірка існуючого Traefik:

```bash
docker ps --filter name=traefik
docker network ls | grep traefik
```

Якщо Traefik ще не піднятий, тоді:

```bash
mkdir -p /srv/traefik
cp infra/traefik/traefik.yml /srv/traefik/traefik.yml
cp infra/traefik/docker-compose.yml /srv/traefik/docker-compose.yml
touch /srv/traefik/acme.json
chmod 600 /srv/traefik/acme.json

docker network create traefik_network || true
cd /srv/traefik
docker compose up -d
```

## 5) DNS + Mailcow (S0-16, S0-17)

DNS записи перевести на Hetzner IP:
- `workflo.space`, `www.workflo.space`
- `app.workflo.space`, `work.workflo.space`, `api.workflo.space`
- `dev.workflo.space`, `dev-app.workflo.space`, `dev-work.workflo.space`, `dev-api.workflo.space`
- `mail.workflo.space`

Mailcow:
- встановити окремим stack
- налаштувати `SPF`, `DKIM`, `DMARC`
- створити скриньки `hello@`, `noreply@`, `support@`

## 6) Staging/Production deploy (S0-30)

На сервері:

```bash
mkdir -p /srv/workflo/staging /srv/workflo/production
cp docker-compose.staging.yml /srv/workflo/staging/
cp docker-compose.production.yml /srv/workflo/production/

cp .env.server.example /srv/workflo/staging/.env
cp .env.server.example /srv/workflo/production/.env
# заповнити реальними значеннями
```

Push у `dev` запускає `staging.yml`.

Перевірка:

```bash
./scripts/healthcheck.sh --env staging --delay 20 --retries 3
```

Після merge `dev -> main` і manual approval у GitHub:

```bash
./scripts/healthcheck.sh --env production --delay 20 --retries 3
```

## 7) Backup/Rollback

Backup:

```bash
bash /srv/workflo/scripts/backup.sh
```

Rollback:

```bash
bash /srv/workflo/scripts/rollback.sh
# або на конкретний тег:
bash /srv/workflo/scripts/rollback.sh sha-xxxxxxxx
```
