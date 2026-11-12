/** Kleiner CSV-Parser (RFC 4180, Trennzeichen ; oder , oder Tab wird erkannt). Läuft im Browser und auf dem Server. */
export function detectDelimiter(text: string): string {
  const head = text.split(/\r?\n/).slice(0, 5).join("\n");
  const counts = [";", ",", "\t"].map((d) => ({ d, n: (head.match(new RegExp(d === "\t" ? "\t" : `\\${d}`, "g")) ?? []).length }));
  return counts.sort((a, b) => b.n - a.n)[0].n > 0 ? counts.sort((a, b) => b.n - a.n)[0].d : ";";
}

export function parseCsv(text: string, delimiter?: string): string[][] {
  const d = delimiter ?? detectDelimiter(text);
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === d) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type ImportScope = "leads" | "objekte" | "partner";

export type ImportField = { key: string; label: string; required?: boolean; aliases: string[] };

export const IMPORT_FIELDS: Record<ImportScope, ImportField[]> = {
  leads: [
    { key: "name", label: "Name", required: true, aliases: ["name", "kontakt", "ansprechpartner", "vorname nachname"] },
    { key: "company", label: "Firma", aliases: ["firma", "company", "unternehmen"] },
    { key: "email", label: "E-Mail", aliases: ["email", "e-mail", "mail"] },
    { key: "phone", label: "Telefon", aliases: ["telefon", "phone", "tel", "mobil", "handy"] },
    { key: "role", label: "Rolle (Käufer/Verkäufer/Partner/Multiplikator)", aliases: ["rolle", "role", "typ"] },
    { key: "source", label: "Quelle", aliases: ["quelle", "source", "herkunft"] },
    { key: "sourceDetail", label: "Quelle Detail", aliases: ["quelle detail", "sourcedetail", "event", "messe"] },
    { key: "interest", label: "Interesse", aliases: ["interesse", "interest", "anfrage", "bemerkung"] },
    { key: "segment", label: "Segment", aliases: ["segment", "objektart"] },
    { key: "regions", label: "Regionen (kommagetrennt)", aliases: ["regionen", "region", "regions", "ort", "lage"] },
    { key: "budgetMin", label: "Budget von", aliases: ["budget von", "budgetmin", "preis von", "min"] },
    { key: "budgetMax", label: "Budget bis", aliases: ["budget bis", "budgetmax", "budget", "preis bis", "max"] },
    { key: "consentEmail", label: "Einwilligung E-Mail (ja/nein)", aliases: ["einwilligung", "consent", "newsletter", "opt-in"] },
    { key: "note", label: "Notiz", aliases: ["notiz", "note", "anmerkung", "kommentar"] },
  ],
  objekte: [
    { key: "title", label: "Titel", required: true, aliases: ["titel", "title", "objekt", "bezeichnung", "name"] },
    { key: "segment", label: "Segment", required: true, aliases: ["segment", "objektart", "typ", "art"] },
    { key: "country", label: "Land (ISO)", required: true, aliases: ["land", "country", "staat"] },
    { key: "region", label: "Region (Key oder Name)", required: true, aliases: ["region", "regionen", "gebiet"] },
    { key: "locality", label: "Ort", aliases: ["ort", "locality", "stadt", "gemeinde", "city"] },
    { key: "address", label: "Adresse", aliases: ["adresse", "address", "strasse", "straße"] },
    { key: "price", label: "Preis", required: true, aliases: ["preis", "price", "kaufpreis", "angebotspreis"] },
    { key: "units", label: "Einheiten/Zimmer", aliases: ["einheiten", "units", "zimmer", "rooms", "wohnungen"] },
    { key: "livingArea", label: "Wohnfläche", aliases: ["wohnfläche", "wohnflaeche", "fläche", "qm", "m2", "m²", "area"] },
    { key: "licenseStatus", label: "Lizenz (vorhanden/beantragt/fehlt/unklar/nicht nötig)", aliases: ["lizenz", "license", "licencia", "genehmigung"] },
    { key: "occupancyPct", label: "Auslastung %", aliases: ["auslastung", "occupancy", "belegung"] },
    { key: "adr", label: "Ø Tagespreis", aliases: ["tagespreis", "adr", "preis/nacht", "nachtpreis"] },
    { key: "revenueYear", label: "Jahresumsatz", aliases: ["umsatz", "jahresumsatz", "revenue"] },
    { key: "features", label: "Merkmale (kommagetrennt)", aliases: ["merkmale", "features", "ausstattung"] },
    { key: "source", label: "Quelle (PARTNER/AGENTUR/PORTAL/OFFMARKET/DIREKT)", aliases: ["quelle", "source", "herkunft"] },
    { key: "sourceDetail", label: "Quelle Detail / Link", aliases: ["quelle detail", "link", "url", "sourcedetail", "portal"] },
    { key: "knownSince", label: "Bekannt seit (Datum)", aliases: ["bekannt seit", "knownsince", "seit", "datum"] },
    { key: "knownSourceNote", label: "Woher bekannt", aliases: ["woher", "knownsourcenote", "vorkenntnis"] },
    { key: "offmarket", label: "Off-Market (ja/nein)", aliases: ["offmarket", "off-market", "off market"] },
    { key: "description", label: "Beschreibung", aliases: ["beschreibung", "description", "text", "bemerkung"] },
  ],
  partner: [
    { key: "name", label: "Name", required: true, aliases: ["name", "ansprechpartner", "kontakt"] },
    { key: "company", label: "Firma", aliases: ["firma", "company", "büro", "agentur"] },
    { key: "email", label: "E-Mail", aliases: ["email", "e-mail", "mail"] },
    { key: "phone", label: "Telefon", aliases: ["telefon", "phone", "tel"] },
    { key: "language", label: "Sprache (de/en)", aliases: ["sprache", "language", "lang"] },
    { key: "type", label: "Art (MAKLER/AGENTUR/ANWALT/NOTAR/FINANZIERER)", aliases: ["art", "typ", "type", "rolle"] },
    { key: "country", label: "Land (ISO)", required: true, aliases: ["land", "country"] },
    { key: "regions", label: "Regionen (kommagetrennt)", aliases: ["regionen", "region", "regions", "gebiet"] },
    { key: "licenseNote", label: "Lizenz/Registrierung", aliases: ["lizenz", "registrierung", "license"] },
    { key: "commissionSplit", label: "Provisionsteilung", aliases: ["provision", "provisionsteilung", "split", "commission"] },
    { key: "agreementAt", label: "Partnervereinbarung am", aliases: ["vereinbarung", "agreement", "vertrag", "partnervereinbarung"] },
    { key: "note", label: "Notiz", aliases: ["notiz", "note", "bemerkung"] },
  ],
};

/** Spalten automatisch zuordnen: exakter oder enthaltener Aliasname. */
export function autoMap(scope: ImportScope, headers: string[]): Record<number, string | ""> {
  const fields = IMPORT_FIELDS[scope];
  const used = new Set<string>();
  const map: Record<number, string | ""> = {};
  headers.forEach((h, i) => {
    const n = h.trim().toLowerCase();
    const hit = fields.find((f) => !used.has(f.key) && f.aliases.some((a) => n === a)) ?? fields.find((f) => !used.has(f.key) && f.aliases.some((a) => n.includes(a)));
    map[i] = hit?.key ?? "";
    if (hit) used.add(hit.key);
  });
  return map;
}
