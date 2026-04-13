FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @workflo/bot...
RUN pnpm --filter @workflo/bot... build

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@workflo/bot", "start"]
