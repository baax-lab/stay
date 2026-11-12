# Baax Stay – Produktions-Image (Coolify oder vorhandener Docker-Host)
# Debian-Basis mit Chromium für PDF-Erzeugung (Dossier, Berichte, Vorlagen)
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Alle Abhängigkeiten für den Build
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# Nur Laufzeit-Abhängigkeiten (inkl. Prisma CLI für migrate deploy)
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
# SWC-Compiler wird nur zum Bauen gebraucht, nicht zur Laufzeit
RUN pnpm install --frozen-lockfile --prod && pnpm exec prisma generate \
  && find node_modules/.pnpm -maxdepth 1 -name '@next+swc-*' -exec rm -r {} +

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Platzhalter nur für den Build-Schritt (echte Werte kommen zur Laufzeit aus der Umgebung)
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" SESSION_SECRET="build-time-placeholder-not-used-at-runtime-0000" APP_URL="https://stay.baax.de" \
  pnpm build && pnpm build:seed

FROM node:22-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-core ca-certificates openssl tini \
  && apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHROMIUM_PATH=/usr/bin/chromium \
    UPLOAD_DIR=/app/uploads \
    INTERNAL_URL=http://127.0.0.1:3000 \
    APP_VERSION=${APP_VERSION} \
    TZ=Europe/Berlin
RUN groupadd -r app -g 1001 && useradd -r -u 1001 -g app -d /app app && mkdir -p /app/uploads && chown app:app /app/uploads

# Mit --chown kopieren statt nachträglich chown -R (sonst verdoppelt sich die Image-Größe)
COPY --chown=app:app --from=prod-deps /app/node_modules ./node_modules
COPY --chown=app:app --from=build /app/.next/standalone ./
COPY --chown=app:app --from=build /app/.next/static ./.next/static
COPY --chown=app:app --from=build /app/public ./public
COPY --chown=app:app --from=build /app/prisma ./prisma
COPY --chown=app:app --chmod=755 docker-entrypoint.sh ./
USER app
EXPOSE 3000
VOLUME ["/app/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
