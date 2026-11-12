import "server-only";
import { prisma } from "@/lib/db";

/**
 * Wechselkurse (Konzept §9.3): EZB-Referenzkurse, täglich per Cron, manuell überschreibbar.
 * Die EZB nennt „1 EUR = x Fremdwährung“; gespeichert wird „1 Fremdwährung = 1/x EUR“.
 */
export const ECB_URL = process.env.FX_SOURCE_URL ?? "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
export const FX_CURRENCIES = ["CHF", "GBP", "USD", "SEK", "DKK", "NOK", "CZK", "HUF", "PLN"];

import { parseEcbXml } from "./fx-parse";
export { parseEcbXml };

export async function fetchEcbRates(): Promise<{ updated: string[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(ECB_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { updated: [], error: `EZB antwortete ${res.status}` };
    const rates = parseEcbXml(await res.text());
    const updated: string[] = [];
    for (const c of FX_CURRENCIES) {
      if (!rates[c]) continue;
      await prisma.fxRate.create({ data: { currency: c, rateToEur: 1 / rates[c], source: "EZB" } });
      updated.push(c);
    }
    return { updated };
  } catch (e) {
    return { updated: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function latestRate(currency: string): Promise<{ rateToEur: number; fetchedAt: Date } | null> {
  if (currency.toUpperCase() === "EUR") return { rateToEur: 1, fetchedAt: new Date() };
  const r = await prisma.fxRate.findFirst({ where: { currency: currency.toUpperCase() }, orderBy: { fetchedAt: "desc" } });
  return r ? { rateToEur: r.rateToEur, fetchedAt: r.fetchedAt } : null;
}
