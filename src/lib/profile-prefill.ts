import type { Segment } from "@prisma/client";
import { FINANCING_LABEL, TIME_HORIZON_LABEL, oneOf, FINANCING_OPTIONS, TIME_HORIZONS } from "./form-options";

/**
 * Vorschlag für das Suchprofil aus einem Lead (rein, getestet).
 * Lead-Regionen sind Freitext („Mallorca“, „Südtirol“, „Spanien“); das Suchprofil braucht Regionsschlüssel und Länder.
 */

export type RegionRef = { key: string; name: string; country: string };
export type CountryRef = { code: string; name: string };

export type LeadForProfile = {
  segment: Segment | null;
  regions: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  timeHorizon?: string | null;
  financing?: string | null;
};

// „Südtirol“ = „Suedtirol“ = „sudtirol“: deutsche Umschreibung zuerst, dann übrige Akzente entfernen
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function profileFromLead(lead: LeadForProfile, regionList: RegionRef[], countryList: CountryRef[]) {
  const regions = new Set<string>();
  const countries = new Set<string>();
  const unmatched: string[] = [];

  for (const raw of lead.regions) {
    const text = norm(raw);
    if (!text) continue;
    const region =
      regionList.find((r) => norm(r.key) === text || norm(r.name) === text) ??
      regionList.find((r) => norm(r.name).includes(text) || (text.length >= 4 && text.includes(norm(r.name))));
    if (region) {
      regions.add(region.key);
      countries.add(region.country);
      continue;
    }
    const country = countryList.find((c) => norm(c.code) === text || norm(c.name) === text);
    if (country) countries.add(country.code);
    else unmatched.push(raw);
  }

  const horizon = oneOf(TIME_HORIZONS, lead.timeHorizon);
  const financing = oneOf(FINANCING_OPTIONS, lead.financing);
  return {
    segments: lead.segment ? [lead.segment] : [],
    countries: [...countries],
    regions: [...regions],
    priceMin: lead.budgetMin,
    priceMax: lead.budgetMax ?? lead.budgetMin ?? 1_000_000,
    horizon: horizon ? TIME_HORIZON_LABEL[horizon] : null,
    financing: financing ? FINANCING_LABEL[financing] : null,
    /** Nicht zugeordnete Angaben, damit sie im Auftrag nicht verloren gehen */
    unmatched,
  };
}
