/** Reine Parser-Funktion ohne Server-Abhängigkeiten (testbar). */
export function parseEcbXml(xml: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) out[m[1]] = Number(m[2]);
  return out;
}
