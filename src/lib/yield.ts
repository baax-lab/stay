import type { Segment } from "@prisma/client";

/**
 * Renditerechner mit Spannen (Konzept §9.4): drei Szenarien (vorsichtig, mittel, gut),
 * standardmäßig ±15 % auf Auslastung und Tagespreis, Nettomietrendite auf die Gesamtinvestition.
 * Fehlende Kostenangaben werden durch ausgewiesene Annahmen ersetzt, nie durch null.
 */

export const YIELD_DEFAULTS = {
  managementPct: 20, // Verwaltung/Agentur in % vom Umsatz
  reservesPct: 3, // Rücklagen in % vom Umsatz
  taxPct: 25, // Steuern grob in % vom Überschuss
  opCostsPctOfRevenue: 15, // Betriebskosten, falls nicht erfasst
  spread: 0.15,
  maxOccupancy: 95,
} as const;

export type YieldInput = {
  segment: Segment;
  units: number | null;
  occupancyPct: number | null;
  adr: number | null; // Ø Tagespreis je Einheit/Zimmer, EUR
  revenueYear: number | null; // Jahresumsatz EUR (Betriebe)
  opCostsYear: number | null;
  managementPct: number | null;
  reservesPct: number | null;
  taxPct: number | null;
  spread: number | null;
  totalInvestment: number | null; // EUR
};

export type ScenarioKey = "vorsichtig" | "mittel" | "gut";

export type Scenario = {
  key: ScenarioKey;
  occupancyPct: number | null;
  adr: number | null;
  revenue: number;
  management: number;
  reserves: number;
  opCosts: number;
  preTax: number;
  tax: number;
  net: number;
  yieldPct: number;
};

export type Assumption = { key: "managementPct" | "reservesPct" | "taxPct" | "opCosts" | "spread" | "units"; value: number; assumed: boolean };

export type YieldResult =
  | { ok: true; scenarios: Scenario[]; assumptions: Assumption[]; basis: "adr" | "revenue" }
  | { ok: false; reason: "missing_revenue" | "missing_investment" };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeYield(i: YieldInput): YieldResult {
  if (!i.totalInvestment || i.totalInvestment <= 0) return { ok: false, reason: "missing_investment" };

  const spread = i.spread ?? YIELD_DEFAULTS.spread;
  const units = i.units && i.units > 0 ? i.units : 1;
  const hasAdrBasis = i.occupancyPct != null && i.occupancyPct > 0 && i.adr != null && i.adr > 0;
  const hasRevenue = i.revenueYear != null && i.revenueYear > 0;
  if (!hasAdrBasis && !hasRevenue) return { ok: false, reason: "missing_revenue" };

  // Betriebe mit erfasstem Umsatz rechnen auf Umsatzbasis, sonst Auslastung × Tagespreis
  const basis: "adr" | "revenue" = hasRevenue && (i.segment === "PENSION_HOTEL" || !hasAdrBasis) ? "revenue" : "adr";

  const mgmtPct = i.managementPct ?? YIELD_DEFAULTS.managementPct;
  const resPct = i.reservesPct ?? YIELD_DEFAULTS.reservesPct;
  const taxPct = i.taxPct ?? YIELD_DEFAULTS.taxPct;

  const factors: Record<ScenarioKey, number> = { vorsichtig: 1 - spread, mittel: 1, gut: 1 + spread };

  const scenarios: Scenario[] = (Object.keys(factors) as ScenarioKey[]).map((key) => {
    const f = factors[key];
    let occ: number | null = i.occupancyPct;
    let adr: number | null = i.adr;
    let revenue: number;
    if (basis === "adr") {
      occ = Math.min(YIELD_DEFAULTS.maxOccupancy, i.occupancyPct! * f);
      adr = i.adr! * f;
      revenue = units * 365 * (occ / 100) * adr;
    } else {
      // Umsatzbasis: Auslastung und Preis wirken beide, Auslastung gedeckelt, falls bekannt
      const occFactor = i.occupancyPct ? Math.min(YIELD_DEFAULTS.maxOccupancy, i.occupancyPct * f) / i.occupancyPct : f;
      occ = i.occupancyPct ? Math.min(YIELD_DEFAULTS.maxOccupancy, i.occupancyPct * f) : null;
      adr = i.adr ? i.adr * f : null;
      revenue = i.revenueYear! * occFactor * f;
    }
    const management = (revenue * mgmtPct) / 100;
    const reserves = (revenue * resPct) / 100;
    // Betriebskosten sind weitgehend fix; ohne Angabe Annahme in % des mittleren Umsatzes
    const opCosts = i.opCostsYear ?? 0;
    return { key, occupancyPct: occ == null ? null : round1(occ), adr: adr == null ? null : Math.round(adr), revenue, management, reserves, opCosts, preTax: 0, tax: 0, net: 0, yieldPct: 0 };
  });

  const middleRevenue = scenarios[1].revenue;
  const opCostsAssumed = i.opCostsYear == null;
  const opCostsFix = opCostsAssumed ? (middleRevenue * YIELD_DEFAULTS.opCostsPctOfRevenue) / 100 : i.opCostsYear!;

  for (const s of scenarios) {
    s.opCosts = opCostsFix;
    s.preTax = s.revenue - s.management - s.reserves - s.opCosts;
    s.tax = Math.max(0, s.preTax) * (taxPct / 100);
    s.net = s.preTax - s.tax;
    s.yieldPct = round1((s.net / i.totalInvestment) * 100);
    s.revenue = Math.round(s.revenue);
    s.management = Math.round(s.management);
    s.reserves = Math.round(s.reserves);
    s.opCosts = Math.round(s.opCosts);
    s.preTax = Math.round(s.preTax);
    s.tax = Math.round(s.tax);
    s.net = Math.round(s.net);
  }

  return {
    ok: true,
    basis,
    scenarios,
    assumptions: [
      { key: "managementPct", value: mgmtPct, assumed: i.managementPct == null },
      { key: "reservesPct", value: resPct, assumed: i.reservesPct == null },
      { key: "taxPct", value: taxPct, assumed: i.taxPct == null },
      { key: "opCosts", value: Math.round(opCostsFix), assumed: opCostsAssumed },
      { key: "spread", value: Math.round(spread * 100), assumed: i.spread == null },
      { key: "units", value: units, assumed: !(i.units && i.units > 0) },
    ],
  };
}
