# Baax Stay

Internes Arbeitswerkzeug der Baax Immobilien GmbH für die Suchmakler-Tätigkeit bei touristisch genutzten Immobilien (ausschließlich Käuferseite). Bauvorlage: [docs/KONZEPT.md](docs/KONZEPT.md).

**Stand: alle Phasen des Konzepts umgesetzt (0, 1, 1b, 2, 3).** Phase 3: Länder- und Regionswissen mit Prüfdatum und Kennzahlen aus eigenen Daten, vollständige Auswertung (Quelle → Lead → Auftrag → Kauf, Dauer je Status, Honorar je Monat, Leistung je Tippgeber und Partner), gespeicherte Portal-Suchen als Kandidaten. Phase 0: Lead-Schnellerfassung mit Offline-Puffer, Lead-Liste mit CSV-Export, öffentliches Interessenformular, Hub-Login und Hub-Übergabe mit PENDING-Mechanik. Phase 1: Suchaufträge mit Statuslogik, Erstgespräch, Suchprofile, Objekte, Matching, Vorrang, Honorar, Angebote, Kaufabwicklung, Nachbetreuung, Partner, Tippgeber, Import, Automatisierungen. Phase 2: Partnerzugang mit Objekt-Einreichung (DE/EN/ES/IT/FR), Partnerbewertung und Leistungsübersicht, Vorprüfung je Segment und Land, mobile Besichtigung mit Kamera, Reisen mit Reisekosten, Vorlagen (Suchauftrag, Partnervereinbarung, Tippgeberbestätigung), Erinnerungsmails, pflegbarer Kriterienkatalog. Phase 1b: Käuferportal mit Magic Link, Genehmigungsampel mit Begründung, Gesamtkosten mit Nebenkosten und Wechselkursen, Renditespanne in drei Szenarien, Objektdossier als Weblink und PDF (DE/EN), Such- und Marktbericht mit Freigabe, Benachrichtigungen an Käufer als Entwurf.

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
| `/partner/[id]` | Leistungsübersicht, Bewertung, Partnerzugang (Links), Partnervereinbarung aus Vorlage | |
| `/partner-zugang/[token]` | Partner: anonymisierte Suchprofile, Objekt einreichen mit Fotos/Unterlagen, eigene Einreichungen; DE/EN/ES/IT/FR | öffentlich mit Token |
| `/objekte/[id]?tab=vorpruefung` | Vorprüfung mit Checkliste je Segment und Land | |
| `/besichtigungen`, `/besichtigungen/[id]` | Besichtigungsprotokoll mobil, Fotos aus der Kamera, Übernahme ins Objekt | |
| `/auftraege/[id]?tab=reisen` | Reisen, Reisekosten mit Belegen, Vergleich zur Reisepauschale | |
| `/vorlage/[art]/[id]` | Dokument aus Vorlage (Vorschau; PDF über `/api/pdf/vorlage/...`) | ab Mitarbeiter oder Druck-Token |
| `/wissen`, `/wissen/[land]`, `/wissen/region/[key]` | Länder- und Regionswissen, Kennzahlen aus eigenen Objekten, Nebenkosten, Checklisten | lesen alle; pflegen Leitung, Admin |
| `/auswertung` | Trichter je Quelle, Dauer je Status, Honorar je Monat, Leistung je Tippgeber und Partner; CSV | ab Mitarbeiter; Honorar und Export Leitung, Admin |
| `/auftraege/[id]?tab=kandidaten` | Kandidaten aus Suchwünschen des Käufers, Übernahme als Treffer, „Suchprofil erweitern?“ | |
| `/einstellungen` | Ziel, aktives Event, QR-Kennungen, Systemstatus; Unterseiten Honorarstaffel, Regionen, Kaufnebenkosten, Wechselkurse, Kriterienkatalog, Vorlagen | Leitung, Admin |
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

- `src/lib/precheck.ts`: Vorprüfungs-Checklisten (allgemein, je Segment, je Land DE/AT/IT/ES), Gesamtstatus, Besichtigungspunkte
- `src/lib/trips.ts`: Reisekosten-Summen und Reisepauschale
- `src/lib/templates.ts`: Vorlagen mit `{{platzhalter}}` und `{{#if}}`, Markdown-Subset
- `src/lib/partner-stats.ts`: Partnerbewertung und Trefferquote
- `src/lib/i18n/partner.ts`: Texte des Partnerzugangs in fünf Sprachen
- `src/lib/analytics.ts`: Trichter je Quelle, Dauer je Status, Dauer bis Kauf, Honorar je Monat, Wissensstand, Regionskennzahlen
- `src/lib/candidates.ts`: Suchwunsch als Matching-Profil, Abweichung vom Suchprofil

Ampel, Gesamtkosten und Rendite kommen intern, im Portal und im Dossier aus `src/lib/services/figures.ts`.

## Tests

```bash
pnpm test                       # Unit (Vitest): Matching, Honorar, Statuslogik, Ampel, Validierung, Rechte, Session, Rate-Limit
pnpm test:e2e                   # Playwright: Phase 0, 1 (Lead bis Kauf, Rechte, Vorrang), 1b (Portal, Dossier, Berichte), 2 (Partnerzugang, Vorprüfung, Besichtigung, Reisen, Vorlagen), 3 (Wissen, Kandidaten, Auswertung)
```

Die E2E-Tests starten einen Dev-Server (Turbopack, eigener Build-Ordner `.next-e2e`) auf Port 3100 und brauchen die Datenbank aus `.env`. Mit abweichendem Chromium-Pfad: `PW_CHROMIUM_PATH=/pfad/zu/chromium pnpm test:e2e`.

## Automatisierungen

`GET /api/cron/daily` mit `Authorization: Bearer <CRON_SECRET>` (im Compose übernimmt das der Dienst `cron`, 7:30 Uhr): Lead ohne Kontakt nach 2 Werktagen → Hub-Aufgabe; tägliche Trefferübersicht per Mail an Verantwortliche; Nachgespräche und Laufzeitende → Hub-Aufgaben; verworfene Leads nach 12 Monaten löschen; Wechselkurse von der EZB; am Monatsersten Suchbericht-Entwürfe für den Vormonat; Erinnerungsmails an Verantwortliche für Laufzeitende (30 und 7 Tage vorher) und fällige Nachgespräche, je Anlass einmalig. Fehler gehen per Mail an `ADMIN_EMAIL`.

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
- Englische Texte in `src/lib/i18n/en.json` gegenlesen; Partnerzugang-Texte ES/IT/FR in `src/lib/i18n/partner.ts`
- Vorlagen (Suchauftrag, Partnervereinbarung, Tippgeberbestätigung) unter `/einstellungen/vorlagen` rechtlich prüfen lassen
- Vorprüfungs-Checklisten je Segment und Land (`src/lib/precheck.ts`) mit Partnern vor Ort abstimmen
- Hub-Termine (`POST /appointments`) sind wie die übrigen Hub-Endpunkte eine Annahme
- Länderwissen unter `/wissen` inhaltlich prüfen (Startinhalte für DE, AT, IT, ES, CH ohne Prüfdatum) und Schwerpunktregionen befüllen
- Datenschutzhinweise unter `/datenschutz` inhaltlich prüfen
- QR-Code mit `https://stay.baax.de/interesse?q=superstay26` erzeugen
