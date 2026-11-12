"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/services/events";
import { runMatchingForMandate } from "@/lib/services/matching";
import type { ActionResult } from "@/components/ui/action-form";

/** Kandidaten aus Portal-Suchen übernehmen oder verwerfen (Phase 3). */

export async function adoptCandidateAction(mandateId: string, candidateId: string): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const c = await prisma.searchCandidate.findFirstOrThrow({ where: { id: candidateId, mandateId }, include: { property: { select: { title: true } }, portalSearch: { select: { name: true } } } });
  await prisma.match.upsert({
    where: { mandateId_propertyId: { mandateId, propertyId: c.propertyId } },
    update: {},
    create: { mandateId, propertyId: c.propertyId, score: c.score, reasons: c.reasons ?? {}, status: "GEPRUEFT" },
  });
  await prisma.searchCandidate.update({ where: { id: c.id }, data: { status: "UEBERNOMMEN", decidedById: user.id, decidedAt: new Date() } });
  await logEvent(mandateId, "PORTAL_SEARCH", { action: "Kandidat übernommen", propertyId: c.propertyId, propertyTitle: c.property.title, search: c.portalSearch.name }, user);
  await audit({ userId: user.id, action: "MANDATE_UPDATE", entity: "Mandate", entityId: mandateId, meta: { candidateAdopted: c.id } });
  revalidatePath(`/auftraege/${mandateId}`);
  return { ok: true, message: "Als Treffer übernommen (Status geprüft). Vorstellung wie gewohnt im Tab Treffer." };
}

export async function discardCandidateAction(mandateId: string, candidateId: string): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  await prisma.searchCandidate.updateMany({ where: { id: candidateId, mandateId }, data: { status: "VERWORFEN", decidedById: user.id, decidedAt: new Date() } });
  revalidatePath(`/auftraege/${mandateId}`);
  return { ok: true, message: "Verworfen." };
}

/** Suchwunsch ins vereinbarte Suchprofil übernehmen (Regionen, Länder, Segmente ergänzen, Budget anheben). */
export async function adoptSearchIntoProfileAction(mandateId: string, searchId: string): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const s = await prisma.portalSearch.findFirstOrThrow({ where: { id: searchId, mandateId } });
  const p = await prisma.searchProfile.findUnique({ where: { mandateId } });
  if (!p) return { ok: false, error: "Kein Suchprofil vorhanden" };
  const uniq = <T,>(a: T[]) => Array.from(new Set(a));
  await prisma.searchProfile.update({
    where: { mandateId },
    data: {
      segments: p.segments.length ? uniq([...p.segments, ...s.segments]) : p.segments,
      countries: p.countries.length ? uniq([...p.countries, ...s.countries]) : p.countries,
      regions: p.regions.length || s.regions.length ? uniq([...p.regions, ...s.regions]) : p.regions,
      priceMax: Math.max(p.priceMax, s.priceMax),
    },
  });
  await logEvent(mandateId, "PROFILE_SAVED", { fromPortalSearch: s.name, regions: s.regions, priceMax: s.priceMax }, user);
  const m = await runMatchingForMandate(mandateId);
  await prisma.searchCandidate.updateMany({ where: { portalSearchId: s.id, status: "NEU", property: { matches: { some: { mandateId } } } }, data: { status: "UEBERNOMMEN", decidedById: user.id, decidedAt: new Date() } });
  revalidatePath(`/auftraege/${mandateId}`);
  return { ok: true, message: `Suchprofil erweitert. ${m.created} neue Treffer.` };
}
