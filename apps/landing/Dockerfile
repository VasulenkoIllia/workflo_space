FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @workflo/landing...
RUN pnpm --filter @workflo/landing build
RUN chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
USER node

CMD ["pnpm", "--filter", "@workflo/landing", "start"]
