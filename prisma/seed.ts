import { PrismaClient } from "@prisma/client";

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
      update: { name: r.name, country: r.country, focus: r.focus ?? false },
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

  console.log(`Seed fertig: ${regions.length} Regionen, aktives Event gesetzt.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
