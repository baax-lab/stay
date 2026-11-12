/**
 * Gesamtkostenrechnung (Konzept §9.3): Kaufpreis + Nebenkosten (CountryCost) + Baax-Honorar
 * + optional Renovierungsbudget = Gesamtinvestition. Ausweis in EUR, Fremdwährung mit Umrechnung.
 */

export type CostRule = {
  country: string;
  regionKey: string | null;
  label: string;
  pct: number | null; // Prozent vom Kaufpreis, z. B. 3.5
  flat: number | null; // fester Betrag in EUR
  note?: string | null;
  validFrom: Date;
};

/**
 * Regeln für ein Objekt auswählen: nur gültige Regeln des Landes; eine regionale Regel ersetzt die
 * Landesregel mit gleicher Bezeichnung; bei mehreren Ständen gilt der jüngste gültige.
 */
export function selectCostRules(rules: CostRule[], country: string, regionKey: string | null, at: Date = new Date()): CostRule[] {
  const valid = rules.filter((r) => r.country === country && r.validFrom <= at && (r.regionKey == null || r.regionKey === regionKey));
  const byLabel = new Map<string, CostRule>();
  for (const r of valid) {
    const key = r.label.trim().toLowerCase();
    const cur = byLabel.get(key);
    if (!cur) {
      byLabel.set(key, r);
      continue;
    }
    const curRegional = cur.regionKey != null;
    const rRegional = r.regionKey != null;
    if (rRegional && !curRegional) byLabel.set(key, r);
    else if (rRegional === curRegional && r.validFrom > cur.validFrom) byLabel.set(key, r);
  }
  return [...byLabel.values()];
}

export type CostItem = { label: string; pct: number | null; flat: number | null; amount: number; note: string | null };

export type TotalCostsInput = {
  price: number; // Kaufpreis in Objektwährung
  currency: string;
  rateToEur: number | null; // 1 Einheit Fremdwährung = x EUR
  rateDate?: Date | null;
  rules: CostRule[]; // bereits ausgewählt (selectCostRules)
  baaxFee: number | null; // EUR
  renovation: number | null; // EUR
};

export type TotalCosts =
  | {
      ok: true;
      currency: string;
      priceOriginal: number;
      rateToEur: number;
      rateDate: Date | null;
      priceEur: number;
      items: CostItem[];
      sideCosts: number;
      sideCostsPct: number;
      baaxFee: number;
      renovation: number;
      total: number;
      noRules: boolean;
    }
  | { ok: false; reason: "fx_missing"; currency: string };

export function computeTotalCosts(i: TotalCostsInput): TotalCosts {
  const isEur = i.currency.toUpperCase() === "EUR";
  const rate = isEur ? 1 : i.rateToEur;
  if (!rate || rate <= 0) return { ok: false, reason: "fx_missing", currency: i.currency };

  const priceEur = Math.round(i.price * rate);
  const items: CostItem[] = i.rules.map((r) => {
    const amount = Math.round((r.pct ? (priceEur * r.pct) / 100 : 0) + (r.flat ?? 0));
    return { label: r.label, pct: r.pct, flat: r.flat, amount, note: r.note ?? null };
  });
  const sideCosts = items.reduce((s, x) => s + x.amount, 0);
  const baaxFee = Math.max(0, Math.round(i.baaxFee ?? 0));
  const renovation = Math.max(0, Math.round(i.renovation ?? 0));
  return {
    ok: true,
    currency: i.currency.toUpperCase(),
    priceOriginal: i.price,
    rateToEur: rate,
    rateDate: isEur ? null : (i.rateDate ?? null),
    priceEur,
    items,
    sideCosts,
    sideCostsPct: priceEur > 0 ? Math.round((sideCosts / priceEur) * 1000) / 10 : 0,
    baaxFee,
    renovation,
    total: priceEur + sideCosts + baaxFee + renovation,
    noRules: i.rules.length === 0,
  };
}
