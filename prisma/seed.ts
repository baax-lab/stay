import { PrismaClient } from "@prisma/client";
import { CRITERIA } from "../src/lib/criteria";
import { EN_CRITERIA } from "../src/lib/profile-text";
import { readFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

// Schwerpunktmärkte und erste Regionen. licenseRule ist Kurzinfo für Ampel und Dossier (Phase 1b)
// und wird von der Leitung inhaltlich gepflegt (offener Punkt im Konzept).
const regions: Array<{ country: string; key: string; name: string; focus?: boolean; licenseRule?: string }> = [
  { country: "DE", key: "de-oberallgaeu", name: "Oberallgäu", focus: true },
  { country: "DE", key: "de-ostallgaeu", name: "Ostallgäu" },
  { country: "DE", key: "de-garmisch", name: "Garmisch-Partenkirchen / Werdenfels" },
  { country: "DE", key: "de-berchtesgaden", name: "Berchtesgadener Land" },
  { country: "DE", key: "de-chiemgau", name: "Chiemgau / Chiemsee" },
  { country: "DE", key: "de-tegernsee", name: "Tegernsee / Schliersee" },
  { country: "DE", key: "de-bodensee", name: "Bodensee" },
  { country: "DE", key: "de-ostsee", name: "Ostseeküste" },
  { country: "DE", key: "de-nordsee", name: "Nordseeküste" },
  { country: "DE", key: "de-schwarzwald", name: "Schwarzwald" },
  { country: "AT", key: "at-tirol", name: "Tirol", focus: true },
  { country: "AT", key: "at-salzburger-land", name: "Salzburger Land" },
  { country: "AT", key: "at-kaernten", name: "Kärnten" },
  { country: "AT", key: "at-vorarlberg", name: "Vorarlberg" },
  { country: "AT", key: "at-steiermark", name: "Steiermark" },
  { country: "IT", key: "it-suedtirol", name: "Südtirol", focus: true },
  { country: "IT", key: "it-gardasee", name: "Gardasee" },
  { country: "IT", key: "it-toskana", name: "Toskana" },
  { country: "IT", key: "it-ligurien", name: "Ligurien" },
  { country: "IT", key: "it-apulien", name: "Apulien" },
  { country: "ES", key: "es-mallorca", name: "Mallorca", focus: true },
  { country: "ES", key: "es-ibiza", name: "Ibiza" },
  { country: "ES", key: "es-menorca", name: "Menorca" },
  { country: "ES", key: "es-costa-blanca", name: "Costa Blanca" },
  { country: "ES", key: "es-costa-del-sol", name: "Costa del Sol" },
  { country: "ES", key: "es-kanaren", name: "Kanarische Inseln" },
  { country: "PT", key: "pt-algarve", name: "Algarve" },
  { country: "PT", key: "pt-lissabon", name: "Lissabon und Küste" },
  { country: "FR", key: "fr-cote-d-azur", name: "Côte d'Azur" },
  { country: "FR", key: "fr-savoyen", name: "Savoyen / Haute-Savoie" },
  { country: "CH", key: "ch-graubuenden", name: "Graubünden" },
  { country: "CH", key: "ch-wallis", name: "Wallis" },
  { country: "HR", key: "hr-istrien", name: "Istrien" },
  { country: "HR", key: "hr-dalmatien", name: "Dalmatien" },
  { country: "GR", key: "gr-kreta", name: "Kreta" },
  { country: "GR", key: "gr-kykladen", name: "Kykladen" },
];

async function main() {
  for (const r of regions) {
    await prisma.region.upsert({
      where: { key: r.key },
      update: {}, // gepflegte Angaben (Name, Schwerpunkt, Regeln) nie überschreiben
      create: { ...r, focus: r.focus ?? false },
    });
  }

  await prisma.setting.upsert({
    where: { key: "activeEvent" },
    update: {},
    create: {
      key: "activeEvent",
      value: { source: "MESSE", sourceDetail: "SuperStay LIVE 2026", active: true },
    },
  });

  // Honorarstaffel – Startwerte (offener Punkt im Konzept, von der Leitung anzupassen)
  if ((await prisma.feeBand.count()) === 0) {
    await prisma.feeBand.createMany({
      data: [
        { volumeFrom: 0, volumeTo: 500_000, baseFee: 2_500, successFee: 12_000, bonusPct: 0.1, bonusCapPct: 0.25, note: "Startwert" },
        { volumeFrom: 500_000, volumeTo: 1_000_000, baseFee: 3_500, successFee: 18_500, bonusPct: 0.1, bonusCapPct: 0.25, note: "Startwert" },
        { volumeFrom: 1_000_000, volumeTo: 2_000_000, baseFee: 5_000, successFee: 28_000, bonusPct: 0.1, bonusCapPct: 0.25, note: "Startwert" },
        { volumeFrom: 2_000_000, volumeTo: 3_000_000, baseFee: 7_500, successFee: 40_000, bonusPct: 0.1, bonusCapPct: 0.25, note: "Startwert" },
        { volumeFrom: 3_000_000, volumeTo: null, baseFee: 10_000, successFee: 55_000, bonusPct: 0.1, bonusCapPct: 0.25, note: "darüber individuell" },
      ],
    });
  }

  await prisma.setting.upsert({
    where: { key: "goal" },
    update: {},
    create: { key: "goal", value: { mandates: 3, days: 90, startDate: "2026-11-20" } },
  });

  // Kaufnebenkosten-Richtwerte für die Startmärkte (offener Punkt: inhaltlich prüfen und regelmäßig aktualisieren)
  if ((await prisma.countryCost.count()) === 0) {
    const validFrom = new Date("2026-01-01");
    const bavarian = ["de-oberallgaeu", "de-ostallgaeu", "de-garmisch", "de-berchtesgaden", "de-chiemgau", "de-tegernsee"];
    await prisma.countryCost.createMany({
      data: [
        { country: "DE", label: "Grunderwerbsteuer", pct: 5.0, note: "je Bundesland 3,5–6,5 %; Richtwert", validFrom },
        ...bavarian.map((regionKey) => ({ country: "DE", regionKey, label: "Grunderwerbsteuer", pct: 3.5, note: "Bayern 3,5 %", validFrom })),
        { country: "DE", label: "Notar und Grundbuch", pct: 2.0, note: "Richtwert", validFrom },
        { country: "AT", label: "Grunderwerbsteuer", pct: 3.5, note: "", validFrom },
        { country: "AT", label: "Grundbucheintragung", pct: 1.1, note: "", validFrom },
        { country: "AT", label: "Vertragserrichtung und Treuhand", pct: 1.8, note: "inkl. USt; Richtwert", validFrom },
        { country: "IT", label: "Registersteuer (Zweitwohnsitz)", pct: 9.0, note: "Bemessung meist auf Katasterwert, hier vereinfacht auf Kaufpreis; Richtwert", validFrom },
        { country: "IT", label: "Hypothekar- und Katastersteuer", flat: 100, note: "pauschal", validFrom },
        { country: "IT", label: "Notar", pct: 1.5, note: "Richtwert", validFrom },
        { country: "ES", label: "Grunderwerbsteuer (ITP)", pct: 10.0, note: "regional unterschiedlich; Richtwert", validFrom },
        ...["es-mallorca", "es-ibiza", "es-menorca"].map((regionKey) => ({ country: "ES", regionKey, label: "Grunderwerbsteuer (ITP)", pct: 10.0, note: "Balearen progressiv ca. 8–13 % je nach Kaufpreis; Richtwert", validFrom })),
        { country: "ES", label: "Notar und Registro", pct: 1.5, note: "Richtwert", validFrom },
        { country: "ES", label: "Anwalt", pct: 1.0, note: "Richtwert", validFrom },
      ],
    });
  }

  if ((await prisma.fxRate.count()) === 0) {
    await prisma.fxRate.createMany({
      data: [
        { currency: "CHF", rateToEur: 1.06, source: "Startwert" },
        { currency: "GBP", rateToEur: 1.17, source: "Startwert" },
      ],
    });
  }

  // Kriterienkatalog (Phase 2 pflegbar)
  for (const [i, c] of CRITERIA.entries()) {
    await prisma.criterion.upsert({ where: { key: c.key }, update: {}, create: { key: c.key, label: c.label, labelEn: EN_CRITERIA[c.key] ?? null, group: c.group, sort: i } });
  }

  // Vorlagen (Phase 2): nur anlegen, wenn noch nicht vorhanden – bearbeitete Fassungen bleiben erhalten
  const templates: Array<[string, string, string, string]> = [
    ["SUCHAUFTRAG", "de", "Suchauftrag", "suchauftrag.de.md"],
    ["SUCHAUFTRAG", "en", "Search mandate", "suchauftrag.en.md"],
    ["PARTNERVEREINBARUNG", "de", "Partnervereinbarung", "partnervereinbarung.de.md"],
    ["PARTNERVEREINBARUNG", "en", "Partner agreement", "partnervereinbarung.en.md"],
    ["TIPPGEBERBESTAETIGUNG", "de", "Tippgeberbestätigung", "tippgeberbestaetigung.de.md"],
  ];
  for (const [kind, lang, name, file] of templates) {
    const body = readFileSync(path.join(__dirname, "templates", file), "utf8");
    await prisma.documentTemplate.upsert({ where: { kind_lang: { kind, lang } }, update: {}, create: { kind, lang, name, body } });
  }

  // Länderwissen (Phase 3): Startinhalte ohne Prüfdatum – inhaltlich prüfen und als geprüft markieren
  const countries: Array<{ code: string; name: string; nameEn: string; currency?: string; overview?: string; buyingProcess?: string; foreignBuyers?: string; taxesNote?: string; typicalDuration?: string }> = [
    { code: "DE", name: "Deutschland", nameEn: "Germany", buyingProcess: "Beurkundung beim Notar, Auflassungsvormerkung, Kaufpreiszahlung nach Fälligkeitsmitteilung, Eigentumsumschreibung im Grundbuch.", foreignBuyers: "Keine generellen Beschränkungen für ausländische Käufer.", taxesNote: "Grunderwerbsteuer je Bundesland 3,5–6,5 %; Zweitwohnungssteuer und Zweckentfremdungssatzungen der Gemeinden beachten.", typicalDuration: "6–10 Wochen ab Einigung" },
    { code: "AT", name: "Österreich", nameEn: "Austria", buyingProcess: "Kaufvertrag mit Treuhänder (Notar/Anwalt), Grundverkehrsgenehmigung je nach Bundesland, Grundbucheintragung.", foreignBuyers: "Grundverkehrsgesetze der Länder; Erwerb durch Nicht-EU-Bürger genehmigungspflichtig. Freizeitwohnsitze in Tirol und Salzburg stark beschränkt.", taxesNote: "Grunderwerbsteuer 3,5 %, Eintragungsgebühr 1,1 %.", typicalDuration: "2–4 Monate inkl. Grundverkehr" },
    { code: "IT", name: "Italien", nameEn: "Italy", buyingProcess: "Proposta d'acquisto, Compromesso mit Caparra, Rogito beim Notaio, Eintragung im Catasto.", foreignBuyers: "Codice fiscale erforderlich; für EU-Bürger keine Beschränkungen.", taxesNote: "Registersteuer auf Zweitwohnungen meist 9 % auf den Katasterwert; touristische Vermietung mit CIN/CIR.", typicalDuration: "2–3 Monate" },
    { code: "ES", name: "Spanien", nameEn: "Spain", buyingProcess: "Reservierung, Contrato de arras (meist 10 %), Escritura beim Notario, Eintragung im Registro de la Propiedad.", foreignBuyers: "NIE und spanisches Bankkonto erforderlich; für EU-Bürger keine Beschränkungen.", taxesNote: "ITP je Autonomer Gemeinschaft (Balearen progressiv); touristische Vermietung je Region reguliert (ETV/ETVPL).", typicalDuration: "6–12 Wochen" },
    { code: "PT", name: "Portugal", nameEn: "Portugal" },
    { code: "FR", name: "Frankreich", nameEn: "France" },
    { code: "CH", name: "Schweiz", nameEn: "Switzerland", currency: "CHF", foreignBuyers: "Lex Koller: Erwerb von Ferienwohnungen durch Personen im Ausland bewilligungspflichtig und kontingentiert; Zweitwohnungsgesetz (max. 20 % je Gemeinde)." },
    { code: "HR", name: "Kroatien", nameEn: "Croatia" },
    { code: "GR", name: "Griechenland", nameEn: "Greece" },
  ];
  for (const c of countries) await prisma.country.upsert({ where: { code: c.code }, update: {}, create: { currency: "EUR", ...c } });

  console.log("Seed fertig (idempotent): Stammdaten ergänzt, gepflegte Werte unverändert.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
