# KONZEPT.md – Baax Stay

Stand: 12.11.2026 · Verantwortlich: Maximilian Schmitzberger · Name des Programms: Baax Stay

Dieses Dokument ist die verbindliche Bauvorlage für Claude Code. Es beschreibt Phase 0 (bis zur SuperStay LIVE am 20.11.2026), Phase 1 (Kern) und Phase 1b (Kundenerlebnis) vollständig, Phase 2 und 3 als Ausblick.

**Leitgedanke:** Käufer sehen die Software nie, nur ihre Ergebnisse. Baax setzt sich deshalb über das ab, was beim Käufer ankommt: Käuferportal, Dossiers mit Genehmigungsampel, echte Gesamtkosten, ehrliche Renditespannen und Suchberichte, die auch das Aussortierte zeigen. Bei Unklarheiten: nachfragen statt annehmen.

---

## 1. Zweck

Baax Stay ist das interne Arbeitswerkzeug der Baax Immobilien GmbH für ihre Positionierung als **Suchmakler für touristisch genutzte Immobilien** (Ferienwohnungen, Apartmenthäuser, Pensionen, kleine Hotels), **ausschließlich auf Käuferseite**, europaweit über Partnermakler.

Das Tool begleitet jeden Suchauftrag vom ersten Kontakt bis zum Nachgespräch nach dem Kauf.

**Nicht Teil des Tools:** Vermarktung von Verkäuferobjekten, öffentliches Objektportal, eigenes CRM (das CRM ist der Baax Hub), Anlageberatung.

## 2. Rahmenbedingungen

- **Eigenständige App**, eigenes Repository, eigene Datenbank, Subdomain (Vorschlag: `stay.baax.de`).
- **Baax Match** bleibt unverändert in Betrieb und wird nicht angefasst. Wiederverwendbare Teile werden kopiert, nicht geteilt.
- **Baax Hub ist die Zentrale:** Login nur über den Hub, Kontakte (Personen, Firmen) leben im Hub, Baax Stay speichert nur `hubContactId`. Aufgaben und Termine werden an den Hub gemeldet.
- **Stack:** Next.js 15 (App Router), TypeScript strict, Prisma, PostgreSQL, Tailwind, Docker, Caddy, Hetzner-VPS, Deployment über Coolify.
- **Keine teure KI in Version 1.** Alles regelbasiert und nachvollziehbar.
- **Sicherheit hat Vorrang:** Investoren- und Käuferdaten sind vertraulich.
- **Design:** modern, rund, ruhig, nicht nach KI aussehend. Hausfarbe Baax-Cyan (exakten Hex-Wert aus Baax Match bzw. Logo übernehmen), Schrift auf Cyan in dunklem Petrol (#0E3A47).
- **Mobil zuerst** für Lead-Erfassung (Messe), Desktop für die übrigen Module.

## 3. Aus Baax Match übernehmen

1. Hub-Login (SSO) inkl. Session-Handling und Rollenprüfung
2. SMTP-Versand mit Pflicht-HTML-Signatur der GmbH
3. UI-Bausteine (Buttons, Formulare, Tabellen, Layout, Navigation)
4. Matching-Grundlogik (Muss-Kriterien filtern, Wunschkriterien gewichten, Punktwert mit Begründung, „knapp daneben“)

Vorgehen: Code aus Baax Match lesen, in `/src/lib` bzw. `/src/components` dieses Projekts kopieren und an das neue Datenmodell anpassen. Keine gemeinsame Bibliothek.

## 4. Rollen und Rechte

| Rolle | Darf |
| --- | --- |
| `admin` (mail@baax.de) | alles, inkl. Honorarstaffel, Nutzerrollen, Protokolle |
| `leitung` | alles außer Systemeinstellungen; sieht Honorare |
| `mitarbeiter` | Leads, Objekte, Suchprofile bearbeiten; sieht keine Honorarstaffel und keine Honorarbeträge |
| `praktikant` | Leads erfassen, Objekte erfassen; keine Käuferdetails außer Name und Suchprofil |

Rollen kommen aus dem Hub-Token. Prüfung serverseitig in jeder Server Action und jedem Route Handler.

## 5. Status eines Suchauftrags

```
LEAD → ERSTGESPRAECH → BEAUFTRAGT → ANALYSE → SUCHE → PRUEFUNG → VERHANDLUNG → GEKAUFT → NACHBETREUUNG → ABGESCHLOSSEN
Seitliche Zustände: PAUSIERT (zurück in vorherigen Status möglich), BEENDET_OHNE_KAUF (mit Pflichtgrund)
```

Leads sind ein eigenes Objekt. Ein Lead mit Rolle Käufer wird bei Beauftragung in einen Suchauftrag umgewandelt; Verkäufer werden zu Off-Market-Objekten, Partner und Multiplikatoren zu `Partner` bzw. `Referrer`.

### Abdeckung des Ablaufs

Jeder Schritt hat ab der genannten Phase eine Funktion im System. Bis dahin wird der Schritt über Status, Notiz und Dokument-Upload am Suchauftrag geführt, damit von Anfang an nichts außerhalb des Systems liegt.

| Schritt | Funktion | Phase |
| --- | --- | --- |
| Erster Kontakt | Lead-Erfassung, Interessenformular, Dubletten-Prüfung | 0 |
| Erstgespräch | Gesprächsleitfaden mit strukturierten Notizen, daraus Suchprofil vorbefüllt | 1 |
| Beauftragung | Suchauftrag, GwG-Identifizierung, Honorarvereinbarung, Dokumente | 1 |
| Marktanalyse | Marktbericht je Zielregion | 1b |
| Suche | Objekte, Partner, Off-Market-Pipeline, Matching, Vorkenntnis-Nachweis | 1 |
| Prüfung | Ampel, Gesamtkosten, Renditespanne, Dossier | 1b |
| | Vorprüfungs-Checklisten je Land | 2 |
| Vorstellung | Freigabe, Presentation-Protokoll, Käuferportal, Benachrichtigung | 1 / 1b |
| Besichtigung | Termin und Notiz am Treffer | 1 |
| | Protokoll mit Fotos, Reisen und Reisekosten | 2 |
| Verhandlung | Angebote mit Gegenangeboten und Bedingungen | 1 |
| Kauf | Kaufabwicklung als Checkliste je Land, Honorar mit Bonus und Anrechnung | 1 |
| Nachbetreuung | Nachgespräch, Empfehlung, Folgeauftrag | 1 |
| Berichte an Käufer | Monatlicher Suchbericht | 1b |
| Prämien | Tippgeber, Agenturen, Multiplikatoren | 1 |
| Auswertung | Zielverfolgung im Dashboard | 1 |
| | Vollständige Auswertung | 3 |

## 6. Datenmodell (Prisma, Entwurf)

```prisma
enum Role { ADMIN LEITUNG MITARBEITER PRAKTIKANT }

enum LeadSource { MESSE AGENTUR MULTIPLIKATOR WEBSITE EMPFEHLUNG LINKEDIN BESTAND SONSTIGES }
enum LeadStatus { NEU KONTAKTIERT ERSTGESPRAECH UMGEWANDELT VERWORFEN }
enum LeadRole  { KAEUFER VERKAEUFER PARTNER MULTIPLIKATOR }   // Messekontakte können auch Verkäufer/Partner sein

enum MandateStatus { ERSTGESPRAECH BEAUFTRAGT ANALYSE SUCHE PRUEFUNG VERHANDLUNG GEKAUFT NACHBETREUUNG ABGESCHLOSSEN PAUSIERT BEENDET_OHNE_KAUF }
enum Segment { FEWO APARTMENTHAUS PENSION_HOTEL }            // Stufe 1, 2, 3
enum UsageGoal { RENDITE EIGENNUTZUNG KOMBINIERT EIGENBETRIEB }
enum ObjectSource { PARTNER AGENTUR PORTAL OFFMARKET DIREKT }
enum LicenseStatus { VORHANDEN BEANTRAGT FEHLT UNKLAR NICHT_NOETIG }
enum MatchStatus { NEU GEPRUEFT AN_KAEUFER ABGELEHNT GEMERKT }

model Lead {
  id            String     @id @default(cuid())
  hubContactId  String?    // gesetzt, sobald an Hub übergeben
  hubSync       String     @default("PENDING")  // PENDING, SYNCED, FAILED
  duplicateOfId String?    // Dublette eines bestehenden Leads (gleiche E-Mail/Telefon)
  name          String
  company       String?
  email         String?
  phone         String?
  role          LeadRole   @default(KAEUFER)
  source        LeadSource
  sourceDetail  String?    // z. B. "SuperStay LIVE 2026"
  referrerId    String?    // Tippgeber, Agentur oder Multiplikator, der den Kontakt gebracht hat
  interest      String?    // Freitext: was sucht/bietet er
  segment       Segment?
  regions       String[]   // grob, Freitext-Tags
  budgetMin     Int?
  budgetMax     Int?
  consentEmail  Boolean    @default(false)
  consentAt     DateTime?
  status        LeadStatus @default(NEU)
  note          String?
  createdById   String
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  mandate       Mandate?
}

model Mandate {                    // Suchauftrag
  id              String        @id @default(cuid())
  leadId          String?       @unique
  lead            Lead?         @relation(fields: [leadId], references: [id])
  hubContactId    String        // Käufer im Hub
  title           String        // z. B. "FeWo Mallorca Nord, Rendite"
  status          MandateStatus @default(ERSTGESPRAECH)
  ownerId         String        // verantwortlicher Mitarbeiter (Hub-User-ID)
  startDate       DateTime?
  endDate         DateTime?     // Laufzeit, z. B. 6 Monate
  endReason       String?       // Pflicht bei BEENDET_OHNE_KAUF
  statusBeforePause MandateStatus?   // für Rückkehr aus PAUSIERT
  contractSignedAt  DateTime?   // Suchauftrag unterschrieben
  gwgIdentifiedAt   DateTime?   // GwG-Identifizierung, Pflicht vor BEAUFTRAGT
  gwgIdentType      String?     // z. B. Ausweis vor Ort, Video-Ident
  interviewNotes    Json?       // strukturierte Notizen aus dem Erstgespräch
  offers          Offer[]
  closing         Closing?
  followUps       FollowUp[]
  documents       MandateDocument[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  profile         SearchProfile?
  fee             FeeAgreement?
  matches         Match[]
  events          MandateEvent[]
}

model SearchProfile {
  id           String    @id @default(cuid())
  mandateId    String    @unique
  mandate      Mandate   @relation(fields: [mandateId], references: [id])
  segments     Segment[]
  countries    String[]  // ISO 3166-1 alpha-2
  regions      String[]  // Region-Tags, siehe Region-Tabelle
  priceMin     Int?
  priceMax     Int
  usageGoal    UsageGoal
  minUnits     Int?      // Einheiten bzw. Zimmer
  maxUnits     Int?
  licenseRequired Boolean @default(true)
  mustCriteria Json      // Liste von Kriterien-Keys (siehe 8.)
  wishCriteria Json      // Liste { key, weight }
  financing    String?   // Freitext: Eigenkapital, Finanzierung geklärt?
  horizon      String?   // Zeithorizont
  active       Boolean   @default(true)
  updatedAt    DateTime  @updatedAt
}

model Property {                   // Objekt
  id             String        @id @default(cuid())
  title          String
  segment        Segment
  country        String        // ISO
  region         String
  locality       String?
  address        String?       // nur intern
  price          Int
  currency       String        @default("EUR")
  units          Int?          // Einheiten bzw. Zimmer
  livingArea     Int?          // m²
  licenseStatus  LicenseStatus @default(UNKLAR)
  licenseNote    String?
  licenseLight   LicenseLight  @default(GRAU)   // Phase 1b, aus licenseStatus + Regionsregel abgeleitet
  occupancyPct   Float?        // Auslastung, falls bekannt
  adr            Int?          // durchschnittlicher Tagespreis
  revenueYear    Int?          // Jahresumsatz bei Betrieben
  features       Json          // Kriterien-Keys, die erfüllt sind
  source         ObjectSource
  sourceDetail   String?
  knownSince     DateTime      @default(now())  // Vorkenntnis: seit wann Baax das Objekt kennt
  knownSourceNote String?      // woher (Partner, Portal-Link, Verkäuferkontakt ...)
  sellerLeadId   String?       // Verkäuferkontakt (Lead mit Rolle VERKAEUFER), falls Off-Market
  offmarket      Boolean       @default(false)
  referrerId     String?       // Tippgeber/Agentur, die das Objekt gebracht hat
  partnerId      String?       // Phase 2
  availability   String        @default("VERFUEGBAR")  // VERFUEGBAR, RESERVIERT, VERKAUFT, ZURUECKGEZOGEN
  priceHistory   Json          // Liste { preis, datum }; der für den Bonus maßgebliche Angebotspreis steht in Presentation
  duplicateOfId  String?       // dasselbe Objekt aus anderer Quelle (z. B. zwei Partner)
  documents      Json          // Liste von Datei-Referenzen
  photos         Json
  active         Boolean       @default(true)
  createdById    String
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  matches        Match[]
}

model Match {
  id          String      @id @default(cuid())
  mandateId   String
  propertyId  String
  mandate     Mandate     @relation(fields: [mandateId], references: [id])
  property    Property    @relation(fields: [propertyId], references: [id])
  score       Int         // 0–100
  reasons     Json        // { passt: [...], fehlt: [...], knapp: [...] }
  status      MatchStatus @default(NEU)
  rejectReason String?
  notifiedAt  DateTime?   // in Tagesübersicht gemeldet
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  @@unique([mandateId, propertyId])
}

model FeeBand {                    // Honorarstaffel, nur LEITUNG/ADMIN
  id            String @id @default(cuid())
  volumeFrom    Int
  volumeTo      Int?   // null = darüber individuell
  baseFee       Int    // Grundhonorar
  successFee    Int    // festes Erfolgshonorar
  bonusPct      Float  @default(0.10)
  bonusCapPct   Float  @default(0.25)   // Anteil am Erfolgshonorar
}

model FeeAgreement {
  id             String  @id @default(cuid())
  mandateId      String  @unique
  mandate        Mandate @relation(fields: [mandateId], references: [id])
  volumeBandId   String?
  baseFee        Int     @default(0)    // 0 in der Startphase (erste ca. 4 Mandate)
  successFee     Int
  bonusPct       Float
  bonusCapPct    Float
  travelFlat     Int?    // Reisepauschale je Reise
  sellerSideCommission Int?   // Provision der Verkäuferseite (nur Gewerbe-/Betriebsobjekte), offengelegt
  sellerSideCredited   Int?   // davon dem Käufer angerechnet
  note           String?
  // Abschlussdaten (Phase 1 einfach, Rechnung Phase 2)
  purchasePrice  Int?
  bonusAmount    Int?
  invoicedAt     DateTime?
  paidAt         DateTime?
}

model MandateEvent {               // Verlauf und Protokoll
  id         String   @id @default(cuid())
  mandateId  String
  mandate    Mandate  @relation(fields: [mandateId], references: [id])
  type       String   // STATUS_CHANGE, NOTE, EMAIL_SENT, MATCH_SENT, ...
  payload    Json
  userId     String
  createdAt  DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String
  entity    String
  entityId  String?
  meta      Json
  ip        String?
  createdAt DateTime @default(now())
}

model Region {                     // Stammdaten für Auswahl und Matching
  id       String @id @default(cuid())
  country  String
  key      String @unique           // z. B. "es-mallorca", "it-suedtirol", "de-oberallgaeu"
  name     String
  focus    Boolean @default(false)  // Schwerpunktmarkt
  licenseRule String?               // Kurzinfo Vermietungs-/Zweitwohnungsregeln (für Ampel und Dossier)
}

enum ReferrerType { TIPPGEBER AGENTUR MULTIPLIKATOR PARTNER }

model Referrer {                   // Wer bringt Kunden oder Objekte?
  id            String       @id @default(cuid())
  hubContactId  String
  type          ReferrerType
  rewardRule    String?      // z. B. "10 % des Netto-Erfolgshonorars"
  active        Boolean      @default(true)
  rewards       ReferralReward[]
}

model ReferralReward {
  id          String   @id @default(cuid())
  referrerId  String
  referrer    Referrer @relation(fields: [referrerId], references: [id])
  mandateId   String
  amount      Int
  dueAt       DateTime?
  paidAt      DateTime?
}

model Presentation {               // Nachweis: welches Objekt wann welchem Käufer vorgestellt
  id           String   @id @default(cuid())
  mandateId    String
  propertyId   String
  channel      String   // PORTAL, EMAIL, DOSSIER, VOR_ORT
  askingPrice  Int      // eingefrorener Angebotspreis (Basis Verhandlungsbonus)
  sentById     String
  sentAt       DateTime @default(now())
  viewedAt     DateTime?  // Portal: erstmals angesehen
  @@unique([mandateId, propertyId])
}

enum LicenseLight { GRUEN GELB ROT GRAU }   // vorhanden / beantragt-prüfen / fehlt-riskant / unbekannt

model CountryCost {                // Kaufnebenkosten je Land bzw. Region (Richtwerte, gepflegt von Leitung)
  id            String @id @default(cuid())
  country       String
  regionKey     String?           // optional regionale Abweichung
  label         String            // z. B. "Grunderwerbsteuer", "ITP", "Notar"
  pct           Float?            // Anteil am Kaufpreis
  flat          Int?              // fester Betrag
  note          String?
  validFrom     DateTime
}

model FxRate {                     // Wechselkurse für Vergleiche (z. B. CHF)
  id        String   @id @default(cuid())
  currency  String
  rateToEur Float
  fetchedAt DateTime @default(now())
}

model Partner {                    // Phase 1: Stammdaten; Phase 2: Zugang, Bewertung
  id            String  @id @default(cuid())
  hubContactId  String
  type          String  // MAKLER, AGENTUR, ANWALT, NOTAR, FINANZIERER
  country       String
  regions       String[]
  licenseNote   String? // Lizenz/Registrierung im Land
  commissionSplit String? // vereinbarte Teilung, Freitext
  agreementAt   DateTime? // Partnervereinbarung geschlossen
  active        Boolean @default(true)
}

model Offer {                      // Angebote und Verhandlungsstand
  id          String   @id @default(cuid())
  mandateId   String
  mandate     Mandate  @relation(fields: [mandateId], references: [id])
  propertyId  String
  amount      Int
  madeAt      DateTime
  conditions  String?  // z. B. Finanzierungsvorbehalt, Inventar
  response    String   @default("OFFEN")  // OFFEN, ANGENOMMEN, ABGELEHNT, GEGENANGEBOT
  counterAmount Int?
  note        String?
}

model Closing {                    // Kaufabwicklung als Checkliste
  id            String   @id @default(cuid())
  mandateId     String   @unique
  mandate       Mandate  @relation(fields: [mandateId], references: [id])
  propertyId    String
  checklist     Json     // Punkte je Land: Finanzierung, Anwalt/Notar, Steuernummer (z. B. NIE), Vorvertrag, Anzahlung, Beurkundung, Übergabe
  notaryDate    DateTime?
  handoverDate  DateTime?
}

model FollowUp {                   // Nachbetreuung
  id          String   @id @default(cuid())
  mandateId   String
  mandate     Mandate  @relation(fields: [mandateId], references: [id])
  dueAt       DateTime
  doneAt      DateTime?
  feedback    String?
  referralGiven Boolean @default(false)
  nextMandateWanted Boolean @default(false)
}

model MandateDocument {            // Unterlagen am Suchauftrag
  id          String   @id @default(cuid())
  mandateId   String
  mandate     Mandate  @relation(fields: [mandateId], references: [id])
  kind        String   // SUCHAUFTRAG, GWG_NACHWEIS, FINANZIERUNG, VOLLMACHT, SONSTIGES
  fileRef     String
  uploadedById String
  uploadedAt  DateTime @default(now())
}

model PortalAccess {               // Phase 1b
  id          String   @id @default(cuid())
  mandateId   String
  tokenHash   String   @unique
  expiresAt   DateTime
  revokedAt   DateTime?
  lastSeenAt  DateTime?
}
```

Phase-2-Modelle (nur vorbereiten, nicht bauen): `Inspection`, `Trip`, `Precheck`, `AccessLink` (für Partner), `DocumentTemplate`, `MarketReport`.

## 7. Phase 0 – bis zur SuperStay LIVE (Ziel: 19.11.2026)

**Ziel:** Kontakte auf der Messe in unter einer Minute auf dem Handy erfassen, sauber und mit Einwilligung, ohne Datenverlust.

### Umfang

1. Projekt-Setup: Next.js, Prisma, PostgreSQL, Docker, Coolify-Deployment auf `stay.baax.de`
2. Hub-Login (aus Baax Match übernommen), Rollen aus dem Token
3. Layout mit Navigation, mobil optimiert
4. **Lead-Schnellerfassung** `/leads/neu`
   - Pflichtfelder: Name, Rolle (Käufer/Verkäufer/Partner/Multiplikator), mindestens Telefon oder E-Mail
   - Optional: Firma, Interesse (Freitext), Segment, Regionen (Tags), Budget grob (Auswahl: bis 300 T€ / 300 T€–1 Mio. / 1–3 Mio. / über 3 Mio.), Notiz
   - Quelle vorbelegt über Einstellung „aktives Event“ (z. B. `MESSE` + „SuperStay LIVE 2026“)
   - Checkbox Einwilligung E-Mail-Kontakt mit Zeitstempel
   - Großer Speichern-Button, danach sofort leeres Formular für den nächsten Kontakt
   - Offline-Puffer: bei fehlender Verbindung im Browser zwischenspeichern (IndexedDB) und automatisch nachsenden, sichtbarer Hinweis „3 Kontakte warten auf Übertragung“
5. **Lead-Liste** `/leads` mit Filter nach Quelle, Rolle, Status; Export als CSV (nur LEITUNG/ADMIN)
6. **Öffentliches Interessenformular** `/interesse` (für QR-Code auf Visitenkarte/Einseiter)
   - Felder: Name, E-Mail, Telefon optional, Rolle, Interesse, Region, Budget grob, Einwilligung (Pflicht für Absenden), Datenschutzhinweis
   - Spam-Schutz: Honeypot + Rate-Limit pro IP, kein Google reCAPTCHA
   - Erzeugt Lead mit Quelle aus URL-Parameter `?q=superstay26`
7. **Hub-Übergabe:** Lead an Hub-API senden (Kontakt anlegen + Aufgabe „Nachfassen“); falls Hub-Schnittstelle bis zur Messe nicht steht: Lead bleibt in Baax Stay, Übergabe-Status `PENDING`, Nachholen per Button

### Abnahme Phase 0

- [ ] Erfassung eines Kontakts auf dem Smartphone in unter 60 Sekunden
- [ ] Erfassung funktioniert ohne Netz und wird nachgesendet
- [ ] QR-Formular legt Lead mit korrekter Quelle an
- [ ] Nur eingeloggte Hub-Nutzer sehen Leads
- [ ] Deployment läuft, Backup der Datenbank täglich

**Ausweichlösung:** Wenn bis 18.11. nicht stabil: Erfassung direkt im Hub oder in einer Liste, CSV-Import in Phase 1 (`/leads/import`).

## 8. Phase 1 – Kern (ca. 5–6 Wochen nach der Messe)

**Ziel:** Bestehender Suchkunde und Messe-Leads werden vollständig im System geführt.

### Module

1. **Leads → Suchauftrag umwandeln:** Button „In Suchauftrag umwandeln“, übernimmt Daten, setzt Lead auf `UMGEWANDELT`.
2. **Suchaufträge** `/auftraege`
   - Liste als Tabelle und Kanban nach Status
   - Detailseite: Kopf (Käufer, Status, Laufzeit, Verantwortlicher), Tabs: Suchprofil, Treffer, Honorar, Verlauf
   - Statuswechsel nur in erlaubte Folgestatus; `BEENDET_OHNE_KAUF` verlangt Grund
3. **Suchprofile** (im Suchauftrag)
   - Segmente, Länder, Regionen (aus `Region`), Preis von–bis, Nutzungsziel, Einheiten/Zimmer, Lizenz erforderlich
   - Muss- und Wunschkriterien aus Kriterienkatalog (siehe unten), Wunschkriterien mit Gewicht 1–3
4. **Objekte** `/objekte`
   - Erfassung mit Segment-abhängigen Feldern (FeWo: Lizenz, Auslastung, Tagespreis; Pension/Hotel: Zimmer, Umsatz, Konzession)
   - Upload Fotos und Unterlagen (lokal auf Volume oder Nextcloud via WebDAV, siehe offene Punkte)
   - Angebotspreis zum Zeitpunkt der Vorstellung wird beim ersten Versand an Käufer eingefroren
5. **Matching**
   - Läuft bei Speichern eines Objekts oder Suchprofils (Server Action, synchron bis 500 Profile, sonst Job)
   - Muss-Filter: Segment, Land, Region (oder ganzes Land, wenn Profil nur Land hat), Preis mit Toleranz +10 %, Lizenz falls erforderlich
   - Punktwert: Basis 50 bei bestandenem Muss-Filter; Wunschkriterien addieren bis 50 nach Gewicht; Preis im Rahmen +5, über Rahmen (Toleranzband) −5
   - „Knapp daneben“: genau ein Muss-Kriterium knapp verfehlt (Preis bis +20 %, Nachbarregion) → Treffer mit Kennzeichnung
   - Begründung als `{ passt, fehlt, knapp }`
   - Treffer-Tabelle je Suchauftrag und je Objekt; Status setzen; Ablehnungsgrund Pflicht
6. **Honorar**
   - `FeeBand` pflegen (`/einstellungen/honorar`, nur LEITUNG/ADMIN)
   - Im Suchauftrag: Band automatisch aus Budget vorschlagen, überschreibbar; Grundhonorar standardmäßig 0 (Startphase), Schalter „Grundhonorar aktiv“
   - Bei Status `GEKAUFT`: Kaufpreis eintragen → Bonus = min(bonusPct × (Angebotspreis − Kaufpreis), bonusCapPct × Erfolgshonorar), nie negativ; Gesamtsumme anzeigen
   - Hinweis bei Land `AT`: „Gesetzlichen Höchstsatz prüfen (3 % zzgl. USt)“ mit Vergleichsrechnung
7. **Automatisierungen**
   - Lead ohne Kontakt nach 2 Werktagen → Aufgabe im Hub
   - Tägliche Trefferübersicht per Mail an Verantwortliche (nur neue Treffer, `notifiedAt` setzen), 7:30 Uhr
8. **Dashboard** `/`: offene Leads, Suchaufträge nach Status, neue Treffer, Aufgaben heute
9. **Vorkenntnis-Nachweis**
   - Jedes Objekt speichert `knownSince` und `knownSourceNote` beim Anlegen (nicht nachträglich änderbar, nur ADMIN mit Protokoll)
   - Jede Vorstellung an einen Käufer erzeugt eine `Presentation` (Kanal, Zeitpunkt, eingefrorener Angebotspreis)
   - Warnung, wenn ein Objekt vor Beginn des Suchauftrags bekannt war: „Vorkenntnis – Honoraranspruch prüfen“
10. **Verkäuferkontakte als Objektquelle**
    - Lead mit Rolle `VERKAEUFER`: Button „Als Objekt anlegen“ → Property mit `offmarket = true`, `sellerLeadId`, `source = DIREKT`
    - Liste „Off-Market-Pipeline“: Verkäuferkontakte, Objekt angelegt ja/nein, Treffer vorhanden ja/nein
    - Hinweis im UI: Baax arbeitet auf Käuferseite; keine Provision vom Verkäufer bei Wohnungen und Häusern
11. **Tippgeber, Agenturen, Multiplikatoren**
    - `Referrer` pflegen; Lead und Objekt können einem Referrer zugeordnet werden
    - Bei Status `GEKAUFT`: Prämie nach Regel vorschlagen (`ReferralReward`), fällig/bezahlt markieren
    - Übersicht je Referrer: gebrachte Leads, Objekte, Abschlüsse, Prämien
12. **Partner-Stammdaten**
    - Partnermakler, Agenturen, Anwälte, Notare, Finanzierer je Land und Region; Lizenzhinweis, vereinbarte Provisionsteilung, Datum der Partnervereinbarung
    - Objekt wird dem einreichenden Partner zugeordnet (schützt auch dessen Provisionsanspruch)
    - Warnung, wenn ein Objekt von einem Partner ohne Vereinbarung kommt
13. **Dubletten-Prüfung**
    - Leads: gleiche E-Mail oder Telefonnummer → Hinweis und Zusammenführen
    - Objekte: gleiches Land, ähnliche Adresse/Ort, Preis ±5 %, gleiche Einheitenzahl → Hinweis „möglicherweise dasselbe Objekt“; maßgeblich ist die früheste Quelle (`knownSince`)
14. **Erstgespräch-Leitfaden**
    - Feste Fragen (Ziel, Budget, Eigenkapital und Finanzierung, Regionen, Zeithorizont, Erfahrung, Ausschlüsse) mit strukturierten Antworten in `interviewNotes`
    - Button „Suchprofil daraus anlegen“; Feld „Einschätzung: realistisch ja/nein/mit Anpassung“
15. **Besichtigung, Angebote und Verhandlung**
    - Am Treffer: Besichtigungstermin und Kurznotiz (ausführliches Protokoll in Phase 2)
    - `Offer` je Objekt: Betrag, Datum, Bedingungen, Antwort, Gegenangebot; Verlauf als Zeitleiste
    - Ersparnis gegenüber dem eingefrorenen Angebotspreis wird laufend angezeigt
16. **Kaufabwicklung**
    - `Closing` mit Checkliste je Land (Startvorlagen: DE, AT, IT, ES; weitere als allgemeine Vorlage): Finanzierung, Anwalt bzw. Notar, Steuernummer, Vorvertrag, Anzahlung, Beurkundung, Übergabe
    - Fällige Punkte erzeugen Aufgaben im Hub
    - Nach Beurkundung: Status `GEKAUFT`, Honorar berechnen inkl. Bonus und angerechneter Verkäuferprovision; Rechnungsdaten als Export für die Buchhaltung
17. **Nachbetreuung**
    - `FollowUp` drei Monate nach Übergabe automatisch angelegt, Aufgabe im Hub
    - Erfasst: Feedback, Empfehlung ausgesprochen, weiterer Suchauftrag gewünscht; danach Status `ABGESCHLOSSEN`
18. **Dokumente am Suchauftrag**
    - Unterschriebener Suchauftrag, GwG-Nachweis, Finanzierungsbestätigung, Vollmachten; nur LEITUNG/ADMIN sehen GwG-Nachweise
19. **Vorrang bei mehreren Käufern**
    - Passt ein Objekt zu mehreren aktiven Suchaufträgen, zeigt das System alle Treffer mit Reihenfolge nach Beauftragungsdatum
    - Vorstellung an einen zweiten Käufer erst nach Freigabe durch die Leitung; Entscheidung wird protokolliert
20. **Verfügbarkeit und Preisänderungen**
    - Objektstatus verfügbar, reserviert, verkauft, zurückgezogen; Preisänderungen mit Datum in `priceHistory`
    - Bei „verkauft“ oder „zurückgezogen“: offene Treffer werden geschlossen, betroffene Suchaufträge erhalten einen Hinweis
21. **Zielverfolgung**
    - Dashboard zeigt das laufende Ziel (Start: 3 Suchaufträge in 90 Tagen) mit Stand, dazu Leads je Quelle und Umwandlung Lead → Erstgespräch → Auftrag
22. **Suchprofil an Partner senden**
    - Im Suchauftrag: Button „An Partner senden“; Auswahl passender Partner nach Land und Region
    - Versand als Mail mit anonymisiertem Suchprofil (ohne Name und Kontaktdaten des Käufers) im Text und als PDF; Deutsch oder Englisch je Partner
    - Jeder Versand wird als `MandateEvent` protokolliert (Partner, Zeitpunkt, Inhalt); Übersicht „an wen gesendet, Rückmeldung ja/nein“
    - Nur an Partner mit geschlossener Partnervereinbarung, sonst Warnung
23. **Suche und gespeicherte Filter**
    - Globale Suche über Leads, Suchaufträge, Objekte, Partner und Referrer (Name, Ort, Region, Titel)
    - Filter in allen Listen; Filter als benannte Ansicht je Nutzer speicherbar (z. B. „Objekte Mallorca bis 800.000 €“)
24. **Import**
    - CSV-Import für Leads, Objekte und Partner mit Spaltenzuordnung, Vorschau und Dubletten-Prüfung vor dem Speichern
    - Bestehender Suchkunde wird über die normale Maske oder den Import angelegt; Import nur für LEITUNG/ADMIN, protokolliert

### Kriterienkatalog (Start)

```
lage_strand, lage_berg_ski, lage_see, lage_altstadt, meerblick, bergblick,
pool, garten_terrasse, parkplatz, aufzug, barrierearm,
lizenz_vorhanden, vermietung_laufend, agentur_vorhanden,
renovierungsbedarf_gering, sanierungsobjekt, ganzjahresdestination,
flughafen_unter_60min, zimmer_mit_bad, restaurant_vorhanden, wellness
```

Katalog als Tabelle pflegbar (Phase 1 als Konstante, Phase 2 editierbar).

### Abnahme Phase 1

- [ ] Ein Suchauftrag läuft komplett von Lead bis `GEKAUFT` durch
- [ ] Neues Objekt erzeugt Treffer mit nachvollziehbarer Begründung
- [ ] Honorar inkl. Bonus wird korrekt berechnet (Testfälle unten)
- [ ] Mitarbeiter ohne Leitungsrolle sehen keine Honorarbeträge
- [ ] Jede Statusänderung steht im Verlauf
- [ ] Jede Objektvorstellung ist mit Zeitpunkt und Angebotspreis protokolliert; Vorkenntnis-Warnung greift
- [ ] Ein Verkäuferkontakt von der Messe wird mit zwei Klicks zum Off-Market-Objekt
- [ ] Prämie für einen Tippgeber wird bei Kauf korrekt vorgeschlagen
- [ ] Dasselbe Objekt aus zwei Quellen wird als mögliche Dublette erkannt
- [ ] Ein Angebot mit Gegenangebot ist erfasst, die Ersparnis stimmt mit dem Bonus überein
- [ ] Kaufabwicklung für ein Objekt in Spanien und eines in Deutschland mit der jeweiligen Checkliste durchgespielt
- [ ] Ein Objekt, das zu zwei Käufern passt, geht erst nach Freigabe an den zweiten
- [ ] Status `BEAUFTRAGT` ist ohne GwG-Identifizierung nicht möglich
- [ ] Ein Suchprofil geht anonymisiert an zwei Partner; der Versand steht im Verlauf, der Käufername ist nirgends enthalten
- [ ] Eine CSV mit Objekten wird eingelesen, Dubletten werden vor dem Speichern angezeigt

### Testfälle Honorar

| Erfolgshonorar | Angebotspreis | Kaufpreis | Bonus erwartet |
| --- | --- | --- | --- |
| 40.000 | 2.050.000 | 1.900.000 | 10.000 (gedeckelt, 10 % von 150.000 = 15.000 > 25 % Cap) |
| 40.000 | 2.000.000 | 1.950.000 | 5.000 |
| 18.500 | 800.000 | 820.000 | 0 |

## 9. Phase 1b – Kundenerlebnis (ca. 3–4 Wochen direkt nach Phase 1)

**Ziel:** Das, was der Käufer sieht, ist besser als bei jedem anderen Makler. Diese Phase ist das Alleinstellungsmerkmal der Software.

### Module

1. **Käuferportal** `/portal/[token]`
   - Zugang per persönlichem Magic Link (kein Passwort), Gültigkeit 30 Tage, verlängerbar; Link-Versand über SMTP mit Signatur
   - Neues Modell `PortalAccess` (mandateId, tokenHash, expiresAt, revokedAt, lastSeenAt); Freigabe je Objekt über `Match.status = AN_KAEUFER` plus `Presentation`
   - Zeigt: Status des Suchauftrags als Zeitleiste der Ablaufschritte, nächste Schritte, Ansprechpartner mit Foto und Telefon
   - Freigegebene Objekte (nur nach Freigabe durch Mitarbeiter): Karte mit Fotos, Eckdaten, Genehmigungsampel, Gesamtkosten, Renditespanne, Dossier-PDF
   - Aktionen: „merken“, „ablehnen“ mit Pflichtgrund (Auswahl + Freitext), „Besichtigung anfragen“ → Aufgabe im Hub
   - Ablehnungsgründe fließen als Vorschlag in das Suchprofil zurück („3 Ablehnungen wegen Lage zu touristisch – Kriterium anpassen?“)
   - Erstes Ansehen eines Objekts setzt `Presentation.viewedAt`
   - Sprache: Deutsch, Englisch umschaltbar
2. **Genehmigungsampel**
   - Je Objekt `LicenseLight`, abgeleitet aus `licenseStatus` und Regionsregel: GRÜN (vorhanden, übertragbar), GELB (beantragt oder zu prüfen), ROT (fehlt oder Region mit Vergabestopp), GRAU (unbekannt)
   - Begründung in einem Satz, sichtbar intern, im Portal und im Dossier
   - Matching: Objekte mit ROT werden bei Profilen mit „Lizenz erforderlich“ nicht als Treffer gezeigt, nur als „knapp daneben“
3. **Gesamtkostenrechnung**
   - Je Objekt: Kaufpreis + Nebenkosten aus `CountryCost` (Land bzw. Region) + Baax-Honorar + optional Renovierungsbudget = Gesamtinvestition
   - Ausweis in EUR; bei CHF Originalwährung plus Umrechnung (`FxRate`, täglich aktualisiert)
   - Hinweis „Richtwerte, ohne Gewähr; verbindlich durch Notar/Steuerberater vor Ort“
4. **Renditerechner mit Spannen**
   - Eingaben je Objekt: Auslastung, Tagespreis bzw. Umsatz, Betriebskosten, Verwaltung/Agentur, Rücklagen, Steuern grob
   - Ausgabe in drei Szenarien (vorsichtig, mittel, gut) mit Nettomietrendite auf Gesamtinvestition
   - Szenarien standardmäßig ±15 % auf Auslastung und Tagespreis, je Objekt anpassbar
   - Keine Renditeversprechen: Pflichthinweis im Portal und Dossier
5. **Objektdossier**
   - PDF und Weblink aus denselben Daten (Playwright rendert die Dossier-Route)
   - Inhalt: Fotos, Lage, Eckdaten, Genehmigungsampel mit Begründung, Gesamtkosten, Renditespanne, Stärken und Risiken (Freitext Mitarbeiter), Vorprüfungsstand
   - Deutsch und Englisch; Corporate Design Baax (Cyan, Petrol)
6. **Suchbericht mit Aussortiertem**
   - Monatlich je aktivem Suchauftrag als Entwurf zur Freigabe
   - Abschnitte: neu gesichtet (Anzahl), vorgestellt, aussortiert mit Grund (gruppiert: Preis, Lizenz, Lage, Zustand, Zahlen), Marktbeobachtung (Freitext), nächste Schritte
   - Nach Freigabe: im Portal sichtbar und per Mail angekündigt
7. **Marktbericht je Suchauftrag**
   - Entsteht im Status `ANALYSE`: je Zielregion Vermietungsregeln (aus `Region.licenseRule`), Nebenkosten (aus `CountryCost`), Preisniveau und Auslastung als Freitext des Bearbeiters, Risiken
   - Als PDF und im Portal; Vorlage in Deutsch und Englisch
8. **Benachrichtigungen an Käufer**
   - Mail mit Portal-Link bei: neuem freigegebenem Objekt, neuem Suchbericht, Statuswechsel
   - Immer nach Freigabe durch einen Mitarbeiter, nie automatisch ohne Sichtung

### Abnahme Phase 1b

- [ ] Ein Käufer öffnet sein Portal per Link, sieht Status und freigegebene Objekte, lehnt eines mit Grund ab
- [ ] Ampel, Gesamtkosten und Renditespanne erscheinen konsistent intern, im Portal und im Dossier
- [ ] Dossier als PDF auf Deutsch und Englisch erzeugbar
- [ ] Suchbericht zeigt aussortierte Objekte mit Gründen
- [ ] Portal-Zugriffe werden protokolliert; abgelaufene Links zeigen eine freundliche Seite mit Kontaktmöglichkeit

## 10. Ausblick Phase 2 und 3

**Phase 2 (ca. 4–6 Wochen):**
- **Partner erweitert:** Bewertung nach Zusammenarbeit, Leistungsübersicht (eingereichte Objekte, Abschlüsse), Stammdaten bestehen seit Phase 1
- **Mobile Besichtigung:** Protokoll und Fotos direkt vom Handy am Objekt
- **Partnerzugang** per Link, **mehrsprachig (Deutsch, Englisch; Spanisch, Italienisch, Französisch optional)**: anonymisiertes Suchprofil, Formular zur Objekt-Einreichung (legt Property mit `source = PARTNER` und `knownSince` an)
- **Vorprüfung** mit Checklisten je Segment und Land
- **Besichtigungen und Reisen** mit Protokoll, Fotos, Reisekosten je Auftrag
- **Vorlagen** aus Datensatz befüllt: Suchauftrag, Partnervereinbarung, Tippgeberbestätigung; später Unterschrift über Baax Sign
- **Erinnerungen** Laufzeitende und Nachgespräch nach 3 Monaten

**Phase 3:** Länder- und Regionswissen ausbauen, Auswertung (Quelle → Lead → Auftrag → Kauf, Dauer je Status, Honorar je Monat, Leistung je Referrer und Partner), gespeicherte Portal-Suchen als Kandidaten.

## 11. Sicherheit und Datenschutz

- Alle Seiten außer `/interesse` und `/portal/[token]` erfordern Hub-Login
- Portal-Token: zufällig, mindestens 32 Byte, gehasht gespeichert, ablaufend, widerrufbar; Portal zeigt nur Daten des eigenen Suchauftrags und nur freigegebene Objekte; keine internen Notizen, keine Honorarstaffel
- Rechteprüfung serverseitig, nie nur im UI
- `AuditLog` für Login, Export, Honorarzugriff, jeden Versand nach außen
- Uploads: Typ- und Größenprüfung, Dateinamen randomisieren, kein öffentlicher Zugriff
- Einwilligungen mit Zeitstempel speichern; Leads ohne Einwilligung nicht per Werbe-Mail kontaktieren
- Löschkonzept: verworfene Leads nach 12 Monaten automatisch löschen (Einstellung)
- GwG: Feld „Identifizierung erfolgt“ (Datum, Art) am Suchauftrag, Pflicht vor Status `BEAUFTRAGT`
- Tägliches Datenbank-Backup, Aufbewahrung 30 Tage; Wiederherstellung einmal testen
- DSGVO: Auskunft je Kontakt als Export (alle Daten zu einer `hubContactId`), Löschung auf Anfrage mit Protokoll; Aufbewahrungsfristen für abgeschlossene Aufträge beachten (GwG-Unterlagen 5 Jahre)
- Getrennte Umgebungen: Staging und Produktion; Migrationen zuerst auf Staging
- Fehlerüberwachung und Benachrichtigung an den Admin bei fehlgeschlagenen Jobs (Hub-Übergabe, Mailversand, Wechselkurse)
- Tests: Unit-Tests für Matching, Honorar, Ampel, Kosten und Rendite; ein End-to-End-Test „Lead bis Kauf“

## 12. Projektstruktur

```
/src
  /app
    /(auth)          Login-Callback Hub
    /leads           Liste, neu, import
    /interesse       öffentliches Formular
    /auftraege       Liste, Kanban, [id]
    /objekte         Liste, neu, [id], offmarket
    /tippgeber       Referrer, Prämien
    /portal/[token]  Käuferportal (öffentlich mit Token)
    /dossier/[id]    Dossier-Ansicht (auch Quelle für PDF)
    /einstellungen   honorar, regionen, nebenkosten, event
    /api             hub-webhook, cron, pdf
  /components        UI-Bausteine (aus Baax Match)
  /lib
    auth.ts          Hub-SSO, Rollen
    mail.ts          SMTP + Signatur
    matching.ts      Matching-Logik
    fees.ts          Honorarberechnung
    hub.ts           Hub-API-Client
    audit.ts
    license.ts       Genehmigungsampel
    costs.ts         Gesamtkosten inkl. Nebenkosten, Währung
    yield.ts         Renditerechner mit Szenarien
    portal.ts        Token, Freigaben, Ablehnungsgründe
    i18n/            de.json, en.json
/prisma
  schema.prisma
  seed.ts            Regionen, Kriterien, Honorarstaffel-Startwerte
```

## 13. Bauvorgehen für Claude Code

1. Projekt anlegen, Docker + Coolify, leere Seite live
2. Hub-Login aus Baax Match übernehmen, Rollen testen
3. Prisma-Schema Phase 0 (Lead, AuditLog, Region), Seed
4. Lead-Schnellerfassung mobil inkl. Offline-Puffer
5. Interessenformular mit Spam-Schutz
6. Lead-Liste, CSV-Export
7. Hub-Übergabe (oder PENDING-Mechanik)
8. → Abnahme Phase 0
9. Schema Phase 1 ergänzen (Mandate, SearchProfile, Property, Match, FeeBand, FeeAgreement, MandateEvent)
10. Suchaufträge + Statuslogik
11. Suchprofile, Objekte, Uploads
12. Matching + Tests
13. Honorar + Tests
14. Vorkenntnis-Nachweis und Presentation-Protokoll
15. Off-Market-Pipeline aus Verkäuferkontakten
16. Referrer und Prämien; Partner-Stammdaten; Dubletten-Prüfung
16a. Erstgespräch-Leitfaden; Besichtigungstermin, Angebote und Verhandlung
16b. Kaufabwicklung mit Checklisten, Nachbetreuung, Dokumente am Suchauftrag
16c. Vorrangregel, Verfügbarkeit und Preisänderungen
16d. Suchprofil-Versand an Partner, globale Suche und gespeicherte Filter, CSV-Import
17. Automatisierungen (Cron), Dashboard mit Zielverfolgung
18. → Abnahme Phase 1
19. i18n-Grundlage (de/en)
20. Genehmigungsampel, Nebenkosten-Stammdaten, Wechselkurse
21. Gesamtkosten- und Renditerechner + Tests
22. Dossier-Ansicht und PDF
23. Käuferportal mit Token, Freigaben, Ablehnungsgründen
24. Suchbericht und Marktbericht als Entwurf mit Freigabe; Benachrichtigungen an Käufer
25. → Abnahme Phase 1b

Nach jedem Schritt: lauffähig, getestet, committet.

## 14. Offene Punkte

- [ ] Subdomain bestätigen (Vorschlag `stay.baax.de`); Name „Baax Stay“ ist entschieden
- [ ] Hub-Schnittstelle: Endpunkte für Kontakt anlegen, Aufgabe anlegen, Rollen im Token (wie bei Baax Match?)
- [ ] Ablage Fotos/Unterlagen: Server-Volume oder Nextcloud (WebDAV)
- [ ] Honorarstaffel-Startwerte für dieses Segment
- [ ] Vorprüfungs-Checklisten je Segment und Land (für Phase 2)
- [ ] Exakter Hex-Wert Baax-Cyan
- [ ] Nebenkosten-Richtwerte je Land/Region für die Startmärkte (DE-Bayern, AT-Tirol, IT-Südtirol, ES-Balearen) inhaltlich erfassen und regelmäßig prüfen
- [ ] Regionsregeln für die Genehmigungsampel (Kurztexte je Schwerpunktregion)
- [ ] Quelle für Wechselkurse (z. B. EZB-Referenzkurse)
- [ ] Prämienregeln für Tippgeber und Agenturen (Höhe, Fälligkeit)
- [ ] Checklisten der Kaufabwicklung für DE, AT, IT, ES inhaltlich festlegen (mit Partnern vor Ort abstimmen)
- [ ] Rechnungen: Erstellung im Hub bzw. in der Buchhaltung; Baax Stay liefert nur die Rechnungsdaten als Export
- [ ] Vorrangregel bestätigen (Reihenfolge nach Beauftragungsdatum, zweiter Käufer nur nach Freigabe)
