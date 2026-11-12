# Baax Stay – Hinweise für Claude Code

- Bauvorlage ist `docs/KONZEPT.md`. Phase 0, 1, 1b und 2 sind umgesetzt; als Nächstes käme Phase 3 (Konzept §10: Länderwissen, vollständige Auswertung, gespeicherte Portal-Suchen).
- Kriterienkatalog liegt seit Phase 2 in der Tabelle `Criterion` (`src/lib/services/criteria.ts`); Formulare bekommen die Kriterien als Prop, Schlüssel nie umbenennen.
- Partnerzugang (`/partner-zugang/[token]`) ist öffentlich mit Token wie das Käuferportal; Texte in `src/lib/i18n/partner.ts` (fünf Sprachen).
- Alles, was Käufer sehen (Portal, Dossier, Berichte, Mails), läuft über `src/lib/i18n` (de/en). Ampel, Gesamtkosten und Rendite nur über `src/lib/services/figures.ts` berechnen, damit sie überall gleich sind.
- Käufer-Mails nie automatisch senden: immer `BuyerNotification`-Entwurf, Versand nach Sichtung.
- Fachlogik liegt als reine Funktionen in `src/lib/*.ts` (Matching, Honorar, Status, Ampel, Checklisten) mit Unit-Tests; Datenbankzugriffe in `src/lib/services/*`.
- E2E-Tests nutzen den Dev-Server mit Turbopack in `.next-e2e`; `pnpm dev` baut in `.next-dev`, `pnpm build` in `.next`.
- Sprache im UI und in Kommentaren: Deutsch. Enum-Werte und Code: Englisch bzw. wie im Konzept.
- Rechte immer serverseitig prüfen: `requirePermission()` in Server Actions und Route Handlern, `can.*` aus `src/lib/permissions.ts`.
- Jede Änderung nach außen (Export, Versand, Hub) ins `AuditLog` (`src/lib/audit.ts`).
- Hub-SSO und Hub-API sind Annahmen (`src/lib/auth.ts`, `src/lib/hub.ts`); bei Klärung der Schnittstelle nur dort anpassen.
- Befehle: `pnpm dev`, `pnpm test` (Vitest), `pnpm test:e2e` (Playwright, braucht DB), `pnpm db:migrate`, `pnpm db:seed`, `pnpm build`.
- Nach jedem Schritt: lauffähig, getestet, committet.
