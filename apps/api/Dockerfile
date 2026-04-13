FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @workflo/api...
RUN pnpm --filter @workflo/db db:generate
RUN pnpm --filter @workflo/api... build

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=4000

EXPOSE 4000

CMD ["pnpm", "--filter", "@workflo/api", "start"]
