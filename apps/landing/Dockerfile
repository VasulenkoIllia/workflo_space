FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @workflo/landing...
RUN pnpm --filter @workflo/landing build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "--filter", "@workflo/landing", "start"]
