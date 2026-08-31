# Built from repo root context (see docker-compose.yml `context: ..`)
FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

FROM node:20-alpine
WORKDIR /repo
ENV NODE_ENV=production
ENV MIGRATIONS_DIR=/repo/infra/postgres/migrations
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY infra/postgres/migrations ./infra/postgres/migrations
EXPOSE 4000
# Migrations run on every boot (tracked/idempotent via schema_migrations — see
# src/scripts/migrate.ts) rather than as a separate pre-deploy step, since not
# every host supports one (e.g. Render's free tier doesn't).
CMD ["sh", "-c", "node apps/api/dist/scripts/migrate.js && node apps/api/dist/server.js"]
