/**
 * Kriterienkatalog (Konzept §8). Seit Phase 2 in der Tabelle Criterion pflegbar;
 * diese Konstante ist Startbestand (Seed) und Rückfall, falls die Tabelle leer ist.
 */
export type CriterionDef = { key: string; label: string; labelEn?: string | null; group: string };
export const CRITERIA = [
  { key: "lage_strand", label: "Lage am Strand", group: "Lage" },
  { key: "lage_berg_ski", label: "Lage Berg / Ski", group: "Lage" },
  { key: "lage_see", label: "Lage am See", group: "Lage" },
  { key: "lage_altstadt", label: "Lage Altstadt", group: "Lage" },
  { key: "meerblick", label: "Meerblick", group: "Lage" },
  { key: "bergblick", label: "Bergblick", group: "Lage" },
  { key: "ganzjahresdestination", label: "Ganzjahresdestination", group: "Lage" },
  { key: "flughafen_unter_60min", label: "Flughafen unter 60 Minuten", group: "Lage" },
  { key: "pool", label: "Pool", group: "Ausstattung" },
  { key: "garten_terrasse", label: "Garten / Terrasse", group: "Ausstattung" },
  { key: "parkplatz", label: "Parkplatz", group: "Ausstattung" },
  { key: "aufzug", label: "Aufzug", group: "Ausstattung" },
  { key: "barrierearm", label: "Barrierearm", group: "Ausstattung" },
  { key: "zimmer_mit_bad", label: "Zimmer mit Bad", group: "Ausstattung" },
  { key: "restaurant_vorhanden", label: "Restaurant vorhanden", group: "Betrieb" },
  { key: "wellness", label: "Wellness", group: "Betrieb" },
  { key: "lizenz_vorhanden", label: "Vermietungslizenz vorhanden", group: "Betrieb" },
  { key: "vermietung_laufend", label: "Vermietung läuft", group: "Betrieb" },
  { key: "agentur_vorhanden", label: "Verwaltungsagentur vorhanden", group: "Betrieb" },
  { key: "renovierungsbedarf_gering", label: "Geringer Renovierungsbedarf", group: "Zustand" },
  { key: "sanierungsobjekt", label: "Sanierungsobjekt", group: "Zustand" },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];

export const CRITERION_LABEL: Record<string, string> = Object.fromEntries(CRITERIA.map((c) => [c.key, c.label]));

export function criterionLabel(key: string): string {
  return CRITERION_LABEL[key] ?? key;
}

export function isCriterionKey(key: string): key is CriterionKey {
  return key in CRITERION_LABEL;
}
