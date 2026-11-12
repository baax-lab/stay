# Baax Stay – Produktions-Image (Coolify / Docker)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Platzhalter, damit Prisma/Next beim Build nicht an fehlenden Variablen scheitern
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV SESSION_SECRET="build-time-placeholder-secret-not-used-at-runtime"
RUN pnpm build

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R app:app /app
USER app
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
