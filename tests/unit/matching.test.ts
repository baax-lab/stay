import { describe, expect, it } from "vitest";
import { isPriorKnowledge, matchProperty, rankMandates, type ProfileForMatch, type PropertyForMatch } from "@/lib/matching";

const profile: ProfileForMatch = {
  segments: ["FEWO"],
  countries: ["ES"],
  regions: ["es-mallorca"],
  priceMin: null,
  priceMax: 800_000,
  minUnits: null,
  maxUnits: null,
  licenseRequired: true,
  mustCriteria: ["meerblick"],
  wishCriteria: [
    { key: "pool", weight: 3 },
    { key: "parkplatz", weight: 1 },
  ],
};

const property: PropertyForMatch = {
  segment: "FEWO",
  country: "ES",
  region: "es-mallorca",
  price: 750_000,
  units: 1,
  licenseLight: "GRUEN",
  features: ["meerblick", "pool"],
};

describe("Matching", () => {
  it("voller Treffer mit nachvollziehbarer Begründung", () => {
    const r = matchProperty(profile, property);
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    // 50 Basis + 3/4 von 50 = 38 + 5 Preis = 93
    expect(r.score).toBe(93);
    expect(r.nearMiss).toBe(false);
    expect(r.reasons.passt).toContain("Pool (Wunsch 3)");
    expect(r.reasons.fehlt).toContain("Parkplatz (Wunsch 1)");
    expect(r.reasons.knapp).toEqual([]);
  });

  it("Preis im Toleranzband +10 % zählt, aber −5", () => {
    const r = matchProperty(profile, { ...property, price: 860_000 });
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.score).toBe(83);
    expect(r.nearMiss).toBe(false);
  });

  it("Preis bis +20 % ist knapp daneben", () => {
    const r = matchProperty(profile, { ...property, price: 950_000 });
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.nearMiss).toBe(true);
    expect(r.reasons.knapp[0]).toMatch(/bis \+20 %/);
  });

  it("Preis über +20 % ist kein Treffer", () => {
    const r = matchProperty(profile, { ...property, price: 1_000_000 });
    expect(r.matched).toBe(false);
    expect(r.reasons.fehlt[0]).toMatch(/deutlich über Rahmen/);
  });

  it("Muss-Kriterium fehlt → kein Treffer", () => {
    const r = matchProperty(profile, { ...property, features: ["pool"] });
    expect(r.matched).toBe(false);
    expect(r.reasons.fehlt).toContain("Meerblick (Muss)");
  });

  it("Nachbarregion im gleichen Land ist knapp daneben; anderes Land nicht", () => {
    const nb = matchProperty(profile, { ...property, region: "es-ibiza" });
    expect(nb.matched && nb.nearMiss).toBe(true);
    const other = matchProperty(profile, { ...property, country: "IT", region: "it-suedtirol" });
    expect(other.matched).toBe(false);
  });

  it("Profil nur mit Land: ganzes Land passt", () => {
    const r = matchProperty({ ...profile, regions: [] }, { ...property, region: "es-menorca" });
    expect(r.matched).toBe(true);
    expect(r.reasons.passt).toContain("Land passt (keine Regionsvorgabe)");
  });

  it("Lizenz rot bei Lizenzpflicht nur als knapp daneben", () => {
    const r = matchProperty(profile, { ...property, licenseLight: "ROT" });
    expect(r.matched && r.nearMiss).toBe(true);
    const r2 = matchProperty({ ...profile, licenseRequired: false }, { ...property, licenseLight: "ROT" });
    expect(r2.matched && !r2.nearMiss).toBe(true);
  });

  it("zwei knappe Verfehlungen sind kein Treffer", () => {
    const r = matchProperty(profile, { ...property, licenseLight: "ROT", price: 950_000 });
    expect(r.matched).toBe(false);
  });

  it("Rangfolge nach Beauftragungsdatum", () => {
    const a = { id: "a", contractSignedAt: new Date("2026-03-01"), createdAt: new Date("2026-01-01") };
    const b = { id: "b", contractSignedAt: new Date("2026-02-01"), createdAt: new Date("2026-02-15") };
    const c = { id: "c", contractSignedAt: null, createdAt: new Date("2026-02-10") };
    expect(rankMandates([a, b, c]).map((m) => m.id)).toEqual(["b", "c", "a"]);
  });

  it("Vorkenntnis tagesgenau: gleicher Tag zählt nicht", () => {
    expect(isPriorKnowledge(new Date("2026-11-12T08:00:00"), new Date("2026-11-12T15:00:00"))).toBe(false);
    expect(isPriorKnowledge(new Date("2026-11-11T23:00:00"), new Date("2026-11-12T08:00:00"))).toBe(true);
    expect(isPriorKnowledge(new Date("2026-11-11"), null)).toBe(false);
  });
});
