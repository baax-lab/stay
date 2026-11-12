/** Honorarberechnung (Konzept §8.6). Reine Funktionen mit Testfällen. */

export type FeeInput = {
  baseFeeActive: boolean;
  baseFee: number;
  successFee: number;
  bonusPct: number; // z. B. 0.10
  bonusCapPct: number; // Anteil am Erfolgshonorar, z. B. 0.25
  askingPrice: number | null;
  purchasePrice: number | null;
  sellerSideCredited?: number | null;
  travelFlat?: number | null;
  trips?: number | null;
};

export type FeeResult = {
  baseFee: number;
  successFee: number;
  savings: number; // Angebotspreis − Kaufpreis, nie negativ
  bonusRaw: number; // bonusPct × Ersparnis
  bonusCap: number; // bonusCapPct × Erfolgshonorar
  bonus: number;
  travel: number;
  sellerSideCredited: number;
  total: number;
};

export function calculateFee(i: FeeInput): FeeResult {
  const baseFee = i.baseFeeActive ? Math.max(0, i.baseFee) : 0;
  const successFee = Math.max(0, i.successFee);
  const savings = i.askingPrice != null && i.purchasePrice != null ? Math.max(0, i.askingPrice - i.purchasePrice) : 0;
  const bonusRaw = Math.round(i.bonusPct * savings);
  const bonusCap = Math.round(i.bonusCapPct * successFee);
  const bonus = Math.max(0, Math.min(bonusRaw, bonusCap));
  const travel = Math.max(0, (i.travelFlat ?? 0) * (i.trips ?? 0));
  const sellerSideCredited = Math.max(0, i.sellerSideCredited ?? 0);
  const total = Math.max(0, baseFee + successFee + bonus + travel - sellerSideCredited);
  return { baseFee, successFee, savings, bonusRaw, bonusCap, bonus, travel, sellerSideCredited, total };
}

/** Österreich: gesetzlicher Höchstsatz 3 % zzgl. USt (Konzept §8.6). */
export const AT_MAX_PCT = 0.03;
export const AT_VAT = 0.2;

export function austriaCap(purchasePrice: number): { net: number; gross: number } {
  const net = Math.round(purchasePrice * AT_MAX_PCT);
  return { net, gross: Math.round(net * (1 + AT_VAT)) };
}

export type FeeBandLike = { id: string; volumeFrom: number; volumeTo: number | null; baseFee: number; successFee: number; bonusPct: number; bonusCapPct: number };

/** Band aus dem Budget (priceMax) vorschlagen. */
export function suggestBand<T extends FeeBandLike>(bands: T[], budget: number): T | null {
  const sorted = [...bands].sort((a, b) => a.volumeFrom - b.volumeFrom);
  return sorted.find((b) => budget >= b.volumeFrom && (b.volumeTo == null || budget < b.volumeTo)) ?? null;
}

/** Prämie für Tippgeber nach Regel (prozentual vom Netto-Erfolgshonorar oder pauschal). */
export function referralReward(rule: { rewardPct: number | null; rewardFlat: number | null }, netSuccessFee: number): { amount: number; basis: string } {
  if (rule.rewardFlat != null && rule.rewardFlat > 0) return { amount: rule.rewardFlat, basis: `Pauschal ${rule.rewardFlat.toLocaleString("de-DE")} €` };
  if (rule.rewardPct != null && rule.rewardPct > 0) {
    const amount = Math.round(rule.rewardPct * netSuccessFee);
    return { amount, basis: `${(rule.rewardPct * 100).toLocaleString("de-DE")} % von ${netSuccessFee.toLocaleString("de-DE")} € Netto-Erfolgshonorar` };
  }
  return { amount: 0, basis: "Keine Prämienregel hinterlegt" };
}

export function formatEur(n: number | null | undefined): string {
  if (n == null) return "–";
  return `${Math.round(n).toLocaleString("de-DE")} €`;
}
