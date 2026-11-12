# Baax Stay

Internes Arbeitswerkzeug der Baax Immobilien GmbH für die Suchmakler-Tätigkeit bei touristisch genutzten Immobilien (ausschließlich Käuferseite). Bauvorlage: [docs/KONZEPT.md](docs/KONZEPT.md).

**Stand: Phase 0** (Messe SuperStay LIVE) – Lead-Schnellerfassung mit Offline-Puffer, Lead-Liste mit CSV-Export, öffentliches Interessenformular, Hub-Login und Hub-Übergabe mit PENDING-Mechanik.

## Stack

Next.js 15 (App Router) · TypeScript strict · Prisma 6 · PostgreSQL 16 · Tailwind 4 · Docker/Coolify

## Lokal starten

```bash
cp .env.example .env            # Werte anpassen, SESSION_SECRET setzen
pnpm install
pnpm db:migrate                 # Migrationen anwenden
pnpm db:seed                    # Regionen und aktives Event
pnpm dev
```

Ohne konfigurierten Hub steht unter `/auth/dev` ein Entwickler-Login mit wählbarer Rolle bereit (nur wenn `AUTH_DEV_LOGIN=true` und nicht in Produktion).

## Seiten

| Pfad | Zweck | Zugang |
| --- | --- | --- |
| `/` | Dashboard: offene Leads, Quellen, Hub-Status | Login |
| `/leads/neu` | Schnellerfassung (mobil, Offline-Puffer) | alle Rollen |
| `/leads` | Liste, Filter, Dubletten-Hinweis, Hub-Übergabe nachholen | alle; Kontaktdaten ab Mitarbeiter |
| `/leads/[id]` | Detail, Status, Notiz, Zusammenführen | Bearbeiten ab Mitarbeiter |
| `/leads/export` | CSV (Semikolon, UTF-8 mit BOM) | Leitung, Admin |
| `/interesse?q=<kennung>` | QR-Formular für Visitenkarte und Einseiter | öffentlich |
| `/einstellungen` | Aktives Event, QR-Kennungen, Systemstatus | Leitung, Admin |
| `/datenschutz` | Datenschutzhinweise zum Formular (Platzhalter, prüfen) | öffentlich |

## Hub-Anbindung

**Login (SSO):** `/auth/login` leitet zu `HUB_URL + HUB_LOGIN_PATH?redirect_uri=…/auth/callback`. Der Hub leitet mit `?token=<JWT>` zurück. Das Token wird mit `HUB_JWT_SECRET` (HS256) oder `HUB_JWKS_URL` geprüft; die Rolle kommt aus dem Claim `HUB_ROLE_CLAIM` (Standard `role`, String oder Array; erkannt werden admin, leitung, mitarbeiter, praktikant und gängige Aliase). Danach setzt Baax Stay ein eigenes Session-Cookie (12 h).

**Kontakt- und Aufgabenübergabe:** `POST {HUB_API_URL}/contacts` und `POST {HUB_API_URL}/tasks` mit `Authorization: Bearer HUB_API_TOKEN` (Annahme, siehe `src/lib/hub.ts`). Ist die API nicht konfiguriert, bleibt jeder Lead auf `PENDING` und kann einzeln oder gesammelt nachgereicht werden.

Beides sind Annahmen bis die Hub-Schnittstelle feststeht (offener Punkt im Konzept §14). Anpassungen betreffen nur `src/lib/auth.ts` und `src/lib/hub.ts`.

## Tests

```bash
pnpm test                       # Unit (Vitest): Validierung, Dubletten-Normalisierung, Rechte, Session, Rate-Limit
pnpm test:e2e                   # Playwright: Login, Erfassung mobil, Offline-Puffer, QR-Formular, Export-Rechte
```

Die E2E-Tests starten den Dev-Server auf Port 3100 und brauchen eine erreichbare Datenbank aus `.env`. Mit abweichendem Chromium-Pfad: `PW_CHROMIUM_PATH=/pfad/zu/chromium pnpm test:e2e`.

## Deployment (Coolify)

- `Dockerfile` baut ein Standalone-Image; `docker-entrypoint.sh` führt `prisma migrate deploy` beim Start aus.
- `docker-compose.yml` enthält App, PostgreSQL und einen Backup-Dienst (täglich, 30 Tage Aufbewahrung).
- Umgebungsvariablen siehe `.env.example`. In Produktion `AUTH_DEV_LOGIN` nicht setzen.
- Domain: `stay.baax.de` (Vorschlag, zu bestätigen).

## Offene Punkte für Phase 0

- Hub-Endpunkte und Token-Format bestätigen (siehe oben)
- Exakten Hex-Wert Baax-Cyan in `src/app/globals.css` (`--brand`) eintragen
- Datenschutzhinweise unter `/datenschutz` inhaltlich prüfen
- QR-Code mit `https://stay.baax.de/interesse?q=superstay26` erzeugen
