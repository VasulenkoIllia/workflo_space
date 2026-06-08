FROM node:20-alpine AS builder
WORKDIR /app

# Cross-origin API base, baked into the bundle at build (vite reads import.meta.env).
# Passed per-environment by CI (staging: https://dev-api.workflo.space, prod:
# https://api.workflo.space). Empty → app falls back to '/api' (dev proxy).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @workflo/portal...
RUN pnpm --filter @workflo/portal... build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY apps/portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=101:101 /app/apps/portal/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
