# Baax Stay – Hinweise für Claude Code

- Bauvorlage ist `docs/KONZEPT.md`. Phase 0, Phase 1 und Phase 1b sind umgesetzt; als Nächstes käme Phase 2 (Konzept §10).
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
