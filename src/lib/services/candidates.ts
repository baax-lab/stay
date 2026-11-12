import "server-only";
import { prisma } from "@/lib/db";
import { matchProperty } from "@/lib/matching";
import { searchToProfile } from "@/lib/candidates";
import { ACTIVE_STATUSES } from "@/lib/mandates";
import { criteriaLabels } from "./criteria";

/**
 * Kandidaten aus gespeicherten Portal-Suchen (Phase 3): Objekte, die zum Suchwunsch passen,
 * aber noch kein Treffer des Suchauftrags sind. Kandidaten sind nur intern sichtbar.
 */

function toProperty(p: { segment: import("@prisma/client").Segment; country: string; region: string; price: number; units: number | null; licenseLight: import("@prisma/client").LicenseLight; features: unknown }) {
  return { segment: p.segment, country: p.country, region: p.region, price: p.price, units: p.units, licenseLight: p.licenseLight, features: Array.isArray(p.features) ? (p.features as string[]) : [] };
}

async function upsertCandidate(search: { id: string; mandateId: string }, property: Parameters<typeof toProperty>[0] & { id: string }, labels: Record<string, string>, profile: ReturnType<typeof searchToProfile>) {
  const existingMatch = await prisma.match.findUnique({ where: { mandateId_propertyId: { mandateId: search.mandateId, propertyId: property.id } } });
  const current = await prisma.searchCandidate.findUnique({ where: { portalSearchId_propertyId: { portalSearchId: search.id, propertyId: property.id } } });
  const r = matchProperty(profile, toProperty(property), labels);
  if (!r.matched || existingMatch) {
    if (current?.status === "NEU") await prisma.searchCandidate.delete({ where: { id: current.id } });
    return 0;
  }
  if (current) {
    if (current.status === "NEU") await prisma.searchCandidate.update({ where: { id: current.id }, data: { score: r.score, reasons: r.reasons } });
    return 0;
  }
  await prisma.searchCandidate.create({ data: { portalSearchId: search.id, mandateId: search.mandateId, propertyId: property.id, score: r.score, reasons: r.reasons } });
  return 1;
}

export async function runCandidatesForSearch(searchId: string): Promise<number> {
  const s = await prisma.portalSearch.findUniqueOrThrow({ where: { id: searchId } });
  if (!s.active) {
    await prisma.searchCandidate.deleteMany({ where: { portalSearchId: s.id, status: "NEU" } });
    return 0;
  }
  const labels = (await criteriaLabels()).de;
  const profile = searchToProfile(s);
  const props = await prisma.property.findMany({ where: { active: true, availability: { in: ["VERFUEGBAR", "RESERVIERT"] }, ...(profile.countries.length ? { country: { in: profile.countries } } : {}) } });
  let n = 0;
  for (const p of props) n += await upsertCandidate(s, p, labels, profile);
  return n;
}

export async function runCandidatesForProperty(propertyId: string): Promise<number> {
  const p = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
  if (!p.active || p.availability === "VERKAUFT" || p.availability === "ZURUECKGEZOGEN") {
    await prisma.searchCandidate.deleteMany({ where: { propertyId, status: "NEU" } });
    return 0;
  }
  const searches = await prisma.portalSearch.findMany({ where: { active: true, mandate: { status: { in: ACTIVE_STATUSES } } } });
  if (!searches.length) return 0;
  const labels = (await criteriaLabels()).de;
  let n = 0;
  for (const s of searches) n += await upsertCandidate(s, p, labels, searchToProfile(s));
  return n;
}
