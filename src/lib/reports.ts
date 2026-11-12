/** Suchbericht (Konzept §9.6): aussortierte Objekte gruppiert nach Preis, Lizenz, Lage, Zustand, Zahlen. */

export const REJECT_GROUPS = ["Preis", "Lizenz", "Lage", "Zustand", "Zahlen", "Sonstiges"] as const;
export type RejectGroup = (typeof REJECT_GROUPS)[number];

const BUYER_CATEGORY_GROUP: Record<string, RejectGroup> = {
  preis: "Preis",
  lage: "Lage",
  lage_touristisch: "Lage",
  zustand: "Zustand",
  groesse: "Zustand",
  lizenz: "Lizenz",
  zahlen: "Zahlen",
  sonstiges: "Sonstiges",
};

/** Gruppe aus Käuferkategorie oder Freitext-Ablehnungsgrund ableiten. */
export function rejectGroup(reason: string | null | undefined, buyerCategory?: string | null): RejectGroup {
  if (buyerCategory && BUYER_CATEGORY_GROUP[buyerCategory]) return BUYER_CATEGORY_GROUP[buyerCategory];
  const r = (reason ?? "").toLowerCase();
  if (/preis|teuer|budget|price/.test(r)) return "Preis";
  if (/lizenz|genehmigung|konzession|licen|recht/.test(r)) return "Lizenz";
  if (/lage|region|umgebung|touristisch|location/.test(r)) return "Lage";
  if (/zustand|renovier|sanier|bau|größe|groesse|aufteilung|condition/.test(r)) return "Zustand";
  if (/zahlen|rendite|umsatz|auslastung|plausib|figure/.test(r)) return "Zahlen";
  return "Sonstiges";
}

export type RejectedEntry = { propertyId: string; title: string; locality: string | null; price: number; reason: string; by: "baax" | "kaeufer"; group: RejectGroup };

export function groupRejected(entries: RejectedEntry[]): Partial<Record<RejectGroup, RejectedEntry[]>> {
  const out: Partial<Record<RejectGroup, RejectedEntry[]>> = {};
  for (const g of REJECT_GROUPS) {
    const list = entries.filter((e) => e.group === g);
    if (list.length) out[g] = list;
  }
  return out;
}

export type SearchReportContent = {
  reviewedCount: number;
  presented: Array<{ propertyId: string; title: string; locality: string | null; price: number; sentAt: string }>;
  rejected: Partial<Record<RejectGroup, RejectedEntry[]>>;
  marketNote: string;
  nextSteps: string;
};

export type MarketReportRegion = {
  key: string;
  name: string;
  country: string;
  licenseRule: string | null;
  costs: Array<{ label: string; pct: number | null; flat: number | null; note: string | null }>;
  priceLevel: string;
  occupancy: string;
  risks: string;
};

export type MarketReportContent = { intro: string; regions: MarketReportRegion[]; conclusion: string };

/** Vormonat als Berichtszeitraum. */
export function previousMonth(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}
