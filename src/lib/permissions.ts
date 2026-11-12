import type { Role } from "@prisma/client";

/**
 * Rechte nach Konzept §4. Reine Funktionen, damit sie testbar sind.
 * Prüfung immer serverseitig (Server Action / Route Handler), nie nur im UI.
 */

export const ROLE_ORDER: Role[] = ["PRAKTIKANT", "MITARBEITER", "LEITUNG", "ADMIN"];

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(min);
}

export const can = {
  /** Leads erfassen dürfen alle Rollen. */
  createLead: (role: Role) => ROLE_ORDER.includes(role),
  /** Lead-Liste sehen dürfen alle; Praktikanten sehen eingeschränkte Felder. */
  viewLeads: (role: Role) => ROLE_ORDER.includes(role),
  /** Kontaktdaten, Firma, Notizen der Leads sehen: ab Mitarbeiter. */
  viewLeadContactDetails: (role: Role) => roleAtLeast(role, "MITARBEITER"),
  /** Lead bearbeiten (Status, Notiz, Zusammenführen): ab Mitarbeiter. */
  editLead: (role: Role) => roleAtLeast(role, "MITARBEITER"),
  /** CSV-Export: nur Leitung und Admin. */
  exportLeads: (role: Role) => roleAtLeast(role, "LEITUNG"),
  /** Hub-Übergabe manuell auslösen: ab Mitarbeiter. */
  syncHub: (role: Role) => roleAtLeast(role, "MITARBEITER"),
  /** Aktives Event und Betriebseinstellungen: Leitung und Admin. */
  editEventSetting: (role: Role) => roleAtLeast(role, "LEITUNG"),
  /** Systemeinstellungen, Nutzerrollen, Protokolle: nur Admin. */
  systemSettings: (role: Role) => role === "ADMIN",
  viewAuditLog: (role: Role) => role === "ADMIN",
  /** Honorare (Phase 1): Leitung und Admin. */
  viewFees: (role: Role) => roleAtLeast(role, "LEITUNG"),
} as const;

export type Permission = keyof typeof can;

export class ForbiddenError extends Error {
  constructor(message = "Keine Berechtigung") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can[permission](role)) throw new ForbiddenError();
}

/** Übersetzt Rollenbezeichnungen aus dem Hub-Token in die Stay-Rolle. */
export function mapHubRole(input: unknown): Role | null {
  const values = Array.isArray(input) ? input : [input];
  const normalized = values
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toUpperCase());

  // Höchste enthaltene Rolle gewinnt.
  const aliases: Record<string, Role> = {
    ADMIN: "ADMIN",
    ADMINISTRATOR: "ADMIN",
    SUPERADMIN: "ADMIN",
    LEITUNG: "LEITUNG",
    GESCHAEFTSFUEHRUNG: "LEITUNG",
    MANAGER: "LEITUNG",
    MITARBEITER: "MITARBEITER",
    USER: "MITARBEITER",
    MEMBER: "MITARBEITER",
    PRAKTIKANT: "PRAKTIKANT",
    INTERN: "PRAKTIKANT",
    AZUBI: "PRAKTIKANT",
  };

  let best: Role | null = null;
  for (const n of normalized) {
    const r = aliases[n];
    if (r && (!best || roleAtLeast(r, best))) best = r;
  }
  return best;
}
