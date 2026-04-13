FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @workflo/workspace...
RUN pnpm --filter @workflo/workspace... build

FROM nginx:alpine
COPY apps/workspace/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/workspace/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
