import de from "./de.json";
import en from "./en.json";

/** i18n-Grundlage (Konzept §13 Schritt 19): alles, was Käufer sehen (Portal, Dossier, Berichte, Mails). */

export type Lang = "de" | "en";
export const LANGS: Lang[] = ["de", "en"];

type Dict = typeof de;
const DICTS: Record<Lang, Dict> = { de, en };

export function asLang(v: unknown): Lang {
  return v === "en" ? "en" : "de";
}

/** Schlüssel in Punktnotation, z. B. t("en", "portal.hello", { name: "Anna" }). Fehlt ein Schlüssel im Englischen, gilt Deutsch. */
export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const lookup = (d: unknown): string | undefined => {
    let cur: unknown = d;
    for (const part of key.split(".")) {
      if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
      else return undefined;
    }
    return typeof cur === "string" ? cur : undefined;
  };
  let s = lookup(DICTS[lang]) ?? lookup(DICTS.de) ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function translator(lang: Lang) {
  return (key: string, vars?: Record<string, string | number>) => t(lang, key, vars);
}

export function locale(lang: Lang): string {
  return lang === "en" ? "en-GB" : "de-DE";
}

export function fmtMoney(lang: Lang, n: number | null | undefined, currency = "EUR"): string {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat(locale(lang), { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function fmtNumber(lang: Lang, n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export function fmtDate(lang: Lang, d: Date | string | null | undefined): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString(locale(lang), { day: "2-digit", month: "2-digit", year: "numeric" });
}
