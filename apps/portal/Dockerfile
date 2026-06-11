FROM node:20-alpine AS builder
WORKDIR /app

# Cross-origin API base, baked into the bundle at build (vite reads import.meta.env).
# Passed per-environment by CI (staging: https://dev-api.workflo.space, prod:
# https://api.workflo.space). Empty → app falls back to '/api' (dev proxy).
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# AR-50: manifests-first layering; ARG comes AFTER the install so the dependency
# layer is shared between staging/production builds (different VITE_API_URL).
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
RUN pnpm install --frozen-lockfile --filter @workflo/portal...

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN pnpm --filter @workflo/portal... build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY apps/portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=101:101 /app/apps/portal/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
