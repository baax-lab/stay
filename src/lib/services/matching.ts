import "server-only";
import type { Match, MatchStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isPriorKnowledge, matchProperty, rankMandates, type MatchResult } from "@/lib/matching";
import { ACTIVE_STATUSES } from "@/lib/mandates";
import { logEvent } from "./events";
import type { SessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { draftObjectNotification } from "./notifications";
import { criteriaLabels } from "./criteria";

type ProfileRow = Prisma.SearchProfileGetPayload<{ include: { mandate: { select: { id: true; status: true } } } }>;
type PropertyRow = Prisma.PropertyGetPayload<Record<string, never>>;

function toProfile(p: ProfileRow) {
  return {
    segments: p.segments,
    countries: p.countries,
    regions: p.regions,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    minUnits: p.minUnits,
    maxUnits: p.maxUnits,
    licenseRequired: p.licenseRequired,
    mustCriteria: Array.isArray(p.mustCriteria) ? (p.mustCriteria as string[]) : [],
    wishCriteria: Array.isArray(p.wishCriteria) ? (p.wishCriteria as Array<{ key: string; weight: number }>) : [],
  };
}

function toProperty(p: PropertyRow) {
  return {
    segment: p.segment,
    country: p.country,
    region: p.region,
    price: p.price,
    units: p.units,
    licenseLight: p.licenseLight,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  };
}

/** Treffer anlegen/aktualisieren. Bereits bewertete Treffer (AN_KAEUFER, ABGELEHNT, GEMERKT) behalten ihren Status. */
async function upsertMatch(mandateId: string, propertyId: string, result: MatchResult) {
  const existing = await prisma.match.findUnique({ where: { mandateId_propertyId: { mandateId, propertyId } } });
  if (!result.matched) {
    if (existing && (existing.status === "NEU" || existing.status === "GEPRUEFT")) {
      await prisma.match.delete({ where: { id: existing.id } });
      return "removed" as const;
    }
    return "none" as const;
  }
  if (existing) {
    await prisma.match.update({
      where: { id: existing.id },
      data: { score: result.score, nearMiss: result.nearMiss, reasons: result.reasons },
    });
    return "updated" as const;
  }
  await prisma.match.create({
    data: { mandateId, propertyId, score: result.score, nearMiss: result.nearMiss, reasons: result.reasons },
  });
  return "created" as const;
}

/** Läuft beim Speichern eines Objekts gegen alle aktiven Profile (synchron, Konzept §8.5). */
export async function runMatchingForProperty(propertyId: string): Promise<{ created: number; updated: number; removed: number }> {
  const property = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
  const out = { created: 0, updated: 0, removed: 0 };
  if (!property.active || property.availability === "VERKAUFT" || property.availability === "ZURUECKGEZOGEN") return out;

  const profiles = await prisma.searchProfile.findMany({
    where: { active: true, mandate: { status: { in: ACTIVE_STATUSES } } },
    include: { mandate: { select: { id: true, status: true } } },
  });
  const labels = (await criteriaLabels()).de;
  for (const profile of profiles) {
    const r = await upsertMatch(profile.mandateId, property.id, matchProperty(toProfile(profile), toProperty(property), labels));
    if (r !== "none") out[r]++;
  }
  return out;
}

/** Läuft beim Speichern eines Suchprofils gegen alle verfügbaren Objekte. */
export async function runMatchingForMandate(mandateId: string): Promise<{ created: number; updated: number; removed: number }> {
  const profile = await prisma.searchProfile.findUnique({ where: { mandateId }, include: { mandate: { select: { id: true, status: true } } } });
  const out = { created: 0, updated: 0, removed: 0 };
  if (!profile || !profile.active) return out;
  const properties = await prisma.property.findMany({ where: { active: true, availability: { in: ["VERFUEGBAR", "RESERVIERT"] } } });
  const labels = (await criteriaLabels()).de;
  for (const property of properties) {
    const r = await upsertMatch(mandateId, property.id, matchProperty(toProfile(profile), toProperty(property), labels));
    if (r !== "none") out[r]++;
  }
  return out;
}

/** Rang des Suchauftrags unter allen aktiven Suchaufträgen mit Treffer auf dieses Objekt (1 = Vorrang). */
export async function mandateRankForProperty(propertyId: string, mandateId: string): Promise<{ rank: number; total: number; first?: { id: string; title: string } }> {
  const matches = await prisma.match.findMany({
    where: { propertyId, status: { not: "GESCHLOSSEN" }, mandate: { status: { in: ACTIVE_STATUSES } } },
    include: { mandate: { select: { id: true, title: true, contractSignedAt: true, createdAt: true } } },
  });
  const ranked = rankMandates(matches.map((m) => m.mandate));
  const idx = ranked.findIndex((m) => m.id === mandateId);
  return { rank: idx + 1, total: ranked.length, first: ranked[0] ? { id: ranked[0].id, title: ranked[0].title } : undefined };
}

export type SetMatchStatusResult = { ok: true; match: Match } | { ok: false; error: string; needsApproval?: boolean };

/**
 * Trefferstatus setzen. AN_KAEUFER erzeugt eine Presentation mit eingefrorenem Angebotspreis.
 * Nachrangiger Käufer (Rang > 1) braucht Freigabe durch Leitung (Konzept §8.19).
 */
export async function setMatchStatus(
  matchId: string,
  status: MatchStatus,
  user: SessionUser,
  opts: { rejectReason?: string | null; channel?: string } = {},
): Promise<SetMatchStatusResult> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { property: true, mandate: true } });
  if (!match) return { ok: false, error: "Treffer nicht gefunden" };

  if (status === "ABGELEHNT" && !opts.rejectReason?.trim()) return { ok: false, error: "Ablehnungsgrund ist Pflicht" };

  let approved: { by: string; at: Date } | null = null;
  if (status === "AN_KAEUFER") {
    if (match.property.availability === "VERKAUFT" || match.property.availability === "ZURUECKGEZOGEN") {
      return { ok: false, error: "Objekt ist nicht mehr verfügbar" };
    }
    const { rank, first } = await mandateRankForProperty(match.propertyId, match.mandateId);
    if (rank > 1) {
      if (!can.approveSecondBuyer(user.role)) {
        return { ok: false, error: `Vorrang hat „${first?.title}“. Vorstellung an einen weiteren Käufer nur nach Freigabe durch die Leitung.`, needsApproval: true };
      }
      approved = { by: user.id, at: new Date() };
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.match.update({
      where: { id: matchId },
      data: {
        status,
        rejectReason: status === "ABGELEHNT" ? opts.rejectReason?.trim() : match.rejectReason,
        ...(approved ? { approvedById: approved.by, approvedAt: approved.at } : {}),
      },
    });
    if (status === "AN_KAEUFER") {
      const priorKnowledge = isPriorKnowledge(match.property.knownSince, match.mandate.contractSignedAt);
      await tx.presentation.upsert({
        where: { mandateId_propertyId: { mandateId: match.mandateId, propertyId: match.propertyId } },
        update: {},
        create: {
          mandateId: match.mandateId,
          propertyId: match.propertyId,
          channel: opts.channel ?? "EMAIL",
          askingPrice: match.property.price,
          sentById: user.id,
          priorKnowledge,
        },
      });
    }
    return m;
  });

  // Freigabe an den Käufer → Mail-Entwurf (Versand erst nach Sichtung)
  if (status === "AN_KAEUFER") await draftObjectNotification(match.mandateId, match.propertyId);

  if (approved) {
    await logEvent(match.mandateId, "MATCH_APPROVED", { propertyId: match.propertyId, propertyTitle: match.property.title }, user);
  }
  await logEvent(
    match.mandateId,
    status === "AN_KAEUFER" ? "MATCH_SENT" : "MATCH_STATUS",
    { propertyId: match.propertyId, propertyTitle: match.property.title, status, rejectReason: opts.rejectReason ?? null, askingPrice: match.property.price, channel: opts.channel ?? null },
    user,
  );
  return { ok: true, match: updated };
}

/** Objekt verkauft/zurückgezogen: offene Treffer schließen, betroffene Suchaufträge erhalten einen Hinweis. */
export async function closeMatchesForProperty(propertyId: string, reason: string, user: SessionUser): Promise<number> {
  const open = await prisma.match.findMany({ where: { propertyId, status: { in: ["NEU", "GEPRUEFT", "AN_KAEUFER", "GEMERKT"] } }, include: { property: { select: { title: true } } } });
  for (const m of open) {
    await prisma.match.update({ where: { id: m.id }, data: { status: "GESCHLOSSEN", rejectReason: reason } });
    await logEvent(m.mandateId, "PROPERTY_UNAVAILABLE", { propertyId, propertyTitle: m.property.title, reason }, user);
  }
  return open.length;
}
