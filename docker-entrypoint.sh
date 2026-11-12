#!/bin/sh
set -e
# Migrationen beim Start anwenden (Coolify startet nur einen Container; bei mehreren Instanzen in einen Job auslagern)
./node_modules/.bin/prisma migrate deploy
exec "$@"
