# AR-50 (audit 2026-06-11): manifests-first layering — see apps/api/Dockerfile.
FROM node:20-alpine
WORKDIR /app

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
RUN pnpm install --frozen-lockfile --filter @workflo/landing...

# 2. Build layer.
COPY . .
RUN pnpm --filter @workflo/landing build
RUN chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
USER node

CMD ["pnpm", "--filter", "@workflo/landing", "start"]
