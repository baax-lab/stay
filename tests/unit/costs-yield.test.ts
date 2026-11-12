import { describe, expect, it } from "vitest";
import { computeTotalCosts, selectCostRules, type CostRule } from "@/lib/costs";
import { computeYield } from "@/lib/yield";

const d = (s: string) => new Date(s);
const rules: CostRule[] = [
  { country: "DE", regionKey: null, label: "Grunderwerbsteuer", pct: 5, flat: null, validFrom: d("2024-01-01") },
  { country: "DE", regionKey: "de-oberallgaeu", label: "Grunderwerbsteuer", pct: 3.5, flat: null, validFrom: d("2024-01-01") },
  { country: "DE", regionKey: null, label: "Notar und Grundbuch", pct: 2, flat: null, validFrom: d("2024-01-01") },
  { country: "DE", regionKey: null, label: "Notar und Grundbuch", pct: 1.8, flat: null, validFrom: d("2025-06-01") },
  { country: "DE", regionKey: null, label: "Zukunftssteuer", pct: 9, flat: null, validFrom: d("2030-01-01") },
  { country: "IT", regionKey: null, label: "Hypothekar- und Katastersteuer", pct: null, flat: 100, validFrom: d("2024-01-01") },
];

describe("Nebenkosten-Auswahl", () => {
  it("Region ersetzt Land, jüngster gültiger Stand gewinnt, Zukünftiges zählt nicht", () => {
    const r = selectCostRules(rules, "DE", "de-oberallgaeu", d("2026-11-12"));
    expect(r.map((x) => `${x.label}:${x.pct}`).sort()).toEqual(["Grunderwerbsteuer:3.5", "Notar und Grundbuch:1.8"]);
    const other = selectCostRules(rules, "DE", "de-ostsee", d("2026-11-12"));
    expect(other.find((x) => x.label === "Grunderwerbsteuer")?.pct).toBe(5);
  });
});

describe("Gesamtkosten", () => {
  it("Kaufpreis + Nebenkosten + Honorar + Renovierung", () => {
    const r = computeTotalCosts({ price: 800_000, currency: "EUR", rateToEur: null, rules: selectCostRules(rules, "DE", "de-oberallgaeu", d("2026-11-12")), baaxFee: 18_500, renovation: 20_000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideCosts).toBe(28_000 + 14_400);
    expect(r.sideCostsPct).toBe(5.3);
    expect(r.total).toBe(800_000 + 42_400 + 18_500 + 20_000);
  });

  it("Pauschalbeträge und CHF mit Umrechnung", () => {
    const r = computeTotalCosts({ price: 1_000_000, currency: "CHF", rateToEur: 1.05, rules: selectCostRules(rules, "IT", null), baaxFee: null, renovation: null });
    expect(r.ok && r.priceEur).toBe(1_050_000);
    expect(r.ok && r.total).toBe(1_050_100);
  });

  it("ohne Wechselkurs kein EUR-Ausweis", () => {
    const r = computeTotalCosts({ price: 1, currency: "CHF", rateToEur: null, rules: [], baaxFee: null, renovation: null });
    expect(r).toEqual({ ok: false, reason: "fx_missing", currency: "CHF" });
  });
});

describe("Renditerechner", () => {
  const base = { segment: "FEWO" as const, units: 1, occupancyPct: 60, adr: 200, revenueYear: null, opCostsYear: 6_000, managementPct: 20, reservesPct: 3, taxPct: 25, spread: null, totalInvestment: 900_000 };

  it("drei Szenarien ±15 % auf Auslastung und Tagespreis", () => {
    const r = computeYield(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [v, m, g] = r.scenarios;
    expect(m.revenue).toBe(43_800); // 365 × 0,6 × 200
    expect(m.preTax).toBe(43_800 - 8_760 - 1_314 - 6_000);
    expect(m.net).toBe(Math.round((43_800 - 8_760 - 1_314 - 6_000) * 0.75));
    expect(m.yieldPct).toBe(2.3);
    expect(v.occupancyPct).toBe(51);
    expect(v.adr).toBe(170);
    expect(g.occupancyPct).toBe(69);
    expect(v.yieldPct).toBeLessThan(m.yieldPct);
    expect(g.yieldPct).toBeGreaterThan(m.yieldPct);
    expect(r.assumptions.every((a) => !a.assumed || a.key === "spread")).toBe(true);
  });

  it("Auslastung im guten Szenario gedeckelt", () => {
    const r = computeYield({ ...base, occupancyPct: 90 });
    expect(r.ok && r.scenarios[2].occupancyPct).toBe(95);
  });

  it("Betrieb auf Umsatzbasis; fehlende Kosten als ausgewiesene Annahmen", () => {
    const r = computeYield({ ...base, segment: "PENSION_HOTEL", units: 12, occupancyPct: null, adr: null, revenueYear: 400_000, opCostsYear: null, managementPct: null, reservesPct: null, taxPct: null, totalInvestment: 3_000_000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.basis).toBe("revenue");
    expect(r.scenarios[1].revenue).toBe(400_000);
    expect(Math.round(r.scenarios[0].revenue)).toBe(Math.round(400_000 * 0.85 * 0.85));
    expect(r.assumptions.find((a) => a.key === "opCosts")).toEqual({ key: "opCosts", value: 60_000, assumed: true });
    expect(r.assumptions.find((a) => a.key === "managementPct")?.assumed).toBe(true);
  });

  it("ohne Umsatzbasis oder Investition keine Schätzung", () => {
    expect(computeYield({ ...base, occupancyPct: null })).toEqual({ ok: false, reason: "missing_revenue" });
    expect(computeYield({ ...base, totalInvestment: null })).toEqual({ ok: false, reason: "missing_investment" });
  });
});
