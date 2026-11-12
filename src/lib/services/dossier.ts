import "server-only";
import { prisma } from "@/lib/db";
import { criterionLabel } from "@/lib/criteria";
import { EN_CRITERIA } from "@/lib/profile-text";
import type { Lang } from "@/lib/i18n";
import { propertyFigures, type PropertyFigures } from "./figures";

export type DossierData = {
  propertyId: string;
  title: string;
  segment: string;
  country: string;
  regionName: string;
  locality: string | null;
  price: number;
  currency: string;
  units: number | null;
  livingArea: number | null;
  occupancyPct: number | null;
  adr: number | null;
  revenueYear: number | null;
  features: string[];
  description: string | null;
  strengths: string[];
  risks: string[];
  precheck: string | null;
  photoIds: string[];
  figures: PropertyFigures;
  buyerName: string | null;
  available: boolean;
};

const lines = (s: string | null | undefined) => (s ?? "").split(/\n+/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

/** Daten fürs Dossier (Konzept §9.5) – keine internen Angaben wie Adresse, Quelle oder Notizen. */
export async function loadDossier(propertyId: string, mandateId: string | null, lang: Lang): Promise<DossierData | null> {
  const p = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!p || !p.active) return null;
  const mandate = mandateId ? await prisma.mandate.findUnique({ where: { id: mandateId }, select: { buyerName: true } }) : null;
  const figures = await propertyFigures(p, mandate ? mandateId : null);
  const photoIds = Array.isArray(p.photos) ? (p.photos as string[]) : [];
  const en = lang === "en";
  return {
    propertyId: p.id,
    title: (en && p.titleEn) || p.title,
    segment: p.segment,
    country: p.country,
    regionName: figures.regionName,
    locality: p.locality,
    price: p.price,
    currency: p.currency,
    units: p.units,
    livingArea: p.livingArea,
    occupancyPct: p.occupancyPct,
    adr: p.adr,
    revenueYear: p.revenueYear,
    features: (p.features as string[]).map((k) => (en ? (EN_CRITERIA[k] ?? k) : criterionLabel(k))),
    description: (en && p.descriptionEn) || p.description,
    strengths: lines((en && p.strengthsEn) || p.strengths),
    risks: lines((en && p.risksEn) || p.risks),
    precheck: p.precheckNote,
    photoIds,
    figures,
    buyerName: mandate?.buyerName ?? null,
    available: p.availability === "VERFUEGBAR" || p.availability === "RESERVIERT",
  };
}
