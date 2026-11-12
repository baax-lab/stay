import { createHash, randomBytes } from "node:crypto";

/** Käuferportal (Konzept §9.1, §11): Token zufällig ≥ 32 Byte, nur gehasht gespeichert, ablaufend, widerrufbar. */

export const PORTAL_VALIDITY_DAYS = 30;

export function generatePortalToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashPortalToken(token) };
}

export function hashPortalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function looksLikeToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43,}$/.test(token);
}

export type AccessState = "valid" | "expired" | "revoked";

export function accessState(a: { expiresAt: Date; revokedAt: Date | null }, now: Date = new Date()): AccessState {
  if (a.revokedAt) return "revoked";
  if (a.expiresAt <= now) return "expired";
  return "valid";
}

export function extendExpiry(from: Date = new Date(), days = PORTAL_VALIDITY_DAYS): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/** Ablehnungsgründe im Portal (Auswahl + Freitext). */
export const BUYER_REJECT_REASONS = ["preis", "lage", "lage_touristisch", "zustand", "groesse", "lizenz", "zahlen", "sonstiges"] as const;
export type BuyerRejectReason = (typeof BUYER_REJECT_REASONS)[number];

export function isBuyerRejectReason(v: string): v is BuyerRejectReason {
  return (BUYER_REJECT_REASONS as readonly string[]).includes(v);
}

const SUGGESTION: Record<BuyerRejectReason, string> = {
  preis: "Preisrahmen prüfen oder Objekte näher am Budget vorstellen",
  lage: "Regionen bzw. Lagekriterien nachschärfen",
  lage_touristisch: "Ruhigere Lage als Kriterium aufnehmen (z. B. Altstadt/Berg statt Strandpromenade) oder touristische Hotspots ausschließen",
  zustand: "„Geringer Renovierungsbedarf“ als Muss-Kriterium setzen",
  groesse: "Einheiten/Zimmer bzw. Wohnfläche im Suchprofil anpassen",
  lizenz: "Nur Objekte mit vorhandener Lizenz (Ampel grün) vorstellen",
  zahlen: "Nur Objekte mit belastbaren Zahlen (Auslastung, Umsatz) vorstellen",
  sonstiges: "Rücksprache mit dem Käufer zu den Gründen",
};

/** Rückfluss der Ablehnungsgründe ins Suchprofil: ab `threshold` gleichen Gründen ein Vorschlag. */
export function suggestProfileAdjustments(rejections: Array<{ category: string | null }>, threshold = 2): Array<{ category: BuyerRejectReason; count: number; suggestion: string }> {
  const counts = new Map<BuyerRejectReason, number>();
  for (const r of rejections) if (r.category && isBuyerRejectReason(r.category)) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count, suggestion: SUGGESTION[category] }));
}
