# Baax Stay – Hinweise für Claude Code

- Bauvorlage ist `docs/KONZEPT.md`. Phase 0 ist umgesetzt; nächster Schritt ist Phase 1 (Schritt 9 ff. in Konzept §13).
- Sprache im UI und in Kommentaren: Deutsch. Enum-Werte und Code: Englisch bzw. wie im Konzept.
- Rechte immer serverseitig prüfen: `requirePermission()` in Server Actions und Route Handlern, `can.*` aus `src/lib/permissions.ts`.
- Jede Änderung nach außen (Export, Versand, Hub) ins `AuditLog` (`src/lib/audit.ts`).
- Hub-SSO und Hub-API sind Annahmen (`src/lib/auth.ts`, `src/lib/hub.ts`); bei Klärung der Schnittstelle nur dort anpassen.
- Befehle: `pnpm dev`, `pnpm test` (Vitest), `pnpm test:e2e` (Playwright, braucht DB), `pnpm db:migrate`, `pnpm db:seed`, `pnpm build`.
- Nach jedem Schritt: lauffähig, getestet, committet.
