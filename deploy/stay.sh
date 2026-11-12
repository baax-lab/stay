#!/usr/bin/env bash
# Baax Stay – Bedienung auf dem VPS. Aufruf aus dem Repository-Verzeichnis:
#   deploy/stay.sh <umgebung> <befehl>     umgebung: production | staging
# Befehle: up, down, logs, ps, update, rollback <version>, images, backup, restore-test, restore <dump> [uploads.tar.gz], health
set -euo pipefail

ENVNAME="${1:-}"; CMD="${2:-}"; shift 2 || true
case "$ENVNAME" in
  production) PROJECT=baax-stay; ENVFILE=.env.production ;;
  staging)    PROJECT=baax-stay-staging; ENVFILE=.env.staging ;;
  *) echo "Umgebung: production | staging"; exit 1 ;;
esac
[ -f "$ENVFILE" ] || { echo "$ENVFILE fehlt (Vorlage: deploy/env.$ENVNAME.example)"; exit 1; }

# Variante über STAY_PROXY_MODE in der Env-Datei: port (Standard) oder network
MODE=$(grep -E '^STAY_PROXY_MODE=' "$ENVFILE" | cut -d= -f2 || true)
FILES=(-f docker-compose.yml)
if [ "${MODE:-port}" = "network" ]; then FILES+=(-f deploy/compose.proxy-network.yml); else FILES+=(-f deploy/compose.port.yml); fi
if grep -qE '^BACKUP_HOST_DIR=.+' "$ENVFILE"; then FILES+=(-f deploy/compose.backup-host.yml); fi
# Image-Tag = Git-Stand (für Rollback); ein APP_VERSION in der Umgebung hat Vorrang
export APP_VERSION="${APP_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
DC=(docker compose -p "$PROJECT" --env-file "$ENVFILE" "${FILES[@]}")

case "$CMD" in
  up)      "${DC[@]}" up -d --build ;;
  down)    "${DC[@]}" down ;;
  logs)    "${DC[@]}" logs -f --tail=200 "$@" ;;
  ps)      "${DC[@]}" ps ;;
  update)
    git pull --ff-only
    APP_VERSION="$(git rev-parse --short HEAD)"; export APP_VERSION
    echo "Update auf $APP_VERSION, Backup vorher …"; "${DC[@]}" exec -T backup sh -c 'umask 077; ts=$(date +%F_%H%M)-pre-update; pg_dump -Fc -f /backups/stay-$ts.dump && tar -czf /backups/uploads-$ts.tar.gz -C /uploads . && echo "Backup $ts ok"'
    "${DC[@]}" up -d --build
    ;;
  rollback)
    # Älteres Image ohne Neubau starten. Achtung: hat das neuere Update die Datenbank migriert,
    # zusätzlich das Backup „pre-update“ zurückspielen (restore), sonst passt das Schema nicht.
    VER="${1:?Version angeben, siehe: deploy/stay.sh $ENVNAME images}"
    docker image inspect "baax-stay:$VER" >/dev/null || { echo "Image baax-stay:$VER nicht vorhanden"; exit 1; }
    APP_VERSION="$VER" "${DC[@]}" up -d --no-build app cron
    ;;
  images)
    docker image ls baax-stay --format 'table {{.Tag}}\t{{.CreatedSince}}\t{{.Size}}'
    id=$("${DC[@]}" ps -q app 2>/dev/null || true)
    echo "Laufend: ${id:+$(docker inspect -f '{{.Config.Image}}' "$id")}"
    ;;
  backup)
    "${DC[@]}" exec -T backup sh -c 'umask 077; ts=$(date +%F_%H%M)-manuell; pg_dump -Fc -f /backups/stay-$ts.dump && tar -czf /backups/uploads-$ts.tar.gz -C /uploads . && ls -lh /backups | tail -4'
    ;;
  restore-test)
    # Spielt das jüngste Backup in eine Wegwerf-Datenbank und vergleicht die Datensätze mit dem Live-Stand
    "${DC[@]}" exec -T backup sh -c '
      set -e
      f=$(ls -t /backups/stay-*.dump | head -1); echo "Teste $f"
      psql -q -d postgres -c "DROP DATABASE IF EXISTS stay_restore_test" -c "CREATE DATABASE stay_restore_test"
      pg_restore --no-owner -d stay_restore_test "$f"
      for t in "Lead" "Mandate" "Property" "Match" "AuditLog"; do
        a=$(psql -tA -d stay -c "SELECT count(*) FROM \"$t\""); b=$(psql -tA -d stay_restore_test -c "SELECT count(*) FROM \"$t\"")
        echo "$t: live=$a backup=$b"
      done
      psql -q -d postgres -c "DROP DATABASE stay_restore_test"
      echo "Wiederherstellungstest erfolgreich (Abweichungen = Änderungen seit dem Backup)"'
    ;;
  restore)
    DUMP="${1:?Pfad im Backup-Volume, z. B. /backups/stay-2026-11-20_0300.dump}"; UPL="${2:-}"
    read -r -p "Datenbank $PROJECT wirklich durch $DUMP ersetzen? (ja/nein) " ok; [ "$ok" = "ja" ] || exit 1
    "${DC[@]}" stop app cron
    "${DC[@]}" exec -T backup sh -c "psql -q -d postgres -c 'DROP DATABASE IF EXISTS stay WITH (FORCE)' -c 'CREATE DATABASE stay OWNER stay' && pg_restore --no-owner --role=stay -d stay '$DUMP'"
    # eigener Entrypoint, weil der Backup-Dienst „/bin/sh -c“ mit seiner Schleife als Entrypoint hat
    if [ -n "$UPL" ]; then
      "${DC[@]}" run --rm --no-deps -T --entrypoint /bin/sh -v "${PROJECT}_uploads:/restore" backup \
        -c "find /restore -mindepth 1 -delete && tar -xzf '$UPL' -C /restore && echo \"Uploads wiederhergestellt: \$(find /restore -type f | wc -l) Dateien\""
    fi
    "${DC[@]}" start app cron
    ;;
  health)  "${DC[@]}" exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)" ;;
  *) echo "Befehle: up | down | logs | ps | update | rollback <version> | images | backup | restore-test | restore <dump> [uploads.tar.gz] | health"; exit 1 ;;
esac
