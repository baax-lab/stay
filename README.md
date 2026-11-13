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
| `/einstellungen/texte` | Datenschutzhinweise, Impressum-Link, Kontakt für Datenschutzanfragen | Leitung, Admin |
| `/einstellungen/protokoll` | AuditLog mit Filtern (Aktion, Bereich, Datensatz, Nutzer, Zeitraum) und CSV | Admin |
| `/einstellungen/datenschutz` | DSGVO: Person suchen, Auskunft als JSON, Löschung bzw. Anonymisierung mit Fristprüfung | Admin |
| `/api/cron/daily` | Tägliche Jobs (Bearer `CRON_SECRET`) | Cron |
| `/api/health` | Zustand für Healthcheck und Monitoring (`{ok, db, version}`) | öffentlich |
| `/datenschutz` | Datenschutzhinweise zum Formular (Text pflegbar, sonst Standardtext) | öffentlich |

## Hub-Anbindung

Umgesetzt nach `docs/SSO.md`, `docs/API.md` und `docs/APP-ANBINDUNG.md` im Repository `baax-lab/BaaxHub`.

**Anmeldung (OpenID Connect):** Der Knopf „Anmelden“ an der App im Hub ruft den Anmelde-Einstieg `/auth/hub?iss=<HUB_URL>[&target_link_uri=…]` auf. Baax Stay startet die Anmeldung (Authorization Code mit PKCE S256, `state`, `nonce`), der Hub kommt ohne Abfrage mit einem Code auf `/auth/callback` zurück, das ID-Token (ES256, JWKS des Hubs) wird geprüft und eine eigene Sitzung (8 Stunden) angelegt. Verknüpft wird über `sub`. Rollen: `ADMIN` → Admin, `MANAGEMENT` → Leitung, `TEAMLEAD` und `EMPLOYEE` → Mitarbeiter, `intern: true` → Praktikant (außer Admin). Ohne Sitzung leitet jede Seite still über den Einstieg zum Hub und danach zurück; `access_denied` zeigt „Kein Zugang“.

**API:** Neue Leads werden über `POST /api/v1/contacts` als Kontakt angelegt (Dublette liefert den vorhandenen, `hubId` wird gespeichert); die Aufgabe „Nachfassen“ und alle weiteren Aufgaben (Kaufabwicklung, Nachgespräch, Laufzeitende, Besichtigungsanfrage) entstehen als Ereignis mit `task` über `POST /api/v1/events`. Reisen erscheinen als Ereignis „meeting“ in der Timeline. Ohne `HUB_API_TOKEN` bleibt jeder Lead auf „ausstehend“ und kann nachgereicht werden.

**Für den Hub:** Status-Endpoint `GET /api/hub/status` (Bearer `HUB_STATUS_TOKEN`, nur Zahlen) und Sprung-Link `/kontakte/by-hub-id/{hubId}`. Welche Werte im Hub einzutragen sind, zeigt Einstellungen → Systemstatus.

Code: `src/lib/oidc.ts` (reine Bausteine, getestet), `src/lib/auth.ts` (Anmeldung), `src/lib/hub.ts` (API).

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
- `src/lib/privacy.ts`: Lösch- und Aufbewahrungsregeln (GwG, Prämienbelege), Deutung des Suchbegriffs
- `src/lib/brand.ts`, `src/lib/audit-filter.ts`, `src/lib/legal.ts`, `src/lib/sw-script.ts`: Hausfarbe, Protokollfilter, Rechtstext-Format, Service Worker

Ampel, Gesamtkosten und Rendite kommen intern, im Portal und im Dossier aus `src/lib/services/figures.ts`.

## Tests

```bash
pnpm test                       # Unit (Vitest): Matching, Honorar, Statuslogik, Ampel, Validierung, Rechte, Session, Rate-Limit
pnpm test:e2e                   # Playwright: Phase 0, 1 (Lead bis Kauf, Rechte, Vorrang), 1b (Portal, Dossier, Berichte), 2 (Partnerzugang, Vorprüfung, Besichtigung, Reisen, Vorlagen), 3 (Wissen, Kandidaten, Auswertung), Betrieb (DSGVO, Protokoll, Rechtstexte, Abmelden)
```

Die E2E-Tests starten einen Dev-Server (Turbopack, eigener Build-Ordner `.next-e2e`) auf Port 3100 und brauchen die Datenbank aus `.env`. Mit abweichendem Chromium-Pfad: `PW_CHROMIUM_PATH=/pfad/zu/chromium pnpm test:e2e`.

## Automatisierungen

`GET /api/cron/daily` mit `Authorization: Bearer <CRON_SECRET>` (im Compose übernimmt das der Dienst `cron`, 7:30 Uhr): Lead ohne Kontakt nach 2 Werktagen → Hub-Aufgabe; tägliche Trefferübersicht per Mail an Verantwortliche; Nachgespräche und Laufzeitende → Hub-Aufgaben; verworfene Leads nach 12 Monaten löschen; Wechselkurse von der EZB; am Monatsersten Suchbericht-Entwürfe für den Vormonat; Erinnerungsmails an Verantwortliche für Laufzeitende (30 und 7 Tage vorher) und fällige Nachgespräche, je Anlass einmalig. Fehler gehen per Mail an `ADMIN_EMAIL`.

## Käuferportal und Benachrichtigungen

- Der Portal-Link ist ein persönlicher Magic Link (32 Byte, nur als SHA-256-Hash gespeichert), 30 Tage gültig, verlängerbar und widerrufbar. Der Klartext ist nur beim Erzeugen sichtbar.
- Jede Benachrichtigung an den Käufer (neues Objekt, Bericht, Statuswechsel) entsteht als Entwurf im Tab „Käuferportal“ und wird erst nach Sichtung gesendet; sie enthält jeweils einen frischen Link.
- Abgelaufene Links zeigen eine Hinweisseite mit Kontakt und der Möglichkeit, einen neuen Link an die hinterlegte Adresse anzufordern. Widerrufene Links nicht.
- Jeder Portalaufruf und jede Aktion steht im AuditLog und im Tab „Käuferportal“.

## Datenschutz und Protokoll

- **Auskunft:** `/einstellungen/datenschutz` findet eine Person über E-Mail, Telefon, Name oder Hub-Kontakt-ID in Leads, Suchaufträgen, Tippgebern und Partnern und exportiert alles als JSON (inkl. Verlauf und Protokolleinträge). Suche und Export laufen per POST, damit Adressen nicht in URLs und Proxy-Logs landen.
- **Löschung** (Regeln in `src/lib/privacy.ts`, getestet): Leads ohne Auftrag werden gelöscht. Laufende Aufträge sind gesperrt. Aufträge mit GwG-Identifizierung oder Kauf bleiben 5 Jahre ab Ende des Kalenderjahres, in dem die Geschäftsbeziehung endete; Tippgeber mit ausgezahlter Prämie 10 Jahre. Alles andere wird anonymisiert: Name, Kontakt, Notizen, Erstgespräch, Dokumente samt Dateien, Portal-Links, Berichte und Entwürfe weg; Objekte und Vorstellungen bleiben ohne Personenbezug als Nachweis für Honoraransprüche. Ältere Protokollinhalte zu den Datensätzen werden geschwärzt, die Löschung selbst wird protokolliert. Hub-Kontakt-IDs werden angezeigt, damit der Kontakt auch im Hub gelöscht wird.
- **Protokoll:** `/einstellungen/protokoll` zeigt das AuditLog mit Namen aus den Anmeldungen; Export ist selbst protokolliert.

## Offline auf der Messe

Ein Service Worker (`/sw.js`, Quelle `src/lib/sw-script.ts`, nur im Produktionsbuild) hält `/leads/neu` samt Skripten im Cache. Ohne Netz startet die Erfassung trotzdem; gespeicherte Kontakte landen im Offline-Puffer (IndexedDB) und werden automatisch nachgesendet. Andere Seiten zeigen ohne Netz einen Hinweis mit Link zur Erfassung. API, Dateien, Anmeldung, Portal und Partnerzugang werden nie gecacht; beim Abmelden wird der Seiten-Cache geleert, der Puffer mit noch nicht gesendeten Kontakten bleibt.

## Deployment

Anleitung für den vorhandenen Docker-Server (Varianten mit Host-Proxy oder Proxy-Container, Staging, Update, Rollback, Backup und Wiederherstellung, Go-live-Checkliste): **[deploy/README.md](deploy/README.md)**.

- `Dockerfile` baut ein Standalone-Image mit Chromium (PDF), nur Produktionsabhängigkeiten, Healthcheck auf `/api/health`; `docker-entrypoint.sh` führt `prisma migrate deploy` und den idempotenten Seed aus.
- `docker-compose.yml`: App, PostgreSQL, Cron und Backup als Projekt `baax-stay`, ohne veröffentlichte Ports, mit Speicher- und Loggrenzen.
- Uploads liegen auf dem Volume `/app/uploads` (Nextcloud/WebDAV ist offener Punkt).
- Gestaltung wie der Baax Hub: Inter, Baax-Cyan `#0cc0df` als Primärfarbe (Schrift darauf dunkel), Milchglas-Flächen, Cyan-Schimmer im Hintergrund; Druck und PDF ohne Glas. Primärfarbe zur Laufzeit über `BRAND_COLOR` änderbar (`/brand.css`).

## Offene Punkte vor Veröffentlichung

- Hub-Endpunkte und Token-Format bestätigen (siehe oben); Pfade über `HUB_CONTACTS_PATH`, `HUB_TASKS_PATH`, `HUB_APPOINTMENTS_PATH` anpassbar
- SMTP-Zugang und HTML-Signatur der GmbH (`MAIL_SIGNATURE_HTML`) eintragen
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
- Datenschutzhinweise unter Einstellungen → Rechtstexte prüfen bzw. den Text von baax.de übernehmen, Impressum-Link bestätigen
- PDF-Erzeugung im fertigen Image einmal prüfen (Chromium kommt aus den Debian-Paketen; in der Entwicklungsumgebung waren die Paketquellen gesperrt)
- QR-Code mit `https://stay.baax.de/interesse?q=superstay26` erzeugen
