#!/bin/sh
set -e
# 1. Migrationen anwenden (bei mehreren Instanzen in einen einmaligen Job auslagern)
./node_modules/.bin/prisma migrate deploy
# 2. Stammdaten ergänzen (idempotent: legt nur Fehlendes an, überschreibt nichts Gepflegtes)
if [ "${SEED_ON_START:-true}" = "true" ]; then
  node prisma/seed.cjs
fi
exec "$@"
