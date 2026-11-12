/** Reisen und Reisekosten je Suchauftrag (Konzept §10). */

export const TRIP_COST_CATEGORIES = ["FLUG", "BAHN", "AUTO", "MIETWAGEN", "HOTEL", "VERPFLEGUNG", "SONSTIGES"] as const;
export type TripCostCategory = (typeof TRIP_COST_CATEGORIES)[number];

export const TRIP_COST_LABEL: Record<TripCostCategory, string> = {
  FLUG: "Flug",
  BAHN: "Bahn",
  AUTO: "Auto (km)",
  MIETWAGEN: "Mietwagen",
  HOTEL: "Hotel",
  VERPFLEGUNG: "Verpflegung",
  SONSTIGES: "Sonstiges",
};

export function tripTotals(trips: Array<{ billable: boolean; costs: Array<{ category: string; amount: number }> }>, travelFlat: number | null) {
  const byCategory: Record<string, number> = {};
  let actual = 0;
  for (const t of trips) for (const c of t.costs) {
    actual += c.amount;
    byCategory[c.category] = (byCategory[c.category] ?? 0) + c.amount;
  }
  const billableTrips = trips.filter((t) => t.billable).length;
  const flatTotal = (travelFlat ?? 0) * billableTrips;
  return { actual, byCategory, billableTrips, flatTotal, difference: flatTotal - actual };
}
