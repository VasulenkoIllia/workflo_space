FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @workflo/portal...
RUN pnpm --filter @workflo/portal... build

FROM nginx:alpine
COPY apps/portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/portal/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
