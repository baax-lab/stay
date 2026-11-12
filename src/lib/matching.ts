import type { LicenseLight, Segment } from "@prisma/client";
import { criterionLabel } from "./criteria";

/**
 * Matching (Konzept §8.5). Reine Funktion, Server Action ruft sie für alle Kombinationen auf.
 *
 * Muss-Filter: Segment, Land, Region (oder ganzes Land, wenn Profil in diesem Land keine Region nennt),
 * Preis mit Toleranz +10 %, Lizenz falls erforderlich.
 * Punktwert: Basis 50; Wunschkriterien addieren bis 50 nach Gewicht; Preis im Rahmen +5, im Toleranzband −5.
 * „Knapp daneben“: genau ein Muss-Kriterium knapp verfehlt (Preis bis +20 %, Nachbarregion = gleiches Land,
 * Lizenz ROT bei Lizenzpflicht) → Treffer mit Kennzeichnung.
 */

export type ProfileForMatch = {
  segments: Segment[];
  countries: string[];
  regions: string[];
  priceMin: number | null;
  priceMax: number;
  minUnits: number | null;
  maxUnits: number | null;
  licenseRequired: boolean;
  mustCriteria: string[];
  wishCriteria: Array<{ key: string; weight: number }>;
};

export type PropertyForMatch = {
  segment: Segment;
  country: string;
  region: string;
  price: number;
  units: number | null;
  licenseLight: LicenseLight;
  features: string[];
};

export type MatchReasons = { passt: string[]; fehlt: string[]; knapp: string[] };

export type MatchResult = { matched: true; score: number; nearMiss: boolean; reasons: MatchReasons } | { matched: false; reasons: MatchReasons };

export const PRICE_TOLERANCE = 0.1;
export const PRICE_NEAR_MISS = 0.2;

function fmtEur(n: number) {
  return `${n.toLocaleString("de-DE")} €`;
}

export function matchProperty(profile: ProfileForMatch, property: PropertyForMatch): MatchResult {
  const passt: string[] = [];
  const fehlt: string[] = [];
  const knapp: string[] = [];
  let hardFails = 0;
  let nearMisses = 0;

  // Segment
  if (profile.segments.length === 0 || profile.segments.includes(property.segment)) {
    passt.push("Segment passt");
  } else {
    fehlt.push("Segment passt nicht");
    hardFails++;
  }

  // Land
  const countryOk = profile.countries.length === 0 || profile.countries.includes(property.country);
  if (!countryOk) {
    fehlt.push(`Land ${property.country} nicht im Profil`);
    hardFails++;
  } else {
    // Region: nur prüfen, wenn das Profil in diesem Land Regionen nennt
    const regionsInCountry = profile.regions.filter((r) => r.startsWith(property.country.toLowerCase() + "-"));
    if (regionsInCountry.length === 0 || profile.regions.length === 0) {
      passt.push(profile.regions.length === 0 ? "Land passt (keine Regionsvorgabe)" : `Land ${property.country} passt (ganzes Land)`);
    } else if (regionsInCountry.includes(property.region)) {
      passt.push("Region passt");
    } else {
      knapp.push("Nachbarregion im gleichen Land");
      nearMisses++;
    }
  }

  // Preis
  const max = profile.priceMax;
  const min = profile.priceMin ?? 0;
  let priceDelta = 0;
  if (property.price <= max && property.price >= min * (1 - PRICE_TOLERANCE)) {
    passt.push(`Preis ${fmtEur(property.price)} im Rahmen`);
    priceDelta = 5;
  } else if (property.price > max && property.price <= max * (1 + PRICE_TOLERANCE)) {
    passt.push(`Preis ${fmtEur(property.price)} leicht über Rahmen (bis +10 %)`);
    priceDelta = -5;
  } else if (property.price > max && property.price <= max * (1 + PRICE_NEAR_MISS)) {
    knapp.push(`Preis ${fmtEur(property.price)} bis +20 % über Rahmen`);
    nearMisses++;
    priceDelta = -5;
  } else if (property.price > max) {
    fehlt.push(`Preis ${fmtEur(property.price)} deutlich über Rahmen (${fmtEur(max)})`);
    hardFails++;
  } else {
    fehlt.push(`Preis ${fmtEur(property.price)} unter Mindestpreis (${fmtEur(min)})`);
    hardFails++;
  }

  // Lizenz
  if (profile.licenseRequired) {
    if (property.licenseLight === "ROT") {
      knapp.push("Lizenz fehlt oder riskant (Ampel rot), Profil verlangt Lizenz");
      nearMisses++;
    } else if (property.licenseLight === "GRUEN") {
      passt.push("Lizenz vorhanden");
    } else {
      passt.push(property.licenseLight === "GELB" ? "Lizenz beantragt / zu prüfen" : "Lizenzstatus unbekannt, prüfen");
    }
  }

  // Muss-Kriterien aus dem Katalog
  for (const key of profile.mustCriteria) {
    if (property.features.includes(key)) passt.push(criterionLabel(key));
    else {
      fehlt.push(`${criterionLabel(key)} (Muss)`);
      hardFails++;
    }
  }

  // Einheiten (weich)
  if (property.units != null) {
    if (profile.minUnits != null && property.units < profile.minUnits) fehlt.push(`Nur ${property.units} Einheiten (gewünscht ab ${profile.minUnits})`);
    else if (profile.maxUnits != null && property.units > profile.maxUnits) fehlt.push(`${property.units} Einheiten (gewünscht bis ${profile.maxUnits})`);
    else if (profile.minUnits != null || profile.maxUnits != null) passt.push(`${property.units} Einheiten im Rahmen`);
  }

  if (hardFails > 0 || nearMisses > 1) {
    return { matched: false, reasons: { passt, fehlt, knapp } };
  }

  // Wunschkriterien
  const totalWeight = profile.wishCriteria.reduce((s, w) => s + Math.max(1, Math.min(3, w.weight)), 0);
  let gained = 0;
  for (const w of profile.wishCriteria) {
    const weight = Math.max(1, Math.min(3, w.weight));
    if (property.features.includes(w.key)) {
      gained += weight;
      passt.push(`${criterionLabel(w.key)} (Wunsch ${weight})`);
    } else {
      fehlt.push(`${criterionLabel(w.key)} (Wunsch ${weight})`);
    }
  }
  const wishScore = totalWeight > 0 ? Math.round((gained / totalWeight) * 50) : 25;

  const score = Math.max(0, Math.min(100, 50 + wishScore + priceDelta - (nearMisses ? 10 : 0)));
  return { matched: true, score, nearMiss: nearMisses === 1, reasons: { passt, fehlt, knapp } };
}

/** Rangfolge mehrerer Käufer für dasselbe Objekt: nach Beauftragungsdatum (Konzept §8.19). */
export function rankMandates<T extends { id: string; contractSignedAt: Date | null; createdAt: Date }>(mandates: T[]): T[] {
  return [...mandates].sort((a, b) => {
    const da = (a.contractSignedAt ?? a.createdAt).getTime();
    const db = (b.contractSignedAt ?? b.createdAt).getTime();
    return da - db;
  });
}
