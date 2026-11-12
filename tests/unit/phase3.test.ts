import { describe, expect, it } from "vitest";
import { daysToPurchase, feesByMonth, funnelBySource, funnelTotals, isStale, regionStats, statusDurations } from "@/lib/analytics";

const d = (s: string) => new Date(s);

describe("Trichter je Quelle", () => {
  it("zählt Lead, Erstgespräch, Auftrag, Kauf", () => {
    const rows = funnelBySource(
      [
        { source: "MESSE", status: "NEU", mandate: null },
        { source: "MESSE", status: "ERSTGESPRAECH", mandate: null },
        { source: "MESSE", status: "UMGEWANDELT", mandate: { contractSignedAt: d("2026-12-01"), status: "GEKAUFT" } },
        { source: "WEBSITE", status: "UMGEWANDELT", mandate: { contractSignedAt: null, status: "ERSTGESPRAECH" } },
      ],
      [{ contractSignedAt: d("2026-11-01"), status: "SUCHE" }],
    );
    expect(rows.find((r) => r.source === "MESSE")).toEqual({ source: "MESSE", leads: 3, interviews: 2, mandates: 1, purchases: 1 });
    expect(rows.find((r) => r.source === "WEBSITE")).toEqual({ source: "WEBSITE", leads: 1, interviews: 1, mandates: 0, purchases: 0 });
    expect(rows.find((r) => r.source === "OHNE_LEAD")).toEqual({ source: "OHNE_LEAD", leads: 0, interviews: 1, mandates: 1, purchases: 0 });
    const t = funnelTotals(rows);
    expect(t).toMatchObject({ leads: 4, interviews: 4, mandates: 2, purchases: 1, rateInterview: 100, rateMandate: 50, ratePurchase: 50 });
  });
});

describe("Dauer je Status", () => {
  it("abgeschlossene und laufende Phasen", () => {
    const mandates = [
      { id: "a", createdAt: d("2026-01-01"), status: "SUCHE" as const },
      { id: "b", createdAt: d("2026-01-01"), status: "GEKAUFT" as const },
    ];
    const events = [
      { mandateId: "a", from: "ERSTGESPRAECH" as const, to: "BEAUFTRAGT" as const, at: d("2026-01-11") },
      { mandateId: "a", from: "BEAUFTRAGT" as const, to: "SUCHE" as const, at: d("2026-01-21") },
      { mandateId: "b", from: "ERSTGESPRAECH" as const, to: "BEAUFTRAGT" as const, at: d("2026-01-05") },
      { mandateId: "b", from: "BEAUFTRAGT" as const, to: "GEKAUFT" as const, at: d("2026-03-06") },
    ];
    const r = statusDurations(mandates, events, d("2026-01-31"));
    const eg = r.find((x) => x.status === "ERSTGESPRAECH")!;
    expect(eg).toMatchObject({ closed: 2, avgDays: 7, medianDays: 7 });
    expect(r.find((x) => x.status === "BEAUFTRAGT")).toMatchObject({ closed: 2, avgDays: 35, medianDays: 35 });
    expect(r.find((x) => x.status === "SUCHE")).toMatchObject({ closed: 0, current: 1, currentAvgDays: 10 });
    expect(daysToPurchase(mandates, events)).toEqual({ count: 1, avgDays: 64, medianDays: 64 });
  });
});

describe("Honorar je Monat", () => {
  it("summiert nach Monat, Rechnung und Zahlung getrennt", () => {
    const r = feesByMonth([
      { date: d("2026-03-10"), total: 40_000, invoicedAt: d("2026-03-12"), paidAt: null },
      { date: d("2026-03-20"), total: 18_500, invoicedAt: d("2026-03-25"), paidAt: d("2026-04-02") },
      { date: d("2026-01-05"), total: 10_000, invoicedAt: null, paidAt: null },
    ]);
    expect(r).toEqual([
      { month: "2026-01", count: 1, total: 10_000, invoiced: 0, paid: 0 },
      { month: "2026-03", count: 2, total: 58_500, invoiced: 58_500, paid: 18_500 },
    ]);
  });
});

describe("Regionswissen", () => {
  it("Prüfdatum und Kennzahlen", () => {
    expect(isStale(null)).toBe(true);
    expect(isStale(d("2026-01-01"), d("2026-11-12"))).toBe(false);
    expect(isStale(d("2025-01-01"), d("2026-11-12"))).toBe(true);
    const s = regionStats([
      { price: 600_000, livingArea: 60, occupancyPct: 60, adr: 200 },
      { price: 900_000, livingArea: 90, occupancyPct: 70, adr: null },
      { price: 750_000, livingArea: null, occupancyPct: null, adr: 250 },
    ]);
    expect(s).toEqual({ count: 3, medianPrice: 750_000, medianPricePerSqm: 10_000, avgOccupancy: 65, avgAdr: 225 });
  });
});

import { knowledgeToMarket } from "@/lib/reports";

describe("Marktbericht aus Regionswissen", () => {
  it("baut Preisniveau, Auslastung und Risiken", () => {
    const k = knowledgeToMarket({ pricePerSqmMin: 5000, pricePerSqmMax: 9000, occupancyMin: 55, occupancyMax: 70, adrMin: 180, adrMax: 320, seasonality: "Hauptsaison Mai–Oktober", risks: "Lizenzvergabe eingeschränkt", description: "Gefragte Nordküste." });
    expect(k.priceLevel).toBe("Richtwert 5.000–9.000 €/m². Gefragte Nordküste.");
    expect(k.occupancy).toBe("Auslastung 55–70 %, Ø Tagespreis 180–320 € je Nacht. Hauptsaison Mai–Oktober");
    expect(k.risks).toBe("Lizenzvergabe eingeschränkt");
    expect(knowledgeToMarket({})).toEqual({ priceLevel: "", occupancy: "", risks: "" });
  });
});

import { searchToProfile, searchVsProfile } from "@/lib/candidates";
import { matchProperty } from "@/lib/matching";

describe("Gespeicherte Portal-Suchen", () => {
  const search = { segments: ["FEWO" as const], countries: [], regions: ["es-ibiza"], priceMin: null, priceMax: 1_200_000, minUnits: null, features: ["pool"] };

  it("wird zum Matching-Profil ohne Lizenzpflicht", () => {
    const p = searchToProfile(search);
    expect(p.countries).toEqual(["ES"]);
    expect(p.licenseRequired).toBe(false);
    const r = matchProperty(p, { segment: "FEWO", country: "ES", region: "es-ibiza", price: 1_000_000, units: 1, licenseLight: "ROT", features: ["pool"] });
    expect(r.matched && !r.nearMiss).toBe(true);
  });

  it("zeigt, was über das Suchprofil hinausgeht", () => {
    const d = searchVsProfile(search, { segments: ["FEWO"], countries: ["ES"], regions: ["es-mallorca"], priceMax: 900_000 });
    expect(d).toEqual({ newSegments: [], newCountries: [], newRegions: ["es-ibiza"], higherBudget: 1_200_000, any: true });
    expect(searchVsProfile({ ...search, regions: ["es-mallorca"], priceMax: 800_000 }, { segments: ["FEWO"], countries: ["ES"], regions: ["es-mallorca"], priceMax: 900_000 }).any).toBe(false);
  });
});
