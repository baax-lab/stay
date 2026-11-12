import type { Segment } from "@prisma/client";
import type { ProfileForMatch } from "./matching";

/** Gespeicherte Portal-Suchen (Phase 3): Umwandlung in ein Matching-Profil und Abgleich mit dem Suchprofil. */

export type PortalSearchLike = { segments: Segment[]; countries: string[]; regions: string[]; priceMin: number | null; priceMax: number; minUnits: number | null; features: string[] };

export function searchToProfile(s: PortalSearchLike): ProfileForMatch {
  const countries = s.countries.length ? s.countries : Array.from(new Set(s.regions.map((r) => r.slice(0, 2).toUpperCase())));
  return {
    segments: s.segments,
    countries,
    regions: s.regions,
    priceMin: s.priceMin,
    priceMax: s.priceMax,
    minUnits: s.minUnits,
    maxUnits: null,
    licenseRequired: false, // Wunsch des Käufers; Lizenz prüft Baax vor einer Vorstellung
    mustCriteria: [],
    wishCriteria: s.features.map((key) => ({ key, weight: 2 })),
  };
}

/** Was der Suchwunsch über das vereinbarte Suchprofil hinaus verlangt (Hinweis „Suchprofil erweitern?“). */
export function searchVsProfile(s: PortalSearchLike, p: { segments: Segment[]; countries: string[]; regions: string[]; priceMax: number } | null) {
  if (!p) return { newSegments: s.segments, newCountries: s.countries, newRegions: s.regions, higherBudget: s.priceMax, any: true };
  const newSegments = s.segments.filter((x) => p.segments.length > 0 && !p.segments.includes(x));
  const searchCountries = s.countries.length ? s.countries : Array.from(new Set(s.regions.map((r) => r.slice(0, 2).toUpperCase())));
  const newCountries = searchCountries.filter((c) => p.countries.length > 0 && !p.countries.includes(c));
  const newRegions = s.regions.filter((r) => !p.regions.includes(r) && (p.regions.length > 0 || newCountries.includes(r.slice(0, 2).toUpperCase())));
  const higherBudget = s.priceMax > p.priceMax ? s.priceMax : null;
  return { newSegments, newCountries, newRegions, higherBudget, any: newSegments.length + newCountries.length + newRegions.length > 0 || higherBudget != null };
}
