import type { MandateStatus } from "@prisma/client";

/** Statuslogik Suchauftrag (Konzept §5). Reine Funktionen. */

export const MAIN_FLOW: MandateStatus[] = [
  "ERSTGESPRAECH",
  "BEAUFTRAGT",
  "ANALYSE",
  "SUCHE",
  "PRUEFUNG",
  "VERHANDLUNG",
  "GEKAUFT",
  "NACHBETREUUNG",
  "ABGESCHLOSSEN",
];

export const MANDATE_STATUS_LABEL: Record<MandateStatus, string> = {
  ERSTGESPRAECH: "Erstgespräch",
  BEAUFTRAGT: "Beauftragt",
  ANALYSE: "Analyse",
  SUCHE: "Suche",
  PRUEFUNG: "Prüfung",
  VERHANDLUNG: "Verhandlung",
  GEKAUFT: "Gekauft",
  NACHBETREUUNG: "Nachbetreuung",
  ABGESCHLOSSEN: "Abgeschlossen",
  PAUSIERT: "Pausiert",
  BEENDET_OHNE_KAUF: "Beendet ohne Kauf",
};

export const ACTIVE_STATUSES: MandateStatus[] = ["BEAUFTRAGT", "ANALYSE", "SUCHE", "PRUEFUNG", "VERHANDLUNG"];

/** Erlaubte Folgestatus. Rückschritte um einen Schritt sind erlaubt (z. B. Verhandlung → Suche). */
export function allowedTransitions(current: MandateStatus, statusBeforePause?: MandateStatus | null): MandateStatus[] {
  if (current === "PAUSIERT") {
    return [statusBeforePause ?? "SUCHE", "BEENDET_OHNE_KAUF"];
  }
  if (current === "ABGESCHLOSSEN" || current === "BEENDET_OHNE_KAUF") return [];

  const idx = MAIN_FLOW.indexOf(current);
  const next: MandateStatus[] = [];
  if (idx >= 0 && idx < MAIN_FLOW.length - 1) next.push(MAIN_FLOW[idx + 1]);
  // Rückschritt innerhalb der Suchphase
  if (current === "PRUEFUNG" || current === "VERHANDLUNG") next.push("SUCHE");
  if (current === "ANALYSE") next.push("SUCHE"); // Analyse darf übersprungen werden (bereits enthalten) – kein Duplikat
  if (current !== "GEKAUFT" && current !== "NACHBETREUUNG") {
    next.push("PAUSIERT", "BEENDET_OHNE_KAUF");
  }
  return Array.from(new Set(next));
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function checkTransition(
  mandate: { status: MandateStatus; statusBeforePause?: MandateStatus | null; gwgIdentifiedAt?: Date | null; contractSignedAt?: Date | null },
  target: MandateStatus,
  opts: { endReason?: string | null; purchasePrice?: number | null } = {},
): TransitionCheck {
  if (!allowedTransitions(mandate.status, mandate.statusBeforePause).includes(target)) {
    return { ok: false, reason: `Wechsel von ${MANDATE_STATUS_LABEL[mandate.status]} nach ${MANDATE_STATUS_LABEL[target]} ist nicht vorgesehen` };
  }
  if (target === "BEAUFTRAGT" && !mandate.gwgIdentifiedAt) {
    return { ok: false, reason: "GwG-Identifizierung fehlt (Pflicht vor Beauftragung)" };
  }
  if (target === "BEENDET_OHNE_KAUF" && !opts.endReason?.trim()) {
    return { ok: false, reason: "Grund für die Beendigung ohne Kauf ist Pflicht" };
  }
  if (target === "GEKAUFT" && !(opts.purchasePrice && opts.purchasePrice > 0)) {
    return { ok: false, reason: "Kaufpreis ist beim Statuswechsel auf Gekauft Pflicht" };
  }
  return { ok: true };
}

export function isActiveMandate(status: MandateStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export const USAGE_GOAL_LABEL = {
  RENDITE: "Rendite",
  EIGENNUTZUNG: "Eigennutzung",
  KOMBINIERT: "Kombiniert",
  EIGENBETRIEB: "Eigenbetrieb",
} as const;

/** Vorlagen für Laufzeit: 6 Monate ab Beauftragung. */
export function defaultEndDate(start: Date, months = 6): Date {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d;
}
