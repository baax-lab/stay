import type { LicenseLight, LicenseStatus } from "@prisma/client";

/**
 * Genehmigungsampel (Konzept §9.2, Grundlogik bereits in Phase 1).
 * GRÜN: vorhanden/übertragbar · GELB: beantragt oder zu prüfen · ROT: fehlt oder Vergabestopp · GRAU: unbekannt
 * Die Regionsregel (Region.licenseRule) kann die Ampel verschärfen: enthält sie „stopp“ oder „verbot“, wird FEHLT/BEANTRAGT zu ROT.
 */
export function deriveLicenseLight(status: LicenseStatus, regionRule?: string | null): { light: LicenseLight; reason: string; reasonKey: string } {
  const r = deriveLicenseLightInner(status, regionRule);
  const stop = isStopRule(regionRule);
  const reasonKey = `license.reason_${status}${stop && (status === "BEANTRAGT" || status === "FEHLT") ? "_STOP" : ""}`;
  return { ...r, reasonKey };
}

export function isStopRule(regionRule?: string | null): boolean {
  return /stopp|verbot|moratorium|keine neuen/.test((regionRule ?? "").toLowerCase());
}

function deriveLicenseLightInner(status: LicenseStatus, regionRule?: string | null): { light: LicenseLight; reason: string } {
  const stop = isStopRule(regionRule);
  switch (status) {
    case "VORHANDEN":
      return { light: "GRUEN", reason: "Vermietungslizenz vorhanden; Übertragbarkeit beim Kauf prüfen lassen." };
    case "NICHT_NOETIG":
      return { light: "GRUEN", reason: "Für diese Nutzung ist keine Lizenz erforderlich." };
    case "BEANTRAGT":
      return stop
        ? { light: "ROT", reason: "Lizenz beantragt, aber die Region vergibt derzeit keine neuen Lizenzen." }
        : { light: "GELB", reason: "Lizenz beantragt; Erteilung vor dem Kauf prüfen." };
    case "FEHLT":
      return stop
        ? { light: "ROT", reason: "Keine Lizenz und Vergabestopp in der Region." }
        : { light: "ROT", reason: "Keine Vermietungslizenz vorhanden; Erteilung ungewiss." };
    case "UNKLAR":
    default:
      return { light: "GRAU", reason: "Lizenzstatus noch nicht geklärt." };
  }
}

export const LICENSE_STATUS_LABEL: Record<LicenseStatus, string> = {
  VORHANDEN: "vorhanden",
  BEANTRAGT: "beantragt",
  FEHLT: "fehlt",
  UNKLAR: "unklar",
  NICHT_NOETIG: "nicht nötig",
};

export const LICENSE_LIGHT_LABEL: Record<LicenseLight, string> = {
  GRUEN: "Grün",
  GELB: "Gelb",
  ROT: "Rot",
  GRAU: "Grau",
};
