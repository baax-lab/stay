import type { SearchProfile } from "@prisma/client";
import { criterionLabel as defaultLabel } from "./criteria";
import { SEGMENT_LABEL } from "./labels";
import { USAGE_GOAL_LABEL } from "./mandates";

/** Anonymisiertes Suchprofil (ohne Name/Kontakt des Käufers) als Text und HTML, Deutsch oder Englisch. */

const EN_SEGMENT: Record<string, string> = { FEWO: "Holiday apartment", APARTMENTHAUS: "Apartment building", PENSION_HOTEL: "Guesthouse / small hotel" };
const EN_GOAL: Record<string, string> = { RENDITE: "Yield", EIGENNUTZUNG: "Own use", KOMBINIERT: "Combined", EIGENBETRIEB: "Owner-operated" };
export const EN_CRITERIA: Record<string, string> = {
  lage_strand: "Beachfront location", lage_berg_ski: "Mountain / ski location", lage_see: "Lakeside", lage_altstadt: "Old town", meerblick: "Sea view", bergblick: "Mountain view",
  pool: "Pool", garten_terrasse: "Garden / terrace", parkplatz: "Parking", aufzug: "Lift", barrierearm: "Accessible", lizenz_vorhanden: "Rental licence in place",
  vermietung_laufend: "Rental operation running", agentur_vorhanden: "Management agency in place", renovierungsbedarf_gering: "Little renovation needed", sanierungsobjekt: "Renovation project",
  ganzjahresdestination: "Year-round destination", flughafen_unter_60min: "Airport within 60 min", zimmer_mit_bad: "Rooms with en-suite", restaurant_vorhanden: "Restaurant", wellness: "Spa / wellness",
};

export type ProfileText = { title: string; lines: Array<[string, string]>; intro: string; outro: string };

export function profileToText(profile: SearchProfile, regionNames: Record<string, string>, lang: "de" | "en", ref: string, labels?: { de: Record<string, string>; en: Record<string, string> }): ProfileText {
  const criterionLabel = (k: string) => labels?.de[k] ?? defaultLabel(k);
  const EN_CRITERIA_L: Record<string, string> = { ...EN_CRITERIA, ...(labels?.en ?? {}) };
  const eur = (n: number | null | undefined) => (n == null ? "–" : `${n.toLocaleString(lang === "de" ? "de-DE" : "en-GB")} €`);
  const regions = profile.regions.map((r) => regionNames[r] ?? r);
  const must = (profile.mustCriteria as string[]).map((k) => (lang === "de" ? criterionLabel(k) : (EN_CRITERIA_L[k] ?? criterionLabel(k))));
  const wish = (profile.wishCriteria as Array<{ key: string; weight: number }>).map((w) => `${lang === "de" ? criterionLabel(w.key) : (EN_CRITERIA[w.key] ?? w.key)} (${w.weight})`);

  if (lang === "en") {
    return {
      title: `Search mandate ${ref} – buyer profile`,
      intro: `We are acting exclusively for a buyer and are looking for the following property. The client's identity remains confidential; please send suitable offers directly to us.`,
      lines: [
        ["Property type", profile.segments.map((s) => EN_SEGMENT[s]).join(", ") || "–"],
        ["Countries", profile.countries.join(", ") || "–"],
        ["Regions", regions.join(", ") || "whole country"],
        ["Budget", `${profile.priceMin ? eur(profile.priceMin) + " – " : "up to "}${eur(profile.priceMax)}`],
        ["Purpose", EN_GOAL[profile.usageGoal]],
        ["Units / rooms", profile.minUnits || profile.maxUnits ? `${profile.minUnits ?? ""} – ${profile.maxUnits ?? ""}` : "–"],
        ["Rental licence required", profile.licenseRequired ? "yes" : "no"],
        ["Must-have criteria", must.join(", ") || "–"],
        ["Nice-to-have (weight)", wish.join(", ") || "–"],
        ["Time horizon", profile.horizon ?? "–"],
      ],
      outro: `Please reply with exposé, asking price, licence status and occupancy figures where available. We work on the buyer's side; commission arrangements follow our partner agreement.`,
    };
  }
  return {
    title: `Suchauftrag ${ref} – Käuferprofil`,
    intro: `Wir suchen im Auftrag eines Käufers folgendes Objekt. Der Auftraggeber bleibt vertraulich; passende Angebote bitte direkt an uns.`,
    lines: [
      ["Objektart", profile.segments.map((s) => SEGMENT_LABEL[s]).join(", ") || "–"],
      ["Länder", profile.countries.join(", ") || "–"],
      ["Regionen", regions.join(", ") || "ganzes Land"],
      ["Budget", `${profile.priceMin ? eur(profile.priceMin) + " – " : "bis "}${eur(profile.priceMax)}`],
      ["Nutzungsziel", USAGE_GOAL_LABEL[profile.usageGoal]],
      ["Einheiten / Zimmer", profile.minUnits || profile.maxUnits ? `${profile.minUnits ?? ""} – ${profile.maxUnits ?? ""}` : "–"],
      ["Vermietungslizenz erforderlich", profile.licenseRequired ? "ja" : "nein"],
      ["Muss-Kriterien", must.join(", ") || "–"],
      ["Wunschkriterien (Gewicht)", wish.join(", ") || "–"],
      ["Zeithorizont", profile.horizon ?? "–"],
    ],
    outro: `Bitte antworten Sie mit Exposé, Angebotspreis, Lizenzstatus und, soweit vorhanden, Auslastungszahlen. Wir arbeiten auf Käuferseite; die Provisionsregelung ergibt sich aus unserer Partnervereinbarung.`,
  };
}

export function profileTextPlain(t: ProfileText, intro?: string | null): string {
  return [intro?.trim(), t.intro, "", ...t.lines.map(([k, v]) => `${k}: ${v}`), "", t.outro].filter((x) => x !== undefined).join("\n");
}

export function profileTextHtml(t: ProfileText, intro?: string | null): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `${intro ? `<p>${esc(intro).replace(/\n/g, "<br>")}</p>` : ""}<p>${esc(t.intro)}</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
${t.lines.map(([k, v]) => `<tr><td style="border-bottom:1px solid #dfe7ea;color:#5d6f76;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="border-bottom:1px solid #dfe7ea">${esc(v)}</td></tr>`).join("\n")}
</table><p>${esc(t.outro)}</p>`;
}

export function profilePdfHtml(t: ProfileText, intro?: string | null): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,Helvetica,sans-serif;color:#1b2a30;font-size:12.5px}
h1{color:#0e3a47;font-size:20px;border-bottom:3px solid #19b5d4;padding-bottom:8px}
.brand{color:#19b5d4;font-weight:bold;font-size:14px;margin-bottom:24px}
td{padding:6px 8px;border-bottom:1px solid #dfe7ea;vertical-align:top} td:first-child{color:#5d6f76;white-space:nowrap}
.foot{margin-top:32px;font-size:10px;color:#5d6f76}
</style></head><body><div class="brand">Baax Immobilien GmbH · Baax Stay</div><h1>${t.title}</h1>${profileTextHtml(t, intro)}
<div class="foot">Baax Immobilien GmbH · www.baax.de · mail@baax.de</div></body></html>`;
}
