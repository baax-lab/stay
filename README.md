# Baax Stay

Internes Arbeitswerkzeug der Baax Immobilien GmbH für die Suchmakler-Tätigkeit bei touristisch genutzten Immobilien (ausschließlich Käuferseite). Bauvorlage: [docs/KONZEPT.md](docs/KONZEPT.md).

**Stand: Phase 0, Phase 1 (Kern) und Phase 1b (Kundenerlebnis) umgesetzt.** Phase 0: Lead-Schnellerfassung mit Offline-Puffer, Lead-Liste mit CSV-Export, öffentliches Interessenformular, Hub-Login und Hub-Übergabe mit PENDING-Mechanik. Phase 1: Suchaufträge mit Statuslogik, Erstgespräch, Suchprofile, Objekte, Matching, Vorrang, Honorar, Angebote, Kaufabwicklung, Nachbetreuung, Partner, Tippgeber, Import, Automatisierungen. Phase 1b: Käuferportal mit Magic Link, Genehmigungsampel mit Begründung, Gesamtkosten mit Nebenkosten und Wechselkursen, Renditespanne in drei Szenarien, Objektdossier als Weblink und PDF (DE/EN), Such- und Marktbericht mit Freigabe, Benachrichtigungen an Käufer als Entwurf.

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
| `/auftraege` | Suchaufträge als Tabelle und Kanban, neu anlegen | alle; bearbeiten ab Mitarbeiter |
| `/auftraege/[id]` | Tabs: Übersicht (Kopf, GwG), Erstgespräch, Suchprofil, Treffer, Angebote, Kaufabwicklung, Honorar, Dokumente, Partner, Nachbetreuung, Verlauf | Honorar nur Leitung/Admin |
| `/objekte` | Objekte mit Filtern, Ampel, Verfügbarkeit, Treffern | alle; bearbeiten ab Mitarbeiter |
| `/objekte/[id]` | Eckdaten, Ampel, Preisverlauf, Dubletten, Treffer mit Rang, Fotos und Unterlagen | |
| `/objekte/offmarket` | Off-Market-Pipeline aus Verkäuferkontakten | |
| `/partner`, `/tippgeber` | Partner-Stammdaten; Tippgeber mit Prämien | Prämien nur Leitung/Admin |
| `/suche` | Globale Suche über alle Bereiche | |
| `/leads/import`, `/objekte/import`, `/partner/import` | CSV-Import mit Spaltenzuordnung, Vorschau, Dubletten | Leitung, Admin |
| `/auftraege/[id]?tab=portal` | Portal-Links (erzeugen, senden, verlängern, widerrufen), Ansprechpartner, Benachrichtigungs-Entwürfe, Portal-Zugriffe | |
| `/auftraege/[id]?tab=berichte` | Suchbericht und Marktbericht: Entwurf, Bearbeiten, Freigabe, PDF | |
| `/objekte/[id]?tab=kosten` | Ampel, Gesamtkosten, Renditespanne, Angaben für Dossier, Dossier-Links | |
| `/dossier/[id]` | Objektdossier DE/EN (Weblink; PDF über `/api/pdf/dossier/[id]`) | Login oder Druck-Token |
| `/portal/[token]` | Käuferportal: Status, nächste Schritte, Ansprechpartner, freigegebene Objekte, Berichte; merken, ablehnen mit Grund, Besichtigung anfragen | öffentlich mit Token |
| `/einstellungen` | Ziel, aktives Event, QR-Kennungen, Systemstatus; Unterseiten Honorarstaffel, Regionen, Kaufnebenkosten, Wechselkurse | Leitung, Admin |
| `/api/cron/daily` | Tägliche Jobs (Bearer `CRON_SECRET`) | Cron |
| `/datenschutz` | Datenschutzhinweise zum Formular (Platzhalter, prüfen) | öffentlich |

## Hub-Anbindung

**Login (SSO):** `/auth/login` leitet zu `HUB_URL + HUB_LOGIN_PATH?redirect_uri=…/auth/callback`. Der Hub leitet mit `?token=<JWT>` zurück. Das Token wird mit `HUB_JWT_SECRET` (HS256) oder `HUB_JWKS_URL` geprüft; die Rolle kommt aus dem Claim `HUB_ROLE_CLAIM` (Standard `role`, String oder Array; erkannt werden admin, leitung, mitarbeiter, praktikant und gängige Aliase). Danach setzt Baax Stay ein eigenes Session-Cookie (12 h).

**Kontakt- und Aufgabenübergabe:** `POST {HUB_API_URL}/contacts` und `POST {HUB_API_URL}/tasks` mit `Authorization: Bearer HUB_API_TOKEN` (Annahme, siehe `src/lib/hub.ts`). Ist die API nicht konfiguriert, bleibt jeder Lead auf `PENDING` und kann einzeln oder gesammelt nachgereicht werden.

Beides sind Annahmen bis die Hub-Schnittstelle feststeht (offener Punkt im Konzept §14). Anpassungen betreffen nur `src/lib/auth.ts` und `src/lib/hub.ts`.

## Fachlogik (reine Funktionen, getestet)

- `src/lib/matching.ts`: Muss-Filter, Punktwert, „knapp daneben“, Rangfolge nach Beauftragung
- `src/lib/fees.ts`: Honorar mit Bonus und Deckel (Testfälle aus dem Konzept), AT-Höchstsatz, Band-Vorschlag, Prämie
- `src/lib/mandates.ts`: erlaubte Statusübergänge, GwG-Pflicht, Pflichtgrund, Kaufpreis-Pflicht
- `src/lib/license.ts`: Genehmigungsampel aus Lizenzstatus und Regionsregel
- `src/lib/checklists.ts`: Kaufabwicklung je Land (DE, AT, IT, ES, allgemein)
- `src/lib/costs.ts`: Gesamtkosten aus Kaufpreis, Nebenkosten (Region vor Land, jüngster Stand), Honorar, Renovierung, Währung
- `src/lib/yield.ts`: Renditespanne vorsichtig/mittel/gut (±15 %), Annahmen werden ausgewiesen
- `src/lib/portal.ts`: Token (32 Byte, nur Hash gespeichert), Gültigkeit, Rückfluss der Ablehnungsgründe ins Suchprofil
- `src/lib/reports.ts`: Gruppierung des Aussortierten nach Preis, Lizenz, Lage, Zustand, Zahlen
- `src/lib/i18n/`: Deutsch und Englisch für Portal, Dossier, Berichte und Mails

Ampel, Gesamtkosten und Rendite kommen intern, im Portal und im Dossier aus `src/lib/services/figures.ts`.

## Tests

```bash
pnpm test                       # Unit (Vitest): Matching, Honorar, Statuslogik, Ampel, Validierung, Rechte, Session, Rate-Limit
pnpm test:e2e                   # Playwright: Phase 0, Phase 1 (Lead bis Kauf, Rechte, Vorrang) und Phase 1b (Portal, Dossier, Berichte)
```

Die E2E-Tests starten einen Dev-Server (Turbopack, eigener Build-Ordner `.next-e2e`) auf Port 3100 und brauchen die Datenbank aus `.env`. Mit abweichendem Chromium-Pfad: `PW_CHROMIUM_PATH=/pfad/zu/chromium pnpm test:e2e`.

## Automatisierungen

`GET /api/cron/daily` mit `Authorization: Bearer <CRON_SECRET>` (im Compose übernimmt das der Dienst `cron`, 7:30 Uhr): Lead ohne Kontakt nach 2 Werktagen → Hub-Aufgabe; tägliche Trefferübersicht per Mail an Verantwortliche; Nachgespräche und Laufzeitende → Hub-Aufgaben; verworfene Leads nach 12 Monaten löschen; Wechselkurse von der EZB; am Monatsersten Suchbericht-Entwürfe für den Vormonat. Fehler gehen per Mail an `ADMIN_EMAIL`.

## Käuferportal und Benachrichtigungen

- Der Portal-Link ist ein persönlicher Magic Link (32 Byte, nur als SHA-256-Hash gespeichert), 30 Tage gültig, verlängerbar und widerrufbar. Der Klartext ist nur beim Erzeugen sichtbar.
- Jede Benachrichtigung an den Käufer (neues Objekt, Bericht, Statuswechsel) entsteht als Entwurf im Tab „Käuferportal“ und wird erst nach Sichtung gesendet; sie enthält jeweils einen frischen Link.
- Abgelaufene Links zeigen eine Hinweisseite mit Kontakt und der Möglichkeit, einen neuen Link an die hinterlegte Adresse anzufordern. Widerrufene Links nicht.
- Jeder Portalaufruf und jede Aktion steht im AuditLog und im Tab „Käuferportal“.

## Deployment (Coolify)

- `Dockerfile` baut ein Standalone-Image mit Chromium (PDF); `docker-entrypoint.sh` führt `prisma migrate deploy` beim Start aus.
- `docker-compose.yml` enthält App, PostgreSQL, Cron-Dienst, Upload-Volume und einen Backup-Dienst (täglich, 30 Tage Aufbewahrung).
- Uploads liegen auf dem Volume `/app/uploads` (Nextcloud/WebDAV ist offener Punkt).
- Umgebungsvariablen siehe `.env.example`. In Produktion `AUTH_DEV_LOGIN` nicht setzen.
- Domain: `stay.baax.de` (Vorschlag, zu bestätigen).

## Offene Punkte vor Veröffentlichung

- Hub-Endpunkte und Token-Format bestätigen (siehe oben); Hub-Aufgaben nutzen dieselbe API
- SMTP-Zugang und HTML-Signatur der GmbH (`MAIL_SIGNATURE_HTML`) eintragen
- Exakten Hex-Wert Baax-Cyan in `src/app/globals.css` (`--brand`) eintragen
- Honorarstaffel-Startwerte unter `/einstellungen/honorar` festlegen
- Regionsregeln (Vermietung, Zweitwohnsitz) unter `/einstellungen/regionen` als Kurztext pflegen
- Checklisten der Kaufabwicklung (`src/lib/checklists.ts`) mit Partnern vor Ort abstimmen
- Kaufnebenkosten-Richtwerte unter `/einstellungen/nebenkosten` prüfen (Startwerte für DE-Bayern, AT, IT, ES-Balearen)
- Standardannahmen der Renditeschätzung (`src/lib/yield.ts`: Verwaltung 20 %, Rücklagen 3 %, Steuern 25 %, Betriebskosten 15 % vom Umsatz) bestätigen
- Englische Texte in `src/lib/i18n/en.json` gegenlesen
- Datenschutzhinweise unter `/datenschutz` inhaltlich prüfen
- QR-Code mit `https://stay.baax.de/interesse?q=superstay26` erzeugen
