# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --filter api... --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm db:generate
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Prisma's query engine needs OpenSSL to make TLS connections to managed
# Postgres (Neon, RDS, Supabase, etc.). node:20-alpine does not include it,
# which causes `prisma migrate deploy` to fail with
# `Could not parse schema engine response: "Error load"`.
RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api
EXPOSE 3001

# Start command handles Prisma's P3005 ("schema is not empty") error so
# the first deploy against a DB that already has the schema (e.g. from a
# prior `prisma db push` or partial migration) can baseline itself and
# proceed. On any other migration error we fail fast so the deploy
# surfaces the real problem.
CMD ["bash", "-c", "npx prisma migrate deploy 2>&1 | tee /tmp/migrate.log; if [ ${PIPESTATUS[0]} -ne 0 ]; then if grep -q P3005 /tmp/migrate.log; then echo 'P3005: baselining migration 0_init'; npx prisma migrate resolve --applied 0_init; else echo 'Migration failed, see /tmp/migrate.log'; exit 1; fi; fi; exec node dist/server.js"]
