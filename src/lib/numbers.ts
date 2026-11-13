/**
 * Zahlen in Formularen: Anzeige mit Tausenderpunkten (1.250.000), Eingabe tolerant.
 * Rein und im Browser nutzbar.
 */

export function formatNumberDe(n: number | null | undefined, decimals = 0): string {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(n);
}

/**
 * Liest „1.250.000“, „1250000“, „1.250.000,50“, „1,5“, „12.5“, „€ 700.000“, „700 000“.
 * Punkt mit genau drei Ziffern dahinter gilt als Tausenderpunkt, sonst als Komma.
 */
export function parseNumberDe(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).replace(/[€%\s ]/g, "").replace(/^\+/, "");
  if (s === "" || s === "-") return null;
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;
  if (s.includes(",")) {
    // Deutsch: Punkte sind Tausender, Komma ist Dezimal
    s = s.replace(/\./g, "").replace(",", ".");
    if ((s.match(/\./g) ?? []).length > 1) return null;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    return null;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}
