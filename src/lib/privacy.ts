import type { MandateStatus } from "@prisma/client";
import { normalizeEmail, normalizePhone } from "./leads";

/**
 * DSGVO-Auskunft und Löschung (Konzept §11). Reine Regeln, getestet; Datenbankzugriffe in services/privacy.ts.
 *
 * Grundsätze:
 * - Leads ohne Suchauftrag werden gelöscht.
 * - Laufende Suchaufträge werden nicht angefasst: erst beenden (Vertragsverhältnis besteht).
 * - Abgeschlossene Aufträge mit GwG-Identifizierung oder Kauf: Aufbewahrung 5 Jahre ab Ende des Kalenderjahres,
 *   in dem die Geschäftsbeziehung endete (§ 8 Abs. 4 GwG). Bis dahin bleibt alles, danach Anonymisierung.
 * - Sonst Anonymisierung: Personenbezug weg, Objekte, Vorstellungen und Verlauf ohne Namen bleiben
 *   (Nachweis eines späteren Honoraranspruchs, Art. 17 Abs. 3 lit. e DSGVO).
 * - Tippgeber mit ausgezahlter Prämie: Buchungsbelege 10 Jahre (§ 147 AO, § 257 HGB).
 */

export type ErasureAction = "DELETE" | "ANONYMIZE" | "RETAIN" | "BLOCKED";

export type ErasureDecision = {
  action: ErasureAction;
  reason: string;
  /** Bis wann aufbewahrt werden muss (nur bei RETAIN). */
  retainUntil?: Date;
};

export const ANONYMIZED_NAME = "Gelöscht (DSGVO)";
export const GWG_RETENTION_YEARS = 5;
export const TAX_RETENTION_YEARS = 10;

/** Ende einer Aufbewahrungsfrist: Schluss des Kalenderjahres + Jahre. */
export function retentionEnd(endedAt: Date, years: number): Date {
  return new Date(Date.UTC(endedAt.getUTCFullYear() + years, 11, 31, 23, 59, 59));
}

const FINAL_STATUSES: MandateStatus[] = ["ABGESCHLOSSEN", "BEENDET_OHNE_KAUF"];

export type MandateFacts = {
  status: MandateStatus;
  contractSignedAt: Date | null;
  gwgIdentifiedAt: Date | null;
  hasClosing: boolean;
  endDate: Date | null;
  handoverDate: Date | null;
  updatedAt: Date;
};

export function decideMandate(m: MandateFacts, now: Date = new Date()): ErasureDecision {
  const beforeContract = m.status === "ERSTGESPRAECH" && !m.contractSignedAt;
  if (!FINAL_STATUSES.includes(m.status) && !beforeContract) {
    return { action: "BLOCKED", reason: "Suchauftrag läuft noch. Erst beenden, dann erneut prüfen." };
  }
  if (m.gwgIdentifiedAt || m.hasClosing) {
    const endedAt = m.endDate ?? m.handoverDate ?? m.updatedAt;
    const until = retentionEnd(endedAt, GWG_RETENTION_YEARS);
    if (now <= until) {
      return { action: "RETAIN", reason: `GwG-Aufbewahrung 5 Jahre nach Ende der Geschäftsbeziehung (${endedAt.getUTCFullYear()}).`, retainUntil: until };
    }
    return { action: "ANONYMIZE", reason: "GwG-Frist abgelaufen." };
  }
  return { action: "ANONYMIZE", reason: "Kein GwG-Fall. Personenbezug wird entfernt, Vorstellungen bleiben als Nachweis ohne Namen." };
}

/** Lead ohne Suchauftrag wird gelöscht, mit Suchauftrag folgt er dessen Entscheidung. */
export function decideLead(mandateDecision: ErasureDecision | null): ErasureDecision {
  if (!mandateDecision) return { action: "DELETE", reason: "Lead ohne Suchauftrag." };
  if (mandateDecision.action === "DELETE") return mandateDecision;
  return { ...mandateDecision, reason: `Wie Suchauftrag: ${mandateDecision.reason}` };
}

export function decideReferrer(paidAt: (Date | null)[], now: Date = new Date()): ErasureDecision {
  const paid = paidAt.filter((d): d is Date => d instanceof Date).sort((a, b) => b.getTime() - a.getTime());
  if (paid.length) {
    const until = retentionEnd(paid[0], TAX_RETENTION_YEARS);
    if (now <= until) return { action: "RETAIN", reason: "Ausgezahlte Prämie: Buchungsbelege 10 Jahre.", retainUntil: until };
  }
  return { action: "ANONYMIZE", reason: "Kontaktdaten werden entfernt, Prämienhistorie bleibt ohne Namen." };
}

export function decidePartner(): ErasureDecision {
  return { action: "ANONYMIZE", reason: "Kontaktdaten werden entfernt und Zugänge gesperrt; eingereichte Objekte bleiben." };
}

export type PrivacyQuery = { raw: string; email: string | null; phoneNorm: string | null; text: string | null };

/** Suchbegriff deuten: E-Mail, Telefonnummer oder Name bzw. Hub-Kontakt-ID. */
export function parsePrivacyQuery(input: string): PrivacyQuery | null {
  const raw = input.trim();
  if (raw.length < 3) return null;
  if (raw.includes("@")) return { raw, email: normalizeEmail(raw), phoneNorm: null, text: null };
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length >= 6 && /^[\d\s+()/.-]+$/.test(raw)) return { raw, email: null, phoneNorm: normalizePhone(raw), text: null };
  return { raw, email: null, phoneNorm: null, text: raw };
}

/** Passt ein Datensatz zum Suchbegriff? (für Felder ohne normalisierte Spalte) */
export function matchesQuery(q: PrivacyQuery, rec: { name?: string | null; email?: string | null; phone?: string | null; hubContactId?: string | null }): boolean {
  if (q.email) return normalizeEmail(rec.email) === q.email;
  if (q.phoneNorm) return !!rec.phone && normalizePhone(rec.phone) === q.phoneNorm;
  if (q.text) {
    const t = q.text.toLowerCase();
    return rec.hubContactId === q.text || (rec.name ?? "").toLowerCase().includes(t);
  }
  return false;
}

export const ERASURE_ACTION_LABEL: Record<ErasureAction, string> = {
  DELETE: "wird gelöscht",
  ANONYMIZE: "wird anonymisiert",
  RETAIN: "Aufbewahrungspflicht",
  BLOCKED: "nicht möglich",
};
