# AR-50 (audit 2026-06-11): manifests-first layering — `COPY . .` before install
# invalidated the dependency layer on EVERY commit, defeating the gha cache.
# Now source edits reuse the cached pnpm-install layer.
#
# Conscious deferral (documented): the runtime still carries devDependencies and
# workspace sources — the compose `migrate` service runs `prisma migrate deploy`
# from THIS image and the prisma CLI is a devDep of @workflo/db. A true prod-prune
# needs a dedicated migrate stage/image first (BACKLOG: AR-50b; trigger — image
# size/pull time starts to hurt).
FROM node:20-bookworm-slim
WORKDIR /app

# openssl/ca-certs for prisma+TLS; chromium + fonts for the documents PDF engine (06, S6-D2).
# `chromium` pulls its own shared-lib deps via apt; fonts-dejavu carries Cyrillic glyphs so
# Ukrainian invoices render. puppeteer-core launches this binary via PUPPETEER_EXECUTABLE_PATH.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openssl ca-certificates \
        chromium fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# 1. Dependency layer: lockfile + workspace manifests only (no sources).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/bot/package.json apps/bot/
COPY apps/landing/package.json apps/landing/
COPY apps/portal/package.json apps/portal/
COPY apps/workspace/package.json apps/workspace/
COPY packages/app-core/package.json packages/app-core/
COPY packages/db/package.json packages/db/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/i18n/package.json packages/i18n/
COPY packages/notifications/package.json packages/notifications/
COPY packages/payments/package.json packages/payments/
COPY packages/storage/package.json packages/storage/
COPY packages/templates/package.json packages/templates/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter @workflo/api...

# 2. Build layer: sources change often; the install above stays cached.
COPY . .
RUN pnpm --filter @workflo/db db:generate
RUN pnpm --filter @workflo/api... build
RUN chown -R node:node /app

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=4000
# Documents PDF engine (S6-D2): puppeteer-core launches the apt-installed Chromium.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 4000
USER node

CMD ["node", "apps/api/dist/index.js"]
