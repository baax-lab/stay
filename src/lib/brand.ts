/**
 * Hausfarbe zur Laufzeit (BRAND_COLOR, z. B. #19B5D4). Aus der Grundfarbe werden die
 * helle Fläche und die kräftige Variante abgeleitet, damit nur ein Wert gepflegt wird.
 */

export const DEFAULT_BRAND = "#19b5d4";

export function parseHex(input: string | null | undefined): string | null {
  const v = (input ?? "").trim().toLowerCase();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${h}`;
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");
}

/** Mischt die Farbe mit Weiß (amount > 0) oder Schwarz (amount < 0). */
export function mix(hex: string, amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  return toHex(toRgb(hex).map((c) => c + (target - c) * a) as [number, number, number]);
}

export function brandPalette(input: string | null | undefined): { brand: string; soft: string; strong: string } | null {
  const brand = parseHex(input);
  if (!brand) return null;
  return { brand, soft: mix(brand, 0.86), strong: mix(brand, -0.2) };
}

/** CSS für <style> im Root-Layout; leer, wenn keine gültige Farbe gesetzt ist. */
export function brandCss(input: string | null | undefined): string {
  const p = brandPalette(input);
  if (!p) return "";
  // html:root schlägt :root aus globals.css unabhängig von der Reihenfolge der Stylesheets
  return `html:root{--brand:${p.brand};--brand-soft:${p.soft};--brand-strong:${p.strong}}`;
}
