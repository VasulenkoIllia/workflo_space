# WORKFLO.SPACE — Інфраструктура

> Статус: Фінальна v2.1
> Дата: 16 квітня 2026
>
> Примітка: цей файл — чинна операційна довідка. Разовий runbook закриття S0 заархівовано (`docs/archive/S0_RUNBOOK.md`, історичне); джерело істини щодо інфри тепер тут + фактичні `infra/`/compose/workflows.
> Поточний S0-факт: staging/production PostgreSQL працює dockerized (custom `infra/postgres` image з `postgresql-16-cron`).
> Поточний hardening-факт: runtime контейнери запускаються non-root, `portal/workspace` працюють на unprivileged `8080`, у staging/prod compose є resource + log rotation limits, API security headers через `@fastify/helmet`, а в Prisma застосовано міграцію `20260413215510_timestamptz_and_index_cleanup`.
> Mailcow-факт: сервер встановлено і повністю налаштовано (16 квітня 2026). Реальні шляхи: `/var/www/mail/` (Mailcow) і `/var/www/proxy/` (Traefik). Docker network: `proxy`.

---

## ЗМІСТ

1. [Принципи](#1-принципи)
2. [Структура файлів репозиторію](#2-структура-файлів-репозиторію)
3. [Dockerfiles](#3-dockerfiles)
4. [Docker Compose](#4-docker-compose)
5. [CI/CD Pipeline](#5-cicd-pipeline)
6. [Traefik](#6-traefik)
7. [PostgreSQL + pg_cron](#7-postgresql--pg_cron)
8. [Environment Variables](#8-environment-variables)
9. [Secrets Management](#9-secrets-management)
10. [Міграції БД](#10-міграції-бд)
11. [Backup & Recovery](#11-backup--recovery)
12. [Rollback](#12-rollback)
13. [Моніторинг](#13-моніторинг)
14. [Локальна розробка](#14-локальна-розробка)
15. [Mailcow — Поштовий сервер](#15-mailcow--поштовий-сервер)
16. [Day-1 Checklist](#16-day-1-checklist)

---

## 1. ПРИНЦИПИ

**Незмінні правила:**

- `main` — завжди production-ready. Нічого не пушиться напряму, тільки PR.
- Кожен деплой в production = ручне підтвердження в GitHub UI.
- Кожна production міграція = автоматичний pg_dump перед нею.
- Docker образи тегуються commit SHA. Ніякого `:latest` в production.
- Секрети ніколи не потрапляють в git. Ніколи.
- Frontend apps не мають DATABASE_URL. Це security violation.
- Тільки additive DB зміни в MVP (нові колонки, нові таблиці). Видалення — тільки після видалення з коду.

---

## 2. СТРУКТУРА ФАЙЛІВ РЕПОЗИТОРІЮ

```
workflo.space/
│
├── apps/
│   ├── landing/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── next.config.ts
│   │   └── src/
│   ├── portal/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── nginx.conf
│   │   └── src/
│   ├── workspace/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── nginx.conf
│   │   └── src/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   └── src/
│   └── bot/
│       ├── Dockerfile
│       ├── .dockerignore
│       └── src/
│
├── packages/
│   ├── ui/
│   ├── db/
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── seed.ts
│   │       └── migrations/
│   ├── types/
│   └── notifications/
│
├── infra/
│   ├── traefik/
│   │   ├── traefik.yml           ← статична конфігурація Traefik
│   │   └── acme.json             ← TLS сертифікати (600 права, в .gitignore)
│   ├── postgres/
│   │   └── init.sql              ← pg_cron extension + recurring charges job
│   ├── scripts/
│   │   ├── backup.sh             ← cron pg_dump скрипт
│   │   ├── rollback.sh           ← процедура rollback
│   │   └── health-check.sh       ← перевірка всіх сервісів
│   └── maintenance/
│       └── index.html            ← maintenance page (статична)
│
├── .github/
│   └── workflows/
│       ├── staging.yml
│       └── production.yml
│
├── docker-compose.dev.yml        ← тільки postgres + mailpit
├── docker-compose.staging.yml
├── docker-compose.production.yml
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example                  ← всі ключі без значень, в git
└── .gitignore
```

---

## 3. DOCKERFILES

### 3.1 Landing (Next.js 15) — Multi-stage

```dockerfile
# apps/landing/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Залежності ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY apps/landing/package.json ./apps/landing/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile --filter landing...

# ── Build ────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/landing/node_modules ./apps/landing/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter landing build

# ── Runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/landing/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

```
# apps/landing/next.config.ts — обов'язково для standalone:
output: 'standalone'
```

```
# apps/landing/.dockerignore
node_modules
.next
.env*
```

---

### 3.2 Portal і Workspace (React + Vite SPA) — nginx

```dockerfile
# apps/portal/Dockerfile  (те саме для apps/workspace/Dockerfile)
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Залежності ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY apps/portal/package.json ./apps/portal/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile --filter portal...

# ── Build ────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_URL
ARG VITE_SENTRY_DSN
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN pnpm --filter portal build

# ── Runner (nginx) ───────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/portal/dist /usr/share/nginx/html
COPY apps/portal/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```nginx
# apps/portal/nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing — всі маршрути → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кеш для статичних assets (Vite генерує хеш в імені)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint для Traefik
    location /health {
        return 200 'ok';
        add_header Content-Type text/plain;
    }

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

**Важливо:** `VITE_*` змінні вбудовуються в код під час build (це Vite-специфіка). Тому `VITE_API_URL` — build-time ARG, а не runtime env. Якщо URL API зміниться → потрібен rebuild. Це нормальна поведінка для SPA.

---

### 3.3 API (Fastify) — Multi-stage

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Залежності ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/notifications/package.json ./packages/notifications/
RUN pnpm install --frozen-lockfile --filter api...

# ── Build (TypeScript → JavaScript) ─────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter api build   # tsc → dist/

# ── Runner (тільки production deps) ─────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

# Тільки продакшн залежності
COPY --from=deps /app/node_modules ./node_modules
# Prisma client і schema потрібні в runtime
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

USER fastify
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
```

---

### 3.4 Bot (grammY)

```dockerfile
# apps/bot/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY apps/bot/package.json ./apps/bot/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/notifications/package.json ./packages/notifications/
RUN pnpm install --frozen-lockfile --filter bot...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter bot build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 botuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

USER botuser
CMD ["node", "apps/bot/dist/index.js"]
```

---

## 4. DOCKER COMPOSE

### 4.1 docker-compose.dev.yml — локальна розробка

```yaml
# docker-compose.dev.yml
# Запускає тільки інфраструктуру. Apps запускаються через `pnpm dev`.

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: workflo
      POSTGRES_PASSWORD: workflo_dev
      POSTGRES_DB: workflo_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U workflo']
      interval: 5s
      timeout: 5s
      retries: 5

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - '1025:1025' # SMTP — Nodemailer підключається сюди
      - '8025:8025' # Web UI → http://localhost:8025
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 'true'
      MP_SMTP_AUTH_ALLOW_INSECURE: 'true'

volumes:
  postgres_dev_data:
```

**Як використовувати:**

```bash
docker compose -f docker-compose.dev.yml up -d
# Mailpit UI: http://localhost:8025  ← всі листи видно тут
# PostgreSQL: localhost:5432
```

---

### 4.2 docker-compose.staging.yml

```yaml
# docker-compose.staging.yml
# Запускається на сервері при push в dev.

services:
  landing:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-landing:${LANDING_TAG}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://dev-api.workflo.space
      - SENTRY_DSN=${SENTRY_DSN}
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.workflo-landing-staging.rule=Host(`dev.workflo.space`)'
      - 'traefik.http.routers.workflo-landing-staging.tls.certresolver=cf'
      - 'traefik.http.routers.workflo-landing-staging.entrypoints=websecure'
      - 'traefik.http.services.workflo-landing-staging.loadbalancer.server.port=3000'
    networks:
      - traefik_network

  portal:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-portal:${PORTAL_TAG}
    restart: unless-stopped
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.workflo-portal-staging.rule=Host(`dev-portal.workflo.space`)'
      - 'traefik.http.routers.workflo-portal-staging.tls.certresolver=cf'
      - 'traefik.http.routers.workflo-portal-staging.entrypoints=websecure'
      - 'traefik.http.services.workflo-portal-staging.loadbalancer.server.port=80'
    networks:
      - traefik_network

  workspace:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-workspace:${WORKSPACE_TAG}
    restart: unless-stopped
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.workflo-workspace-staging.rule=Host(`dev-work.workflo.space`)'
      - 'traefik.http.routers.workflo-workspace-staging.tls.certresolver=cf'
      - 'traefik.http.routers.workflo-workspace-staging.entrypoints=websecure'
      - 'traefik.http.services.workflo-workspace-staging.loadbalancer.server.port=80'
      # IP whitelist — тільки ваші IP навіть на staging
      - 'traefik.http.middlewares.workflo-workspace-staging-auth.ipwhitelist.sourcerange=${TEAM_IPS}'
      - 'traefik.http.routers.workflo-workspace-staging.middlewares=workflo-workspace-staging-auth'
    networks:
      - traefik_network

  api:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-api:${API_TAG}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL_STAGING}
      - JWT_SECRET=${JWT_SECRET_STAGING}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET_STAGING}
      - SMTP_HOST=mail.workflo.space
      - SMTP_PORT=587
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - SENTRY_DSN=${SENTRY_DSN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - FRONTEND_URL=https://dev-portal.workflo.space
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.workflo-api-staging.rule=Host(`dev-api.workflo.space`)'
      - 'traefik.http.routers.workflo-api-staging.tls.certresolver=cf'
      - 'traefik.http.routers.workflo-api-staging.entrypoints=websecure'
      - 'traefik.http.services.workflo-api-staging.loadbalancer.server.port=4000'
    networks:
      - traefik_network

  bot:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-bot:${BOT_TAG}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL_STAGING}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - SENTRY_DSN=${SENTRY_DSN}
    networks:
      - traefik_network

networks:
  traefik_network:
    external: true
    name: traefik_network
```

---

### 4.3 docker-compose.production.yml

```yaml
# docker-compose.production.yml

services:
  landing:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-landing:${LANDING_TAG}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.workflo.space
      - SENTRY_DSN=${SENTRY_DSN}
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.workflo-landing.rule=Host(`workflo.space`) || Host(`www.workflo.space`)'
      - 'traefik.http.routers.workflo-landing.tls.certresolver=cf'
      - 'traefik.http.routers.workflo-landing.entrypoints=websecure'
      - 'traefik.http.services.workflo-landing.loadbalancer.server.port=3000'
      # www → без www
      - "traefik.http.middlewares.workflo-www-redirect.redirectregex.regex=^https://www\\.workflo\\.space/(.*)"
      - 'traefik.http.middlewares.workflo-www-redirect.redirectregex.replacement=https://workflo.space/$${1}'
      - 'traefik.http.middlewares.workflo-www-redirect.redirectregex.permanent=true'
      - 'traefik.http.routers.workflo-landing.middlewares=workflo-www-redirect'
    networks:
      - traefik_network

  portal:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-portal:${PORTAL_TAG}
    restart: unless-stopped
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.workflo-portal.rule=Host(`portal.workflo.space`)'
      - 'traefik.http.routers.workflo-portal.tls.certresolver=cf'
      - 'traefik.http.routers.workflo-portal.entrypoints=websecure'
      - 'traefik.http.services.workflo-portal.loadbalancer.server.port=80'
    networks:
      - traefik_network

  workspace:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-workspace:${WORKSPACE_TAG}
    restart: unless-stopped
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.workflo-workspace.rule=Host(`work.workflo.space`)'
      - 'traefik.http.routers.workflo-workspace.tls.certresolver=cf'
      - 'traefik.http.routers.workflo-workspace.entrypoints=websecure'
      - 'traefik.http.services.workflo-workspace.loadbalancer.server.port=80'
      # IP whitelist — ТІЛЬКИ ваші статичні IP
      - 'traefik.http.middlewares.workflo-workspace-ipwhitelist.ipwhitelist.sourcerange=${TEAM_IPS}'
      - 'traefik.http.routers.workflo-workspace.middlewares=workflo-workspace-ipwhitelist'
    networks:
      - traefik_network

  api:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-api:${API_TAG}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL_PROD}
      - JWT_SECRET=${JWT_SECRET_PROD}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET_PROD}
      - SMTP_HOST=mail.workflo.space
      - SMTP_PORT=587
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - SENTRY_DSN=${SENTRY_DSN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - FRONTEND_URL=https://portal.workflo.space
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.workflo-api.rule=Host(`api.workflo.space`)'
      - 'traefik.http.routers.workflo-api.tls.certresolver=cf'
      - 'traefik.http.routers.workflo-api.entrypoints=websecure'
      - 'traefik.http.services.workflo-api.loadbalancer.server.port=4000'
    networks:
      - traefik_network

  bot:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/workflo-bot:${BOT_TAG}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL_PROD}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - SENTRY_DSN=${SENTRY_DSN}
    networks:
      - traefik_network

  maintenance:
    image: nginx:1.27-alpine
    restart: unless-stopped
    volumes:
      - ./infra/maintenance:/usr/share/nginx/html:ro
    profiles:
      - maintenance # запускається тільки явно: --profile maintenance
    labels:
      - 'traefik.enable=false' # вмикається вручну при потребі
    networks:
      - traefik_network

networks:
  traefik_network:
    external: true
    name: traefik_network
```

---

## 5. CI/CD PIPELINE

### 5.1 .github/workflows/staging.yml

```yaml
name: Deploy to Staging

on:
  push:
    branches: [dev]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ghcr.io/${{ github.repository_owner }}/workflo

jobs:
  # ── 1. Перевірки ─────────────────────────────────────────────
  check:
    name: Type check & Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Cache Turborepo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
          restore-keys: ${{ runner.os }}-turbo-

      - name: Type check
        run: pnpm turbo typecheck

      - name: Lint
        run: pnpm turbo lint

  # ── 2. Build і push Docker образів ───────────────────────────
  build:
    name: Build ${{ matrix.app }}
    needs: check
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [landing, portal, workspace, api, bot]
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push ${{ matrix.app }}
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ${{ env.IMAGE_PREFIX }}-${{ matrix.app }}:sha-${{ github.sha }}
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}
          build-args: |
            VITE_API_URL=https://dev-api.workflo.space
            VITE_SENTRY_DSN=${{ secrets.SENTRY_DSN }}

  # ── 3. Deploy на staging сервер ──────────────────────────────
  deploy-staging:
    name: Deploy to Staging
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: deploy
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            set -e
            cd /var/www/srv/workflo/staging

            # Оновити SHA теги
            export LANDING_TAG=sha-${{ github.sha }}
            export PORTAL_TAG=sha-${{ github.sha }}
            export WORKSPACE_TAG=sha-${{ github.sha }}
            export API_TAG=sha-${{ github.sha }}
            export BOT_TAG=sha-${{ github.sha }}
            export GITHUB_REPOSITORY_OWNER=${{ github.repository_owner }}

            # Pull нових образів
            docker compose -f docker-compose.staging.yml pull

            # Міграція БД (staging — автоматично, безпечно)
            docker run --rm \
              -e DATABASE_URL=${{ secrets.DATABASE_URL_STAGING }} \
              ${{ env.IMAGE_PREFIX }}-api:sha-${{ github.sha }} \
              node -e "const {execSync} = require('child_process'); execSync('npx prisma migrate deploy', {stdio:'inherit'})"

            # Restart сервісів (rolling — по одному)
            docker compose -f docker-compose.staging.yml up -d --no-deps landing
            docker compose -f docker-compose.staging.yml up -d --no-deps portal
            docker compose -f docker-compose.staging.yml up -d --no-deps workspace
            docker compose -f docker-compose.staging.yml up -d --no-deps api
            docker compose -f docker-compose.staging.yml up -d --no-deps bot

            # Зберегти SHA для rollback
            echo "sha-${{ github.sha }}" > .last_deploy

  # ── 4. Health check ───────────────────────────────────────────
  health-check:
    name: Health Check
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - name: Check all services
        run: |
          sleep 15   # чекаємо поки контейнери запустяться

          check() {
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$1")
            if [ "$STATUS" != "200" ]; then
              echo "FAIL: $1 returned $STATUS"
              exit 1
            fi
            echo "OK: $1"
          }

          check https://dev.workflo.space
          check https://dev-portal.workflo.space/health
          check https://dev-work.workflo.space/health
          check https://dev-api.workflo.space/health
```

---

### 5.2 .github/workflows/production.yml

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ghcr.io/${{ github.repository_owner }}/workflo

jobs:
  # ── 1. Перевірки (ті самі що staging) ────────────────────────
  check:
    name: Type check & Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
          restore-keys: ${{ runner.os }}-turbo-
      - run: pnpm turbo typecheck
      - run: pnpm turbo lint

  # ── 2. Build і push ───────────────────────────────────────────
  build:
    name: Build ${{ matrix.app }}
    needs: check
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [landing, portal, workspace, api, bot]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ${{ env.IMAGE_PREFIX }}-${{ matrix.app }}:sha-${{ github.sha }}
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}
          build-args: |
            VITE_API_URL=https://api.workflo.space
            VITE_SENTRY_DSN=${{ secrets.SENTRY_DSN }}

  # ── 3. ⏸ РУЧНЕ ПІДТВЕРДЖЕННЯ ─────────────────────────────────
  # GitHub Environment "production" → Settings → Environments
  # Required reviewers працює:
  # - public repo на GitHub Free
  # - private repo на GitHub Pro/Team
  approval:
    name: Waiting for approval
    needs: build
    runs-on: ubuntu-latest
    environment: production # ← тут чекає підтвердження в GitHub UI
    steps:
      - name: Approved
        run: echo "Production deployment approved. Starting..."

  # ── 4. Backup перед міграцією ─────────────────────────────────
  backup:
    name: Database Backup
    needs: approval
    runs-on: ubuntu-latest
    steps:
      - name: Backup production DB
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: deploy
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            set -e
            BACKUP_DIR=/var/www/srv/workflo/production/backups
            DATE=$(date +%Y-%m-%d_%H-%M)
            BACKUP_FILE=$BACKUP_DIR/pre-deploy_$DATE.sql.gz

            pg_dump ${{ secrets.DATABASE_URL_PROD }} | gzip > $BACKUP_FILE
            echo "Backup created: $BACKUP_FILE"
            ls -lh $BACKUP_FILE

  # ── 5. Deploy production ──────────────────────────────────────
  deploy-production:
    name: Deploy to Production
    needs: backup
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: deploy
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            set -e
            cd /var/www/srv/workflo/production

            # Зберегти поточний тег (для rollback)
            CURRENT_TAG=$(cat .last_deploy 2>/dev/null || echo "none")
            echo "$CURRENT_TAG" > .previous_deploy

            NEW_TAG=sha-${{ github.sha }}

            export LANDING_TAG=$NEW_TAG
            export PORTAL_TAG=$NEW_TAG
            export WORKSPACE_TAG=$NEW_TAG
            export API_TAG=$NEW_TAG
            export BOT_TAG=$NEW_TAG
            export GITHUB_REPOSITORY_OWNER=${{ github.repository_owner }}

            # Pull нових образів
            docker compose -f docker-compose.production.yml pull

            # Міграція БД
            docker run --rm \
              -e DATABASE_URL=${{ secrets.DATABASE_URL_PROD }} \
              ${{ env.IMAGE_PREFIX }}-api:$NEW_TAG \
              node -e "const {execSync} = require('child_process'); execSync('npx prisma migrate deploy', {stdio:'inherit'})"

            # Rolling deploy — API першим (backend → frontend)
            docker compose -f docker-compose.production.yml up -d --no-deps api
            sleep 5
            docker compose -f docker-compose.production.yml up -d --no-deps bot
            sleep 5
            docker compose -f docker-compose.production.yml up -d --no-deps portal
            docker compose -f docker-compose.production.yml up -d --no-deps workspace
            docker compose -f docker-compose.production.yml up -d --no-deps landing

            echo "$NEW_TAG" > .last_deploy

  # ── 6. Health check + auto rollback ──────────────────────────
  verify:
    name: Verify & Rollback if failed
    needs: deploy-production
    runs-on: ubuntu-latest
    steps:
      - name: Health check
        id: healthcheck
        run: |
          sleep 20

          check() {
            for i in 1 2 3; do
              STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$1")
              [ "$STATUS" = "200" ] && { echo "OK: $1"; return 0; }
              sleep 5
            done
            echo "FAIL: $1 returned $STATUS"
            return 1
          }

          check https://workflo.space || exit 1
          check https://portal.workflo.space/health || exit 1
          check https://api.workflo.space/health || exit 1

      - name: Auto rollback on failure
        if: failure()
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: deploy
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            cd /var/www/srv/workflo/production
            PREV_TAG=$(cat .previous_deploy)

            echo "⚠️ Health check failed. Rolling back to $PREV_TAG"

            export LANDING_TAG=$PREV_TAG
            export PORTAL_TAG=$PREV_TAG
            export WORKSPACE_TAG=$PREV_TAG
            export API_TAG=$PREV_TAG
            export BOT_TAG=$PREV_TAG
            export GITHUB_REPOSITORY_OWNER=${{ github.repository_owner }}

            docker compose -f docker-compose.production.yml up -d
            echo "Rollback complete."

      - name: Notify on success
        if: success()
        run: |
          curl -s -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
            -d chat_id="${{ secrets.TELEGRAM_DEPLOY_CHAT_ID }}" \
            -d text="✅ Production deploy successful: sha-${{ github.sha }}"

      - name: Notify on failure
        if: failure()
        run: |
          curl -s -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
            -d chat_id="${{ secrets.TELEGRAM_DEPLOY_CHAT_ID }}" \
            -d text="🚨 Production deploy FAILED and rolled back. SHA: sha-${{ github.sha }}"
```

### 5.3 Схема гілок

```
feature/xyz ──→ PR review ──→  dev  ─── auto ──→  staging (dev.workflo.space)
                                │
                        PR + review
                                │
                               main  ──→  build OK ──→  ⏸ manual OK ──→  production
                                                              ↑
                                                    GitHub Environment "production"
                                                    Required reviewer: owner

hotfix/xyz ─────────────────────────────────────────→  main (тільки критичні баги)
                                                         + cherry-pick в dev
```

**Branch protection rules для `main`:**

```
✅ Require pull request before merging
✅ Require 1 approval
✅ Require status checks to pass (check job)
✅ Require branches to be up to date
✅ Do not allow bypassing the above settings
ℹ️ На GitHub Free для private repo ця функція недоступна (потрібен public або Pro/Team)
```

---

## 6. TRAEFIK

### 6.1 Статична конфігурація — infra/traefik/traefik.yml

```yaml
# infra/traefik/traefik.yml
# Цей файл живе на сервері, не в Docker compose

api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ':80'
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true

  websecure:
    address: ':443'
    http:
      tls:
        certResolver: cf

certificatesResolvers:
  cf:
    acme:
      email: hello@workflo.space
      storage: /acme/acme.json # volume, зберігається на сервері
      httpChallenge:
        entryPoint: web

providers:
  docker:
    endpoint: 'unix:///var/run/docker.sock'
    exposedByDefault: false # ← важливо: сервіси НЕ відкриті без traefik.enable=true
    network: traefik_network

log:
  level: WARN

accessLog:
  filePath: /logs/access.log
  bufferingSize: 100
```

### 6.2 Запуск Traefik (docker-compose.traefik.yml на сервері)

```yaml
# /srv/traefik/docker-compose.yml
# Запускається ОДИН РАЗ на сервері, незалежно від workflo

services:
  traefik:
    image: traefik:v3.2
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
      - traefik_acme:/acme
      - traefik_logs:/logs
    networks:
      - traefik_network
    labels:
      - 'traefik.enable=true'
      # Dashboard доступний тільки локально через SSH tunnel
      - 'traefik.http.routers.traefik-dashboard.rule=Host(`traefik.internal`)'
      - 'traefik.http.routers.traefik-dashboard.service=api@internal'

volumes:
  traefik_acme:
  traefik_logs:

networks:
  traefik_network:
    external: true
    name: traefik_network
```

```bash
# Перший запуск на сервері:
docker network create traefik_network
cd /srv/traefik && docker compose up -d
```

### 6.3 IP Whitelist для workspace

```yaml
# У docker-compose.production.yml для workspace:
- 'traefik.http.middlewares.workflo-workspace-ipwhitelist.ipwhitelist.sourcerange=11.22.33.44/32,55.66.77.88/32'
# Перераховуєш статичні IP всіх членів команди
# При зміні IP — оновити змінну TEAM_IPS в GitHub Secrets + restart workspace
```

---

## 7. POSTGRESQL + pg_cron

### 7.1 Кастомний PostgreSQL image з pg_cron

```dockerfile
# infra/postgres/Dockerfile.postgres
FROM postgres:16-alpine

# pg_cron потребує окремої установки
RUN apk add --no-cache \
    build-base \
    clang15 \
    llvm15 \
    git \
    postgresql16-dev

RUN git clone https://github.com/citusdata/pg_cron.git /pg_cron \
    && cd /pg_cron \
    && make \
    && make install \
    && rm -rf /pg_cron
```

```
# У docker-compose.staging/production.yml, якщо PostgreSQL в Docker:
postgres:
  build:
    context: ./infra/postgres
    dockerfile: Dockerfile.postgres
  command: postgres -c shared_preload_libraries=pg_cron -c cron.database_name=workflo_production
```

**Альтернатива (простіше):** Встановити PostgreSQL напряму на сервері через apt, не в Docker. pg_cron тоді ставиться через `apt install postgresql-16-cron`. Для MVP це надійніше.

### 7.2 infra/postgres/init.sql

```sql
-- infra/postgres/init.sql
-- Виконується при першому запуску PostgreSQL контейнера

-- Встановлення pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Recurring charges: щомісяця 1-го числа о 00:01 UTC
-- (Prisma вже створить таблиці через migrate, cron task додається після)

-- ВИКОНАТИ ПІСЛЯ ПЕРШОЇ МІГРАЦІЇ:
-- SELECT cron.schedule(
--   'generate-monthly-charges',
--   '1 0 1 * *',
--   $$
--   INSERT INTO service_charges (id, company_id, service_id, amount, month, status, created_at)
--   SELECT
--     gen_random_uuid(),
--     cs.company_id,
--     cs.service_id,
--     cs.custom_price,
--     DATE_TRUNC('month', NOW()),
--     'pending',
--     NOW()
--   FROM company_services cs
--   WHERE cs.active = true
--   ON CONFLICT (company_id, service_id, month) DO NOTHING;
--   $$
-- );

-- Перевірка:
-- SELECT * FROM cron.job;
```

### 7.3 Два PostgreSQL інстанси (staging + production)

```bash
# На сервері — два окремих кластери PostgreSQL:
# PostgreSQL встановлений напряму (не Docker для надійності)

# Production:
DATABASE_URL=postgresql://workflo_prod:STRONG_PASS@localhost:5432/workflo_production

# Staging:
DATABASE_URL=postgresql://workflo_stg:ANOTHER_PASS@localhost:5433/workflo_staging

# Різні порти: 5432 (prod) і 5433 (staging)
# Або один PostgreSQL, різні databases і users
```

---

## 8. ENVIRONMENT VARIABLES

### 8.1 Повний список — .env.example

```bash
# .env.example
# Копіюйте в .env.local і заповнюйте. Ніколи не комітьте .env.local

# ═══════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════
DATABASE_URL=postgresql://user:password@localhost:5432/workflo_dev

# ═══════════════════════════════════════
# AUTH (API)
# ═══════════════════════════════════════
JWT_SECRET=               # мінімум 64 символи, random
JWT_REFRESH_SECRET=       # інший секрет для refresh токенів
JWT_EXPIRES_IN=15m        # access token TTL
JWT_REFRESH_EXPIRES_IN=30d

# ═══════════════════════════════════════
# EMAIL (Nodemailer → Mailpit dev / Mailcow prod)
# ═══════════════════════════════════════
SMTP_HOST=mailpit          # prod: mail.workflo.space
SMTP_PORT=1025             # prod: 587
SMTP_SECURE=false          # false і в dev і в prod (STARTTLS на 587)
SMTP_USER=                 # prod: noreply@workflo.space
SMTP_PASS=                 # prod: пароль скриньки
SMTP_FROM="workflo.space <noreply@workflo.space>"

# ═══════════════════════════════════════
# TELEGRAM
# ═══════════════════════════════════════
TELEGRAM_BOT_TOKEN=
TELEGRAM_DEPLOY_CHAT_ID=  # ID чату куди йдуть deploy notifications

# ═══════════════════════════════════════
# OPENAI (для AI-допомоги в блозі)
# ═══════════════════════════════════════
OPENAI_API_KEY=

# ═══════════════════════════════════════
# SENTRY
# ═══════════════════════════════════════
SENTRY_DSN=

# ═══════════════════════════════════════
# URLS (API використовує для CORS і email links)
# ═══════════════════════════════════════
FRONTEND_URL=http://localhost:3001   # prod: https://portal.workflo.space
WORKSPACE_URL=http://localhost:3002  # prod: https://work.workflo.space

# ═══════════════════════════════════════
# VITE (build-time, вбудовується в SPA bundle)
# ═══════════════════════════════════════
VITE_API_URL=http://localhost:4000   # prod: https://api.workflo.space
VITE_SENTRY_DSN=

# ═══════════════════════════════════════
# NEXT.JS (runtime env для landing)
# ═══════════════════════════════════════
NEXT_PUBLIC_API_URL=http://localhost:4000

# ═══════════════════════════════════════
# INFRASTRUCTURE
# ═══════════════════════════════════════
TEAM_IPS=                 # IP команди через кому: 11.22.33.44/32,55.66.77.88/32
```

### 8.2 Які змінні до яких apps

| Змінна              |  landing   | portal | workspace | api | bot |
| ------------------- | :--------: | :----: | :-------: | :-: | :-: |
| DATABASE_URL        |     —      |   —    |     —     | ✅  | ✅  |
| JWT_SECRET          |     —      |   —    |     —     | ✅  |  —  |
| SMTP\_\*            |     —      |   —    |     —     | ✅  |  —  |
| TELEGRAM_BOT_TOKEN  |     —      |   —    |     —     | ✅  | ✅  |
| OPENAI_API_KEY      |     —      |   —    |     —     | ✅  |  —  |
| SENTRY_DSN          |     ✅     | build  |   build   | ✅  | ✅  |
| VITE_API_URL        |     —      | build  |   build   |  —  |  —  |
| NEXT_PUBLIC_API_URL | ✅ runtime |   —    |     —     |  —  |  —  |

Frontend apps **не мають** DATABASE_URL. Ніколи.

---

## 9. SECRETS MANAGEMENT

### 9.1 GitHub Secrets (Settings → Secrets → Actions)

```
# Server access
HETZNER_HOST            IP адреса сервера
HETZNER_SSH_KEY         приватний SSH ключ (deploy user)

# Databases
DATABASE_URL_PROD       postgresql://...@localhost:5432/workflo_production
DATABASE_URL_STAGING    postgresql://...@localhost:5433/workflo_staging

# Auth
JWT_SECRET_PROD         64+ символи, random
JWT_SECRET_STAGING      64+ символи, інший
JWT_REFRESH_SECRET_PROD
JWT_REFRESH_SECRET_STAGING

# Email
SMTP_USER               noreply@workflo.space
SMTP_PASS

# Telegram
TELEGRAM_BOT_TOKEN
TELEGRAM_DEPLOY_CHAT_ID

# External services
OPENAI_API_KEY
SENTRY_DSN
```

### 9.2 Сервер — .env файли

```bash
# /var/www/srv/workflo/staging/.env  (chmod 600)
DATABASE_URL_STAGING=postgresql://workflo_stg:...@localhost:5433/workflo_staging
JWT_SECRET_STAGING=...
JWT_REFRESH_SECRET_STAGING=...

# EMAIL — Mailcow (той самий сервер для staging і prod)
SMTP_HOST=mail.workflo.space
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@workflo.space
SMTP_PASS=...
SMTP_FROM="workflo.space <noreply@workflo.space>"

TELEGRAM_BOT_TOKEN=...
SENTRY_DSN=...
TEAM_IPS=11.22.33.44/32,55.66.77.88/32
GITHUB_REPOSITORY_OWNER=yourname
```

```bash
# /var/www/srv/workflo/production/.env  (chmod 600)
DATABASE_URL_PROD=postgresql://workflo_prod:...@localhost:5432/workflo_production
JWT_SECRET_PROD=...
JWT_REFRESH_SECRET_PROD=...

# EMAIL — Mailcow
SMTP_HOST=mail.workflo.space
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@workflo.space
SMTP_PASS=...
SMTP_FROM="workflo.space <noreply@workflo.space>"

TELEGRAM_BOT_TOKEN=...
OPENAI_API_KEY=...
SENTRY_DSN=...
TEAM_IPS=11.22.33.44/32,55.66.77.88/32
GITHUB_REPOSITORY_OWNER=yourname
```

### 9.3 Deploy user на сервері

```bash
# Не deploy через root — окремий user з мінімальними правами
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

# SSH ключ для GitHub Actions:
# На локальній машині:
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/workflo_deploy

# Публічний ключ → сервер:
ssh-copy-id -i ~/.ssh/workflo_deploy.pub deploy@server-ip

# Приватний ключ → GitHub Secret HETZNER_SSH_KEY
```

---

## 10. МІГРАЦІЇ БД

### 10.1 Zero-downtime правила

**✅ Безпечні зміни (завжди):**

```sql
-- Додати nullable колонку
ALTER TABLE orders ADD COLUMN notes TEXT;

-- Додати колонку з DEFAULT
ALTER TABLE orders ADD COLUMN priority INTEGER DEFAULT 0;

-- Додати нову таблицю
CREATE TABLE referral_codes (...);

-- Додати index CONCURRENTLY (не блокує таблицю)
CREATE INDEX CONCURRENTLY idx_orders_company_id ON orders(company_id);
```

**⚠️ Небезпечні зміни (потребують окремого деплою):**

```sql
-- НЕ МОЖНА в одному деплої:
-- 1. Видалити колонку яку ще читає код
-- 2. Додати NOT NULL без DEFAULT (якщо таблиця не порожня)
-- 3. Змінити тип колонки

-- ПРАВИЛЬНА послідовність видалення колонки:
-- Крок 1 (Deploy 1): видалити з коду всі звернення до колонки
-- Крок 2 (Deploy 2): DROP COLUMN

-- ПРАВИЛЬНА послідовність переіменування:
-- Крок 1: додати нову колонку
-- Крок 2: код пише в обидві (backward compat)
-- Крок 3: міграція даних (backfill)
-- Крок 4: код читає тільки нову
-- Крок 5: DROP старої
```

### 10.2 Workflow нової міграції

```bash
# 1. Змінюєш packages/db/prisma/schema.prisma

# 2. Генеруєш файл міграції локально
pnpm --filter db prisma migrate dev --name describe_your_change
# Prisma створює packages/db/prisma/migrations/20260412_143000_describe_your_change/migration.sql

# 3. Перевіряєш SQL вручну в migration.sql
#    Переконайся що немає: DROP, ALTER TYPE, NOT NULL без DEFAULT

# 4. Комітиш
git add packages/db/prisma/migrations/
git add packages/db/prisma/schema.prisma
git commit -m "feat: add describe_your_change"

# 5. Push в dev → CI запускає prisma migrate deploy на staging автоматично
# 6. Перевіряєш staging
# 7. PR dev → main → ручне OK → CI робить backup → migrate → deploy prod
```

### 10.3 Prisma в Docker (важливий нюанс)

Prisma Client генерується під час `prisma generate` і прив'язаний до OS/arch. У Dockerfile:

```dockerfile
# В api/Dockerfile, в builder stage:
RUN pnpm --filter db prisma generate   # генерує для Linux (Docker)
```

Локально:

```bash
pnpm --filter db prisma generate       # генерує для macOS
```

Ці бінарники різні — тому в `.dockerignore` має бути `node_modules` (перегенерується в контейнері).

---

## 11. BACKUP & RECOVERY

> **⚠️ AS-BUILT (S5.5 AR-51, 11.06.2026) — канон тепер у коді, не в листингах нижче:**
>
> - Канонічний скрипт — **`scripts/backup.sh`** (репо): pg_dump через docker/direct,
>   sanity-check розміру дампа, Telegram-алерти, **offsite-обвʼязка** (restic →
>   Hetzner Storage Box або rclone; env-gated: `RESTIC_REPOSITORY`+`RESTIC_PASSWORD`
>   або `RCLONE_REMOTE`). Без offsite-env скрипт ГОЛОСНО попереджає в лог+Telegram —
>   локальний дамп на диску БД ≠ бекап.
> - Cron інсталюється **автоматизацією**, не `crontab -e`: `sudo bash
scripts/install-backup-cron.sh` → `/etc/cron.d/workflo-backup` (щодня 03:00).
> - Pre-migrate бекап у деплої тепер **blocking** (AR-03): міграція не їде без
>   перевіреного дампа (staging + production workflows).
> - **Offsite-тест відкладено** (рішення власника 11.06): сховища ще нема; після
>   появи Storage Box — заповнити env, ганяти `backup.sh` вручну, зробити
>   restore-drill за §11.2. До того моменту RPO фактично 24h-local-only.
> - Listing нижче — історичний (квітень); розбіжності → код канон.

### 11.1 infra/scripts/backup.sh

```bash
#!/bin/bash
# infra/scripts/backup.sh
# Запускається cron на сервері щодня о 3:00

set -e

BACKUP_DIR=/var/www/srv/workflo/production/backups
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE=$BACKUP_DIR/$DATE.sql.gz
LOG_FILE=$BACKUP_DIR/backup.log

# Завантажити env (DATABASE_URL_PROD)
source /var/www/srv/workflo/production/.env

echo "[$(date)] Starting backup..." >> $LOG_FILE

# pg_dump → gzip → файл
pg_dump "$DATABASE_URL_PROD" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup OK: $BACKUP_FILE ($SIZE)" >> $LOG_FILE

  # Telegram notification
  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d chat_id="$TELEGRAM_DEPLOY_CHAT_ID" \
    -d text="💾 Daily backup OK: $DATE ($SIZE)"
else
  echo "[$(date)] Backup FAILED" >> $LOG_FILE
  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d chat_id="$TELEGRAM_DEPLOY_CHAT_ID" \
    -d text="🚨 Daily backup FAILED: $DATE"
fi

# Видалити бекапи старіші 14 днів
find $BACKUP_DIR -name "*.sql.gz" -mtime +14 -delete

echo "[$(date)] Old backups cleaned" >> $LOG_FILE
```

```bash
# Cron на сервері:
crontab -e
# Додати:
0 3 * * * /var/www/srv/workflo/infra/scripts/backup.sh
```

### 11.2 Відновлення з бекапу

```bash
# ТЕСТ ВІДНОВЛЕННЯ (щомісяця):
# 1. Знайти останній бекап
ls -lh /var/www/srv/workflo/production/backups/ | tail -5

# 2. Відновити в тестову БД
createdb workflo_test
gunzip -c /var/www/srv/workflo/production/backups/2026-04-12_03-00.sql.gz | psql workflo_test

# 3. Перевірити що дані є
psql workflo_test -c "SELECT COUNT(*) FROM orders;"
psql workflo_test -c "SELECT COUNT(*) FROM companies;"

# 4. Дропнути тестову БД
dropdb workflo_test

# ВІДНОВЛЕННЯ В PRODUCTION (екстрений випадок):
# Тільки після зупинки всіх сервісів!
docker compose -f docker-compose.production.yml stop
gunzip -c /var/www/srv/workflo/production/backups/BACKUP_FILE.sql.gz | psql workflo_production
docker compose -f docker-compose.production.yml up -d
```

---

## 12. ROLLBACK

### 12.1 infra/scripts/rollback.sh

```bash
#!/bin/bash
# infra/scripts/rollback.sh
# Використовується вручну або автоматично з CI

set -e

PROD_DIR=/var/www/srv/workflo/production
source $PROD_DIR/.env

CURRENT_TAG=$(cat $PROD_DIR/.last_deploy 2>/dev/null || echo "none")
PREV_TAG=$(cat $PROD_DIR/.previous_deploy 2>/dev/null || echo "none")

if [ "$PREV_TAG" = "none" ]; then
  echo "❌ No previous deploy found. Cannot rollback."
  exit 1
fi

echo "🔄 Rolling back from $CURRENT_TAG to $PREV_TAG"

export LANDING_TAG=$PREV_TAG
export PORTAL_TAG=$PREV_TAG
export WORKSPACE_TAG=$PREV_TAG
export API_TAG=$PREV_TAG
export BOT_TAG=$PREV_TAG

cd $PROD_DIR
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d

echo "$CURRENT_TAG" > $PROD_DIR/.previous_deploy
echo "$PREV_TAG" > $PROD_DIR/.last_deploy

echo "✅ Rollback complete to $PREV_TAG"
```

### 12.2 Rollback по конкретному SHA

```bash
# Якщо треба відкотитись не на попередній а на конкретний:
cd /var/www/srv/workflo/production

export LANDING_TAG=sha-a1b2c3
export PORTAL_TAG=sha-a1b2c3
export WORKSPACE_TAG=sha-a1b2c3
export API_TAG=sha-a1b2c3
export BOT_TAG=sha-a1b2c3

docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d

# Перевірити
curl https://api.workflo.space/health
```

### 12.3 Rollback DB міграції

```bash
# Prisma не має вбудованого rollback міграцій.
# Варіант 1 (preferred): відновити з pre-deploy backup
gunzip -c backups/pre-deploy_2026-04-12_14-30.sql.gz | psql workflo_production

# Варіант 2 (якщо міграція була тільки additive):
# Написати нову міграцію яка відміняє зміни
# (DROP нових таблиць, DROP нових колонок)

# Тому правило: тільки additive зміни в MVP.
# Тоді rollback DB ніколи не потрібен.
```

---

## 13. МОНІТОРИНГ

### 13.1 Sentry — налаштування

```typescript
// apps/api/src/server.ts
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% запитів трейсяться
})

// apps/landing/src/app/layout.tsx
import * as Sentry from '@sentry/nextjs'
// sentry.client.config.ts, sentry.server.config.ts — стандартна ініціалізація
```

**Alerts в Sentry:**

- New issue → email + Telegram
- Error rate > 10/min → email + Telegram
- Performance > 3s p95 → email

### 13.2 UptimeRobot

```
Моніторить кожні 5 хвилин:
- https://workflo.space                    (HTTP 200)
- https://portal.workflo.space/health         (HTTP 200)
- https://api.workflo.space/health         (HTTP 200)

Алерт: Telegram notification при downtime > 2 хв
```

**API /health endpoint:**

```typescript
// apps/api/src/routes/health.ts
fastify.get('/health', async (req, reply) => {
  return reply.send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

fastify.get('/ready', async (req, reply) => {
  // Readiness перевіряє БД і повертає 200/503
})
```

Примітка: для прод runtime API використовує Debian + OpenSSL 3, а Prisma Client генерується з `binaryTargets = ["native", "debian-openssl-3.0.x"]`.

### 13.3 Netdata (CPU/RAM/Disk сервера)

```bash
# Встановлення на сервері (1 команда):
wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh
sh /tmp/netdata-kickstart.sh --stable-channel

# Dashboard: http://server-ip:19999 (закрий firewall, доступ через SSH tunnel)
# ssh -L 19999:localhost:19999 deploy@server-ip

# Alerts по замовчуванню:
# - RAM > 85% → email
# - Disk > 85% → email
# - CPU > 90% (sustained) → email
```

### 13.4 Disk space моніторинг

```bash
# Додати в cron:
# crontab -e
0 */6 * * * df -h / | awk 'NR==2{if(+$5 > 80) print "DISK WARNING: "$5" used"}' | \
  xargs -I{} curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
  -d chat_id="$CHAT_ID" -d text="{}"
```

---

## 14. ЛОКАЛЬНА РОЗРОБКА

### 14.1 Перший запуск

```bash
# 1. Клонуєш репо
git clone git@github.com:yourname/workflo.git
cd workflo

# 2. Встановлюєш залежності
pnpm install

# 3. Копіюєш env
cp .env.example .env.local
# Заповнюєш DATABASE_URL та інші (мінімум DATABASE_URL для старту)

# 4. Запускаєш інфраструктуру (postgres + mailpit)
docker compose -f docker-compose.dev.yml up -d

# 5. Застосовуєш міграції
pnpm --filter db prisma migrate dev

# 6. Seed тестовими даними
pnpm --filter db prisma db seed

# 7. Запускаєш apps (все разом через Turborepo)
turbo dev

# Або окремо:
pnpm --filter landing dev       # http://localhost:3000
pnpm --filter portal dev        # http://localhost:3001
pnpm --filter workspace dev     # http://localhost:3002
pnpm --filter api dev           # http://localhost:4000
pnpm --filter bot dev           # polling mode
```

### 14.2 Turborepo конфігурація — turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 14.3 pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 14.4 Hot reload для shared packages

```json
// packages/ui/package.json
{
  "name": "@workflo/ui",
  "main": "./src/index.ts", // ← src, не dist
  "types": "./src/index.ts"
}
```

Vite і Next.js підхоплюють TypeScript-джерела напряму через tsconfig paths. Зміна в `packages/ui` → миттєвий hot reload в portal/workspace без rebuild.

### 14.5 Seed файл

```typescript
// packages/db/prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Owner profile
  const owner = await prisma.profile.upsert({
    where: { email: 'owner@workflo.space' },
    update: {},
    create: {
      email: 'owner@workflo.space',
      name: 'Власник',
      role: 'owner',
      passwordHash: '...', // bcrypt hash of "password123"
    },
  })

  // Тестова компанія
  const company = await prisma.company.upsert({
    where: { slug: 'test-company' },
    update: {},
    create: {
      name: 'Test Company LLC',
      slug: 'test-company',
      ownerId: owner.id,
    },
  })

  // Тестове замовлення
  await prisma.order.create({
    data: {
      title: 'Тестове замовлення',
      companyId: company.id,
      type: 'client_order',
      internalStatus: 'new',
      clientStatus: 'in_progress',
      billingType: 'fixed',
      fixedPrice: 500,
    },
  })

  console.log('Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

```json
// packages/db/package.json
{
  "prisma": {
    "seed": "ts-node --transpile-only prisma/seed.ts"
  }
}
```

### 14.6 Mailpit — перевірка emails локально

```
http://localhost:8025

Всі листи які відправляє Nodemailer через SMTP localhost:1025
з'являються тут. Не потрібен реальний SMTP для розробки.
```

---

## 15. MAILCOW — ПОШТОВИЙ СЕРВЕР

> Статус: ✅ ПОВНІСТЮ НАЛАШТОВАНО (16 квітня 2026) | ✅ mail-tester.com: 10/10

### 15.1 Архітектура

```
Internet
  │
  ├─ :80, :443 ──→ Traefik ──→ mail.workflo.space (webui + SOGo)
  │                               └─ nginx-mailcow:8443 (HTTPS backend)
  │                                    insecureSkipVerify=true (self-signed → Traefik cert)
  │
  ├─ :25  ──────────────────────→ Mailcow postfix (⏳ Hetzner тікет)
  ├─ :587 ──────────────────────→ Mailcow postfix STARTTLS (✅ працює)
  ├─ :465 ──────────────────────→ Mailcow postfix SMTPS
  ├─ :143 ──────────────────────→ Mailcow dovecot IMAP
  └─ :993 ──────────────────────→ Mailcow dovecot IMAPS

TLS:
  Traefik (CF DNS challenge) → acme.json
    └─→ traefik-certs-dumper → /var/www/mail/data/assets/ssl/mail.workflo.space/
         └─→ sync-mailcow-certs.sh (cron) → cert.pem / key.pem + postfix/dovecot reload
```

**Ключові рішення:**

- `SKIP_LETS_ENCRYPT=y` — Mailcow не отримує власний ACME-сертифікат
- Traefik проксує на **HTTPS** порт 8443 (не HTTP 8880), бо Mailcow nginx завжди редіректить HTTP → HTTPS
- `insecureSkipVerify=true` в Traefik serversTransport — дозволяє Traefik підключатися до Mailcow nginx за HTTPS без валідації самопідписаного сертифіката бекенду
- `traefik-certs-dumper --clean=false` — критично, щоб не видалити `dhparams.pem`

### 15.2 Фактичні шляхи на сервері

```
/var/www/mail/                          ← Mailcow root (git clone)
/var/www/mail/mailcow.conf              ← основна конфігурація
/var/www/mail/docker-compose.override.yml
/var/www/mail/data/assets/ssl/          ← SSL директорія
/var/www/mail/data/assets/ssl/cert.pem  ← активний сертифікат
/var/www/mail/data/assets/ssl/key.pem   ← активний ключ
/var/www/mail/data/assets/ssl/dhparams.pem  ← DH параметри (потрібні Dovecot!)
/var/www/mail/data/assets/ssl/mail.workflo.space/
    cert.crt  ← certs-dumper кладе сюди
    key.key   ← certs-dumper кладе сюди
/var/www/mail/sync-mailcow-certs.sh     ← скрипт синхронізації

/var/www/proxy/traefik/                 ← Traefik root
/var/www/proxy/traefik/dynamic/mailcow.yml  ← serversTransport конфіг
```

**Docker network:** `proxy` (не `traefik_network` — так налаштований Traefik на цьому сервері)

### 15.3 Встановлення

```bash
# 1. Клонувати Mailcow
cd /var/www
git clone https://github.com/mailcow/mailcow-dockerized mail
cd /var/www/mail

# 2. ВАЖЛИВО: перед generate_config.sh створити daemon.json (потрібно для IPv6-питання)
echo '{"ipv6": true}' > /etc/docker/daemon.json

# 3. Запустити конфігуратор
./generate_config.sh
# MAILCOW_HOSTNAME: mail.workflo.space
# Timezone: Europe/Kyiv
# Enable IPv6: Y
```

### 15.4 /var/www/mail/mailcow.conf — ключові параметри

```ini
MAILCOW_HOSTNAME=mail.workflo.space
HTTP_PORT=8880
HTTPS_PORT=8443
TZ=Europe/Kyiv
SKIP_LETS_ENCRYPT=y          # Traefik керує сертифікатами
SKIP_CLAMD=y                 # ~1GB RAM економія; увімкнути пізніше якщо треба
ENABLE_IPV6=true
IPV4_NETWORK=172.26.1        # ЗМІНЕНО з 172.22.1 — конфлікт з іншим проектом на сервері!
```

> **Чому IPV4_NETWORK=172.26.1:** На сервері вже існував контейнер з мережею `172.22.0.0/16`.
> Mailcow за замовчуванням теж хоче `172.22.x` → конфлікт при `docker compose up`.
> Вирішення: змінити `IPV4_NETWORK` в `mailcow.conf` **до першого запуску**.

### 15.5 /var/www/mail/docker-compose.override.yml

```yaml
services:
  nginx-mailcow:
    networks:
      - proxy
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.mailcow.rule=Host(`mail.workflo.space`)'
      - 'traefik.http.routers.mailcow.entrypoints=websecure'
      - 'traefik.http.routers.mailcow.tls.certresolver=cf'
      # HTTPS backend (8443), не HTTP (8880) — бо nginx завжди редіректить 8880 → 8443
      - 'traefik.http.services.mailcow.loadbalancer.server.port=8443'
      - 'traefik.http.services.mailcow.loadbalancer.server.scheme=https'
      - 'traefik.http.services.mailcow.loadbalancer.serversTransport=mailcow-transport@file'
      - 'traefik.docker.network=proxy'

networks:
  proxy:
    external: true
```

### 15.6 /var/www/proxy/traefik/dynamic/mailcow.yml

```yaml
http:
  serversTransports:
    mailcow-transport:
      insecureSkipVerify: true # Mailcow nginx має self-signed cert на бекенді
```

> Цей файл підхоплюється Traefik автоматично через `providers.file` (директорія `dynamic/`).
> Без `insecureSkipVerify` Traefik відмовляє з'єднання через невалідний сертифікат бекенду.

### 15.7 traefik-certs-dumper (в /var/www/proxy/traefik/docker-compose.yml)

```yaml
certs-dumper:
  image: ldez/traefik-certs-dumper:v2.8.3
  container_name: certs-dumper
  restart: unless-stopped
  entrypoint: sh -c "traefik-certs-dumper file --version v2 --watch --clean=false --source /acme/acme.json --dest /output --domain-subdir --crt-name cert --key-name key"
  volumes:
    - ./acme/acme.json:/acme/acme.json:ro
    - /var/www/mail/data/assets/ssl:/output
```

**Критичні прапори:**

- `--clean=false` — без цього certs-dumper **видалить** `dhparams.pem` і `cert.pem/key.pem` при запуску
- `--domain-subdir` — створює піддиректорію `mail.workflo.space/`
- `--crt-name cert --key-name key` — файли будуть `cert.crt` і `key.key` (не `.pem`!)

### 15.8 /var/www/mail/sync-mailcow-certs.sh

```bash
#!/bin/bash
# Копіює cert.crt/key.key → cert.pem/key.pem і перезавантажує postfix+dovecot
DOMAIN="mail.workflo.space"
SRC_DIR="/var/www/mail/data/assets/ssl/$DOMAIN"
SSL_DIR="/var/www/mail/data/assets/ssl"

if [ ! -f "$SRC_DIR/cert.crt" ] || [ ! -f "$SRC_DIR/key.key" ]; then
    exit 0
fi

if [ "$SRC_DIR/cert.crt" -nt "$SSL_DIR/cert.pem" ]; then
    cp "$SRC_DIR/cert.crt" "$SSL_DIR/cert.pem"
    cp "$SRC_DIR/key.key"  "$SSL_DIR/key.pem"
    cd /var/www/mail
    docker compose exec -T postfix-mailcow postfix reload
    docker compose exec -T dovecot-mailcow dovecot reload
    echo "[$(date)] Mailcow certs synced and reloaded"
fi
```

```bash
chmod +x /var/www/mail/sync-mailcow-certs.sh

# Cron (crontab -e):
30 3 * * * /var/www/mail/sync-mailcow-certs.sh >> /var/log/mailcow-certs.log 2>&1
```

### 15.9 DH параметри (обов'язково перед запуском!)

Dovecot вимагає `dhparams.pem`. Без нього Dovecot падає з:
`ssl_dh: Can't open file /etc/ssl/mail/dhparams.pem`

```bash
openssl dhparam -out /var/www/mail/data/assets/ssl/dhparams.pem 2048
# Займає ~1-2 хвилини
```

### 15.10 Запуск Mailcow

```bash
cd /var/www/mail

# Pull образів (~2-3 GB)
docker compose pull

# Запуск
docker compose up -d

# Перевірка
docker compose ps
# Всі контейнери мають бути Up (healthy)

# Перевірити webui
curl -I https://mail.workflo.space
# → HTTP/2 200
```

### 15.11 DNS записи (всі налаштовані ✅)

```
Type   Name                     Content                                    Notes
──────────────────────────────────────────────────────────────────────────────────
A      mail                     49.12.219.133                              DNS only (не Proxied!)
MX     @                        mail.workflo.space (Priority 10)
PTR    49.12.219.133            mail.workflo.space                         Hetzner Console
TXT    @                        v=spf1 mx a:mail.workflo.space ~all
TXT    dkim._domainkey          v=DKIM1; k=rsa; p=<2048-bit ключ>         З Mailcow Admin UI
TXT    _dmarc                   v=DMARC1; p=none; rua=mailto:hello@workflo.space; fo=1
TXT    _mta-sts                 v=STSv1; id=<timestamp>
TXT    _smtp._tls               v=TLSRPTv1; rua=mailto:hello@workflo.space
CNAME  mta-sts                  mail.workflo.space
```

DKIM: Mailcow Admin → Configuration → ARC/DKIM keys → Add domain `workflo.space`, 2048 bit → скопіювати публічний ключ в Cloudflare

### 15.12 Mailcow Admin UI налаштування

```
URL:      https://mail.workflo.space
Login:    admin / <змінений пароль>

Після першого входу:
1. Configuration → Mail Setup → Domains → Add: workflo.space
2. Configuration → ARC/DKIM keys → Add (workflo.space, 2048 bit) → скопіювати в DNS
3. E-Mail → Mailboxes → Add:
   - noreply@workflo.space  (для Nodemailer/API)
   - hello@workflo.space
   - support@workflo.space
4. Configuration → Spam Filter → налаштувати за потреби
```

### 15.13 SOGo Webmail

```
URL: https://mail.workflo.space/SOGo/
Login: email@workflo.space + пароль mailbox

⚠️ Якщо після логіну перекидає на адмін-панель:
   Відкрити в режимі інкогніто (конфлікт session cookie між /SOGo/ та /admin/)
   або очистити cookies для mail.workflo.space
```

### 15.14 SMTP credentials для API

```bash
# /var/www/srv/workflo/production/.env і GitHub Secrets
SMTP_HOST=mail.workflo.space
SMTP_PORT=587
SMTP_SECURE=false      # false = STARTTLS (не SSL from start)
SMTP_USER=noreply@workflo.space
SMTP_PASS=<пароль скриньки noreply>
SMTP_FROM="workflo.space <noreply@workflo.space>"
```

### 15.15 Тест SMTP

```bash
# Тест порту 587 (STARTTLS):
swaks --to test@example.com \
      --from noreply@workflo.space \
      --server mail.workflo.space \
      --port 587 \
      --tls \
      --auth LOGIN \
      --auth-user noreply@workflo.space \
      --auth-password '<пароль>'
# Очікується: 250 2.0.0 Ok: queued as XXXXXXXX

# Тест mail-tester.com (після розблокування порту 25):
# 1. Перейти на mail-tester.com → отримати одноразовий email
# 2. Надіслати лист через swaks або SOGo
# 3. Перевірити рейтинг (ціль: 9+/10)
```

### 15.16 Статус порту 25

✅ Hetzner розблокував вихідний порт 25 (16 квітня 2026).
✅ mail-tester.com: **10/10** — SPF, DKIM, DMARC, SpamAssassin, Blacklist — всі зелені.

```bash
# Перевірити чергу (якщо є накопичені листи):
docker compose exec postfix-mailcow mailq

# Примусово відправити чергу:
docker compose exec postfix-mailcow postqueue -f
```

### 15.17 Відомі проблеми та рішення

| Проблема                                                | Причина                                                 | Рішення                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `generate_config.sh` виходить при питанні IPv6          | Відсутній `/etc/docker/daemon.json`                     | `echo '{"ipv6": true}' > /etc/docker/daemon.json` перед запуском             |
| Docker network conflict `172.22.x`                      | Інший проект на сервері використовує ту ж підмережу     | `IPV4_NETWORK=172.26.1` в `mailcow.conf`                                     |
| Traefik → Mailcow 301 redirect loop                     | Mailcow nginx завжди редіректить HTTP(8880)→HTTPS(8443) | Traefik має роутити на порт **8443** з `scheme=https` + `insecureSkipVerify` |
| Dovecot падає: `Can't open file dhparams.pem`           | Файл не існує після свіжого клону                       | `openssl dhparam -out .../ssl/dhparams.pem 2048`                             |
| `certs-dumper` видаляє `dhparams.pem` та `cert.pem`     | Прапор `--clean=true` за замовчуванням                  | Обов'язково `--clean=false`                                                  |
| `certs-dumper` створює `cert.crt`/`key.key` а не `.pem` | Прапори `--crt-name cert --key-name key`                | Sync-скрипт копіює `.crt`→`.pem` і `.key`→`.pem`                             |
| SOGo відкриває адмін-панель замість webmail             | Сесійний cookie від `/admin/` перекриває `/SOGo/`       | Відкривати SOGo в інкогніто або очистити cookies                             |

---

## 16. DAY-1 CHECKLIST

### GitHub репозиторій

```
✅ Створити GitHub репозиторій (private)
✅ Додати .gitignore (node_modules, .env*, .next, dist, .turbo)
✅ Branch protection → main:
  ✅ Require PR before merge
  ✅ Require 1 approval
  ✅ Require status checks (check job)
  ✅ Do not allow bypassing
✅ GitHub Environments → "production" + required reviewer
✅ GITHUB_TOKEN права на ghcr.io (Read and write)

GitHub Secrets — стан:
  ✅ HETZNER_HOST
  ✅ HETZNER_SSH_KEY
  ✅ HETZNER_SSH_USER
  ✅ DATABASE_URL_PROD
  ✅ DATABASE_URL_STAGING
  □ GITHUB_REPOSITORY_OWNER   ← додати (твій GitHub username lowercase)
  □ TEAM_IPS                  ← додати (curl ifconfig.me → <ip>/32)
  □ TELEGRAM_DEPLOY_BOT_TOKEN ← коли буде бот
  □ TELEGRAM_DEPLOY_CHAT_ID   ← коли буде бот
  □ SENTRY_DSN                ← коли зареєструєш на sentry.io
```

### Сервер Hetzner

```
✅ Deploy user створено + SSH key
✅ Docker + Docker Compose встановлено
✅ UFW firewall налаштовано (22, 80, 443, 25, 465, 587, 143, 993)
✅ PostgreSQL 16 (dockerized) + pg_cron
✅ Структура директорій /var/www/srv/workflo/
✅ staging/.env та production/.env заповнені (SMTP + DB + JWT)
```

### Traefik

```
✅ Traefik запущено (/var/www/proxy/)
✅ Docker network "proxy" створено
✅ Cloudflare DNS challenge (certresolver=cf)
✅ dynamic/ провайдер для Mailcow serversTransport
```

### DNS (Cloudflare)

```
✅ workflo.space          A    49.12.219.133
✅ www.workflo.space      A    49.12.219.133
✅ portal.workflo.space   A    49.12.219.133
✅ work.workflo.space     A    49.12.219.133
✅ api.workflo.space      A    49.12.219.133
✅ dev.workflo.space      A    49.12.219.133
✅ dev-portal.workflo.space  A  49.12.219.133
✅ dev-work.workflo.space A    49.12.219.133
✅ dev-api.workflo.space  A    49.12.219.133
✅ mail.workflo.space     A    49.12.219.133  (DNS only, не Proxied)
✅ MX workflo.space → mail.workflo.space (Priority 10)
```

### Mailcow

```
✅ DNS: A mail.workflo.space → 49.12.219.133 (DNS only, не Proxied)
✅ DNS: MX workflo.space → mail.workflo.space (Priority 10)
✅ PTR: 49.12.219.133 → mail.workflo.space (Hetzner Console)
✅ UFW: порти 25, 465, 587, 143, 993, 995 відкриті
✅ Cloudflare API Token для Traefik DNS challenge
✅ Traefik: dnsChallenge + CF token
✅ Встановлено Mailcow: git clone → /var/www/mail/
✅ mailcow.conf: HTTP_PORT=8880, HTTPS_PORT=8443, SKIP_LETS_ENCRYPT=y, IPV4_NETWORK=172.26.1
✅ docker-compose.override.yml: Traefik labels (HTTPS бекенд 8443 + insecureSkipVerify)
✅ /var/www/proxy/traefik/dynamic/mailcow.yml: serversTransport insecureSkipVerify
✅ traefik-certs-dumper: додано в Traefik compose (--clean=false!)
✅ dhparams.pem: згенеровано (openssl dhparam 2048)
✅ sync-mailcow-certs.sh: створено + cron 3:30
✅ docker compose up -d: всі контейнери запущені та здорові
✅ https://mail.workflo.space: webui доступний (200 OK)
✅ Пароль admin: змінено
✅ Домен workflo.space: додано в Mailcow
✅ DKIM: 2048-bit ключ згенеровано
✅ DNS TXT dkim._domainkey: налаштовано в Cloudflare
✅ DNS TXT SPF: v=spf1 mx a:mail.workflo.space ~all
✅ DNS TXT DMARC: v=DMARC1; p=none; rua=mailto:hello@workflo.space; fo=1
✅ DNS MTA-STS + TLS-RPT: налаштовано
✅ SMTP порт 587 (STARTTLS): перевірено через swaks — TLS v1.3, auth OK, 250 queued
✅ Поштові скриньки створено:
    noreply@workflo.space  (для Nodemailer/API)
    hello@workflo.space
    support@workflo.space
✅ SOGo Webmail: доступний на https://mail.workflo.space/SOGo/
✅ Hetzner port 25: розблоковано
✅ mail-tester.com: 10/10 (SPF ✅ DKIM ✅ DMARC ✅ SpamAssassin ✅ Blacklist ✅)
✅ SMTP credentials → /var/www/srv/workflo/staging/.env
✅ SMTP credentials → /var/www/srv/workflo/production/.env
□ SMTP credentials → GitHub Secrets (не потрібні для CI, тільки якщо є потреба)
```

### Перший деплой

```
✅ Push початкового коду в dev гілку
✅ CI/CD запускається — GitHub Actions green
✅ Docker образи в ghcr.io
✅ Deploy на staging
✅ https://dev.workflo.space — landing
✅ https://dev-portal.workflo.space — portal
✅ https://dev-api.workflo.space/health — api
✅ SSL сертифікати (Cloudflare DNS challenge)
□ PR dev → main → production deploy (після S1)
□ Перевірити production після першого prod-деплою:
  □ https://workflo.space
  □ https://portal.workflo.space
  □ https://api.workflo.space/health
  □ https://work.workflo.space — тільки з TEAM_IPS
□ Backup cron:
  0 3 * * * /var/www/srv/workflo/infra/scripts/backup.sh
□ pg_cron task для recurring charges (SQL з init.sql)
□ UptimeRobot (4 monitors)
□ Sentry projects (5: landing, portal, workspace, api, bot)
□ Netdata: wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh && sh /tmp/netdata-kickstart.sh
□ Тег першого релізу після production deploy:
  git tag -a v0.1.0 -m "Infrastructure ready" && git push origin v0.1.0
```

### Security перевірка

```
□ work.workflo.space недоступний з чужого IP → перевірити через VPN/proxy
□ PostgreSQL не доступний з зовні → nc -zv server-ip 5432 має timeout
□ .env файли не в git → git log --all --full-history -- "**/.env"
□ CORS в API дозволяє тільки потрібні домени
□ JWT секрети мінімум 64 символи
□ rate limiting на auth endpoints (login, register, reset password)
□ HTTPS only (HTTP → redirect)
```

---

## CI/CD & DevOps — аудит і стандартизація (2026-06-22)

### Канонічна серверна розкладка (єдине джерело істини)

| Шлях                              | Що це                                                                                | Ким керується                                     |
| --------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `/var/www/srv/workflo/staging`    | Рантайм staging: `docker-compose.staging.yml` + `.env` + `backups/` + `.last_deploy` | `staging.yml` (push у `dev`)                      |
| `/var/www/srv/workflo/production` | Рантайм production (analog)                                                          | `production.yml` (push у `main`, manual approval) |
| `/var/www/mail/`                  | Mailcow (пошта)                                                                      | окремо                                            |
| `/var/www/proxy/`                 | Traefik (reverse-proxy, network `proxy`/`traefik_network`)                           | окремо                                            |

> ⚠️ **`/var/www/projects/workflo_space` — НЕ канон.** Жоден workflow на нього не посилається (перевірено
> grep'ом). Це ручний клон джерела, який пайплайн **не використовує**. Прибрати (підтвердивши, що нічого
> вручну звідти не запускається): `rm -rf /var/www/projects/workflo_space`. Усі рантайм-операції — лише в
> `srv/workflo/{staging,production}`.

### Деплой = тільки збірка образів + перестворення контейнерів

`staging.yml`/`production.yml` SCP-лять compose+infra у рантайм-теку і роблять `compose up -d --wait` з
**новими sha-тегами** — контейнери перестворюються автоматично. Якщо UI «старий» після успішного деплою —
це **кеш браузера**, а не контейнер (див. нижче). Перевірка свіжості: `curl -ksI https://<host>/ | grep -i etag`.

### SPA-кеш (фікс «задеплоїв, а UI старий»)

`apps/{portal,workspace}/nginx.conf`:

- `index.html` → `Cache-Control: no-cache, must-revalidate` (завжди ревалідація → новий деплой одразу видно).
- `/assets/*` (контент-хешовані) → `public, max-age=31536000, immutable`.

Без цього `index.html` кешувався евристично і віддавав старі хеші ассетів → старий UI попри свіжий деплой.

### Manual ops тепер працюють без `export *_TAG`

Деплой **персистить резолвнуті теги у серверний `.env`** (`*_TAG=sha-…`). Тож на сервері просто:

```bash
cd /var/www/srv/workflo/staging
docker compose --project-name workflo-staging --env-file .env -f docker-compose.staging.yml run --rm api pnpm --filter @workflo/db seed     # ручний seed
docker compose ... up -d --force-recreate workspace                                                                                        # перестворити сервіс
```

Раніше fallback `${API_TAG:-sha-initial}` падав із `sha-initial: not found`.

### Авто-seed staging (ідемпотентний)

`staging.yml` після міграцій робить `compose run --rm api pnpm --filter @workflo/db run seed` —
seed count-guarded (тільки заповнює прогалини, не дублює/не перезаписує). На **production seed НЕ виконується**.

### Rollback-дрил (app)

Образи зберігаються (retention 5). Відкат застосунку на попередній sha:

```bash
cd /var/www/srv/workflo/{staging|production}
export TAG=$(cat .previous_deploy)   # production веде .previous_deploy; staging — попередній sha вручну
export API_TAG=$TAG PORTAL_TAG=$TAG WORKSPACE_TAG=$TAG LANDING_TAG=$TAG BOT_TAG=$TAG
docker compose --project-name workflo-{staging|production} --env-file .env -f docker-compose.{staging|production}.yml up -d --wait
```

Відкат **БД** = restore з `backups/pre-migrate-*.sql.gz` (Prisma не має down-міграцій). `scripts/rollback.sh`.

### Роадмеп покращень (ще НЕ зроблено)

- **Post-deploy frontend smoke (Playwright):** гейт type/lint/test не ловить «виглядає не так» (фронт-тестів
  нема). Додати headless-прохід ключових сторінок + 0 console-errors + базовий рендер після деплою. **Найвищий
  важіль** — закриває весь клас conformance-регресій без ручного огляду.
- **Sentry + uptime-монітор:** `SENTRY_DSN` зараз порожній; увімкнути error-tracking + зовнішній uptime (S7–S8).
- **PR-флоу:** §1 принципів каже «в `main` тільки PR», але фактично — direct-push; гейти продубльовано в
  deploy-воркфлоу (працює). Або перейти на PR (гейт до merge), або оновити §1 під фактичний direct-push.
- **Doc-drift:** §1 «нічого не пушиться напряму, тільки PR» розходиться з реальним процесом — синхронізувати.
