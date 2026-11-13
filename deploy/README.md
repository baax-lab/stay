# Baax Stay auf einem vorhandenen Docker-Server

Diese Anleitung ist für einen VPS, auf dem schon Docker mit anderen Programmen läuft. Baax Stay ist so gebaut, dass es dort nichts stört:

- **Eigenes Compose-Projekt** `baax-stay` (Staging: `baax-stay-staging`). Alle Container, Volumes und Netze tragen dieses Präfix, es gibt keine festen Containernamen.
- **Kein öffentlicher Port.** Die App ist nur über den vorhandenen Reverse Proxy erreichbar, die Datenbank nie von außen.
- **Eindeutige Namen in geteilten Netzen:** intern heißt die Datenbank `stay-db`, im Proxy-Netz heißt die App `baax-stay` (bzw. `baax-stay-staging`), nie nur `app` oder `db`.
- **Grenzen je Dienst:** App 1 GB RAM / 1,5 CPU, Datenbank 512 MB / 1 CPU, Backup 256 MB, Cron 64 MB. Logs werden rotiert (3 × 10 MB je Dienst).

| Dienst | Aufgabe |
| --- | --- |
| `app` | Next.js mit Chromium für PDFs, Port 3000 nur im Docker-Netz |
| `db` | PostgreSQL 16, Volume `db-data` |
| `cron` | ruft täglich ab `CRON_TIME` die Tagesjobs auf, holt verpasste Läufe nach |
| `backup` | täglich ab `BACKUP_TIME` Datenbank-Dump und Uploads, Aufbewahrung `BACKUP_KEEP_DAYS` |

Platzbedarf: Image ca. 1,5 GB, dazu Datenbank, Uploads und 30 Tage Backups.

## 1. Server prüfen (nur lesen, ändert nichts)

```bash
docker version --format '{{.Server.Version}}' && docker compose version   # Compose v2.20 oder neuer
free -h && df -h /var/lib/docker                                            # rund 2 GB RAM und 10 GB frei
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'              # welcher Reverse Proxy läuft? (traefik, caddy, nginx)
docker network ls                                                           # Name des Proxy-Netzes, falls der Proxy ein Container ist
ss -ltnp | grep -E ':(3010|3011)\b' || echo "3010/3011 frei"                # nur für Variante A
```

Danach steht fest, welche Variante passt:

- **Variante A – Proxy läuft direkt auf dem Host** (Caddy oder nginx als Systemdienst): Die App lauscht nur auf `127.0.0.1:3010`.
- **Variante B – Proxy läuft als Container** (Traefik, Caddy, nginx-proxy): Die App tritt dem vorhandenen Proxy-Netz bei, ohne Host-Port.

## 2. Einrichten

```bash
sudo mkdir -p /opt/baax-stay && sudo chown "$USER" /opt/baax-stay
git clone https://github.com/baax-lab/stay.git /opt/baax-stay
cd /opt/baax-stay
cp deploy/env.production.example .env.production
chmod 600 .env.production
```

In `.env.production` mindestens ausfüllen:

| Variable | Inhalt |
| --- | --- |
| `APP_URL` | `https://stay.baax.de` |
| `POSTGRES_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET` | je `openssl rand -hex 32` (keine Sonderzeichen, sonst bricht die Datenbank-Adresse) |
| `HUB_URL`, `HUB_CLIENT_ID`, `HUB_CLIENT_SECRET`, `HUB_API_TOKEN`, `HUB_STATUS_TOKEN` | aus dem Hub, siehe „Anmeldung über den Hub“ unten; ohne sie ist keine Anmeldung möglich und Leads bleiben „ausstehend“ |
| `SMTP_*`, `MAIL_SIGNATURE_HTML` | Versand; ohne SMTP wird nichts gesendet, nur protokolliert |
| `BRAND_COLOR` | exakter Hex-Wert Baax-Cyan, wirkt ohne Neubau |
| `STAY_PROXY_MODE` | `port` (Variante A) oder `network` (Variante B) |
| `STAY_HOST_PORT` | Variante A: freier Port, Standard 3010 |
| `PROXY_NETWORK`, `STAY_DOMAIN`, `STAY_ROUTER` | Variante B: Netzname aus `docker network ls`, Domain, eindeutiger Name |
| `BACKUP_HOST_DIR` | optional: Backups zusätzlich in ein Host-Verzeichnis (für Offsite-Kopie); leer lassen = nur Volume |

`AUTH_DEV_LOGIN` ist im Compose fest auf `false` gesetzt.

DNS: `stay.baax.de` (und für Staging `stay-staging.baax.de`) als A/AAAA-Eintrag auf den Server.

## 3. Reverse Proxy

**Variante A**, Ausschnitt für den vorhandenen Caddy (`deploy/Caddyfile.example`):

```
stay.baax.de {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3010
	request_body {
		max_size 60MB
	}
}
```

Für nginx siehe `deploy/nginx.example.conf`. Wichtig: `client_max_body_size 60m` (Fotos, Unterlagen) und `X-Forwarded-For $remote_addr` überschreiben statt anhängen.

**Variante B:**

- Traefik: nichts weiter zu tun, die Labels stehen in `deploy/compose.proxy-network.yml` (Entrypoint und Zertifikats-Resolver bei Bedarf über `TRAEFIK_ENTRYPOINT`, `TRAEFIK_CERTRESOLVER` anpassen).
- Caddy als Container: `reverse_proxy baax-stay:3000`
- nginx als Container: `proxy_pass http://baax-stay:3000;`

## 4. Starten und prüfen

```bash
deploy/stay.sh production up        # baut das Image, migriert die Datenbank, startet alle Dienste
deploy/stay.sh production ps
deploy/stay.sh production health    # {"ok":true,"db":"ok",...}
curl -sI https://stay.baax.de/api/health
```

Beim ersten Start legt `SEED_ON_START` Regionen, Honorarstaffel-Startwerte, Kaufnebenkosten, Wechselkurse, Kriterien, Vorlagen und Länderwissen an. Der Seed ist idempotent und überschreibt keine gepflegten Inhalte.

## 5. Bedienung

| Befehl | Wirkung |
| --- | --- |
| `deploy/stay.sh production logs [app]` | Logs verfolgen |
| `deploy/stay.sh production update` | `git pull`, Backup „pre-update“, neues Image mit Git-Stand als Tag, Neustart |
| `deploy/stay.sh production images` | vorhandene Versionen und die laufende |
| `deploy/stay.sh production rollback <version>` | älteres Image ohne Neubau starten |
| `deploy/stay.sh production backup` | sofortiges Backup (Datenbank und Uploads) |
| `deploy/stay.sh production restore-test` | jüngstes Backup in eine Wegwerf-Datenbank laden und mit dem Live-Stand vergleichen |
| `deploy/stay.sh production restore <dump> [uploads.tar.gz]` | Wiederherstellung (fragt nach, stoppt App und Cron) |
| `deploy/stay.sh production down` | stoppen (Volumes bleiben) |

**Rollback und Datenbank:** Hat das neuere Update die Datenbank migriert, passt das alte Image nicht mehr zum Schema. Dann nach dem Rollback das Backup „pre-update“ zurückspielen:

```bash
docker compose -p baax-stay exec backup ls -lt /backups | head
deploy/stay.sh production restore /backups/stay-2026-11-20_1012-pre-update.dump /backups/uploads-2026-11-20_1012-pre-update.tar.gz
```

Alte Images aufräumen (die laufende Version und eine Vorversion behalten): `docker image ls baax-stay`, dann gezielt `docker image rm baax-stay:<tag>`. Bitte kein pauschales `docker system prune` auf dem geteilten Server.

## 6. Backups

- Täglich ab `BACKUP_TIME` (Standard 03:00) ein `pg_dump` im Custom-Format und ein Archiv der Uploads im Volume `baax-stay_backups`, Dateien nur für root lesbar.
- Der Tagesmerker liegt im Backup-Volume: Neustarts erzeugen keine Zusatzläufe, ein verpasster Lauf wird nachgeholt.
- **Offsite:** Das Volume liegt auf demselben Server. Mit `BACKUP_HOST_DIR=/srv/backups/baax-stay` landen die Dateien in einem Host-Verzeichnis, das ein vorhandenes Offsite-Backup (restic, Borg, rsync) mitnehmen kann.
- **Wiederherstellung testen** (Konzept §11): nach der Einrichtung einmal `restore-test`, dazu einmal im Staging ein vollständiges `restore` mit Uploads. Lokal wurde beides am fertigen Image durchgespielt (Lead gelöscht, Foto gelöscht, Fremddatei angelegt, Wiederherstellung: Zustand vollständig zurück, Dateien mit richtigem Besitzer).

## 7. Staging

Eigene Umgebung auf demselben Server, komplett getrennt (eigene Datenbank, Volumes, Geheimnisse):

```bash
cp deploy/env.staging.example .env.staging && chmod 600 .env.staging   # Port 3011, eigene Domain, STAY_ROUTER=baax-stay-staging
deploy/stay.sh staging up
```

Im Staging SMTP leer lassen oder ein Testpostfach eintragen, damit keine Mail an echte Käufer geht.

## 8. Coolify

Läuft auf dem Server Coolify, kann Baax Stay dort als „Docker Compose“-Ressource aus dem Repository angelegt werden: `docker-compose.yml` als Compose-Datei, die Variablen aus `deploy/env.production.example` in der Oberfläche setzen, Domain auf den Dienst `app` Port 3000. Die Dateien unter `deploy/compose.*.yml` und `stay.sh` werden dann nicht gebraucht; Backups übernimmt der Dienst `backup` oder Coolifys eigene Datenbanksicherung.

## 9. Anmeldung über den Hub

Im Hub unter **Apps** die App „Baax Stay“ anlegen bzw. öffnen und eintragen (die Werte zeigt auch Baax Stay unter Einstellungen → Systemstatus):

| Im Hub | Wert |
| --- | --- |
| Adresse der App | `https://stay.baax.de` |
| Anmeldung über den Hub → Anmelde-Einstieg | `https://stay.baax.de/auth/hub` |
| Anmeldung über den Hub → Rücksprung-Adresse | `https://stay.baax.de/auth/callback` |
| Anmeldung über den Hub → wer darf rein | Vorschlag: Bereich Baax Immobilien, Praktikanten erlaubt (sie bekommen in Stay nur Praktikanten-Rechte) |
| Prüfung → Status-Endpoint und Token | `https://stay.baax.de/api/hub/status`, Token = `HUB_STATUS_TOKEN` |
| Sprung zum Kontakt | `https://stay.baax.de/kontakte/by-hub-id/{hubId}` |
| Einstellungen → API-Zugänge | Name „Baax Stay“, Schreibrechte ja |

Zurück in `.env.production`: `HUB_CLIENT_ID`, `HUB_CLIENT_SECRET` (wird im Hub nur einmal angezeigt), `HUB_API_TOKEN` (beginnt mit `bhub_`) und `HUB_STATUS_TOKEN` (selbst erzeugen mit `openssl rand -hex 32` und im Hub an der App ins Feld „Token“ eintragen). Danach `deploy/stay.sh production up`.

## 10. Checkliste vor dem Go-live

- [ ] Server geprüft (Abschnitt 1), Variante gewählt, Port bzw. Netz frei
- [ ] `.env.production` vollständig, `chmod 600`, Geheimnisse zufällig erzeugt
- [ ] DNS gesetzt, Zertifikat aktiv, `https://stay.baax.de/api/health` liefert `ok`
- [ ] Hub-Login getestet, Rollen kommen richtig an (Einstellungen → Systemstatus, „Hub-Verbindung testen“)
- [ ] SMTP: „SMTP-Anmeldung testen“ und „Testmail an mich senden“, Signatur geprüft
- [ ] PDF erzeugt (Dossier) – Chromium im Image
- [ ] `restore-test` erfolgreich, Offsite-Kopie der Backups eingerichtet
- [ ] Hausfarbe (`BRAND_COLOR`), Rechtstexte und Impressum-Link unter Einstellungen → Rechtstexte geprüft
- [ ] Handy der Messe-Mitarbeiter: `/leads/neu` einmal online öffnen (lädt die Seite für den Offline-Start vor), „Zum Startbildschirm hinzufügen“, Flugmodus-Test: Kontakt erfassen, Netz an, Kontakt erscheint in der Liste
- [ ] QR-Code auf `https://stay.baax.de/interesse?q=superstay26`
