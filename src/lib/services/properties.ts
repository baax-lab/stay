import "server-only";
import type { Availability, Prisma, Property } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { deriveLicenseLight } from "@/lib/license";
import type { SessionUser } from "@/lib/session";
import { closeMatchesForProperty, runMatchingForProperty } from "./matching";

export type PriceHistoryEntry = { price: number; at: string; note?: string | null };

function norm(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .replace(/str(a|\.)?(ße|sse)?\b/g, "str")
    .replace(/[^a-z0-9äöüß]/g, "");
}

/** Objekt-Dubletten (Konzept §8.13): gleiches Land, ähnliche Adresse/Ort, Preis ±5 %, gleiche Einheitenzahl. */
export async function findPropertyDuplicates(input: { country: string; locality?: string | null; address?: string | null; price: number; units?: number | null }, excludeId?: string) {
  const candidates = await prisma.property.findMany({
    where: {
      country: input.country,
      price: { gte: Math.floor(input.price * 0.95), lte: Math.ceil(input.price * 1.05) },
      ...(input.units != null ? { units: input.units } : {}),
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, title: true, locality: true, address: true, price: true, units: true, knownSince: true, source: true, sourceDetail: true },
    take: 20,
  });
  const loc = norm(input.locality);
  const addr = norm(input.address);
  return candidates.filter((c) => {
    const cl = norm(c.locality);
    const ca = norm(c.address);
    if (addr && ca && (addr.includes(ca) || ca.includes(addr))) return true;
    if (loc && cl && loc === cl) return true;
    return !loc && !addr; // ohne Ortsangabe: Preis und Einheiten reichen für einen Hinweis
  });
}

export type PropertyInput = {
  title: string;
  segment: Property["segment"];
  country: string;
  region: string;
  locality?: string | null;
  address?: string | null;
  price: number;
  currency?: string;
  units?: number | null;
  livingArea?: number | null;
  licenseStatus: Property["licenseStatus"];
  licenseNote?: string | null;
  occupancyPct?: number | null;
  adr?: number | null;
  revenueYear?: number | null;
  features: string[];
  description?: string | null;
  source: Property["source"];
  sourceDetail?: string | null;
  knownSince?: Date | null;
  knownSourceNote?: string | null;
  sellerLeadId?: string | null;
  offmarket?: boolean;
  referrerId?: string | null;
  partnerId?: string | null;
  yearBuilt?: number | null;
  condition?: string | null;
  plotArea?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  distanceBeachM?: number | null;
  distanceSkiM?: number | null;
  distanceAirportKm?: number | null;
  energyClass?: string | null;
  mapUrl?: string | null;
};

async function lightFor(region: string, status: Property["licenseStatus"]) {
  const r = await prisma.region.findUnique({ where: { key: region } });
  return deriveLicenseLight(status, r?.licenseRule).light;
}

export async function createProperty(input: PropertyInput, user: SessionUser) {
  const duplicates = await findPropertyDuplicates(input);
  const knownSince = input.knownSince ?? new Date();
  const property = await prisma.property.create({
    data: {
      ...input,
      currency: input.currency ?? "EUR",
      knownSince,
      knownSourceNote: input.knownSourceNote ?? null,
      licenseLight: await lightFor(input.region, input.licenseStatus),
      priceHistory: [{ price: input.price, at: new Date().toISOString(), note: "Erfassung" }] satisfies PriceHistoryEntry[],
      duplicateOfId: duplicates[0]?.id ?? null,
      createdById: user.id,
    },
  });
  await audit({ userId: user.id, action: "PROPERTY_CREATE", entity: "Property", entityId: property.id, meta: { duplicates: duplicates.map((d) => d.id) } });
  const matching = await runMatchingForProperty(property.id);
  return { property, duplicates, matching };
}

export async function updateProperty(id: string, input: Partial<PropertyInput>, user: SessionUser) {
  const before = await prisma.property.findUniqueOrThrow({ where: { id } });
  const { sellerLeadId, referrerId, partnerId, knownSince: _ks, knownSourceNote: _kn, ...rest } = input;
  void _ks;
  void _kn;
  const data: Prisma.PropertyUpdateInput = { ...rest };
  if (sellerLeadId !== undefined) data.sellerLead = sellerLeadId ? { connect: { id: sellerLeadId } } : { disconnect: true };
  if (referrerId !== undefined) data.referrer = referrerId ? { connect: { id: referrerId } } : { disconnect: true };
  if (partnerId !== undefined) data.partner = partnerId ? { connect: { id: partnerId } } : { disconnect: true };

  // Vorkenntnis-Felder nur durch Admin mit Protokoll (Konzept §8.9)
  if (input.knownSince !== undefined || input.knownSourceNote !== undefined) {
    if (user.role !== "ADMIN") throw new Error("Vorkenntnis-Daten dürfen nur durch Admin geändert werden");
    data.knownSince = input.knownSince ?? before.knownSince;
    data.knownSourceNote = input.knownSourceNote ?? before.knownSourceNote;
    await audit({ userId: user.id, action: "KNOWN_SINCE_CHANGE", entity: "Property", entityId: id, meta: { from: { knownSince: before.knownSince, note: before.knownSourceNote }, to: { knownSince: input.knownSince, note: input.knownSourceNote } } });
  }

  if (input.price !== undefined && input.price !== before.price) {
    const history = (Array.isArray(before.priceHistory) ? (before.priceHistory as PriceHistoryEntry[]) : []).concat({ price: input.price, at: new Date().toISOString(), note: "Preisänderung" });
    data.priceHistory = history;
  }
  const region = input.region ?? before.region;
  const status = input.licenseStatus ?? before.licenseStatus;
  if (input.region !== undefined || input.licenseStatus !== undefined) data.licenseLight = await lightFor(region, status);

  const property = await prisma.property.update({ where: { id }, data });
  await audit({ userId: user.id, action: "PROPERTY_UPDATE", entity: "Property", entityId: id, meta: { fields: Object.keys(input) } });
  const matching = await runMatchingForProperty(id);
  return { property, matching };
}

/** Verfügbarkeit setzen (Konzept §8.20); verkauft/zurückgezogen schließt offene Treffer. */
export async function setAvailability(id: string, availability: Availability, user: SessionUser) {
  await prisma.property.update({ where: { id }, data: { availability } });
  await audit({ userId: user.id, action: "PROPERTY_UPDATE", entity: "Property", entityId: id, meta: { availability } });
  if (availability === "VERKAUFT" || availability === "ZURUECKGEZOGEN") {
    return closeMatchesForProperty(id, availability === "VERKAUFT" ? "Objekt verkauft" : "Objekt zurückgezogen", user);
  }
  await runMatchingForProperty(id);
  return 0;
}

/** Verkäuferkontakt (Lead VERKAEUFER) als Off-Market-Objekt anlegen (Konzept §8.10). */
export async function createPropertyFromSellerLead(leadId: string, user: SessionUser, input: Pick<PropertyInput, "title" | "segment" | "country" | "region" | "price" | "units" | "locality">) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.role !== "VERKAEUFER") throw new Error("Nur Verkäufer-Kontakte werden zu Off-Market-Objekten");
  return createProperty(
    {
      ...input,
      licenseStatus: "UNKLAR",
      features: [],
      source: "DIREKT",
      sourceDetail: `Verkäuferkontakt ${lead.name}${lead.sourceDetail ? ` (${lead.sourceDetail})` : ""}`,
      knownSince: lead.createdAt,
      knownSourceNote: `Verkäuferkontakt ${lead.name}, erfasst am ${lead.createdAt.toLocaleDateString("de-DE")}`,
      sellerLeadId: lead.id,
      offmarket: true,
      referrerId: lead.referrerId,
      description: lead.interest,
    },
    user,
  );
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  VERFUEGBAR: "verfügbar",
  RESERVIERT: "reserviert",
  VERKAUFT: "verkauft",
  ZURUECKGEZOGEN: "zurückgezogen",
};
