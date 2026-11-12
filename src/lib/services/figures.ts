import "server-only";
import type { Property } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeTotalCosts, selectCostRules, type TotalCosts } from "@/lib/costs";
import { computeYield, type YieldResult } from "@/lib/yield";
import { deriveLicenseLight } from "@/lib/license";
import { suggestBand } from "@/lib/fees";
import { latestRate } from "./fx";

/**
 * Eine Quelle für Ampel, Gesamtkosten und Renditespanne (Konzept §9, Abnahme: konsistent intern, im Portal, im Dossier).
 * Baax-Honorar: aus der Honorarvereinbarung des Suchauftrags, sonst Vorschlag aus der Staffel.
 */

export type PropertyFigures = {
  light: ReturnType<typeof deriveLicenseLight>;
  regionName: string;
  regionRule: string | null;
  costs: TotalCosts;
  yield: YieldResult;
  feeSource: "auftrag" | "staffel" | "keins";
};

export async function propertyFigures(property: Property, mandateId?: string | null): Promise<PropertyFigures> {
  const [region, rules, rate, fee, bands] = await Promise.all([
    prisma.region.findUnique({ where: { key: property.region } }),
    prisma.countryCost.findMany({ where: { country: property.country } }),
    latestRate(property.currency),
    mandateId ? prisma.feeAgreement.findUnique({ where: { mandateId } }) : null,
    prisma.feeBand.findMany(),
  ]);

  const priceEur = rate ? property.price * rate.rateToEur : null;
  let baaxFee: number | null = null;
  let feeSource: PropertyFigures["feeSource"] = "keins";
  if (fee && fee.successFee > 0) {
    baaxFee = fee.successFee + (fee.baseFeeActive ? fee.baseFee : 0);
    feeSource = "auftrag";
  } else if (priceEur != null) {
    const band = suggestBand(bands, priceEur);
    if (band) {
      baaxFee = band.successFee;
      feeSource = "staffel";
    }
  }

  const costs = computeTotalCosts({
    price: property.price,
    currency: property.currency,
    rateToEur: rate?.rateToEur ?? null,
    rateDate: rate?.fetchedAt ?? null,
    rules: selectCostRules(rules, property.country, property.region),
    baaxFee,
    renovation: property.renovationBudget,
  });

  const yieldResult = computeYield({
    segment: property.segment,
    units: property.units,
    occupancyPct: property.occupancyPct,
    adr: property.adr,
    revenueYear: property.revenueYear,
    opCostsYear: property.opCostsYear,
    managementPct: property.managementPct,
    reservesPct: property.reservesPct,
    taxPct: property.taxPct,
    spread: property.scenarioSpread,
    totalInvestment: costs.ok ? costs.total : null,
  });

  return {
    light: deriveLicenseLight(property.licenseStatus, region?.licenseRule),
    regionName: region?.name ?? property.region,
    regionRule: region?.licenseRule ?? null,
    costs,
    yield: yieldResult,
    feeSource,
  };
}
