/**
 * Auswahlwerte der erweiterten Formulare (rein, im Browser nutzbar).
 * Deutsche Beschriftungen für das Team; Texte für Käufer stehen in src/lib/i18n (Schlüssel options.* und property.*).
 */

export const LEAD_LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "Englisch" },
  { value: "it", label: "Italienisch" },
  { value: "es", label: "Spanisch" },
  { value: "fr", label: "Französisch" },
  { value: "nl", label: "Niederländisch" },
] as const;
export type LeadLanguage = (typeof LEAD_LANGUAGES)[number]["value"];

export const TIME_HORIZONS = ["SOFORT", "MONATE_6", "MONATE_12", "SPAETER"] as const;
export type TimeHorizon = (typeof TIME_HORIZONS)[number];
export const TIME_HORIZON_LABEL: Record<TimeHorizon, string> = {
  SOFORT: "so bald wie möglich",
  MONATE_6: "innerhalb von 6 Monaten",
  MONATE_12: "innerhalb von 12 Monaten",
  SPAETER: "später / noch offen",
};

export const FINANCING_OPTIONS = ["EIGENKAPITAL", "FINANZIERUNG", "OFFEN"] as const;
export type Financing = (typeof FINANCING_OPTIONS)[number];
export const FINANCING_LABEL: Record<Financing, string> = {
  EIGENKAPITAL: "Eigenkapital",
  FINANZIERUNG: "Finanzierung geplant",
  OFFEN: "noch offen",
};

export const CONTACT_CHANNELS = ["TELEFON", "EMAIL", "WHATSAPP"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = { TELEFON: "Telefon", EMAIL: "E-Mail", WHATSAPP: "WhatsApp" };

export const PROPERTY_CONDITIONS = ["NEUWERTIG", "GEPFLEGT", "MODERNISIERUNG", "SANIERUNG"] as const;
export type PropertyCondition = (typeof PROPERTY_CONDITIONS)[number];
export const PROPERTY_CONDITION_LABEL: Record<PropertyCondition, string> = {
  NEUWERTIG: "neuwertig",
  GEPFLEGT: "gepflegt",
  MODERNISIERUNG: "modernisierungsbedürftig",
  SANIERUNG: "sanierungsbedürftig",
};

export const ENERGY_CLASSES = ["A+", "A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** Wert nur übernehmen, wenn er zur Liste gehört (Schutz gegen beliebige Eingaben). */
export function oneOf<T extends string>(list: readonly T[], v: unknown): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null;
}

/**
 * Kartenlink: gepflegter Link (nur https), sonst Suche aus Adresse, Ort und Land.
 * Ohne Adresse und Ort kein Link (nur das Land wäre zu ungenau).
 */
export function mapsLink(p: { mapUrl?: string | null; address?: string | null; locality?: string | null; country?: string | null }): string | null {
  const own = p.mapUrl?.trim();
  if (own) {
    try {
      const u = new URL(own);
      if (u.protocol === "https:") return u.toString();
    } catch {
      /* ungültig: auf Suche ausweichen */
    }
  }
  const parts = [p.address, p.locality].map((x) => x?.trim()).filter(Boolean) as string[];
  if (!parts.length) return null;
  if (p.country) parts.push(p.country);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}

/** Entfernung lesbar: unter 1000 m in Metern, sonst Kilometer mit einer Nachkommastelle. */
export function formatDistance(meters: number | null | undefined, lang: "de" | "en" = "de"): string | null {
  if (meters == null || Number.isNaN(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${new Intl.NumberFormat(lang === "en" ? "en-GB" : "de-DE", { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}

/** Zusatzangaben eines Leads als kurze Zeilen (Hub-Notiz, Lead-Detail). */
export function leadExtras(l: { language?: string | null; callbackAt?: Date | string | null; contactChannel?: string | null; timeHorizon?: string | null; financing?: string | null }): string[] {
  const out: string[] = [];
  const lang = LEAD_LANGUAGES.find((x) => x.value === l.language);
  if (lang) out.push(`Sprache: ${lang.label}`);
  if (l.callbackAt) {
    const d = new Date(l.callbackAt);
    if (!Number.isNaN(d.getTime())) out.push(`Rückrufwunsch: ${d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}`);
  }
  const ch = oneOf(CONTACT_CHANNELS, l.contactChannel);
  if (ch) out.push(`Bevorzugter Kontaktweg: ${CONTACT_CHANNEL_LABEL[ch]}`);
  const h = oneOf(TIME_HORIZONS, l.timeHorizon);
  if (h) out.push(`Zeithorizont: ${TIME_HORIZON_LABEL[h]}`);
  const f = oneOf(FINANCING_OPTIONS, l.financing);
  if (f) out.push(`Finanzierung: ${FINANCING_LABEL[f]}`);
  return out;
}
