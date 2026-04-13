FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @workflo/api...
RUN pnpm --filter @workflo/db db:generate
RUN pnpm --filter @workflo/api... build
RUN chown -R node:node /app

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=4000

EXPOSE 4000
USER node

CMD ["node", "apps/api/dist/index.js"]
