import type { PrecheckStatus, Segment } from "@prisma/client";

/**
 * Vorprüfung mit Checklisten je Segment und Land (Konzept §10, Phase 2).
 * Inhalte sind Startvorlagen und mit Partnern vor Ort abzustimmen (offener Punkt im Konzept).
 */

export type PrecheckItemStatus = "OFFEN" | "OK" | "BEDENKEN" | "KO" | "NA";
export type PrecheckItem = { key: string; label: string; group: "Allgemein" | "Segment" | "Land"; status: PrecheckItemStatus; note?: string | null; doneAt?: string | null };

const GENERAL: Array<[string, string]> = [
  ["eigentum", "Eigentum und Verfügungsbefugnis des Verkäufers geklärt"],
  ["lasten", "Belastungen, Hypotheken, Dienstbarkeiten geprüft"],
  ["baurecht", "Baurechtliche Genehmigungen und Abweichungen geprüft"],
  ["energie", "Energieausweis vorhanden"],
  ["zahlen", "Zahlen (Auslastung, Umsatz, Kosten) belegt"],
  ["zustand", "Zustand und Instandhaltungsstau eingeschätzt"],
];

const SEGMENT: Record<Segment, Array<[string, string]>> = {
  FEWO: [
    ["vermietung_erlaubt", "Ferienvermietung laut Gemeinschaftsordnung erlaubt"],
    ["lizenz_fewo", "Vermietungslizenz bzw. Registrierung und Übertragbarkeit geprüft"],
    ["gemeinschaft", "Hausgeld, Rücklagen und Beschlüsse der Gemeinschaft geprüft"],
  ],
  APARTMENTHAUS: [
    ["teilung", "Teilungserklärung bzw. Aufteilung der Einheiten geprüft"],
    ["mietvertraege", "Bestehende Miet- und Agenturverträge geprüft"],
    ["lizenz_einheiten", "Lizenzen je Einheit geprüft"],
    ["technik", "Haustechnik (Heizung, Dach, Leitungen) eingeschätzt"],
  ],
  PENSION_HOTEL: [
    ["konzession", "Betriebskonzession und Kategorie geprüft"],
    ["brandschutz", "Brandschutz und behördliche Auflagen geprüft"],
    ["bwa", "Betriebswirtschaftliche Zahlen der letzten drei Jahre geprüft"],
    ["personal", "Personal und Übernahmepflichten geklärt"],
    ["inventar", "Inventarliste und Zustand geprüft"],
    ["vertraege", "Lieferanten-, Buchungsportal- und Pachtverträge geprüft"],
  ],
};

const COUNTRY: Record<string, Array<[string, string]>> = {
  DE: [
    ["grundbuch", "Grundbuchauszug geprüft"],
    ["baulasten", "Baulastenverzeichnis geprüft"],
    ["zweitwohnung", "Zweitwohnungs- bzw. Zweckentfremdungssatzung der Gemeinde geprüft"],
  ],
  AT: [
    ["grundbuch", "Grundbuchauszug geprüft"],
    ["freizeitwohnsitz", "Widmung als Freizeitwohnsitz bzw. touristische Nutzung zulässig"],
    ["grundverkehr", "Grundverkehrsrechtliche Genehmigung erforderlich bzw. möglich"],
  ],
  IT: [
    ["visura", "Visura catastale und ipotecaria geprüft"],
    ["conformita", "Conformità urbanistica und catastale bestätigt"],
    ["ape", "APE (Energieausweis) vorhanden"],
    ["cin", "CIN/CIR für die touristische Vermietung vorhanden"],
  ],
  ES: [
    ["nota_simple", "Nota simple des Registro de la Propiedad geprüft"],
    ["etv", "Licencia turística (ETV/ETVPL) und Übertragbarkeit geprüft"],
    ["cedula", "Cédula de habitabilidad vorhanden"],
    ["ibi", "IBI und Gemeindeabgaben ohne Rückstände"],
    ["costas", "Küstenschutzgesetz (Ley de Costas) geprüft, falls küstennah"],
  ],
};

export function precheckTemplate(segment: Segment, country: string): PrecheckItem[] {
  const mk = (group: PrecheckItem["group"]) => ([key, label]: [string, string]): PrecheckItem => ({ key: `${group.toLowerCase()}_${key}`, label, group, status: "OFFEN" });
  return [...GENERAL.map(mk("Allgemein")), ...SEGMENT[segment].map(mk("Segment")), ...(COUNTRY[country.toUpperCase()] ?? []).map(mk("Land"))];
}

/** Gesamtstatus: KO schlägt alles, dann Bedenken; OK erst, wenn alle Punkte OK oder entfallen. */
export function precheckStatus(items: PrecheckItem[]): PrecheckStatus {
  if (items.some((i) => i.status === "KO")) return "KO";
  if (items.some((i) => i.status === "BEDENKEN")) return "BEDENKEN";
  const done = items.filter((i) => i.status !== "OFFEN").length;
  if (items.length > 0 && done === items.length) return "OK";
  return done === 0 ? "OFFEN" : "LAEUFT";
}

export function precheckProgress(items: PrecheckItem[]): { done: number; total: number; concerns: number; ko: number } {
  return {
    done: items.filter((i) => i.status !== "OFFEN").length,
    total: items.length,
    concerns: items.filter((i) => i.status === "BEDENKEN").length,
    ko: items.filter((i) => i.status === "KO").length,
  };
}

/** Vorlage nachziehen, ohne erfasste Punkte zu verlieren (z. B. nach Segmentwechsel). */
export function mergePrecheck(existing: PrecheckItem[], template: PrecheckItem[]): PrecheckItem[] {
  const byKey = new Map(existing.map((i) => [i.key, i]));
  const merged = template.map((t) => byKey.get(t.key) ?? t);
  const extra = existing.filter((i) => !template.some((t) => t.key === i.key) && i.status !== "OFFEN");
  return [...merged, ...extra];
}

/** Besichtigungsprotokoll: feste Punkte, je 1–5 bewertet. */
export const INSPECTION_ITEMS: Array<{ key: string; label: string }> = [
  { key: "lage", label: "Lage und Umgebung" },
  { key: "aussen", label: "Zustand außen (Fassade, Dach, Außenanlagen)" },
  { key: "innen", label: "Zustand innen" },
  { key: "ausstattung", label: "Ausstattung und Möblierung" },
  { key: "laerm", label: "Lärm und Ruhe" },
  { key: "vermietbarkeit", label: "Vermietbarkeit und Zielgruppe" },
  { key: "betrieb", label: "Betrieb und Abläufe (bei Pension/Hotel)" },
  { key: "maengel", label: "Mängel und Sanierungsbedarf" },
];

export type InspectionItem = { key: string; label: string; rating: number | null; note: string | null };

export function inspectionTemplate(): InspectionItem[] {
  return INSPECTION_ITEMS.map((i) => ({ ...i, rating: null, note: null }));
}

export function averageRating(items: Array<{ rating: number | null }>): number | null {
  const r = items.map((i) => i.rating).filter((x): x is number => typeof x === "number" && x >= 1 && x <= 5);
  return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null;
}
